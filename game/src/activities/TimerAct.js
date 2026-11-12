// ============================================================
//  TimerAct — Le minuteur (chapitre 3, division par 5).
//    « Il faut cuire cet ingrédient 40 s : sur quel chiffre je mets le minuteur ? »
//    Le cadran a les chiffres 1 à 12 comme une horloge, chaque chiffre vaut 5 s.
//    On tourne l'aiguille (elle s'arrête sur les chiffres), puis « Valider ».
//    Série 1 : les secondes sont écrites autour du cadran (5, 10, 15…) ; série 2 : seulement les chiffres.
//    Erreur = une vie en moins ; son aiguille reste en rouge, la bonne s'affiche en vert.
//  q = { t: 5, k, N, ing }   opts.labels : les secondes autour du cadran
//  Les hooks viennent de StoryScene (voir hooks() dans StoryScene.js).
// ============================================================

RM.TimerAct = class
{
  constructor(scene, area, q, hooks, opts = {})
  {
    this.scene = scene;
    this.A = area;
    this.q = q;
    this.hooks = hooks;
    this.o = opts;
    this.root = scene.add.container(0, 0);
    this.value = 12; // l'aiguille part du 12 (zéro)
    this.build();
  }

  // Angle (radians, 0 = en haut, sens des aiguilles) du chiffre n
  ang(n)
  {
    return (n / 12) * Math.PI * 2;
  }

  pt(n, r)
  {
    const a = this.ang(n);

    return { x: this.cx + Math.sin(a) * r, y: this.cy - Math.cos(a) * r };
  }

  build()
  {
    const s = this.scene,
      A = this.A,
      R = this.root,
      q = this.q;

    this.cx = A.x + A.w / 2 + 40;
    this.cy = A.y + 340;
    this.r = 190;

    // l'ingrédient à cuire et son temps
    R.add(RM.icon(s, A.x + 70, A.y + 60, q.ing.sprite, 64));
    R.add(RM.text(s, A.x + 112, A.y + 60, `${q.N} s`, 48, RM.C.ink).setOrigin(0, 0.5));

    const g = s.add.graphics();

    // le boîtier du minuteur
    g.fillStyle(RM.C.woodDark, 1).fillCircle(this.cx, this.cy + 6, this.r + 26);
    g.fillStyle(0xd94f3d, 1).fillCircle(this.cx, this.cy, this.r + 22);
    g.fillStyle(0xfff6e6, 1).fillCircle(this.cx, this.cy, this.r);
    g.fillStyle(0xd94f3d, 1).fillRoundedRect(this.cx - 26, this.cy - this.r - 52, 52, 30, 8); // le bouton du dessus

    for (let i = 0; i < 60; i++)
    {
      const a = (i / 60) * Math.PI * 2,
        big = i % 5 === 0;

      const r1 = this.r - (big ? 22 : 10);

      g.lineStyle(big ? 5 : 2, RM.C.inkHex, big ? 0.9 : 0.4);
      g.lineBetween(
        this.cx + Math.sin(a) * r1,
        this.cy - Math.cos(a) * r1,
        this.cx + Math.sin(a) * (this.r - 4),
        this.cy - Math.cos(a) * (this.r - 4),
      );
    }

    R.add(g);

    for (let n = 1; n <= 12; n++)
    {
      const p = this.pt(n, this.r - 50);

      R.add(RM.text(s, p.x, p.y, String(n), 40, RM.C.ink, { fontFamily: RM.FONT_NB }));

      // série 1 : les secondes, en petit, autour du cadran
      if (this.o.labels)
      {
        const p2 = this.pt(n, this.r + 50);

        R.add(
          RM.text(s, p2.x, p2.y, String(n * 5), 22, '#7a3fa0', {
            fontFamily: RM.FONT_NB,
            stroke: '#fff6e6',
            strokeThickness: 5,
          }),
        );
      }
    }

    // les aiguilles : la sienne, et la bonne (cachée)
    this.good = s.add.graphics().setVisible(false);
    this.hand = s.add.graphics();
    R.add([this.good, this.hand]);
    R.add(s.add.circle(this.cx, this.cy, 14, RM.C.inkHex));
    this.drawHand(this.hand, this.value, RM.C.inkHex);

    // on tourne en touchant ou en glissant n'importe où sur le cadran
    const zone = s.add
      .zone(this.cx, this.cy, (this.r + 60) * 2, (this.r + 60) * 2)
      .setInteractive({ draggable: true, useHandCursor: true });

    R.add(zone);
    zone.on('pointerdown', (p) => this.turnTo(p));
    zone.on('drag', (p) => this.turnTo(p));
    this.zone = zone;

    this.hooks.setMain('Valider', () => this.check());
  }

  drawHand(g, n, color)
  {
    const p = this.pt(n, this.r - 34);

    g.clear();
    g.lineStyle(14, color, 1).lineBetween(this.cx, this.cy, p.x, p.y);
    g.fillStyle(color, 1).fillCircle(p.x, p.y, 12);
  }

  // L'aiguille va sur le chiffre le plus proche du doigt
  turnTo(p)
  {
    if (this.locked)
    {
      return;
    }

    const a = Math.atan2(p.x - this.cx, -(p.y - this.cy));
    let n = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 6));

    if (n === 0)
    {
      n = 12;
    }

    if (n !== this.value)
    {
      this.value = n;
      RM.Sfx.tick();
      this.drawHand(this.hand, n, RM.C.inkHex);
    }
  }

  check()
  {
    const s = this.scene,
      q = this.q,
      ok = this.value === q.k;

    this.locked = true;
    this.zone.disableInteractive();
    this.hooks.setMain(null);
    RM.Progress.record(q.t, q.k, ok, 'div'); // écrit « N ÷ 5 »

    if (ok)
    {
      this.drawHand(this.hand, this.value, RM.CORR_GREEN);
      RM.Sfx.good();
      this.ding('DING !');
      RM.sparkle(s, this.cx, this.cy, RM.C.gold, 16);
      this.hooks.midi('brag');
      this.hooks.pause(1600, () => this.hooks.done({}));
      return;
    }

    // comme à l'école : son aiguille reste en rouge, la bonne apparaît en vert
    this.drawHand(this.hand, this.value, RM.CORR_RED);
    RM.Sfx.bad();
    this.hooks.error();

    s.time.delayedCall(450, () =>
    {
      if (this.dead)
      {
        return;
      }

      this.good.setVisible(true);
      this.drawHand(this.good, q.k, RM.CORR_GREEN);
      RM.Sfx.pop();
    });

    s.time.delayedCall(800, () =>
    {
      if (!this.dead)
      {
        this.hooks.correct(`${q.N} ÷ ${q.t}`, q.k, () => this.hooks.done({}));
      }
    });
  }

  ding(word)
  {
    const s = this.scene;

    const t = s.add
      .text(this.cx, this.cy - this.r - 70, word, {
        fontFamily: RM.FONT_BD,
        fontSize: '60px',
        color: '#f2c14e',
        stroke: '#3b2a4a',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setAngle(8)
      .setScale(0.3);

    this.root.add(t);
    s.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.easeOut' });
  }

  destroy()
  {
    this.dead = true;
    this.root.destroy();
  }
};
