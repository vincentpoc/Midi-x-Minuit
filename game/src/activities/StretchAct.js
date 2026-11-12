// ============================================================
//  StretchAct — Étirer Long-chat (chapitre 3, multiplication, sans vies).
//    1. Prédire : « Il me faut 7 coups de 5 cm » → la longueur au slider (7 × 5 = ?).
//    2. Vérifier en manipulant : on tire la queue et on lâche ; la gomme le tient
//       étiré coup par coup, les bonds s'affichent (5, 10, 15… 35).
//       Juste : la règle devient verte. Faux : son drapeau reste rouge, le bon en vert.
//       Pas de vie en moins (une manipulation ne coûte pas de fiole), mais Minuit dit la correction.
//    3. SCHLAC ! Long-chat revient d'un coup.
//  q = { t, k }   opts.labels : la règle porte ses nombres (série 1)   opts.demo : main fantôme
//  Les hooks viennent de StoryScene (voir hooks() dans StoryScene.js).
// ============================================================

RM.StretchAct = class
{
  constructor(scene, area, q, hooks, opts = {})
  {
    this.scene = scene;
    this.A = area;
    this.q = q;
    this.hooks = hooks;
    this.o = opts;
    this.L = opts.lines || {};
    this.root = scene.add.container(0, 0);
    this.state = 'predict';
    this.build();
    this.askSlider();
  }

  // Le chat couché sur sa règle graduée (10 coups au maximum)
  build()
  {
    const s = this.scene,
      A = this.A,
      R = this.root,
      q = this.q;

    R.add(RM.text(s, A.x + A.w / 2, A.y + 50, `${q.k} coups de ${q.t} cm`, 44, RM.C.ink));
    this.calcText = RM.text(s, A.x + A.w / 2, A.y + 108, `${q.k} × ${q.t} = ? cm`, 36, '#6b4f7f');
    R.add(this.calcText);

    // le chat (petit) : son nez à gauche, sa queue est le zéro de la règle
    this.cat = new RM.LongCat(s, A.x + 34, A.y + 262, 2);
    R.add(this.cat.c);

    this.x0 = this.cat.tailX(); // le zéro
    this.step = (A.x + A.w - 36 - this.x0) / 10; // px par coup
    this.ry = A.y + 290;

    const g = s.add.graphics();

    g.fillStyle(0xf2d38a, 1).fillRoundedRect(this.x0 - 10, this.ry - 4, this.step * 10 + 20, 34, 6);
    g.lineStyle(3, RM.C.wood, 0.9).strokeRoundedRect(this.x0 - 10, this.ry - 4, this.step * 10 + 20, 34, 6);

    for (let i = 0; i <= 10; i++)
    {
      const x = this.x0 + i * this.step;

      g.fillStyle(RM.C.woodDark, 1).fillRect(x - 2, this.ry - 4, 4, 20);

      if (i < 10)
      {
        g.fillStyle(RM.C.woodDark, 0.5).fillRect(x + this.step / 2 - 1, this.ry - 4, 2, 10);
      }

      if (this.o.labels !== false)
      {
        R.add(RM.text(s, x, this.ry + 46, String(i * q.t), 22, RM.C.ink));
      }
    }

    R.add(g);
    R.add(RM.text(s, A.x + 34, this.ry + 46, 'cm', 22, '#6b4f7f').setOrigin(0, 0.5));

    this.ruler = g;
    this.flags = s.add.container(0, 0);
    this.bonds = s.add.container(0, 0);
    this.layer = s.add.container(0, 0);
    R.add([this.flags, this.bonds, this.layer]);
  }

  // 1. Prédire la longueur au slider (comme la recette)
  askSlider()
  {
    const s = this.scene,
      A = this.A,
      L = this.layer,
      q = this.q;

    const ans = q.t * q.k;
    const lo = Math.max(0, ans - Phaser.Math.Between(3, 17));
    const hi = lo + 20;
    const start = Phaser.Math.Between(lo, hi);

    const box = s.add.graphics();

    box.fillStyle(0xffffff, 0.9).fillRoundedRect(A.x + A.w / 2 - 90, A.y + 380, 180, 84, 18);
    box.lineStyle(4, RM.C.purple, 0.8).strokeRoundedRect(A.x + A.w / 2 - 90, A.y + 380, 180, 84, 18);

    const val = RM.text(s, A.x + A.w / 2, A.y + 422, `${start} cm`, 50, RM.C.ink);

    L.add([box, val]);

    const sl = new RM.Slider(s, A.x + A.w / 2, A.y + 530, A.w - 40, lo, hi, start, (v) => val.setText(`${v} cm`), {
      labels: false,
    });

    this.slider = sl;
    L.add(sl.c);
    L.add(RM.text(s, A.x + 120, A.y + 580, String(lo), 24, '#6b4f7f'));
    L.add(RM.text(s, A.x + A.w - 120, A.y + 580, String(hi), 24, '#6b4f7f'));

    this.hooks.setMain('Valider', () =>
    {
      this.hooks.setMain(null);
      sl.setEnabled(false);
      this.guess = sl.value;
      this.layer.removeAll(true);
      this.calcText.setText(`${q.k} × ${q.t} = ${this.guess} cm ?`);
      this.askPull();
    });
  }

  // 2. Tirer la queue et lâcher
  askPull()
  {
    const s = this.scene,
      A = this.A;

    this.state = 'pull';

    if (this.L.pull)
    {
      this.hooks.say('minuit', this.L.pull);
    }

    // un rond qui pulse sur la queue
    const tx = this.cat.tailX(),
      ty = this.cat.c.y - this.cat.height * 0.5;

    this.glow = s.add.circle(tx - 10, ty, 34, RM.C.gold, 0.45);
    this.root.add(this.glow);
    this.scene.tweens.add({ targets: this.glow, scale: 1.3, alpha: 0.15, duration: 500, yoyo: true, repeat: -1 });

    this.hint = RM.text(s, A.x + A.w / 2, A.y + 430, '→  Tire la queue et lâche !', 34, '#6b4f7f');
    this.root.add(this.hint);

    // zone de prise autour de la queue (généreuse) : on tire vers la droite
    const zone = s.add.zone(tx - 20, ty, 160, 160).setInteractive({ draggable: true, useHandCursor: true });

    this.root.add(zone);
    this.zone = zone;

    zone.on('dragstart', () => RM.Sfx.tap());

    zone.on('drag', (p) =>
    {
      if (this.state !== 'pull')
      {
        return;
      }

      const pull = Phaser.Math.Clamp(p.x - tx, 0, 120);

      this.cat.setLength(this.cat.base + pull);
      this.pulled = pull;
    });

    zone.on('dragend', () =>
    {
      if (this.state !== 'pull')
      {
        return;
      }

      if ((this.pulled || 0) < 25)
      {
        this.cat.setLength(this.cat.base);
        return;
      }

      this.state = 'bonds';
      zone.disableInteractive();
      this.glow.destroy();
      this.hint.setText('');
      this.runBonds();
    });

    if (this.o.demo)
    {
      this.ghost(tx - 10, ty);
    }
  }

  // La main fantôme tire la queue une fois
  ghost(x, y)
  {
    const s = this.scene;
    const hand = s.add.container(x, y);
    const g = s.add.graphics();

    g.fillStyle(0xffffff, 0.85).fillCircle(0, 0, 24);
    g.lineStyle(4, 0x7a3fa0, 0.9).strokeCircle(0, 0, 24);
    g.fillStyle(0x7a3fa0, 0.5).fillCircle(0, 0, 9);
    hand.add(g);
    hand.setAlpha(0);
    this.root.add(hand);

    s.tweens.chain({
      tweens: [
        { targets: hand, alpha: 1, duration: 250, delay: 300 },
        {
          targets: hand,
          x: x + 110,
          duration: 800,
          ease: 'Sine.easeInOut',
          onUpdate: () =>
          {
            if (this.state === 'pull')
            {
              this.cat.setLength(this.cat.base + (hand.x - x));
            }
          },
        },
        { targets: hand, alpha: 0, duration: 200 },
      ],
      onComplete: () =>
      {
        hand.destroy();

        if (this.state === 'pull' && !this.dead)
        {
          this.cat.setLength(this.cat.base);
        }
      },
    });
  }

  // Les bonds : la gomme le tient étiré, un coup après l'autre
  runBonds()
  {
    const s = this.scene,
      q = this.q;

    let i = 0;

    this.cat.setLength(this.cat.base);

    const bond = () =>
    {
      if (this.dead)
      {
        return;
      }

      if (i >= q.k)
      {
        s.time.delayedCall(350, () => this.check());
        return;
      }

      i++;

      const from = this.cat.len;
      const to = this.cat.base + i * this.step;
      const lenObj = { v: from };

      s.tweens.add({
        targets: lenObj,
        v: to,
        duration: 230,
        ease: 'Back.easeOut',
        onUpdate: () => this.cat.setLength(lenObj.v),
      });

      RM.Sfx.tone(300 + i * 45, 0.1, 'triangle', 0.09);

      // le bond : un petit arc et le nombre atteint
      const x = this.x0 + i * this.step;
      const arc = s.add.graphics();

      arc.lineStyle(3, 0x7a3fa0, 0.8);
      arc.beginPath();
      arc.arc(x - this.step / 2, this.ry - 10, this.step / 2, Math.PI, 0, false);
      arc.strokePath();
      this.bonds.add(arc);
      // le nombre atteint, au-dessus du chat (pour ne pas le cacher)
      this.bonds.add(RM.text(s, x, this.cat.c.y - this.cat.height - 22, String(i * q.t), 26, '#7a3fa0'));

      s.time.delayedCall(330, bond);
    };

    bond();
  }

  // Un drapeau au-dessus de la règle, à la longueur v
  flag(v, color)
  {
    const s = this.scene;
    const x = Phaser.Math.Clamp(this.x0 + (v / this.q.t) * this.step, this.x0 - 10, this.x0 + 10 * this.step + 10);
    const y = this.ry + 80;
    const g = s.add.graphics();

    g.fillStyle(color, 1).fillTriangle(x, y - 30, x - 14, y, x + 14, y);
    this.flags.add(g);
    this.flags.add(RM.text(s, x, y + 26, `${v}`, 30, color === RM.CORR_GREEN ? RM.GOOD : RM.BAD));
    return g;
  }

  // Juste ou faux ? Puis SCHLAC !
  check()
  {
    const s = this.scene,
      q = this.q,
      ans = q.t * q.k,
      ok = this.guess === ans;

    RM.Progress.record(q.t, q.k, ok, 'ba'); // écrit « k × t »

    const finish = () => this.schlac();

    if (ok)
    {
      this.flag(this.guess, RM.CORR_GREEN);
      this.ruler.setAlpha(1);
      this.calcText.setText(`${q.k} × ${q.t} = ${ans} cm ✓`).setColor(RM.GOOD);
      RM.Sfx.good();
      RM.sparkle(s, this.cat.tailX(), this.ry - 30, RM.C.gold, 14);
      this.hooks.midi('brag');
      this.hooks.pause(1600, finish);
    }
    else
    {
      // comme à l'école : sa réponse reste en rouge, la bonne s'écrit en vert
      this.flag(this.guess, RM.CORR_RED);
      this.flag(ans, RM.CORR_GREEN);
      this.calcText.setText(`${q.k} × ${q.t} = ${ans} cm`).setColor(RM.GOOD);
      RM.Sfx.bad();

      // pas de vie en moins : seulement la correction
      s.time.delayedCall(600, () =>
      {
        if (!this.dead)
        {
          this.hooks.correct(`${q.k} × ${q.t}`, ans, finish);
        }
      });
    }
  }

  // 3. SCHLAC ! Il revient d'un coup
  schlac()
  {
    const s = this.scene;

    if (this.dead)
    {
      return;
    }

    const lenObj = { v: this.cat.len };

    RM.Sfx.pop();

    const t = s.add
      .text(this.A.x + this.A.w / 2, this.A.y + 200, 'SCHLAC !', {
        fontFamily: RM.FONT_BD,
        fontSize: '84px',
        color: '#e8590c',
        stroke: '#3b2a4a',
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setAngle(-6)
      .setScale(0.3);

    this.root.add(t);
    s.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.bonds.removeAll(true);

    s.tweens.add({
      targets: lenObj,
      v: this.cat.base,
      duration: 220,
      ease: 'Cubic.easeIn',
      onUpdate: () => this.cat.setLength(lenObj.v),
      onComplete: () => s.time.delayedCall(650, () => !this.dead && this.hooks.done({})),
    });
  }

  destroy()
  {
    this.dead = true;
    this.root.destroy();
  }
};
