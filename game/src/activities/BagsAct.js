// ============================================================
//  BagsAct — Les sacs de Midi : ranger sur l'étagère (rangées × colonnes).
//    Le nombre total est écrit sur le sac. Le goûter de Midi est
//    caché dans le sac : quand il arrive sur l'étagère, Midi le mange.
//  Les hooks viennent de StoryScene (voir hooks() dans StoryScene.js).
// ============================================================

RM.BagsAct = class
{
  // bag = { ing, t, k, N }, fixed = colonnes imposées (= t), snack = le goûter de Midi
  constructor(scene, area, bag, fixed, snack, hooks)
  {
    this.scene = scene;
    this.A = area;
    this.bag = bag;
    this.fixed = fixed;
    this.snack = snack;
    this.hooks = hooks;
    this.root = scene.add.container(0, 0);
    this.rows = 2;
    this.cols = fixed ? bag.t : 2;

    // le goûter de Midi est caché dans certains sacs seulement (snack = null : pas de goûter)
    this.intrusAt = snack ? Phaser.Math.Between(1, bag.N - 1) : -1; // jamais le premier ni le dernier
    this.intrusRemoved = false;
    this.locked = false;
    this.showCounts = false;
    this.build();
    this.hooks.setMain('Valider', () => this.validate());
  }

  // Dessine le sac, l'étagère et les boutons rangées / colonnes
  build()
  {
    const s = this.scene,
      A = this.A,
      R = this.root,
      b = this.bag;

    // le sac, avec le nombre total d'ingrédients écrit dessus (il ne change pas)
    const sx = A.x + 92,
      sy = A.y + 82;

    const sack = s.add.graphics();

    sack.fillStyle(0x7a5232, 1).fillRoundedRect(sx - 62, sy - 52, 124, 112, 34);
    sack.fillStyle(0xa8744a, 1).fillRoundedRect(sx - 55, sy - 45, 110, 98, 30);
    sack.fillStyle(0x5a3a22, 1).fillRect(sx - 30, sy - 62, 60, 16);
    R.add(sack);

    this.sackNum = RM.text(s, sx, sy + 6, String(b.N), 50, RM.C.cream, {
      stroke: '#5a3a22',
      strokeThickness: 6,
    });

    R.add(this.sackNum);
    R.add(RM.icon(s, A.x + 196, A.y + 60, b.ing.sprite, 44));
    R.add(RM.text(s, A.x + 228, A.y + 60, b.ing.plural, 28, RM.C.ink).setOrigin(0, 0.5));
    this.status = RM.text(s, A.x + 180, A.y + 108, '', 26, '#6b4f7f').setOrigin(0, 0.5);
    R.add(this.status);

    if (this.fixed)
    {
      R.add(
        RM.text(s, A.x + A.w - 36, A.y + 108, `${b.t} colonnes`, 26, '#6b4f7f').setOrigin(1, 0.5),
      );
    }

    this.tray = { x: A.x + 40, y: A.y + 150, w: A.w - 130, h: 260 };
    this.gridLayer = s.add.container(0, 0);
    R.add(this.gridLayer);

    // rangées et colonnes : de gros boutons − et + (plus faciles que les sliders)
    const y1 = A.y + 470,
      y2 = A.y + 565;

    R.add(RM.text(s, A.x + 40, y1, 'Rangées', 30, RM.C.ink).setOrigin(0, 0.5));
    R.add(RM.text(s, A.x + 40, y2, 'Colonnes', 30, RM.C.ink).setOrigin(0, 0.5));

    this.rowSlider = this.stepper(
      A.x + 430,
      y1,
      () => this.rows,
      (v) => { this.rows = v; },
    );

    this.colSlider = this.stepper(
      A.x + 430,
      y2,
      () => this.cols,
      (v) => { this.cols = v; },
    );

    if (this.fixed)
    {
      this.colSlider.setEnabled(false);
    }

    this.draw();
  }

  // − valeur + (de 2 à 10 : jamais de calcul × 1). Renvoie { setEnabled, animateTo } comme l'ancien slider.
  stepper(x, y, get, set)
  {
    const s = this.scene,
      R = this.root;

    const val = RM.text(s, x, y, String(get()), 48, RM.C.ink);

    const change = (d, fromUser = true) =>
    {
      const v = Phaser.Math.Clamp(get() + d, 2, 10);

      if (v === get())
      {
        if (fromUser)
        {
          RM.Sfx.tick();
        }

        return;
      }

      set(v);
      val.setText(String(v));

      if (fromUser)
      {
        this.showCounts = false;
        RM.Sfx.tap();
      }

      this.draw();
    };

    const minus = RM.roundButton(s, x - 120, y, 38, '−', () => change(-1));
    const plus = RM.roundButton(s, x + 120, y, 38, '+', () => change(+1));

    R.add([val, minus, plus]);

    return {
      setEnabled: (b) =>
      {
        minus.setEnabled(b);
        plus.setEnabled(b);
        val.setAlpha(b ? 1 : 0.5);
      },

      animateTo: (target) =>
      {
        const step = () =>
        {
          if (this.dead || get() === target)
          {
            return;
          }

          change(get() < target ? 1 : -1, false);
          this.scene.time.delayedCall(90, step);
        };

        step();
      },
    };
  }

  // contenu du sac dans l'ordre : N ingrédients + le goûter (tant que Midi ne l'a pas mangé)
  items()
  {
    const list = [];

    for (let j = 0; j < this.bag.N; j++)
    {
      if (j === this.intrusAt && !this.intrusRemoved)
      {
        list.push('intrus');
      }

      list.push('ok');
    }

    return list;
  }

  // Redessine l'étagère selon les rangées et colonnes choisies.
  // Si le goûter de Midi arrive sur l'étagère, il sort et on redessine sans lui.
  draw()
  {
    const s = this.scene,
      T = this.tray,
      L = this.gridLayer;

    L.removeAll(true);

    const cells = this.rows * this.cols;
    const list = this.items();
    const size = Math.min(Math.floor(T.w / this.cols), Math.floor(T.h / this.rows), 60);

    const gw = size * this.cols,
      gh = size * this.rows;

    const gx = T.x + (T.w - gw) / 2,
      gy = T.y + (T.h - gh) / 2;

    const g = s.add.graphics();

    g.fillStyle(RM.C.woodDark, 1).fillRoundedRect(gx - 14, gy - 12, gw + 28, gh + 22, 10);
    g.fillStyle(0x8a5a3c, 1).fillRect(gx - 8, gy - 6, gw + 16, gh + 8);

    for (let r = 0; r < this.rows; r++)
    {
      g.fillStyle(RM.C.wood, 1).fillRect(gx - 10, gy + (r + 1) * size - 4, gw + 20, 6);
    }

    // cases vides en pointillés
    for (let c = 0; c < cells; c++)
    {
      if (c >= list.length)
      {
        const x = gx + (c % this.cols) * size,
          y = gy + Math.floor(c / this.cols) * size;

        g.lineStyle(2, 0xf6e7c8, 0.5).strokeRoundedRect(x + 4, y + 4, size - 8, size - 10, 6);
      }
    }

    L.add(g);

    let realShown = 0;

    for (let c = 0; c < Math.min(cells, list.length); c++)
    {
      const x = gx + (c % this.cols) * size + size / 2,
        y = gy + Math.floor(c / this.cols) * size + size / 2 - 3;

      if (list[c] === 'intrus')
      {
        // le goûter sort du sac : Midi se jette dessus (ce n'est pas une erreur)
        this.intrusRemoved = true;

        const ic = RM.icon(s, x, y, this.snack.sprite, size - 6).setDepth(7);

        s.tweens.add({
          targets: ic,
          y: y - 30,
          scale: ic.scale * 1.3,
          duration: 300,
          ease: 'Back.easeOut',
        });

        this.hooks.midiEat(x, y - 30, ic, this.snack);
        s.time.delayedCall(0, () => this.draw());
        return;
      }

      realShown++;
      L.add(RM.icon(s, x, y, this.bag.ing.sprite, size - 8));
    }

    if (this.showCounts)
    {
      for (let r = 0; r < this.rows; r++)
      {
        L.add(
          RM.text(
            s,
            gx + gw + 22,
            gy + r * size + size / 2,
            String((r + 1) * this.cols),
            Math.min(28, size * 0.65),
            '#5b3f8a',
          ).setOrigin(0, 0.5),
        );
      }
    }

    // reste dans le sac (en texte, à côté) / cases vides
    const left = this.bag.N - realShown;
    const empty = Math.max(0, cells - list.length);

    this.status
      .setText(
        left > 0
          ? `il en reste ${left} dans le sac`
          : empty > 0
            ? `${empty} case${empty > 1 ? 's' : ''} vide${empty > 1 ? 's' : ''}`
            : 'le sac est vide !',
      )
      .setColor(left > 0 ? '#6b4f7f' : empty > 0 ? RM.BAD : RM.C.greenText);
  }

  // Valider : la bonne réponse félicite ; sinon, on montre la bonne étagère puis la correction
  validate()
  {
    if (this.locked)
    {
      return;
    }

    this.locked = true;
    this.hooks.setMain(null);
    this.rowSlider.setEnabled(false);
    this.colSlider.setEnabled(false);

    const b = this.bag;

    if (!this.intrusRemoved)
    {
      this.intrusRemoved = true;
    }

    const ok = this.rows * this.cols === b.N;

    this.showCounts = true;
    this.draw();
    RM.Progress.record(b.t, b.k, ok, 'div');

    if (ok)
    {
      RM.Sfx.good();
      RM.sparkle(this.scene, this.A.x + this.A.w / 2, this.A.y + 280, RM.C.gold, 18);
      this.caption(`${this.rows} × ${this.cols} = ${b.N}`);
      this.hooks.midi('brag');
      this.hooks.pause(2000, () => this.hooks.done({}));
    }
    else
    {
      // erreur : on montre la bonne étagère un instant, puis on continue
      RM.Sfx.bad();
      this.hooks.error();
      this.hooks.midi('mock');

      this.scene.time.delayedCall(1000, () =>
      {
        if (this.dead)
        {
          return;
        }

        if (!this.fixed)
        {
          this.colSlider.animateTo(b.t);
        }

        this.rowSlider.animateTo(b.k);
      });

      this.scene.time.delayedCall(1700, () =>
      {
        if (this.dead)
        {
          return;
        }

        this.showCounts = true;
        this.draw();
        this.caption(`${b.k} rangées de ${b.t} = ${b.N}`);
      });

      this.scene.time.delayedCall(2700, () =>
      {
        if (this.dead)
        {
          return;
        }

        this.hooks.correct(`${b.k} × ${b.t}`, b.N, () => this.hooks.done({}));
      });
    }
  }

  // Le calcul affiché sous l'étagère
  caption(str)
  {
    if (this.cap)
    {
      this.cap.destroy();
    }

    this.cap = RM.text(
      this.scene,
      this.A.x + this.A.w / 2,
      this.A.y + 420,
      str,
      32,
      RM.C.greenText,
      { backgroundColor: '#fff6e6', padding: { x: 12, y: 4 } },
    );

    this.root.add(this.cap);
  }

  // Enlève l'activité de l'écran ; les minuteries en attente vérifient this.dead
  destroy()
  {
    this.dead = true;
    this.root.destroy();
  }
};
