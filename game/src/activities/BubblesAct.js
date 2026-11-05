// ============================================================
//  BubblesAct — Mélanger : une scène en plein écran (décor du chaudron).
//    Bulles d'ingrédients qui tournent, avec des nombres droits.
//    3 petits multiples, 3 grands, puis 3 divisions (questions avec div: true).
//    Bulles-pièges = le goûter de Midi (pas de nombre, plus rapides).
//    Les toucher ne compte PAS comme une erreur et n'arrête pas la question.
//    Le tout dernier calcul a toujours une bulle-piège.
//    Une bulle touchée : son contenu tombe dans la potion (fumée verte, rouge sombre ou grise).
//    Mauvaise réponse : la bonne s'affiche dans la question (pas de fenêtre de correction).
//    Q1 : une bulle-goûter monte → Midi crie « Mon goûter ! » et part en courant après.
//    Dernière multiplication : Midi est dans une bulle (à la place d'une bulle-piège).
//    2e division : le client est dans une bulle.
//  Les hooks viennent de StoryScene (voir hooks() dans StoryScene.js).
// ============================================================

RM.BubblesAct = class
{
  // questions = [{ t, k }], ings = ingrédients, snacks = goûters de Midi
  constructor(scene, questions, ings, snacks, client, hooks)
  {
    this.scene = scene;
    this.hooks = hooks;
    this.client = client;
    this.ings = ings;
    this.snacks = snacks;

    const W = RM.W,
      H = RM.H,
      s = scene;

    this.A = { x: 0, top: 230, bottom: 960 };
    this.root = s.add.container(0, 0).setDepth(20);

    // les multiplications d'abord, puis les divisions (Minuit annonce le changement)
    const mul = (f) =>
    {
      const ab = Math.random() < 0.5; // « t × k » ou « k × t » (une étoile chacune dans le grimoire)

      return {
        t: f.t,
        k: f.k,
        kind: ab ? 'ab' : 'ba',
        text: ab ? `${f.t} × ${f.k}` : `${f.k} × ${f.t}`,
        answer: f.t * f.k,
      };
    };

    const div = (f) => ({
      t: f.t,
      k: f.k,
      kind: 'div',
      text: `${f.t * f.k} ÷ ${f.t}`,
      answer: f.k,
      div: true,
    });

    this.mulQ = questions.filter((f) => !f.div).map(mul);
    this.divQ = questions.filter((f) => f.div).map(div);
    this.divAnnounced = false;
    this.total = questions.length;
    this.n = 0;
    this.midiShown = false; // Midi dans une bulle : la dernière multiplication
    this.divCount = 0; // le client dans une bulle : la 2e division
    this.midiGone = false;
    this.bubbles = [];
    this.requeued = new Set();

    // décor
    this.root.add(
      s.add
        .image(W / 2, H / 2, 'bg_cauldron')
        .setScale(3)
        .setInteractive(),
    );

    this.root.add(s.add.rectangle(W / 2, H / 2, W, H, 0x120a1c, 0.35));
    this.root.add(s.add.ellipse(110, 1238, 130, 22, 0x000000, 0.3));

    this.minuit = s.add
      .sprite(110, 1244, 'witch_idle')
      .setOrigin(0.5, 0.95)
      .setScale(3)
      .play('witch_idle');

    this.midi = s.add
      .sprite(610, 1244, 'midi_idle')
      .setOrigin(0.5, 0.95)
      .setScale(3.75)
      .play('midi_idle')
      .setFlipX(true);

    this.root.add([this.minuit, this.midi]);

    // la question
    const band = s.add.graphics();

    band.fillStyle(RM.C.parchment, 1).fillRoundedRect(W / 2 - 210, 100, 420, 110, 26);
    band.lineStyle(4, RM.C.wood, 0.8).strokeRoundedRect(W / 2 - 210, 100, 420, 110, 26);
    this.root.add(band);
    this.qText = RM.text(s, W / 2, 155, '', 64, RM.C.ink);

    this.prog = RM.text(s, W - 30, 155, '', 28, RM.C.cream, {
      stroke: '#1d1428',
      strokeThickness: 5,
    }).setOrigin(1, 0.5);

    this.root.add([this.qText, this.prog]);
    this.layer = s.add.container(0, 0);
    this.root.add(this.layer);
    this.fall = s.add.container(0, 0); // ce qui tombe dans la potion (et sa fumée)
    this.root.add(this.fall);
    this.speech = s.add.container(0, 0);
    this.root.add(this.speech);
    this.hooks.setMain(null);
    s.time.delayedCall(500, () => this.nextQ());
  }

  // petite bulle de dialogue au-dessus d'un personnage (Minuit à gauche, Midi à droite)
  say(who, text)
  {
    const s = this.scene;

    this.speech.removeAll(true);

    const left = who === 'minuit';

    const t = RM.text(s, 0, 0, text, 30, RM.C.ink, {
      backgroundColor: '#fffaf0',
      padding: { x: 14, y: 8 },
      wordWrap: { width: 380 },
      align: 'center',
    });

    t.setPosition(
      left ? Math.max(30 + t.width / 2, 110) : Math.min(RM.W - 30 - t.width / 2, 610),
      990,
    );

    this.speech.add(t);
    t.setScale(0.8);
    s.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });

    if (this.speechTimer)
    {
      this.speechTimer.remove();
    }

    this.speechTimer = s.time.delayedCall(2600, () => this.speech.removeAll(true));
  }

  // Deux mauvaises réponses pour la question q
  distractors(q)
  {
    const a = q.answer;
    const c = q.div ? [a + 1, a - 1, a + 2, a - 2] : [a + q.t, a - q.t, a + 1, a - 1, a + 10];

    // sans doublons (table de 10 : a + t = a + 10)
    return RM.shuffle([...new Set(c)])
      .filter((v) => v > 0 && v !== a)
      .slice(0, 2);
  }

  // La question suivante : les multiplications, l'annonce des divisions, puis les divisions.
  // C'est ici qu'on choisit quelle bulle-piège accompagne la question.
  nextQ()
  {
    if (this.dead)
    {
      return;
    }

    if (!this.mulQ.length && !this.divQ.length)
    {
      this.finish();
      return;
    }

    // fin des multiplications : Minuit annonce les divisions
    if (!this.mulQ.length && !this.divAnnounced)
    {
      this.divAnnounced = true;
      this.qText.setText('÷ ÷ ÷').setColor(RM.BAD);
      this.say('minuit', RM.STORY.steps.melange.divide);

      if (this.speechTimer)
      {
        this.speechTimer.remove();
      }

      this.speechTimer = this.scene.time.delayedCall(3600, () => this.speech.removeAll(true));
      this.scene.time.delayedCall(3200, () => this.nextQ());
      return;
    }

    const inMul = this.mulQ.length > 0;

    this.q = inMul ? this.mulQ.shift() : this.divQ.shift();

    const midiNow = inMul && !this.mulQ.length && !this.midiShown; // dernière multiplication

    if (!inMul)
    {
      this.divCount++;
    }

    const clientNow = !inMul && this.divCount === 2;
    const lastQ = !this.mulQ.length && !this.divQ.length; // le tout dernier calcul : toujours une bulle-piège

    this.n++;
    this.answered = false;
    this.qText.setText(`${this.q.text} = ?`).setColor(RM.C.ink);
    this.prog.setText(`${Math.min(this.n, this.total)}/${this.total}`);

    const lanes = RM.shuffle([130, 290, 450, 600]);
    const y0 = this.A.bottom;
    const vals = RM.shuffle([this.q.answer, ...this.distractors(this.q)]);

    // vitesses (ms pour monter) : bulles normales, bulles-bombes
    const SLOW = 8600,
      FAST = 6400;

    this.bubbles = vals.map((v, i) =>
      this.makeBubble(lanes[i], y0, { value: v, ing: RM.pick(this.ings) }, SLOW, i * 220),
    );

    if (midiNow)
    {
      this.midiShown = true;
      this.bubbles.push(this.makeBubble(lanes[3], y0, { bomb: true, midi: true }, FAST, 500));
      this.scene.time.delayedCall(700, () => this.say('midi', RM.STORY.steps.melange.midiBubble));
    }
    else if (clientNow && this.client)
    {
      this.bubbles.push(
        this.makeBubble(lanes[3], y0, { bomb: true, client: this.client }, FAST, 500),
      );

      this.scene.time.delayedCall(700, () =>
        this.say(
          'client',
          RM.fmt(RM.STORY.steps.melange.clientBubble, { client: this.client.name }),
        ),
      );
    }
    else if (this.n === 1 || lastQ || Math.random() < RM.BOMB_CHANCE)
    {
      this.bubbles.push(
        this.makeBubble(lanes[3], y0, { bomb: true, snack: RM.pick(this.snacks) }, FAST, 600),
      );

      // la première bulle-goûter : Midi la voit monter et part en courant après (« Mon goûter ! »)
      if (!this.midiGone)
      {
        this.scene.time.delayedCall(1100, () =>
        {
          if (!this.dead && !this.midiGone)
          {
            this.midiChase();
          }
        });
      }
    }
  }

  // Toutes les questions sont faites : les bravos ici, dans la scène des bulles
  // (avant, ils arrivaient en retard, dans la boutique, pendant le dialogue de fin)
  finish()
  {
    const s = this.scene;

    this.qText.setText('');
    RM.Sfx.good();
    RM.sparkle(s, RM.W / 2, 560, RM.C.gold, 20);
    this.say('minuit', RM.pick(RM.STORY.minuit.celebrate));

    s.time.delayedCall(1500, () =>
    {
      if (!this.dead)
      {
        this.hooks.done({});
      }
    });
  }

  // Midi crie « Mon goûter ! » et sort de l'écran en courant
  midiChase()
  {
    this.midiGone = true;
    this.say('midi', RM.STORY.steps.melange.midiChase);

    const s = this.scene;

    s.tweens.add({ targets: this.midi, y: this.midi.y - 40, duration: 160, yoyo: true });

    s.tweens.add({
      targets: this.midi,
      x: RM.W + 140,
      delay: 350,
      duration: 900,
      ease: 'Quad.easeIn',
    });
  }

  // Crée une bulle qui monte.
  // d = { value, ing } pour une réponse, ou { bomb, snack | midi | client } pour une bulle-piège
  makeBubble(x, y, d, dur, delay)
  {
    const s = this.scene;
    const c = s.add.container(x, y);
    const g = s.add.graphics();
    const col = d.bomb ? 0xffc2c2 : 0xbff5c9;

    g.fillStyle(col, 0.55).fillCircle(0, 0, 72);
    g.lineStyle(5, 0xffffff, 0.85).strokeCircle(0, 0, 72);
    g.fillStyle(0xffffff, 0.7).fillCircle(-28, -34, 11);
    c.add(g);

    let spin = null;

    if (d.midi)
    {
      spin = s.add.sprite(0, 8, 'midi_idle', 0).setScale(1.9).play('midi_idle');
    }
    else if (d.client)
    {
      const lk = d.client.look;

      spin = s.add.sprite(0, 4, lk.sprite, 0).setScale(lk.scale * 0.64);

      if (s.anims.exists(`${lk.sprite}_idle`))
      {
        spin.play(`${lk.sprite}_idle`);
      }
    }
    else if (d.bomb)
    {
      spin = RM.icon(s, 0, 0, d.snack.sprite, 72);
    }
    else
    {
      spin = RM.icon(s, 0, -26, d.ing.sprite, 46);
    }

    c.add(spin);

    // tout ce qui est dans les bulles tourne sur soi-même (Midi et le client aussi) ; les nombres restent droits
    s.tweens.add({
      targets: spin,
      angle: 360,
      duration: Phaser.Math.Between(1800, 2600),
      repeat: -1,
    });

    if (!d.bomb)
    {
      c.add(
        RM.text(s, 0, 30, String(d.value), 50, RM.C.ink, { stroke: '#ffffff', strokeThickness: 7 }),
      );
    }

    c.d = d;
    c.spin = spin;
    c.setSize(144, 144);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => this.onPick(c));
    c.setScale(0.2);
    this.layer.add(c);
    s.tweens.add({ targets: c, scale: 1, duration: 280, delay, ease: 'Back.easeOut' });

    s.tweens.add({
      targets: c,
      y: this.A.top,
      duration: dur,
      delay,
      ease: 'Sine.easeIn',

      onComplete: () =>
      {
        if (!d.bomb)
        {
          this.onTimeout();
        }
        else
        {
          this.popOne(c);
        }
      },
    });

    s.tweens.add({
      targets: c,
      x: x + Phaser.Math.Between(-25, 25),
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return c;
  }

  // Fait disparaître une bulle
  popOne(b)
  {
    if (!b.active)
    {
      return;
    }

    this.scene.tweens.killTweensOf(b);

    if (b.spin)
    {
      this.scene.tweens.killTweensOf(b.spin);
    }

    this.scene.tweens.add({
      targets: b,
      alpha: 0,
      scale: 0.4,
      duration: 200,
      onComplete: () => b.destroy(),
    });
  }

  // Fait disparaître toutes les bulles, sauf except
  clearAll(except)
  {
    this.bubbles.forEach((b) =>
    {
      if (b !== except)
      {
        this.popOne(b);
      }
    });
  }

  // On touche une bulle : piège (sans effet sur le score), bonne ou mauvaise réponse
  onPick(b)
  {
    if (this.answered || this.dead)
    {
      return;
    }

    const d = b.d,
      q = this.q,
      s = this.scene;

    s.tweens.killTweensOf(b);

    if (b.spin)
    {
      s.tweens.killTweensOf(b.spin);
    }

    if (d.bomb)
    {
      // bulle-piège : pas une erreur, la question continue
      RM.Sfx.pop();
      s.cameras.main.shake(150, 0.005);

      const M = RM.STORY.steps.melange;

      this.say(
        d.midi ? 'midi' : 'minuit',
        RM.fmt(d.midi ? M.midiTouched : d.client ? M.clientTouched : M.bombTouched, {
          client: this.client ? this.client.name : '',
        }),
      );

      // le goûter tombe dans la potion (Midi et le client, eux, ne tombent pas dedans)
      if (d.snack)
      {
        this.dropIn(b, 'snack');
      }

      s.tweens.add({
        targets: b,
        scale: 1.6,
        alpha: 0,
        duration: 350,
        onComplete: () => b.destroy(),
      });

      return;
    }

    this.answered = true;

    const ok = d.value === q.answer;

    RM.Progress.record(q.t, q.k, ok, q.kind);

    if (ok)
    {
      RM.Sfx.good();
      RM.sparkle(s, b.x, b.y, 0xbff5c9, 16);
      this.qText.setText(`${q.text} = ${q.answer}`).setColor(RM.C.greenText);
      this.dropIn(b, 'good');

      s.tweens.add({
        targets: b,
        scale: 1.4,
        alpha: 0,
        duration: 300,
        onComplete: () => b.destroy(),
      });

      this.clearAll(b);
      s.time.delayedCall(800, () => this.nextQ());
    }
    else
    {
      RM.Sfx.bad();
      this.hooks.error();
      this.dropIn(b, 'bad');
      this.popOne(b);
      this.requeue();
      this.qText.setText(`${q.text} = ${q.answer}`).setColor(RM.BAD);

      const good = this.bubbles.find((x) => x.active && x.d.value === q.answer);

      if (good)
      {
        s.tweens.killTweensOf(good);
        s.tweens.add({ targets: good, scale: 1.25, duration: 220, yoyo: true, repeat: 2 });
      }

      // la bonne réponse reste affichée dans la question (pas de fenêtre), puis la question suivante
      if (this.hooks.remember)
      {
        this.hooks.remember(q.text, q.answer); // rappel à la fin
      }

      s.time.delayedCall(2200, () =>
      {
        if (this.dead)
        {
          return;
        }

        this.clearAll(null);
        s.time.delayedCall(250, () => this.nextQ());
      });
    }
  }

  // Le contenu d'une bulle touchée tombe dans la potion : fumée verte (juste), rouge sombre
  // (faux) ou grise (goûter), puis un fantôme de l'ingrédient (transparent, un peu teinté)
  // remonte et s'envole. kind = 'good', 'bad' ou 'snack'
  dropIn(b, kind)
  {
    const s = this.scene,
      d = b.d;

    const spec = kind === 'snack' ? d.snack.sprite : d.ing.sprite;
    const size = kind === 'snack' ? 64 : 52;
    const ic = RM.icon(s, b.x, b.y, spec, size);
    const y = Phaser.Math.Between(RM.POTION_Y - 20, RM.POTION_Y + 30);

    this.fall.add(ic);

    s.tweens.add({
      targets: ic,
      y,
      angle: Phaser.Math.Between(-200, 200),
      duration: 380 + (y - b.y) * 0.7,
      ease: 'Quad.easeIn',

      onComplete: () =>
      {
        const col = kind === 'good' ? RM.CORR_GREEN : kind === 'bad' ? RM.SMOKE_RED : 0x9a90aa;

        ic.destroy();
        RM.Sfx.pop();

        // la fumée
        for (let j = 0; j < 9; j++)
        {
          const p = s.add.circle(
            ic.x + Phaser.Math.Between(-36, 36),
            y + Phaser.Math.Between(-10, 10),
            Phaser.Math.Between(12, 24),
            col,
            0.75,
          );

          this.fall.add(p);

          s.tweens.add({
            targets: p,
            y: p.y - Phaser.Math.Between(70, 150),
            scale: 1.8,
            alpha: 0,
            duration: Phaser.Math.Between(700, 1100),
            ease: 'Sine.easeOut',
            onComplete: () => p.destroy(),
          });
        }

        // le fantôme de l'ingrédient s'envole (teinté sauf pour un goûter)
        const g = RM.icon(s, ic.x, y, spec, size).setAlpha(RM.GHOST_ALPHA);

        if (kind !== 'snack')
        {
          g.setTint(kind === 'good' ? 0xa6ffb0 : 0xff9e9e);
        }

        this.fall.add(g);

        s.tweens.add({
          targets: g,
          y: y - 300,
          x: g.x + Phaser.Math.Between(-40, 40),
          alpha: 0,
          duration: 1600,
          ease: 'Sine.easeOut',
          onComplete: () => g.destroy(),
        });
      },
    });
  }

  // une question ratée revient une fois, plus tard dans la même phase
  requeue()
  {
    if (this.requeued.has(this.q.text))
    {
      return;
    }

    this.requeued.add(this.q.text);
    (this.q.div ? this.divQ : this.mulQ).push(this.q);
    this.total++;
  }

  // Une bulle-réponse arrive en haut sans qu'on ait répondu
  onTimeout()
  {
    if (this.answered || this.dead)
    {
      return;
    }

    this.answered = true;
    RM.Progress.record(this.q.t, this.q.k, false);

    // trop lent : pas une erreur, mais la question reviendra
    // (revient dans la même phase : une multiplication ratée revient avant les divisions)
    this.requeue();

    if (this.hooks.remember)
    {
      this.hooks.remember(this.q.text, this.q.answer); // rappel à la fin
    }

    this.showAnswer();
  }

  // Montre la réponse un instant, puis passe à la question suivante
  showAnswer()
  {
    const q = this.q,
      s = this.scene;

    this.qText.setText(`${q.text} = ${q.answer}`).setColor(RM.BAD);

    const good = this.bubbles.find((b) => b.active && b.d.value === q.answer);

    if (good)
    {
      s.tweens.killTweensOf(good);
      s.tweens.add({ targets: good, scale: 1.25, duration: 220, yoyo: true, repeat: 2 });
    }

    s.time.delayedCall(1700, () =>
    {
      this.clearAll(null);
      s.time.delayedCall(250, () => this.nextQ());
    });
  }

  // Arrête les animations et enlève la scène
  destroy()
  {
    this.dead = true;

    this.layer.list.forEach((b) =>
    {
      this.scene.tweens.killTweensOf(b);

      if (b.spin)
      {
        this.scene.tweens.killTweensOf(b.spin);
      }
    });

    if (this.speechTimer)
    {
      this.speechTimer.remove();
    }

    this.root.destroy();
  }
};
