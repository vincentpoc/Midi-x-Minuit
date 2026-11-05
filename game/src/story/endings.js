// ============================================================
//  endings.js — Les fins communes à tous les chapitres.
//
//  Ces méthodes s'ajoutent à StoryScene : effets de la potion, explosion
//  à 0 vie, sauvegarde de fin de chapitre et écran de fin.
// ============================================================

Object.assign(RM.StoryScene.prototype, {
  // Potion réussie : le client tremble, brille et saute
  potionWorks()
  {
    const c = this.clientSprite;

    RM.Sfx.good();

    this.tweens.add({
      targets: c,
      angle: { from: -10, to: 10 },
      duration: 90,
      yoyo: true,
      repeat: 6,
    });

    this.time.delayedCall(800, () =>
    {
      RM.sparkle(this, c.x, c.y - 80, RM.C.gold, 26);
      this.tweens.add({ targets: c, y: c.y - 60, duration: 260, yoyo: true, ease: 'Quad.easeOut' });
    });

    return this.wait(1800);
  },

  // Potion ratée : le déroulement commun. Chaque chapitre fournit ce qui change :
  //   fx.client()  ce qui arrive au client quand il boit
  //   fx.midi()    ce qui arrive à Midi quand il boit à son tour (renvoie une promesse)
  async potionFails(fx)
  {
    const m = this.midi,
      L = this.client;

    RM.Sfx.bad();
    await this.wait(400);
    fx.client();
    await this.wait(1500);
    await this.dialog(this.fill(L.fail)); // … Midi : « Moi aussi, moi aussi ! »

    // Midi court boire le reste
    await this.tween({ targets: m, x: 470, duration: 500, ease: 'Quad.easeOut' });
    RM.Sfx.pop();
    this.tweens.add({ targets: m, angle: -20, duration: 150, yoyo: true, repeat: 2 });
    await this.wait(700);
    await this.dialog(this.fill(L.failDrink)); // Minuit : « Midi, non ! »
    RM.Sfx.bad();
    await fx.midi();
    await this.dialog(this.fill(L.failFly)); // Midi : « Youpi ! »
  },

  // Sauvegarde de fin de chapitre, puis l'écran de fin
  finishChapter(success, state, exploded = false)
  {
    const P = RM.Progress;

    P.data.chapter = (this.chapter + 1) % RM.GROUPS.length;
    P.data.day++;
    P.data.chaptersPlayed = (P.data.chaptersPlayed || 0) + 1;
    P.data.last = { client: this.clientId, success, chapter: this.chapter, shown: false, exploded };

    if (success && !P.data.healed.includes(this.clientId))
    {
      P.data.healed.push(this.clientId);
    }

    // le client garde cette forme sur le menu jusqu'à ce qu'on rejoue son chapitre
    P.data.clients = P.data.clients || {};
    P.data.clients[this.clientId] = state;
    P.save();
    this.endScreen(success, exploded);
  },

  // Plus aucune vie : la potion explose tout de suite (étape 4 : les personnages couverts de suie)
  async explode()
  {
    if (this.exploded)
    {
      return;
    }

    this.exploded = true;

    // on arrête tout ce qui était en cours
    this.time.removeAllEvents();
    this.tweens.killAll();

    if (this.cur)
    {
      try
      {
        this.cur.destroy();
      }
      catch (e)
      {
        /* déjà détruit */
      }

      this.cur = null;
    }

    this.quickTimer = null;
    this.dialogNext = false;
    this.setMain(null);

    const cam = this.cameras.main;

    cam.resetFX();
    cam.setAlpha(1);
    this.bubble.moveTo(this.bubble.y, false);

    // tout le monde revient à sa place
    this.minuit.setPosition(this.pos.minuit, 478).setAngle(0).setVisible(true);
    this.midi.setPosition(this.pos.midi, 478).setAngle(0).setVisible(true).setFlipX(false);
    this.setMidiProp(null);

    if (this.clientSprite)
    {
      this.clientSprite.setPosition(this.pos.client, 478).setAngle(0).setVisible(true);
    }

    RM.Sfx.bad();
    cam.flash(500, 255, 255, 255);
    cam.shake(600, 0.02);

    // BOUM : Minuit, Midi et le client deviennent tout noirs (on ne voit que leurs yeux)
    RM.burn(this, this.minuit, 'witch_idle');
    this.midi.setOrigin(0.5, 0.95).setScale(3.75);
    RM.burn(this, this.midi, 'midi_idle');

    if (this.clientSprite)
    {
      RM.burn(this, this.clientSprite, this.look.sprite);
    }

    [this.minuit, this.midi, this.clientSprite].forEach((spr) =>
    {
      if (spr)
      {
        RM.soot(this, spr.x, spr.y - 100, 8);
      }
    });

    const W = RM.W;

    const boom = RM.title(this, W / 2, this.area.y + 250, 'BOUM !', 130)
      .setDepth(30)
      .setScale(0.2);

    this.tweens.add({ targets: boom, scale: 1, duration: 420, ease: 'Back.easeOut' });
    RM.sparkle(this, W / 2, this.area.y + 250, 0x3b3b3b, 30);
    await this.wait(1400);
    await this.dialog(this.fill(RM.STORY.steps.potion.explode));
    this.finishChapter(false, 'burned', true);
  },

  // L'écran de fin, dehors (décor de l'écran d'accueil), puis le menu :
  // le score, les vies restantes, et jusqu'à 3 rappels des calculs ratés.
  // Sans faute : Minuit, Midi et le client sautent dans tous les sens.
  endScreen(success, exploded = false)
  {
    const W = RM.W,
      H = RM.H,
      S = RM.STORY.chapterEnd,
      cam = this.cameras.main;

    this.setMain(null);
    cam.fadeOut(400, 0, 0, 0);

    cam.once('camerafadeoutcomplete', () =>
    {
      const c = this.add.container(0, 0).setDepth(50);

      c.add(
        this.add
          .image(W / 2, H / 2, 'bg_title')
          .setScale(3)
          .setInteractive(),
      );

      c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x120a1c, 0.3));
      c.add(RM.panel(this, 50, 200, 620, 900));
      c.add(RM.text(this, W / 2, 270, RM.fmt(S.title, this.vars), 52, RM.C.ink));

      c.add(
        RM.text(
          this,
          W / 2,
          345,
          exploded ? S.explode : success ? S.success : S.fail,
          34,
          success ? RM.GOOD : RM.BAD,
          { wordWrap: { width: 560 } },
        ),
      );

      const total = Math.max(this.asked, 0);

      c.add(RM.text(this, W / 2, 420, RM.fmt(S.score, { good: this.good, total }), 34, RM.C.ink));

      c.add(
        RM.text(
          this,
          W / 2,
          470,
          RM.fmt(S.lives, { lives: this.lives.left, max: RM.MAX_LIVES }),
          30,
          '#6b4f7f',
        ),
      );

      const perfect = this.errors === 0 && total > 0 && this.good === total && !exploded;

      if (perfect)
      {
        c.add(RM.text(this, W / 2, 560, S.perfect, 46, RM.GOOD));

        // Minuit, Midi et le client sautent de joie
        const ck = this.clientSprite ? this.clientSprite.texture.key : this.look.sprite;

        const who = [
          ['witch_idle', 3, 200],
          ['midi_idle', 3.75, 360],
          [ck, this.look.scale * 0.8, 530],
        ];

        who.forEach(([key, sc, x], i) =>
        {
          const spr = this.add.sprite(x, 860, key, 0).setOrigin(0.5, 1).setScale(sc);

          if (this.anims.exists(key))
          {
            spr.play(key);
          }
          else if (this.anims.exists(`${key}_idle`))
          {
            spr.play(`${key}_idle`);
          }

          c.add(spr);

          this.tweens.add({
            targets: spr,
            y: 760,
            duration: 300 + i * 40,
            yoyo: true,
            repeat: -1,
            ease: 'Quad.easeOut',
            delay: i * 120,
          });

          this.tweens.add({
            targets: spr,
            angle: { from: -12, to: 12 },
            duration: 260,
            yoyo: true,
            repeat: -1,
            delay: i * 90,
          });
        });

        this.time.addEvent({
          delay: 700,
          repeat: 6,

          callback: () =>
            RM.sparkle(
              this,
              Phaser.Math.Between(150, 570),
              Phaser.Math.Between(560, 800),
              RM.C.gold,
              14,
            ),
        });
      }
      else
      {
        const list = [...new Set(this.missed)].slice(0, 3);

        if (list.length)
        {
          c.add(RM.text(this, W / 2, 560, S.remember, 36, '#6b4f7f'));
          list.forEach((m, i) => c.add(RM.text(this, W / 2, 640 + i * 82, m, 58, RM.C.ink)));
        }
      }

      // lunes des tables du chapitre (sans le mot « table »)
      this.tables.forEach((t, i) =>
      {
        const x = W / 2 + (i - (this.tables.length - 1) / 2) * 120;

        c.add(RM.moon(this, x, 935, 30, RM.Progress.moon(t)));
      });

      if (this.session && this.chapter >= RM.GROUPS.length - 1)
      {
        c.add(RM.text(this, W / 2, 1000, S.sessionEnd, 30, '#7a3fa0'));
      }

      c.add(
        RM.button(
          this,
          W / 2,
          1170,
          360,
          100,
          S.next,
          () =>
          {
            cam.fadeOut(300, 0, 0, 0);
            cam.once('camerafadeoutcomplete', () => this.scene.start('Title'));
          },
          { color: RM.C.green, dark: 0x3b7a40, size: 42 },
        ),
      );

      cam.fadeIn(400, 0, 0, 0);
    });
  },
});
