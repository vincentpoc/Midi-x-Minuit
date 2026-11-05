// ============================================================
//  RecipeAct — La recette : une série de 3 multiplications, chacune au slider
//    (plage proche de la réponse). Plus de « vrai ou faux » de Midi.
//    Erreur = sa réponse reste en rouge, la bonne s'écrit en vert à côté (et Minuit la dit).
//  Les hooks viennent de StoryScene (voir hooks() dans StoryScene.js).
// ============================================================

RM.RecipeAct = class
{
  // lines = [{ ing, t, k }]  (k sachets de t → t × k)
  // free = true : série sans pénalité (les erreurs ne comptent pas)
  constructor(scene, area, lines, hooks, opts = {})
  {
    this.scene = scene;
    this.A = area;
    this.lines = lines;
    this.hooks = hooks;
    this.free = !!opts.free;
    this.misses = 0;
    this.root = scene.add.container(0, 0);
    this.i = 0;
    this.build();
    this.next();
  }

  // Dessine l'ordonnance : une ligne par calcul
  build()
  {
    const s = this.scene,
      A = this.A,
      R = this.root;

    // l'ordonnance
    const g = s.add.graphics();

    g.fillStyle(0xffffff, 0.55).fillRoundedRect(A.x + 26, A.y + 22, A.w - 52, 270, 18);
    g.lineStyle(3, RM.C.wood, 0.6).strokeRoundedRect(A.x + 26, A.y + 22, A.w - 52, 270, 18);
    R.add(g);
    R.add(RM.text(s, A.x + A.w / 2, A.y + 52, 'Ordonnance', 30, '#6b4f7f'));

    this.rows = this.lines.map((l, j) =>
    {
      const y = A.y + 115 + j * 70;
      const hl = s.add.graphics();

      R.add(hl);
      R.add(RM.icon(s, A.x + 70, y, l.ing.sprite, 48));
      R.add(RM.text(s, A.x + 106, y, l.ing.plural, 26, RM.C.ink).setOrigin(0, 0.5));

      const calc = RM.text(s, A.x + A.w - 250, y, `${l.k} × ${l.t}`, 38, RM.C.ink).setOrigin(0.5);
      // le résultat est un peu à gauche, pour laisser la place à la correction (comme à l'école)
      const res = RM.text(s, A.x + A.w - 190, y, '= ?', 38, '#a08a70').setOrigin(0, 0.5);

      const mark = RM.text(s, A.x + A.w - 52, y, '', 40, RM.GOOD, {
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // la bonne réponse, écrite en vert à côté de la mauvaise
      const fix = RM.text(s, A.x + A.w - 60, y - 6, '', 42, RM.GOOD).setOrigin(0.5).setAngle(-6);

      R.add([calc, res, mark, fix]);
      return { y, hl, res, mark, fix };
    });

    this.answerLayer = s.add.container(0, 0);
    R.add(this.answerLayer);
  }

  // Surligne la ligne du calcul en cours
  highlight()
  {
    const A = this.A;

    this.rows.forEach((r, j) =>
    {
      r.hl.clear();

      if (j === this.i)
      {
        r.hl.fillStyle(RM.C.gold, 0.35).fillRoundedRect(A.x + 36, r.y - 30, A.w - 72, 60, 12);
      }
    });
  }

  // Passe au calcul suivant, ou termine la série
  next()
  {
    if (this.dead)
    {
      return;
    }

    this.answerLayer.removeAll(true);

    if (this.i >= this.lines.length)
    {
      this.hooks.setMain(null);
      this.hooks.done({ lines: this.lines, misses: this.misses });
      return;
    }

    this.highlight();
    this.askSlider(this.lines[this.i]);
  }

  // Slider dans une plage proche de la réponse (largeur 20, réponse jamais au centre exact)
  askSlider(l)
  {
    const s = this.scene,
      A = this.A,
      L = this.answerLayer;

    const ans = l.t * l.k;
    const width = 20;
    const lo = Math.max(0, ans - Phaser.Math.Between(3, width - 3));
    const hi = lo + width;
    const start = Phaser.Math.Between(lo, hi);

    this.hooks.say(
      'minuit',
      RM.fmt(RM.STORY.steps.recette.line, { ingredient: l.ing.plural, calc: `${l.k} × ${l.t}` }),
    );

    const box = s.add.graphics();

    box.fillStyle(0xffffff, 0.9).fillRoundedRect(A.x + A.w / 2 - 80, A.y + 340, 160, 90, 18);

    box
      .lineStyle(4, RM.C.purple, 0.8)
      .strokeRoundedRect(A.x + A.w / 2 - 80, A.y + 340, 160, 90, 18);

    const val = RM.text(s, A.x + A.w / 2, A.y + 385, String(start), 64, RM.C.ink);

    L.add([box, val]);

    const sl = new RM.Slider(
      s,
      A.x + A.w / 2,
      A.y + 510,
      A.w - 40,
      lo,
      hi,
      start,
      (v) => val.setText(String(v)),
      { labels: false },
    );

    this.slider = sl;
    L.add(sl.c);
    L.add(RM.text(s, A.x + 120, A.y + 558, String(lo), 26, '#6b4f7f'));
    L.add(RM.text(s, A.x + A.w - 120, A.y + 558, String(hi), 26, '#6b4f7f'));

    this.hooks.setMain('Valider', () =>
    {
      this.hooks.setMain(null);
      sl.setEnabled(false);
      this.resolve(l, sl.value);
    });
  }

  // Corrige le calcul : compte le résultat, puis félicite ou montre la correction.
  // Erreur : on garde sa réponse en rouge et on écrit la bonne en vert à côté.
  resolve(l, given)
  {
    const ans = l.t * l.k;
    const ok = given === ans;

    RM.Progress.record(l.t, l.k, ok, 'ba'); // écrit « k × t »

    const row = this.rows[this.i];

    row.res.setText(`= ${given}`).setColor(ok ? RM.GOOD : RM.BAD);

    if (ok)
    {
      row.mark.setText('✓');
    }

    const nextOne = () =>
    {
      this.i++;
      this.next();
    };

    if (ok)
    {
      RM.Sfx.good();
      RM.sparkle(this.scene, this.A.x + this.A.w - 120, row.y, RM.C.gold, 10);
      this.hooks.midi('brag');
      this.hooks.pause(1800, nextOne);
    }
    else
    {
      RM.Sfx.bad();
      this.misses++;

      if (!this.free)
      {
        this.hooks.error();
        this.hooks.midi('mock');
      }

      // la bonne réponse s'écrit en vert à côté, un peu après
      this.scene.time.delayedCall(450, () =>
      {
        if (this.dead)
        {
          return;
        }

        row.fix.setText(String(ans)).setScale(0);
        RM.Sfx.pop();
        this.scene.tweens.add({ targets: row.fix, scale: 1, duration: 260, ease: 'Back.easeOut' });
      });

      // Minuit la dit aussi (sans pénalité : elle s'affiche quand même, sans compter l'erreur)
      this.scene.time.delayedCall(700, () =>
      {
        if (!this.dead)
        {
          this.hooks.correct(`${l.k} × ${l.t}`, ans, nextOne, { free: this.free });
        }
      });
    }
  }

  // Enlève l'activité de l'écran ; les minuteries en attente vérifient this.dead
  destroy()
  {
    this.dead = true;
    this.root.destroy();
  }
};
