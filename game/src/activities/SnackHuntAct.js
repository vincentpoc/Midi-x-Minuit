// ============================================================
//  SnackHuntAct — La chasse aux goûters (chapitre 3, remplace les bulles).
//    Scène en plein écran. Midi se sert de Long-chat comme lance-chat pour attraper
//    ses goûters en haut de l'armoire. Mi-jeu de mémoire, mi-quiz rapide.
//
//    1. En bas : Midi (à gauche) dit le calcul dans une grande bulle ; Long-chat au milieu.
//    2. On touche l'écran : Midi saute, s'accroche aux pattes de Long-chat, l'étire… SCHLAC !
//    3. Le vol : la caméra suit Long-chat. Il dépasse la bulle du calcul (il faut s'en souvenir).
//    4. En haut : 4 boîtes avec 4 résultats ; on a le temps de l'élan pour en toucher une.
//       Il tend le bras, l'attrape, retombe et atterrit comme un ressort.
//    5. Il ouvre la boîte : bonne réponse = un cookie ; mauvaise = un ingrédient
//       (et une fois, Chat-boîte, qui adore les boîtes).
//    Pas de boîte touchée à temps : ce n'est pas une erreur, Midi le relance.
//    Mauvaise boîte : une vie en moins, la bonne boîte brille en vert, Minuit dit la correction.
//  questions = [{ t, k }]
//  Les hooks viennent de StoryScene (voir hooks() dans StoryScene.js).
// ============================================================

RM.HUNT = {
  worldH: 3400, // hauteur de l'armoire et du mur (le monde que la caméra parcourt)
  upTime: 1500, // ms de montée (ralentit à la fin : l'élan)
  hangTime: 1700, // ms en haut, presque immobile
  downTime: 1000, // ms de chute
  pickFrom: 650, // ms après le décollage : les boîtes deviennent touchables
};

RM.SnackHuntAct = class
{
  constructor(scene, questions, ings, client, hooks, lines)
  {
    this.scene = scene;
    this.hooks = hooks;
    this.ings = ings;
    this.client = client;
    this.L = lines || {};
    this.root = scene.add.container(0, 0).setDepth(20);

    const W = RM.W,
      H = RM.H,
      WH = RM.HUNT.worldH;

    this.floor = WH - 160; // le sol (pieds des personnages), dans le monde
    this.boxY = 470; // les boîtes, sur le haut de l'armoire
    this.bottomScroll = WH - H;

    this.qs = questions.map((f) =>
    {
      const ab = Math.random() < 0.5;

      return {
        t: f.t,
        k: f.k,
        kind: ab ? 'ab' : 'ba',
        text: ab ? `${f.t} × ${f.k}` : `${f.k} × ${f.t}`,
        answer: f.t * f.k,
      };
    });

    this.total = this.qs.length;
    this.n = 0;
    this.boxcatSeen = false;

    // le monde qui défile (la caméra ne bouge pas : c'est le monde qui monte et descend)
    this.world = scene.add.container(0, -this.bottomScroll);
    this.root.add(this.world);
    this.buildWorld();

    // par-dessus le monde : progression, consignes, dialogues
    this.prog = RM.text(scene, W - 30, 120, '', 28, RM.C.cream, {
      stroke: '#1d1428',
      strokeThickness: 5,
    }).setOrigin(1, 0.5);

    this.hint = RM.text(scene, W / 2, 1225, '', 30, RM.C.cream, {
      stroke: '#1d1428',
      strokeThickness: 6,
    });

    this.speech = scene.add.container(0, 0);
    this.root.add([this.prog, this.hint, this.speech]);

    // toucher l'écran : lancer (les boîtes ont leur propre zone, au-dessus)
    this.tapZone = scene.add.zone(W / 2, H / 2, W, H).setInteractive();
    this.tapZone.on('pointerup', () => this.onTap());
    this.root.add(this.tapZone);
    this.world.bringToTop(this.boxes);
    this.root.bringToTop(this.world);
    this.root.bringToTop(this.prog);
    this.root.bringToTop(this.hint);
    this.root.bringToTop(this.speech);

    this.hooks.setMain(null);
    scene.time.delayedCall(400, () => this.nextQ());
  }

  // ---------- le décor ----------
  buildWorld()
  {
    const s = this.scene,
      W = RM.W,
      WH = RM.HUNT.worldH,
      F = this.floor,
      Wd = this.world;

    // le mur de la boutique, de plus en plus sombre vers le plafond
    const wall = s.add.graphics();

    wall.fillGradientStyle(0x1d1428, 0x1d1428, 0x4a3560, 0x4a3560, 1);
    wall.fillRect(0, 0, W, WH);
    Wd.add(wall);

    // en bas : la boutique
    Wd.add(s.add.image(W / 2, WH - RM.H / 2, 'bg_shop').setScale(3).setAlpha(0.55));

    // l'armoire
    const ax = 70,
      aw = W - 140,
      top = 560;

    const g = s.add.graphics();

    g.fillStyle(0x4a2c1d, 1).fillRect(ax, top, aw, F - top);
    g.fillStyle(0x6b4430, 1).fillRect(ax + 16, top, aw - 32, F - top);

    // le bois flou du milieu : de longues traînées (l'illusion de vitesse)
    for (let i = 0; i < 46; i++)
    {
      const x = ax + 24 + Math.random() * (aw - 48);
      const y = top + 300 + Math.random() * (F - top - 1200);
      const h = 300 + Math.random() * 700;

      g.fillStyle(Math.random() < 0.5 ? 0x8a5a3c : 0x4f3122, 0.35 + Math.random() * 0.4);
      g.fillRect(x, y, 3 + Math.random() * 6, h);
    }

    // en bas : les portes, les poignées et les pieds
    const dTop = F - 640;

    g.lineStyle(6, 0x3f271b, 1).strokeRect(ax + 34, dTop, aw / 2 - 44, 560);
    g.strokeRect(W / 2 + 10, dTop, aw / 2 - 44, 560);
    g.fillStyle(RM.C.gold, 1).fillCircle(W / 2 - 30, dTop + 280, 10).fillCircle(W / 2 + 30, dTop + 280, 10);
    g.fillStyle(0x3f271b, 1).fillRect(ax + 10, F - 20, 50, 30).fillRect(ax + aw - 60, F - 20, 50, 30);

    // en haut : la corniche
    g.fillStyle(0x3f271b, 1).fillRect(ax - 24, top - 30, aw + 48, 44);
    g.fillStyle(0x8a5a3c, 1).fillRect(ax - 18, top - 26, aw + 36, 12);

    // le sol
    g.fillStyle(0x2a1b38, 1).fillRect(0, F, W, WH - F);
    Wd.add(g);

    // la lune par la fenêtre, tout en haut
    Wd.add(s.add.circle(560, 290, 60, 0xfff1b8, 0.9));
    Wd.add(s.add.circle(585, 275, 52, 0x2a1d3d, 1));

    // les personnages
    this.shadowM = s.add.ellipse(170, F, 130, 22, 0x000000, 0.3);
    this.shadowC = s.add.ellipse(380, F, 110, 20, 0x000000, 0.3);
    this.gum = s.add.ellipse(380, F, 110, 26, 0xff7eb6, 1);
    Wd.add([this.shadowM, this.shadowC, this.gum]);

    this.minuit = s.add.sprite(610, F, 'witch_idle').setOrigin(0.5, 0.95).setScale(2.6).play('witch_idle').setFlipX(true);
    this.midi = s.add.sprite(170, F, 'midi_idle').setOrigin(0.5, 0.95).setScale(3.4).play('midi_idle');
    this.cat = s.add.sprite(380, F, 'longchat', 1).setOrigin(0.5, 1).setScale(3);
    this.arm = s.add.graphics();
    Wd.add([this.minuit, this.cat, this.arm, this.midi]);

    // la bulle du calcul (dans le monde : Long-chat la dépasse en montant)
    this.qBubble = s.add.container(W / 2 - 40, F - 820);
    Wd.add(this.qBubble);

    this.boxes = s.add.container(0, 0);
    Wd.add(this.boxes);
  }

  // Le monde défile pour que la hauteur y soit à l'écran à la hauteur screenY
  follow(y, screenY = 700)
  {
    const scroll = Phaser.Math.Clamp(y - screenY, 0, this.bottomScroll);

    this.world.y = -scroll;
  }

  // ---------- dialogues dans la scène ----------
  say(who, text, ms = 2600)
  {
    const s = this.scene;

    this.speech.removeAll(true);

    const x = { midi: 220, minuit: 540, client: RM.W / 2, boxcat: RM.W / 2 }[who] || RM.W / 2;

    const t = RM.text(s, 0, 0, text, 30, RM.C.ink, {
      backgroundColor: '#fffaf0',
      padding: { x: 14, y: 8 },
      wordWrap: { width: 420 },
      align: 'center',
    });

    t.setPosition(Phaser.Math.Clamp(x, 30 + t.width / 2, RM.W - 30 - t.width / 2), 790);
    this.speech.add(t);
    t.setScale(0.8);
    s.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });

    if (this.speechTimer)
    {
      this.speechTimer.remove();
    }

    if (ms)
    {
      this.speechTimer = s.time.delayedCall(ms, () => this.speech.removeAll(true));
    }
  }

  // ---------- une question ----------
  nextQ(again = false)
  {
    if (this.dead)
    {
      return;
    }

    if (!again)
    {
      if (!this.qs.length)
      {
        this.finish();
        return;
      }

      this.q = this.qs.shift();
      this.n++;
    }

    this.prog.setText(`${this.n}/${this.total}`);
    this.follow(this.floor, 1130);
    this.makeBoxes();
    this.showCalc();

    if (this.n === 1 && !again)
    {
      this.hint.setText(this.L.tapHint || '');
    }

    this.state = 'aim';
  }

  // La grande bulle de Midi : « Prends la boîte de 5 × 3 ! »
  showCalc()
  {
    const s = this.scene,
      B = this.qBubble;

    B.removeAll(true);

    const g = s.add.graphics();

    g.fillStyle(0xfffaf0, 1).fillRoundedRect(-230, -110, 460, 220, 34);
    g.fillTriangle(-150, 100, -100, 100, -200, 200);
    g.lineStyle(4, RM.C.inkHex, 0.25).strokeRoundedRect(-230, -110, 460, 220, 34);
    B.add(g);
    B.add(RM.text(s, 0, -60, this.L.ask || 'Prends la boîte de', 30, RM.C.ink));
    B.add(RM.text(s, 0, 25, `${this.q.text} !`, 86, '#45306e', { fontFamily: RM.FONT_NB }));
    B.setScale(0);
    s.tweens.add({ targets: B, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  // Les 4 boîtes sur l'armoire : la bonne et 3 erreurs typiques (l'autre table, un de plus, un de moins)
  makeBoxes()
  {
    const s = this.scene,
      q = this.q;

    this.boxes.removeAll(true);

    const other = q.t === 5 ? 10 : 5;
    const cand = [other * q.k, q.t * (q.k + 1), q.t * (q.k - 1), q.t * (q.k + 2), q.t * (q.k - 2), q.answer + 1];
    const wrong = [...new Set(cand)].filter((v) => v > 0 && v !== q.answer).slice(0, 3);
    const vals = RM.shuffle([q.answer, ...wrong]);

    this.boxList = vals.map((v, i) =>
    {
      const x = 130 + i * 153,
        y = this.boxY;

      const c = s.add.container(x, y);
      const g = s.add.graphics();

      g.fillStyle(0x8a5a2b, 1).fillRect(-60, -46, 120, 92);
      g.fillStyle(0xc28a4e, 1).fillRect(-54, -40, 108, 80);
      g.fillStyle(0x8a5a2b, 1).fillRect(-64, -56, 128, 18); // le couvercle
      g.fillStyle(0xe8d29a, 1).fillRect(-8, -56, 16, 102); // le ruban

      const glow = s.add.rectangle(0, 0, 150, 130, RM.CORR_GREEN, 0).setStrokeStyle(8, RM.CORR_GREEN, 0);
      const label = RM.text(s, 0, 8, String(v), 48, RM.C.ink, {
        fontFamily: RM.FONT_NB,
        stroke: '#fff6e6',
        strokeThickness: 6,
      });

      c.add([glow, g, label]);
      c.setSize(150, 140);
      c.setInteractive({ useHandCursor: true });
      c.on('pointerup', (p, lx, ly, ev) =>
      {
        if (ev)
        {
          ev.stopPropagation();
        }

        this.pick(c);
      });

      c.value = v;
      c.glow = glow;
      c.home = { x, y };
      this.boxes.add(c);
      return c;
    });
  }

  // ---------- le lancer ----------
  onTap()
  {
    if (this.state !== 'aim')
    {
      if (this.state === 'wait' && this.tapCb)
      {
        const cb = this.tapCb;

        this.tapCb = null;
        cb();
      }

      return;
    }

    this.state = 'launch';
    this.hint.setText('');
    this.speech.removeAll(true);
    this.launch();
  }

  // Midi saute, s'accroche aux pattes de Long-chat, l'étire… SCHLAC !
  launch()
  {
    const s = this.scene,
      m = this.midi,
      c = this.cat,
      F = this.floor;

    const top = () => c.y - c.displayHeight; // le bout de ses pattes

    s.tweens.chain({
      tweens: [
        // Midi saute et s'accroche
        { targets: m, x: c.x - 10, y: top() + 60, duration: 380, ease: 'Quad.easeOut' },
        // il tire vers le haut : Long-chat s'étire (ses pieds restent collés)
        {
          targets: [c],
          scaleY: 4.4,
          duration: 520,
          ease: 'Sine.easeIn',
          onUpdate: () => (m.y = top() + 60),
        },
      ],
      onComplete: () =>
      {
        if (this.dead)
        {
          return;
        }

        // SCHLAC : Midi lâche et retombe, Long-chat décolle
        this.pow(c.x, F - 380, 'SCHLAC !');
        RM.Sfx.pop();
        s.tweens.add({ targets: m, x: 170, y: F, duration: 600, ease: 'Bounce.easeOut' });
        s.tweens.add({ targets: c, scaleY: 3, duration: 160, ease: 'Back.easeOut' });
        this.fly();
      },
    });
  }

  // Le vol : la montée (qui ralentit), un moment en haut, puis la chute
  fly()
  {
    const s = this.scene,
      c = this.cat,
      H = RM.HUNT;

    const apex = this.boxY + 330; // ses pieds, en haut
    const o = { y: this.floor };

    this.state = 'fly';
    this.grabbed = null;
    this.canPick = false;

    s.time.delayedCall(H.pickFrom, () =>
    {
      if (this.state === 'fly')
      {
        this.canPick = true;

        if (this.n === 1)
        {
          this.hint.setText(this.L.pickHint || '');
        }
      }
    });

    this.flyTw = s.tweens.chain({
      tweens: [
        {
          targets: o,
          y: apex,
          duration: H.upTime,
          ease: 'Cubic.easeOut',
          onUpdate: () => this.place(o.y),
        },
        {
          targets: o,
          y: apex + 40,
          duration: H.hangTime,
          ease: 'Sine.easeInOut',
          onUpdate: () => this.place(o.y),
        },
      ],
      onComplete: () => this.fall(),
    });
  }

  // Long-chat à la hauteur y (ses pieds) ; la caméra le suit ; la boîte attrapée le suit
  place(y)
  {
    const c = this.cat;

    c.y = y;
    this.follow(y - c.displayHeight / 2, 760);

    if (this.grabbed)
    {
      this.grabbed.setPosition(c.x + 46, y - c.displayHeight + 20);
    }
  }

  // Le joueur touche une boîte
  pick(box)
  {
    if (this.state !== 'fly' || !this.canPick || this.grabbed)
    {
      return;
    }

    const s = this.scene,
      c = this.cat;

    this.state = 'grab';
    this.canPick = false;
    this.hint.setText('');
    RM.Sfx.tap();

    // il tend le bras jusqu'à la boîte
    const hand = { x: c.x + 20, y: c.y - c.displayHeight + 20 };
    const p = { t: 0 };

    s.tweens.add({
      targets: p,
      t: 1,
      duration: 200,
      yoyo: true,
      hold: 60,
      onUpdate: () =>
      {
        const hx = hand.x + (box.x - hand.x) * p.t,
          hy = hand.y + (box.y - hand.y) * p.t;

        this.arm.clear();
        this.arm.lineStyle(18, 0x15121a, 1).lineBetween(hand.x, hand.y, hx, hy);
        this.arm.fillStyle(0xffffff, 1).fillCircle(hx, hy, 12);
      },
      onYoyo: () =>
      {
        this.grabbed = box;
        box.disableInteractive();
        s.tweens.add({ targets: box, x: hand.x + 26, y: hand.y, scale: 0.8, duration: 200 });
      },
      onComplete: () =>
      {
        this.arm.clear();
        this.fall();
      },
    });

    // mauvaise boîte : la bonne brille en vert tout de suite
    if (box.value !== this.q.answer)
    {
      const good = this.boxList.find((b) => b.value === this.q.answer);

      if (good)
      {
        good.glow.setFillStyle(RM.CORR_GREEN, 0.35).setStrokeStyle(8, RM.CORR_GREEN, 1);
        s.tweens.add({ targets: good.glow, alpha: 0.3, duration: 220, yoyo: true, repeat: 4 });
      }
    }
  }

  // La chute, puis l'atterrissage en ressort
  fall()
  {
    if (this.falling || this.dead)
    {
      return;
    }

    this.falling = true;

    const s = this.scene,
      c = this.cat;

    if (this.flyTw)
    {
      this.flyTw.stop();
    }

    this.canPick = false;
    this.state = 'fall';

    const o = { y: c.y };

    if (this.grabbed)
    {
      this.grabbed.setScale(0.8);
    }

    s.tweens.add({
      targets: o,
      y: this.floor,
      duration: RM.HUNT.downTime,
      ease: 'Quad.easeIn',
      onUpdate: () => this.place(o.y),
      onComplete: () =>
      {
        this.falling = false;
        RM.Sfx.tap();

        // le ressort
        s.tweens.add({
          targets: c,
          scaleY: { from: 1.8, to: 3 },
          duration: 520,
          ease: 'Elastic.easeOut',
          easeParams: [1.2, 0.35],
        });

        s.time.delayedCall(450, () => this.landed());
      },
    });
  }

  // Il a atterri : il ouvre la boîte (ou il n'a rien attrapé)
  landed()
  {
    if (this.dead)
    {
      return;
    }

    const s = this.scene,
      q = this.q,
      box = this.grabbed;

    // rien attrapé : ce n'est pas une erreur, on relance
    if (!box)
    {
      this.say('midi', this.L.missed || 'Raté ! On recommence !');
      s.time.delayedCall(1500, () => this.nextQ(true));
      return;
    }

    const ok = box.value === q.answer;

    RM.Progress.record(q.t, q.k, ok, q.kind);

    // la boîte s'ouvre devant Long-chat
    const bx = this.cat.x + 110,
      by = this.floor - 50;

    s.tweens.add({ targets: box, x: bx, y: by, scale: 0.9, duration: 220 });
    s.time.delayedCall(260, () => this.open(box, ok, bx, by));
  }

  // Ce qui sort de la boîte
  open(box, ok, x, y)
  {
    const s = this.scene,
      q = this.q;

    if (this.dead)
    {
      return;
    }

    RM.Sfx.pop();
    box.list[1].clear().fillStyle(0x8a5a2b, 1).fillRect(-60, -46, 120, 92).fillStyle(0x5a3a1b, 1).fillRect(-54, -40, 108, 30);

    let thing;

    if (ok)
    {
      thing = s.add.image(x, y - 40, 'cookies').setScale(4);
    }
    else if (!this.boxcatSeen && s.textures.exists('boxcat'))
    {
      this.boxcatSeen = true;
      thing = s.add.sprite(x, y - 30, 'boxcat', 0).setOrigin(0.5, 1).setScale(3.2);

      if (s.anims.exists('boxcat_idle'))
      {
        thing.play('boxcat_idle');
      }
    }
    else
    {
      thing = RM.icon(s, x, y - 40, RM.pick(this.ings).sprite, 80);
    }

    this.world.add(thing);
    s.tweens.add({ targets: thing, y: thing.y - 90, duration: 380, ease: 'Back.easeOut' });

    const next = () =>
    {
      if (this.dead)
      {
        return;
      }

      thing.destroy();
      box.destroy();
      this.grabbed = null;
      this.speech.removeAll(true);
      this.nextQ();
    };

    if (ok)
    {
      RM.Sfx.good();
      RM.sparkle(s, x, 700, RM.C.gold, 16);
      this.say('midi', RM.pick(this.L.good || ['Mon goûter !']));
      s.time.delayedCall(1700, next);
      return;
    }

    RM.Sfx.bad();
    this.hooks.error();

    if (this.hooks.remember)
    {
      this.hooks.remember(q.text, q.answer); // rappel à la fin
    }

    const isBoxcat = thing.texture && thing.texture.key === 'boxcat';

    this.say(isBoxcat ? 'boxcat' : 'midi', isBoxcat ? this.L.boxcat : RM.pick(this.L.bad || ['Beurk !']), 1500);

    // la correction, dite par Minuit ; on touche l'écran pour continuer
    s.time.delayedCall(1500, () =>
    {
      if (this.dead)
      {
        return;
      }

      this.say('minuit', `${RM.STORY.correction.title} ${q.text} = ${q.answer}`, 0);
      RM.Sfx.pop();

      s.time.delayedCall(1500, () =>
      {
        this.state = 'wait';
        this.tapCb = next;
      });
    });
  }

  // Un mot de bande dessinée, dans le monde
  pow(x, y, word)
  {
    const s = this.scene;

    const t = s.add
      .text(x, y, word, {
        fontFamily: RM.FONT_BD,
        fontSize: '72px',
        color: '#e8590c',
        stroke: '#3b2a4a',
        strokeThickness: 9,
      })
      .setOrigin(0.5)
      .setAngle(-8)
      .setScale(0.3);

    this.world.add(t);
    s.tweens.add({ targets: t, scale: 1, duration: 170, ease: 'Back.easeOut' });
    s.tweens.add({ targets: t, alpha: 0, delay: 700, duration: 300, onComplete: () => t.destroy() });
  }

  // Toutes les questions sont faites. Si Chat-boîte n'est pas encore venu : une dernière boîte, pour lui.
  finish()
  {
    const s = this.scene;

    this.state = 'done';
    this.prog.setText('');
    this.qBubble.removeAll(true);
    this.boxes.removeAll(true);

    const bravo = () =>
    {
      RM.Sfx.good();
      RM.sparkle(s, RM.W / 2, 600, RM.C.gold, 20);
      this.say('minuit', RM.pick(RM.STORY.minuit.celebrate));
      s.time.delayedCall(1600, () => !this.dead && this.hooks.done({}));
    };

    if (this.boxcatSeen || !s.textures.exists('boxcat'))
    {
      bravo();
      return;
    }

    // une boîte tombe de l'armoire… Chat-boîte en sort
    this.boxcatSeen = true;

    const x = 560,
      y = this.floor - 50;

    const box = s.add.container(x, y - 900);
    const g = s.add.graphics();

    g.fillStyle(0x8a5a2b, 1).fillRect(-60, -46, 120, 92);
    g.fillStyle(0xc28a4e, 1).fillRect(-54, -40, 108, 80);
    box.add(g);
    this.world.add(box);

    s.tweens.add({
      targets: box,
      y,
      duration: 700,
      ease: 'Bounce.easeOut',
      onComplete: () =>
      {
        if (this.dead)
        {
          return;
        }

        const bc = s.add.sprite(x, y - 30, 'boxcat', 0).setOrigin(0.5, 1).setScale(3.2);

        if (s.anims.exists('boxcat_idle'))
        {
          bc.play('boxcat_idle');
        }

        this.world.add(bc);
        RM.Sfx.pop();
        s.tweens.add({ targets: bc, y: bc.y - 70, duration: 360, ease: 'Back.easeOut' });
        this.say('boxcat', this.L.boxcatEnd || '', 2200);
        s.time.delayedCall(2400, bravo);
      },
    });
  }

  destroy()
  {
    this.dead = true;

    if (this.speechTimer)
    {
      this.speechTimer.remove();
    }

    this.root.destroy();
  }
};
