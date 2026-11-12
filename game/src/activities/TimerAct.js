// ============================================================
//  TimerAct — Le minuteur (chapitre 3, division par 5).
//    À gauche l'ingrédient et son temps (« 40 s »), à droite le minuteur.
//    « Sur quel chiffre je mets le minuteur ? » Le cadran a les chiffres 1 à 12 comme une horloge,
//    chaque chiffre vaut 5 s. On tourne la petite aiguille, puis « Valider ».
//    Le suspense : l'aiguille remonte vers le zéro (tic, tic, tic…) pendant que l'ingrédient
//    gigote et se déforme dans tous les sens. DING ! Juste : des étoiles. Faux : il explose,
//    s'envole dans un coin, rebondit partout comme Long-chat et fait tomber des ingrédients.
//    Série 1 : les secondes sont écrites autour du cadran (5, 10, 15…) ; série 2 : seulement les chiffres.
//    Erreur = une vie en moins ; son aiguille revient en rouge, la bonne s'affiche en vert.
//  q = { t: 5, k, N, ing }   opts.labels : les secondes autour du cadran   opts.ings : pour le désordre
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

  // Le point du cadran pour le chiffre n (n peut être entre deux chiffres), à la distance r du centre
  pt(n, r)
  {
    const a = (n / 12) * Math.PI * 2;

    return { x: this.cx + Math.sin(a) * r, y: this.cy - Math.cos(a) * r };
  }

  build()
  {
    const s = this.scene,
      A = this.A,
      R = this.root,
      q = this.q;

    this.cx = A.x + A.w - 215;
    this.cy = A.y + 330;
    this.r = 165;

    // à gauche : le temps, et l'ingrédient à cuire
    this.ix = A.x + 135;
    this.iy = this.cy + 30;
    R.add(RM.text(s, this.ix, this.cy - 130, `${q.N} s`, 72, '#45306e', { fontFamily: RM.FONT_NB }));
    this.ing = RM.icon(s, this.ix, this.iy, q.ing.sprite, 150);
    this.ingScale = { x: this.ing.scaleX, y: this.ing.scaleY };
    R.add(this.ing);

    const g = s.add.graphics();

    // le boîtier du minuteur
    g.fillStyle(RM.C.woodDark, 1).fillCircle(this.cx, this.cy + 6, this.r + 22);
    g.fillStyle(0xd94f3d, 1).fillCircle(this.cx, this.cy, this.r + 18);
    g.fillStyle(0xfff6e6, 1).fillCircle(this.cx, this.cy, this.r);

    for (let i = 0; i < 60; i++)
    {
      const a = (i / 60) * Math.PI * 2,
        big = i % 5 === 0;

      const r1 = this.r - (big ? 16 : 8);

      g.lineStyle(big ? 4 : 2, RM.C.inkHex, big ? 0.9 : 0.4);
      g.lineBetween(
        this.cx + Math.sin(a) * r1,
        this.cy - Math.cos(a) * r1,
        this.cx + Math.sin(a) * (this.r - 3),
        this.cy - Math.cos(a) * (this.r - 3),
      );
    }

    R.add(g);

    for (let n = 1; n <= 12; n++)
    {
      const p = this.pt(n, this.r - 42);

      R.add(RM.text(s, p.x, p.y, String(n), 36, RM.C.ink, { fontFamily: RM.FONT_NB }));

      // série 1 : les secondes, en petit, autour du cadran
      if (this.o.labels)
      {
        const p2 = this.pt(n, this.r + 40);

        R.add(
          RM.text(s, p2.x, p2.y, String(n * 5), 20, '#7a3fa0', {
            fontFamily: RM.FONT_NB,
            stroke: '#fff6e6',
            strokeThickness: 5,
          }),
        );
      }
    }

    // les aiguilles (courtes : elles ne cachent pas les chiffres) : la sienne, et la bonne (cachée)
    this.good = s.add.graphics().setVisible(false);
    this.hand = s.add.graphics();
    R.add([this.good, this.hand]);
    R.add(s.add.circle(this.cx, this.cy, 11, RM.C.inkHex));
    this.drawHand(this.hand, this.value, RM.C.inkHex);

    // on tourne en touchant ou en glissant n'importe où sur le cadran
    const zone = s.add
      .zone(this.cx, this.cy, (this.r + 50) * 2, (this.r + 50) * 2)
      .setInteractive({ draggable: true, useHandCursor: true });

    R.add(zone);
    zone.on('pointerdown', (p) => this.turnTo(p));
    zone.on('drag', (p) => this.turnTo(p));
    this.zone = zone;

    this.hooks.setMain('Valider', () => this.check());
  }

  drawHand(g, n, color)
  {
    const p = this.pt(n, this.r * 0.42);

    g.clear();
    g.lineStyle(9, color, 1).lineBetween(this.cx, this.cy, p.x, p.y);
    g.fillStyle(color, 1).fillTriangle(
      ...Object.values(this.pt(n, this.r * 0.56)),
      ...Object.values(this.pt(n - 0.45, this.r * 0.4)),
      ...Object.values(this.pt(n + 0.45, this.r * 0.4)),
    );
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

  // Valider : d'abord le suspense, ensuite seulement la réponse
  check()
  {
    const s = this.scene,
      q = this.q,
      ok = this.value === q.k;

    this.locked = true;
    this.zone.disableInteractive();
    this.hooks.setMain(null);
    RM.Progress.record(q.t, q.k, ok, 'div'); // écrit « N ÷ 5 »

    // l'aiguille remonte vers le zéro : tic, tic, tic…
    const o = { n: this.value % 12 === 0 ? 12 : this.value };
    const ms = 900 + o.n * 110;
    let last = Math.ceil(o.n);

    s.tweens.add({
      targets: o,
      n: 0,
      duration: ms,
      ease: 'Sine.easeIn',
      onUpdate: () =>
      {
        this.drawHand(this.hand, o.n, RM.C.inkHex);

        if (Math.ceil(o.n) !== last)
        {
          last = Math.ceil(o.n);
          RM.Sfx.tick();
        }
      },
    });

    // l'ingrédient cuit : il gigote et se déforme, de plus en plus fort
    const B = this.ingScale;
    const wig = { k: 0 };

    s.tweens.add({ targets: wig, k: 1, duration: ms, ease: 'Quad.easeIn' });

    this.wiggle = s.time.addEvent({
      delay: 70,
      loop: true,
      callback: () =>
      {
        const k = 0.15 + wig.k * 0.5;

        this.ing.setScale(B.x * (1 + (Math.random() - 0.5) * 2 * k), B.y * (1 + (Math.random() - 0.5) * 2 * k));
        this.ing.setAngle((Math.random() - 0.5) * 50 * (0.3 + wig.k));
        this.ing.setPosition(this.ix + (Math.random() - 0.5) * 16 * wig.k, this.iy + (Math.random() - 0.5) * 16 * wig.k);
      },
    });

    s.time.delayedCall(ms + 80, () =>
    {
      if (this.dead)
      {
        return;
      }

      this.wiggle.remove();
      this.ing.setAngle(0).setPosition(this.ix, this.iy);
      this.ding('DING !');

      if (ok)
      {
        this.right();
      }
      else
      {
        this.wrong();
      }
    });
  }

  // Juste : cuit à point, des étoiles
  right()
  {
    const s = this.scene,
      B = this.ingScale;

    this.drawHand(this.hand, this.value, RM.CORR_GREEN);
    this.ing.setScale(B.x, B.y);
    s.tweens.add({ targets: this.ing, scaleX: B.x * 1.25, scaleY: B.y * 1.25, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
    RM.Sfx.good();
    RM.sparkle(s, this.ix, this.iy, RM.C.gold, 22);
    RM.sparkle(s, this.cx, this.cy, RM.C.gold, 12);
    this.hooks.midi('brag');
    this.hooks.pause(1600, () => this.hooks.done({}));
  }

  // Faux : il explose, file dans un coin et rebondit partout ; des ingrédients tombent
  wrong()
  {
    const s = this.scene,
      A = this.A,
      q = this.q,
      B = this.ingScale;

    RM.Sfx.bad();
    RM.Sfx.pop();
    s.cameras.main.shake(160, 0.008);
    RM.sparkle(s, this.ix, this.iy, 0xff7a3d, 26);
    this.root.remove(this.ing);
    this.ing.setScale(B.x * 0.7, B.y * 0.7).setDepth(30);
    RM.Mess.panic(s);

    const icons = (this.o.ings || [q.ing]).map((i) => i.sprite);

    RM.bounce(s, this.ing, A, {
      vx: -1500,
      vy: -1500, // d'abord vers le coin en haut à gauche
      bounces: 5,
      exit: true,
      r: 46,
      spin: 1100,
      onHit: () =>
      {
        RM.Sfx.tap();
        s.cameras.main.shake(70, 0.004);
        RM.Mess.drop(s, 1, { icons });
      },
      onDone: () =>
      {
        if (this.dead)
        {
          return;
        }

        // comme à l'école : son aiguille revient en rouge, la bonne apparaît en vert
        this.drawHand(this.hand, this.value, RM.CORR_RED);
        this.good.setVisible(true);
        this.drawHand(this.good, q.k, RM.CORR_GREEN);
        RM.Sfx.pop();
        this.hooks.error();

        s.time.delayedCall(700, () =>
        {
          if (!this.dead)
          {
            this.hooks.correct(`${q.N} ÷ ${q.t}`, q.k, () => this.hooks.done({}));
          }
        });
      },
    });
  }

  ding(word)
  {
    const s = this.scene;

    const t = s.add
      .text(this.cx, this.cy - this.r - 66, word, {
        fontFamily: RM.FONT_BD,
        fontSize: '56px',
        color: '#f2c14e',
        stroke: '#3b2a4a',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setAngle(8)
      .setScale(0.3);

    this.root.add(t);
    RM.Sfx.tone(1400, 0.5, 'sine', 0.12);
    s.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.easeOut' });
  }

  destroy()
  {
    this.dead = true;

    if (this.wiggle)
    {
      this.wiggle.remove();
    }

    if (this.ing && this.ing.active)
    {
      this.ing.destroy();
    }

    this.root.destroy();
  }
};
