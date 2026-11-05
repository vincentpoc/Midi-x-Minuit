// ============================================================
//  ChaseAct — La poursuite (chapitre 2), remplace le jeu de la patte.
//
//  mode 'protect' (ausculter) : Midi marche vers Chat-cacahuète pour le croquer ;
//    le joueur fait glisser le chat pour l'éloigner. On ne peut pas perdre.
//    1. Explication : une main fantôme montre le geste deux fois.
//    2. Essai sans danger : Midi marche très lentement et ne peut pas attraper
//       le chat ; fini après 3 glissés (« Bravo, comme ça ! »).
//    3. Poursuite (20 s, barre de lune) : Midi accélère à chaque tiers et
//       s'arrête pour renifler toutes les 4 à 5 s. S'il attrape le chat,
//       elle tape 6 fois sur Midi pour le libérer (chrono en pause).
//    done({ catches }) : le nombre de prises ne change que la réplique de fin.
//
//  mode 'reverse' (fin réussie) : Cookie veut le cookie de Midi ; elle éloigne
//    le cookie. Pas d'essai. S'il l'attrape, c'est fini : done({ caught: true }).
//
//  Midi utilise sa planche de marche (midi_walk, la direction suit son
//  déplacement) ; Cookie glisse avec un petit rebond (pas encore de planche).
//  Les hooks viennent de StoryScene (voir hooks() dans StoryScene.js).
// ============================================================

RM.ChaseAct = class
{
  // o = { mode, target: { key, scale }, chaser: { key, scale, walk }, lines, duration }
  constructor(scene, area, o, hooks)
  {
    this.scene = scene;
    this.A = area;
    this.o = o;
    this.hooks = hooks;
    this.reverse = o.mode === 'reverse';
    this.duration = o.duration || (this.reverse ? 15000 : 20000);
    this.L = o.lines || {};
    this.root = scene.add.container(0, 0).setDepth(6);
    this.phase = 'demo'; // demo → trial → chase → end
    this.elapsed = 0;
    this.catches = 0;
    this.drags = 0;
    this.caught = false;
    this.sniffUntil = 0;
    this.nextSniff = Phaser.Math.Between(4000, 5000);

    // le terrain : sous la barre de lune, dans le cadre (les pieds des personnages)
    this.B = {
      x1: area.x + 80,
      x2: area.x + area.w - 80,
      y1: area.y + 270,
      y2: area.y + area.h - 30,
    };

    this.build();
    this.onUpdate = (t, dt) => this.update(Math.min(dt, 50));
    scene.events.on('update', this.onUpdate);
    this.hooks.setMain(null);
    this.start();
  }

  // Dessine la barre de lune, la cible et le poursuivant
  build()
  {
    const s = this.scene,
      A = this.A,
      R = this.root,
      o = this.o,
      B = this.B;

    // barre de lune (le temps qui reste)
    this.barX = A.x + 50;
    this.barW = A.w - 150;
    this.barY = A.y + 40;

    const bg = s.add.graphics();

    bg.fillStyle(0x2a1f3d, 0.25).fillRoundedRect(this.barX, this.barY - 12, this.barW, 24, 12);
    R.add(bg);
    this.bar = s.add.graphics();
    R.add(this.bar);
    this.moonPos = { x: A.x + A.w - 60, y: this.barY };
    this.drawBar(0);

    // la consigne
    this.hint = RM.text(s, A.x + A.w / 2, A.y + 95, '', 30, '#6b4f7f', {
      wordWrap: { width: A.w - 60 },
      align: 'center',
    });

    R.add(this.hint);

    // la cible (à droite) : on la fait glisser
    this.target = s.add
      .image(B.x2 - 40, B.y2 - 10, o.target.key, o.target.frame)
      .setOrigin(0.5, 1)
      .setScale(o.target.scale);

    // le poursuivant (à gauche)
    this.chaser = s.add
      .sprite(B.x1 + 20, B.y2 - 10, o.chaser.key, 0)
      .setOrigin(0.5, 1)
      .setScale(o.chaser.scale);

    this.chaserY = this.chaser.y; // sans le rebond

    if (o.chaser.walk)
    {
      this.chaser.play(`${o.chaser.walk}_walk_down`);
      this.chaser.anims.pause();
    }

    R.add([this.chaser, this.target]);

    // la cible se glisse avec le doigt (zone de toucher généreuse)
    const tw = this.target.width,
      th = this.target.height;

    this.target.setInteractive({
      draggable: true,
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(-tw * 0.25, -th * 0.25, tw * 1.5, th * 1.4),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });

    this.target.on('drag', (p, x, y) =>
    {
      if (!this.canDrag())
      {
        return;
      }

      this.target.x = Phaser.Math.Clamp(x, B.x1, B.x2);
      this.target.y = Phaser.Math.Clamp(y, B.y1, B.y2);
    });

    this.target.on('dragend', () =>
    {
      if (this.canDrag())
      {
        this.drags++;
      }
    });

    // pour libérer le chat : on tape sur Midi (ou sur le chat, qui est collé à lui)
    this.chaser.setInteractive({ useHandCursor: true });
    this.chaser.on('pointerdown', () => this.tapChaser());

    this.target.on('pointerdown', () =>
    {
      if (this.caught)
      {
        this.tapChaser();
      }
    });

    this.tapText = RM.text(s, 0, 0, '', 44, RM.C.cream, {
      stroke: '#2a1b38',
      strokeThickness: 8,
    }).setVisible(false);

    R.add(this.tapText);
  }

  // La barre de lune : frac = part du temps écoulée (0 à 1)
  drawBar(frac)
  {
    this.bar.clear();
    this.bar
      .fillStyle(0xf3d36b, 1)
      .fillRoundedRect(this.barX, this.barY - 12, Math.max(24, this.barW * frac), 24, 12);

    const f = Math.round(frac * 8) / 8; // la lune se remplit par huitièmes

    if (f !== this.moonFrac)
    {
      this.moonFrac = f;

      if (this.moon)
      {
        this.moon.destroy();
      }

      this.moon = RM.moon(this.scene, this.moonPos.x, this.moonPos.y, 24, f);
      this.root.add(this.moon);
    }
  }

  // On peut faire glisser la cible pendant l'essai et la poursuite (pas pendant une prise)
  canDrag()
  {
    return (this.phase === 'trial' || this.phase === 'chase') && !this.caught;
  }

  // ---------- Les phases ----------
  // 1. Explication (sauf à l'envers) : la main fantôme montre le geste deux fois
  async start()
  {
    const L = this.L;

    if (this.reverse)
    {
      this.hint.setText(L.hint || '');
      await this.wait(1200);
      this.go('chase');
      return;
    }

    this.hint.setText(L.hint || '');

    if (L.lick)
    {
      this.hooks.say('midi', L.lick);
    }

    await this.ghostHand();
    await this.ghostHand();

    if (this.dead)
    {
      return;
    }

    // 2. essai sans danger
    this.hint.setText(L.trial || '');
    this.go('trial');
  }

  // Change de phase
  go(phase)
  {
    if (this.dead)
    {
      return;
    }

    this.phase = phase;

    if (phase === 'chase')
    {
      this.elapsed = 0;
      this.hint.setText(this.L.hint || '');

      if (this.L.go)
      {
        this.hooks.say(this.L.go.who, this.L.go.text);
      }
    }
  }

  // Attente (promesse) qui s'arrête si l'activité est détruite
  wait(ms)
  {
    return new Promise((r) => this.scene.time.delayedCall(ms, r));
  }

  // La main fantôme fait glisser la cible vers le haut, puis la ramène
  ghostHand()
  {
    const s = this.scene,
      t = this.target;

    if (this.dead)
    {
      return Promise.resolve();
    }

    const from = { x: t.x, y: t.y - t.displayHeight * 0.4 };
    const to = { x: t.x - 120, y: this.B.y1 + 40 };

    const hand = s.add.container(from.x, from.y);
    const g = s.add.graphics();

    g.fillStyle(0xffffff, 0.85).fillCircle(0, 0, 24);
    g.lineStyle(4, 0x7a3fa0, 0.9).strokeCircle(0, 0, 24);
    g.fillStyle(0x7a3fa0, 0.5).fillCircle(0, 0, 9);
    hand.add(g);
    this.root.add(hand);
    hand.setAlpha(0);

    const home = { x: t.x, y: t.y };

    return new Promise((resolve) =>
    {
      s.tweens.chain({
        tweens: [
          { targets: hand, alpha: 1, duration: 250 },
          {
            targets: [hand],
            x: to.x,
            y: to.y,
            duration: 900,
            ease: 'Sine.easeInOut',
            onUpdate: () =>
            {
              t.x = hand.x;
              t.y = hand.y + t.displayHeight * 0.4;
            },
          },
          { targets: hand, alpha: 0, duration: 250 },
          { targets: t, x: home.x, y: home.y, duration: 400, ease: 'Sine.easeInOut' },
        ],
        onComplete: () =>
        {
          hand.destroy();
          resolve();
        },
      });
    });
  }

  // ---------- À chaque image ----------
  update(dt)
  {
    if (this.dead || this.caught)
    {
      return;
    }

    const c = this.chaser,
      t = this.target;

    // vitesse (px/s) selon la phase ; à la poursuite, Midi accélère à chaque tiers
    let v = 0;

    if (this.phase === 'trial')
    {
      v = 35;

      if (this.drags >= 3 && !this.trialDone)
      {
        this.trialDone = true;
        this.hint.setText(this.L.trialDone || '');
        this.hooks.say('minuit', this.L.trialDone || '');
        this.scene.time.delayedCall(1500, () => this.go('chase'));
      }
    }
    else if (this.phase === 'chase')
    {
      this.elapsed += dt;

      const frac = Math.min(1, this.elapsed / this.duration);

      this.drawBar(frac);

      if (frac >= 1)
      {
        this.finish();
        return;
      }

      v = (this.reverse ? [80, 110, 140] : [70, 100, 130])[Math.min(2, Math.floor(frac * 3))];

      // il s'arrête pour renifler toutes les 4 à 5 s (Cookie aussi)
      if (this.elapsed >= this.nextSniff)
      {
        this.sniffUntil = this.elapsed + 900;
        this.nextSniff = this.elapsed + Phaser.Math.Between(4000, 5000);
        this.sniff();
      }

      if (this.elapsed < this.sniffUntil)
      {
        v = 0;
      }
    }

    // il marche vers la cible
    const dx = t.x - c.x,
      dy = t.y - this.chaserY,
      d = Math.hypot(dx, dy);

    // à l'essai, il ne peut pas l'attraper : il s'arrête avant
    if (this.phase === 'trial' && d < 110)
    {
      v = 0;
    }

    if (v > 0 && d > 1)
    {
      const step = Math.min(d, (v * dt) / 1000);

      c.x += (dx / d) * step;
      this.chaserY += (dy / d) * step;
    }

    this.animate(v > 0 ? dx : 0, v > 0 ? dy : 0, v > 0);

    // attrapé ?
    if (this.phase === 'chase' && d < 60)
    {
      this.onCatch();
    }
  }

  // L'animation du poursuivant : la planche de marche de Midi, ou un rebond pour Cookie
  animate(dx, dy, moving)
  {
    const c = this.chaser,
      w = this.o.chaser.walk;

    if (w)
    {
      if (moving)
      {
        const dir =
          Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';

        const key = `${w}_walk_${dir}`;

        if (c.anims.currentAnim?.key !== key || !c.anims.isPlaying)
        {
          c.play(key);
        }
      }
      else if (c.anims.isPlaying)
      {
        c.anims.pause();
      }

      c.y = this.chaserY;
    }
    else
    {
      // Cookie regarde à gauche sur son dessin : on le retourne quand il va à droite
      if (moving && Math.abs(dx) > 2)
      {
        c.setFlipX(dx > 0);
      }

      const hop = moving ? Math.abs(Math.sin(this.scene.time.now / 110)) * 12 : 0;

      c.y = this.chaserY - hop;
    }
  }

  // Il s'arrête pour renifler
  sniff()
  {
    const s = this.scene,
      c = this.chaser;

    const t = RM.text(s, c.x, c.y - c.displayHeight - 10, 'snif snif', 26, '#6b4f7f', {
      backgroundColor: '#fffaf0',
      padding: { x: 8, y: 2 },
    });

    this.root.add(t);
    s.tweens.add({ targets: t, y: t.y - 30, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  // ---------- Attrapé ! ----------
  onCatch()
  {
    const s = this.scene,
      L = this.L;

    this.caught = true;
    RM.Sfx.bad();
    s.cameras.main.shake(180, 0.006);
    s.tweens.add({
      targets: this.target,
      angle: { from: -12, to: 12 },
      duration: 80,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.target.setAngle(0),
    });

    if (this.reverse)
    {
      // Cookie a le cookie : c'est fini
      this.phase = 'end';
      this.scene.time.delayedCall(700, () => this.hooks.done({ caught: true }));
      return;
    }

    // il faut taper 6 fois sur Midi pour libérer le chat (le chrono est en pause)
    this.catches++;
    this.taps = 6;

    if (L.caught)
    {
      this.hooks.say(L.caught.who, L.caught.text);
    }

    this.hint.setText(L.tapHint || '');
    this.showTaps();
  }

  // Le nombre de tapes qui restent, au-dessus de Midi
  showTaps()
  {
    const c = this.chaser;

    this.tapText
      .setText(`${this.taps}`)
      .setPosition(c.x, c.y - c.displayHeight - 20)
      .setVisible(this.taps > 0);
  }

  // Elle tape sur Midi pendant une prise
  tapChaser()
  {
    if (!this.caught || this.reverse || this.dead)
    {
      return;
    }

    const s = this.scene,
      c = this.chaser;

    this.taps--;
    RM.Sfx.tap();
    // petit écrasement à chaque tape (à partir de sa taille normale : ça ne s'accumule pas)
    const sc = this.o.chaser.scale;

    s.tweens.killTweensOf(c);
    c.setScale(sc);
    s.tweens.add({ targets: c, scaleY: sc * 0.88, duration: 70, yoyo: true });
    this.showTaps();

    if (this.taps > 0)
    {
      return;
    }

    // libéré : Midi recule, le chat file loin de lui
    RM.Sfx.pop();

    if (this.L.released)
    {
      this.hooks.say(this.L.released.who, this.L.released.text);
    }

    const B = this.B;
    const farX = c.x < (B.x1 + B.x2) / 2 ? B.x2 : B.x1;
    const farY = this.chaserY < (B.y1 + B.y2) / 2 ? B.y2 : B.y1 + 40;

    s.tweens.add({ targets: this.target, x: farX, y: farY, duration: 450, ease: 'Quad.easeOut' });

    // il est un peu sonné : il repart après un moment
    this.sniffUntil = this.elapsed + 1200;
    this.hint.setText(this.L.hint || '');
    this.caught = false;
  }

  // Le temps est fini
  finish()
  {
    if (this.phase === 'end')
    {
      return;
    }

    this.phase = 'end';
    this.drawBar(1);
    RM.Sfx.good();
    RM.sparkle(this.scene, this.target.x, this.target.y - 60, RM.C.gold, 18);
    this.chaser.anims?.pause();
    this.scene.time.delayedCall(900, () =>
      this.hooks.done(this.reverse ? { caught: false } : { catches: this.catches }),
    );
  }

  // Enlève l'activité de l'écran
  destroy()
  {
    this.dead = true;
    this.scene.events.off('update', this.onUpdate);
    this.root.destroy();
  }
};
