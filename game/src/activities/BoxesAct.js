// ============================================================
//  BoxesAct — Les boîtes (division, chapitre 1) : « Range les 24 citrouilles dans
//  des boîtes de 4 : combien de boîtes ? » La taille est imposée (2, 4 ou 8 places),
//  un bouton − / + choisit le nombre de boîtes (de 1 à 10).
//  Erreur : on garde ses boîtes (cases vides s'il y en a trop, ingrédients en trop posés
//  en vrac par-dessus s'il en manque), son nombre en rouge et le bon en vert à côté.
//  Les hooks viennent de StoryScene (voir hooks() dans StoryScene.js).
// ============================================================

RM.BoxesAct = class
{
  // q = { ing, t (taille des boîtes), k (bon nombre de boîtes), N }
  constructor(scene, area, q, hooks)
  {
    this.scene = scene;
    this.A = area;
    this.q = q;
    this.hooks = hooks;
    this.count = 1;
    this.filled = false;
    this.locked = false;
    this.root = scene.add.container(0, 0);
    this.build();
    this.hooks.setMain('Valider', () => this.validate());
  }

  // Dessine le titre, la zone des boîtes et le bouton − / +
  build()
  {
    const s = this.scene,
      A = this.A,
      R = this.root,
      q = this.q;

    R.add(RM.icon(s, A.x + 70, A.y + 52, q.ing.sprite, 52));

    R.add(
      RM.text(s, A.x + 110, A.y + 52, `${q.N} ${q.ing.plural}`, 36, RM.C.ink).setOrigin(0, 0.5),
    );

    R.add(RM.text(s, A.x + A.w - 36, A.y + 52, `boîtes de ${q.t}`, 36, '#6b4f7f').setOrigin(1, 0.5));
    this.boxLayer = s.add.container(0, 0);
    R.add(this.boxLayer);
    this.status = RM.text(s, A.x + A.w / 2, A.y + 430, '', 30, '#6b4f7f');
    R.add(this.status);

    // − nombre de boîtes +
    const y = A.y + 530;
    const g = s.add.graphics();

    g.fillStyle(0xffffff, 0.85).fillRoundedRect(A.x + A.w / 2 - 110, y - 52, 220, 104, 20);
    g.lineStyle(4, RM.C.purple, 0.8).strokeRoundedRect(A.x + A.w / 2 - 110, y - 52, 220, 104, 20);
    R.add(g);
    R.add(RM.text(s, A.x + A.w / 2, y - 26, 'boîtes', 26, '#6b4f7f'));
    this.countText = RM.text(s, A.x + A.w / 2, y + 16, String(this.count), 52, RM.C.ink);
    R.add(this.countText);
    this.minus = RM.roundButton(s, A.x + A.w / 2 - 190, y, 44, '−', () => this.change(-1));
    this.plus = RM.roundButton(s, A.x + A.w / 2 + 190, y, 44, '+', () => this.change(+1));
    R.add([this.minus, this.plus]);
    this.draw();
  }

  // Ajoute (d = 1) ou retire (d = -1) une boîte, de 1 à 10
  change(d)
  {
    if (this.locked)
    {
      return;
    }

    const v = Phaser.Math.Clamp(this.count + d, 1, 10);

    if (v === this.count)
    {
      RM.Sfx.tick();
      return;
    }

    this.count = v;
    RM.Sfx.tap();
    this.countText.setText(String(v));
    this.scene.tweens.add({ targets: this.countText, scale: 1.3, duration: 120, yoyo: true });
    this.draw();
  }

  // forme d'une boîte : 2 = 2 × 1, 4 = 2 × 2 (la boîte carrée), 8 = 4 × 2
  shape(n)
  {
    return n === 8 ? { c: 4, r: 2 } : n === 4 ? { c: 2, r: 2 } : { c: 2, r: 1 };
  }

  // Redessine les boîtes ; après « Valider » (this.filled), elles se remplissent
  draw()
  {
    const s = this.scene,
      A = this.A,
      L = this.boxLayer,
      q = this.q;

    L.removeAll(true);

    const { c, r } = this.shape(q.t);
    const n = this.count;

    // les cases rétrécissent si les boîtes ne tiennent pas dans la zone (300 px de haut)
    let cell = 34,
      pad = 8,
      bw,
      bh,
      perRow,
      rows;

    do
    {
      bw = c * cell + pad * 2;
      bh = r * cell + pad * 2 + 8;
      perRow = Math.max(1, Math.min(n, Math.floor((A.w - 40) / (bw + 16))));
      rows = Math.ceil(n / perRow);
      cell -= 2;
    }
    while (rows * (bh + 14) > 300 && cell > 16);

    cell += 2;
    const top = A.y + 100 + Math.max(0, (300 - rows * (bh + 14)) / 2);
    let placed = 0;
    const zone = { x1: Infinity, x2: -Infinity, y1: top, y2: top };

    for (let b = 0; b < n; b++)
    {
      const row = Math.floor(b / perRow),
        col = b % perRow;

      const inRow = Math.min(perRow, n - row * perRow);
      const x = A.x + A.w / 2 - (inRow * (bw + 16) - 16) / 2 + col * (bw + 16);
      const y = top + row * (bh + 14);
      const g = s.add.graphics();

      zone.x1 = Math.min(zone.x1, x);
      zone.x2 = Math.max(zone.x2, x + bw);
      zone.y2 = Math.max(zone.y2, y + bh);

      L.add(g);
      g.fillStyle(0x7a5232, 1).fillRoundedRect(x, y + 4, bw, bh, 8);
      g.fillStyle(0xc08a52, 1).fillRoundedRect(x, y, bw, bh - 4, 8);
      g.fillStyle(0xa8744a, 1).fillRect(x + 4, y + 4, bw - 8, 6);

      for (let i = 0; i < q.t; i++)
      {
        const cx = x + pad + (i % c) * cell,
          cy = y + pad + 6 + Math.floor(i / c) * cell;

        g.fillStyle(0x8a5a3c, 1).fillRoundedRect(cx + 2, cy + 2, cell - 4, cell - 4, 5);

        if (this.filled && placed < q.N)
        {
          const ic = RM.icon(s, cx + cell / 2, cy + cell / 2, q.ing.sprite, cell - 6);

          L.add(ic);
          placed++;
        }
      }
    }

    if (this.filled)
    {
      // pas assez de boîtes : les ingrédients en trop sont posés en vrac par-dessus,
      // comme si Midi avait surchargé les boîtes (trop de boîtes : les cases restent vides)
      if (!this.extra)
      {
        this.extra = [];

        for (let i = placed; i < q.N; i++)
        {
          this.extra.push({
            x: Phaser.Math.Between(zone.x1 + 10, zone.x2 - 10),
            y: Phaser.Math.Between(zone.y1 + 4, zone.y2 - 4),
            a: Phaser.Math.Between(-40, 40),
          });
        }
      }

      this.extra.forEach((e, i) =>
      {
        const ic = RM.icon(s, e.x, e.y, q.ing.sprite, cell - 2).setAngle(e.a);

        const sc = ic.scaleX;

        L.add(ic);
        ic.setScale(0);
        s.tweens.add({ targets: ic, scale: sc, duration: 220, delay: 300 + i * 70, ease: 'Back.easeOut' });
      });

      this.status.setText('');
    }
    else
    {
      this.status.setText('Choisis le nombre de boîtes avec − et +').setColor('#6b4f7f');
    }
  }

  // Valider : le bon nombre félicite ; sinon, on montre le bon nombre puis la correction
  validate()
  {
    if (this.locked)
    {
      return;
    }

    this.locked = true;
    this.hooks.setMain(null);
    this.minus.setEnabled(false);
    this.plus.setEnabled(false);

    const q = this.q;
    const ok = this.count === q.k;

    this.filled = true;
    this.draw();
    RM.Progress.record(q.t, q.k, ok, 'div'); // écrit « N ÷ t »

    if (ok)
    {
      RM.Sfx.good();
      RM.sparkle(this.scene, this.A.x + this.A.w / 2, this.A.y + 250, RM.C.gold, 18);
      this.caption(`${q.N} ÷ ${q.t} = ${q.k}`);
      this.hooks.midi('brag');
      this.hooks.pause(2000, () => this.hooks.done({}));
    }
    else
    {
      RM.Sfx.bad();
      this.hooks.error();
      this.hooks.midi('mock');

      // on garde ses boîtes ; son nombre passe en rouge, le bon s'écrit en vert à côté,
      // puis la bonne opération sous les boîtes
      this.countText.setColor(RM.BAD);

      this.scene.time.delayedCall(1300, () =>
      {
        if (this.dead)
        {
          return;
        }

        const A = this.A;

        const fix = RM.text(this.scene, A.x + A.w / 2 + 70, A.y + 520, String(q.k), 56, RM.GOOD)
          .setAngle(-6)
          .setScale(0);

        this.root.add(fix);
        RM.Sfx.pop();
        this.scene.tweens.add({ targets: fix, scale: 1, duration: 260, ease: 'Back.easeOut' });
        this.caption(`${q.N} ÷ ${q.t} = ${q.k}`);
      });

      this.scene.time.delayedCall(2600, () =>
      {
        if (!this.dead)
        {
          this.hooks.correct(`${q.N} ÷ ${q.t}`, q.k, () => this.hooks.done({}));
        }
      });
    }
  }

  // Le calcul affiché sous les boîtes (remplace le message d'état)
  caption(str)
  {
    if (this.cap)
    {
      this.cap.destroy();
    }

    this.cap = RM.text(this.scene, this.A.x + this.A.w / 2, this.A.y + 430, str, 40, RM.GOOD, {
      backgroundColor: '#fff6e6',
      padding: { x: 14, y: 4 },
    });

    this.status.setText('');
    this.root.add(this.cap);
  }

  // Enlève l'activité de l'écran ; les minuteries en attente vérifient this.dead
  destroy()
  {
    this.dead = true;
    this.root.destroy();
  }
};
