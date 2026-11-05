// ============================================================
//  TitleScene — menu principal « Midi × Minuit »
//  - « Commencer » (chapitre 1) : le titre et les boutons
//    disparaissent, Minuit et Midi se présentent en bulles,
//    puis on entre dans la boutique.
//  - Les clients soignés restent à côté de Minuit et Midi.
//  - Après une potion ratée, Midi vole encore (chapitre 1) ou
//    reste un pot de beurre de cacahuète (chapitre 2).
//    « Continuer » : Midi redevient normal, le dernier client
//    soigné s'en va par la droite, puis le chapitre suivant.
// ============================================================

RM.TitleScene = class extends Phaser.Scene
{
  // Le nom de la scène pour Phaser
  constructor()
  {
    super('Title');
  }

  // Dessine le menu : titre, personnages, clients déjà vus et boutons
  create()
  {
    const W = RM.W,
      H = RM.H,
      P = RM.Progress.data;

    this.busy = false;
    this.add.image(W / 2, H / 2, 'bg_title').setScale(3);
    this.add.rectangle(W / 2, H / 2, W, H, 0x120a1c, 0.35);

    // le titre, sur une seule ligne : « Midi × Minuit » (le × en doré)
    const tA = RM.title(this, 0, 200, 'Midi', 92);
    const tX = RM.title(this, 0, 200, '×', 92).setColor(RM.C.goldText);
    const tB = RM.title(this, 0, 200, 'Minuit', 92);
    const gap = 22;
    let tw = tA.width + tX.width + tB.width + gap * 2;
    const k = Math.min(1, (W - 40) / tw);

    [tA, tX, tB].forEach((t) => t.setScale(k));
    tw *= k;
    tA.x = W / 2 - tw / 2 + (tA.width * k) / 2;
    tX.x = tA.x + (tA.width * k) / 2 + gap * k + (tX.width * k) / 2;
    tB.x = tX.x + (tX.width * k) / 2 + gap * k + (tB.width * k) / 2;

    this.tweens.add({
      targets: [tA, tX, tB],
      y: '+=8',
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.ui = [tA, tX, tB];

    // Minuit et Midi (Midi 1,25 × plus grand), les pieds au bas de la porte
    const G = 1030;

    this.pos = { minuit: 190, midi: 390, ground: G };

    this.onGround = [
      this.add.ellipse(this.pos.minuit, G - 10, 170, 30, 0x000000, 0.3),
      this.add.ellipse(this.pos.midi, G - 10, 210, 34, 0x000000, 0.3),
    ];

    this.minuit = this.add
      .sprite(this.pos.minuit, G, 'witch_idle')
      .setOrigin(0.5, 0.95)
      .setScale(4.4)
      .play('witch_idle');

    this.midi = this.add
      .sprite(this.pos.midi, G, 'midi_idle')
      .setOrigin(0.5, 0.95)
      .setScale(5.5)
      .play('midi_idle');

    const n1 = RM.text(this, this.pos.minuit, G + 28, 'Minuit', 30, RM.C.cream, {
      stroke: '#2a1b38',
      strokeThickness: 6,
    });

    const n2 = RM.text(this, this.pos.midi, G + 28, 'Midi', 30, RM.C.cream, {
      stroke: '#2a1b38',
      strokeThickness: 6,
    });

    this.ui.push(n1, n2);

    [this.minuit, this.midi].forEach((s) =>
    {
      s.setInteractive();

      // un seul saut à la fois (sinon des taps rapides le font décoller)
      s.on('pointerdown', () =>
      {
        if (this.busy || this.tweens.isTweening(s))
        {
          return;
        }

        RM.Sfx.pop();
        this.tweens.add({ targets: s, y: s.y - 30, duration: 150, yoyo: true });
      });
    });

    // les clients restent sur le menu dans la forme de leur dernier chapitre :
    // soignés (Chat-boîte, Cookie qui dort), ratés (Chat-boîte qui flotte,
    // pot de beurre de cacahuète) ou… Cookie transformé en cookie, Chat-boîte devenu Chracula.
    const spots = [
      [590, G],
      [660, G - 110],
      [525, G - 110],
    ];

    const states = P.clients || {};

    const order = [...new Set((RM.STORY.chapterClients || []).concat(Object.keys(states)))].filter(
      (id) => states[id],
    );

    this.clients = {};

    order.slice(0, spots.length).forEach((id, i) =>
    {
      const cl = RM.STORY.clients[id];

      if (!cl || !cl.look)
      {
        return;
      }

      const lk = cl.look,
        st = states[id];

      const [x, y] = spots[i];

      let key = lk.healed || lk.sprite,
        scale = lk.scale * 0.9,
        foot = lk.footY,
        green = false;

      if (st === 'healed')
      {
        key = lk.sleeping || lk.healed || lk.sprite;
      }
      else if (st === 'cookie')
      {
        key = 'cookie_midi';
        scale = 2.2;
        foot = 0.9;
      }
      else if (st === 'chracula')
      {
        key = 'chracula'; // secoué assez vite à la fin du chapitre 1
      }
      else if (st === 'burned')
      {
        // potion explosée : le client reste tout noir jusqu'à ce qu'on rejoue son chapitre
        key = RM.burnedKey(this, lk.sprite) || lk.sprite;
      }
      else if (st === 'failed')
      {
        if (lk.failed === 'green')
        {
          key = lk.sprite;
          green = true;
        }
        else
        {
          key = lk.failed;
        }
      }

      this.onGround.push(this.add.ellipse(x, y - 8, 120, 22, 0x000000, 0.3));

      const spr = this.add.sprite(x, y, key, 0).setOrigin(0.5, foot).setScale(scale);

      if (this.anims.exists(`${key}_idle`))
      {
        spr.play(`${key}_idle`);
      }

      if (green)
      {
        // raté au chapitre 1 : Chat-boîte flotte (look.failed = 'green' : l'ancien nom de cet effet)
        spr.setY(y - 250);

        this.tweens.add({
          targets: spr,
          y: y - 280,
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        this.tweens.add({
          targets: spr,
          angle: { from: -10, to: 10 },
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      this.clients[id] = { spr, state: st };

      if (!green)
      {
        this.onGround.push(spr);
      }
    });

    // potion ratée au dernier chapitre : Midi vole toujours
    // (chapitre 2 : il est un pot de beurre de cacahuète, posé par terre, il ne vole pas)
    const last = P.last && !P.last.shown ? P.last : null;

    this.last = last;
    this.floatTw = [];

    const lc = last && !last.success && RM.STORY.clients[last.client];
    const failed = lc && lc.look && lc.look.failed;

    if (last && last.exploded)
    {
      // la potion a explosé : Minuit et Midi restent tout noirs jusqu'à « Continuer »
      RM.burn(this, this.minuit, 'witch_idle');
      RM.burn(this, this.midi, 'midi_idle');
    }
    else if (failed && failed !== 'green')
    {
      this.midi.stop().setTexture(failed).setOrigin(0.5, 1).setScale(3.4);
    }
    else if (last && !last.success)
    {
      this.midi.setY(G - 230); // chapitre 1 : Midi vole encore

      this.floatTw = [
        this.tweens.add({
          targets: this.midi,
          y: G - 260,
          duration: 1100,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
        this.tweens.add({
          targets: this.midi,
          angle: { from: -10, to: 10 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }),
      ];
    }

    const ch = (P.chapter || 0) + 1;

    // en bas, à la hauteur du bouton « Suite » de l'intro :
    // Chapitres (petit rond à gauche) · Commencer / Continuer · Grimoire (petit rond à droite)
    const BY = 1150;

    this.ui.push(
      RM.button(
        this,
        W / 2,
        BY,
        400,
        100,
        ch > 1 ? `Continuer (chap. ${ch})` : 'Commencer',
        () => this.start(),
        { color: RM.C.green, dark: 0x3b7a40, size: ch > 1 ? 36 : 44 },
      ),
    );

    const chap = RM.roundButton(this, 78, BY, 46, null, () =>
    {
      if (!this.busy)
      {
        this.chapterMenu();
      }
    });

    chap.add(RM.moon(this, 0, 0, 24, 0.6));

    const grim = RM.roundButton(this, W - 78, BY, 46, { key: 'ui_book' }, () =>
    {
      if (!this.busy)
      {
        this.scene.start('Grimoire', { from: 'Title' });
      }
    });

    const lbl = { stroke: '#2a1b38', strokeThickness: 5 };

    this.ui.push(
      chap,
      grim,
      RM.text(this, 78, BY + 66, 'Chapitres', 20, RM.C.cream, lbl),
      RM.text(this, W - 78, BY + 66, 'Grimoire', 20, RM.C.cream, lbl),
    );

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  // Attente simple (promesse)
  wait(ms)
  {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  // Animation qu'on peut attendre (promesse)
  tween(cfg)
  {
    return new Promise((r) => this.tweens.add(Object.assign({}, cfg, { onComplete: r })));
  }

  // Lance un chapitre (par défaut, celui de la sauvegarde). session = true : on enchaîne les chapitres
  async start(chapter, session = true)
  {
    if (this.busy)
    {
      return;
    }

    this.busy = true;

    const P = RM.Progress.data;

    if (chapter === undefined)
    {
      chapter = P.chapter || 0;
    }

    // le titre et les boutons disparaissent
    this.ui.forEach((o) =>
    {
      if (o.disableInteractive)
      {
        o.disableInteractive();
      }
    });

    await this.tween({ targets: this.ui, alpha: 0, duration: 350 });

    if (this.last)
    {
      await this.afterLastChapter();
      P.last.shown = true;
      RM.Progress.save();
    }

    if (chapter === 0 && session)
    {
      await this.intro();
    }

    this.cameras.main.fadeOut(350, 0, 0, 0);

    this.cameras.main.once('camerafadeoutcomplete', () =>
      this.scene.start('Story', { chapter, session }),
    );
  }

  // « Continuer » : Midi redevient normal, le client soigné s'en va par la droite
  async afterLastChapter()
  {
    const last = this.last;

    if (last.exploded)
    {
      // ils secouent la suie et redeviennent comme avant
      [this.minuit, this.midi].forEach((spr) => RM.soot(this, spr.x, spr.y - 140, 8));
      RM.Sfx.pop();

      await this.tween({
        targets: [this.minuit, this.midi],
        angle: { from: -12, to: 12 },
        duration: 90,
        yoyo: true,
        repeat: 3,
      });

      this.minuit.setAngle(0).clearTint().setTexture('witch_idle', 0).play('witch_idle');
      this.midi.setAngle(0).clearTint().setTexture('midi_idle', 0).play('midi_idle');
      RM.sparkle(this, this.minuit.x, this.minuit.y - 140, 0xffffff, 10);
      RM.sparkle(this, this.midi.x, this.midi.y - 140, 0xffffff, 10);
      await this.wait(500);
    }
    else if (!last.success)
    {
      (this.floatTw || []).forEach((t) => t.stop());
      this.midi.clearTint();

      if (this.midi.texture.key !== 'midi_idle')
      {
        this.midi.setTexture('midi_idle').setOrigin(0.5, 0.95).setScale(5.5).play('midi_idle');
      }

      RM.Sfx.pop();
      RM.sparkle(this, this.midi.x, this.midi.y - 120, 0xffffff, 14);

      await this.tween({
        targets: this.midi,
        y: this.pos.ground,
        angle: 0,
        duration: 600,
        ease: 'Bounce.easeOut',
      });
    }

    const cs = this.clients[last.client];
    const spr = last.success && cs && cs.state === 'healed' && cs.spr;

    if (spr)
    {
      this.tweens.add({ targets: spr, y: spr.y - 20, duration: 140, yoyo: true, repeat: 3 });

      await this.tween({
        targets: spr,
        x: RM.W + 120,
        duration: 1100,
        delay: 300,
        ease: 'Quad.easeIn',
      });
    }

    await this.wait(250);
  }

  // L'introduction : Minuit et Midi se présentent, en bulles au-dessus d'eux
  async intro()
  {
    const W = RM.W,
      lines = RM.STORY.titleIntro;

    // les personnages descendent devant la porte (pieds à y = 1030)
    const dy = 1030 - this.pos.ground;

    this.pos.ground += dy;

    if (dy)
    {
      await this.tween({
        targets: this.onGround.concat([this.minuit, this.midi]).filter((o) => o.active),
        y: `+=${dy}`,
        duration: 600,
        ease: 'Sine.easeInOut',
      });
    }

    const bubble = new RM.Bubble(this, 20, 470, 680, 170);

    const btn = RM.button(this, W / 2, 1150, 400, 100, 'Suite', () => next(), {
      color: RM.C.green,
      dark: 0x3b7a40,
      size: 44,
    });

    const zone = this.add.zone(W / 2, RM.H / 2, W, RM.H).setInteractive();

    zone.setDepth(-1);

    const tailOf = (who) =>
      who === 'midi'
        ? this.pos.midi
        : who === 'minuit'
          ? this.pos.minuit
          : (this.pos.minuit + this.pos.midi) / 2;

    let i = 0,
      next;

    return new Promise((resolve) =>
    {
      next = () =>
      {
        if (i >= lines.length)
        {
          bubble.c.destroy();
          btn.destroy();
          zone.destroy();
          resolve();
          return;
        }

        // réplique suivante : le ou les personnages qui parlent sautent
        const l = lines[i++];

        bubble.say(l.text, tailOf(l.who), RM.STORY.characters[l.who].name);

        const who =
          l.who === 'both'
            ? [this.minuit, this.midi]
            : [l.who === 'midi' ? this.midi : this.minuit];

        who.forEach((s) =>
          this.tweens.add({ targets: s, y: this.pos.ground - 24, duration: 130, yoyo: true }),
        );
      };

      zone.on('pointerup', () => next());
      next();
    });
  }

  // choix d'un chapitre à rejouer seul, ou d'une activité précise (raccourcis)
  chapterMenu()
  {
    const W = RM.W;
    const c = this.add.container(0, 0).setDepth(20);

    c.add(this.add.rectangle(W / 2, RM.H / 2, W, RM.H, 0x000000, 0.6).setInteractive());
    c.add(RM.panel(this, 24, 110, W - 48, 1080));
    c.add(RM.text(this, W / 2, 165, 'Choisis un chapitre', 40, RM.C.ink));

    const steps = [
      ['Intro', 'intro'],
      ['Ausculter', 'secouer'],
      ['Recette', 'recette'],
      ['Bouillon', 'bouillon'],
      ['Rangement', 'rangement'],
      ['Bulles', 'bulles'],
      ['Fin réussie', 'fin_ok'],
      ['Fin ratée', 'fin_ko'],
    ];

    const go = (chapter, startAt) =>
    {
      c.destroy();
      this.scene.start('Story', { chapter, session: false, startAt });
    };

    RM.GROUPS.forEach((g, i) =>
    {
      const y = 250 + i * 290;

      c.add(
        RM.button(
          this,
          W / 2 - 40,
          y,
          440,
          92,
          `Chapitre ${i + 1}`,
          () =>
          {
            c.destroy();
            this.start(i, false);
          },
          { size: 38 },
        ),
      );

      c.add(RM.moon(this, W / 2 + 230, y, 30, RM.Progress.moonOf(g.tables)));

      steps.forEach(([label, key], j) =>
      {
        const x = 115 + (j % 4) * 163,
          yy = y + 88 + Math.floor(j / 4) * 70;

        c.add(
          RM.button(this, x, yy, 152, 58, label, () => go(i, key), {
            size: 22,
            color: 0x8a7a9a,
            dark: 0x5a4a6a,
          }),
        );
      });
    });

    c.add(
      RM.button(this, W / 2 + 140, 1125, 240, 76, 'Retour', () => c.destroy(), {
        size: 32,
        color: 0x8a7a9a,
        dark: 0x5a4a6a,
      }),
    );

    c.add(
      RM.button(this, W / 2 - 140, 1125, 260, 76, 'Effacer la partie', () => this.confirmReset(), {
        size: 26,
        color: RM.C.red,
        dark: 0x9a3f39,
      }),
    );
  }

  // Effacer la partie : on demande d'abord confirmation
  confirmReset()
  {
    const W = RM.W;
    const c = this.add.container(0, 0).setDepth(30);

    c.add(this.add.rectangle(W / 2, RM.H / 2, W, RM.H, 0x000000, 0.6).setInteractive());
    c.add(RM.panel(this, 80, 470, W - 160, 340));
    c.add(RM.text(this, W / 2, 545, 'Tout effacer ?', 44, RM.C.ink));

    c.add(
      RM.text(
        this,
        W / 2,
        625,
        'Les lunes, les calculs réussis et les clients\nsur le menu seront perdus.',
        26,
        '#6b4f7f',
      ),
    );

    c.add(
      RM.button(
        this,
        W / 2 - 130,
        735,
        220,
        84,
        'Effacer',
        () =>
        {
          try
          {
            localStorage.removeItem(RM.Progress.KEY);
          }
          catch (e)
          {
            /* mode privé */
          }

          RM.Progress.data = RM.Progress.fresh();
          RM.Progress.save();
          this.cameras.main.fadeOut(300, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart());
        },
        { size: 32, color: RM.C.red, dark: 0x9a3f39 },
      ),
    );

    c.add(RM.button(this, W / 2 + 130, 735, 220, 84, 'Annuler', () => c.destroy(), { size: 32 }));
  }
};
