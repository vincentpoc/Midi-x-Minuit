// ============================================================
//  Mécanique A — Le chaudron (en ml, potions combinables)
//  « Il me faut 35 ml de potion ! »
//
//  En bas : 3 potions à volonté. v1.0 : elles valent 1 ×, 2 × et 3 × la table
//  (table de 3 : 3, 6 et 9 ml) — même couleur, fiole de plus en plus grande.
//  le joueur verse et COMBINE : 21 ml = 9 + 9 + 3.
//  En haut, une ligne par potion : « 3 × 10 ml = 30 ».
//  Le chaudron affiche l'objectif. Après « Valider » : bouillon vert si c'est juste ;
//  sinon bouillon rouge, son total en petit au-dessus de l'objectif, et la bonne
//  opération écrite en vert par-dessus ses lignes (gardées en rouge).
//
//  Effacement du soutien (mémorisation), selon la maîtrise :
//   - les résultats déjà bien connus deviennent « ? » : le chaudron
//     s'arrête, elle verse la bonne fiole numérotée parmi trois.
//     Désactivé en v1.0 : makeMult met noAsk à true (une décision du GDD)
//   - série très bien maîtrisée : plus aucun résultat ni total,
//     elle doit calculer de tête pour arriver au bon nombre de ml
// ============================================================

RM.CauldronMech = class
{
  // v1.0 : les potions valent 1 ×, 2 × et 3 × la table t ; k = nombre de fois la table demandé
  static makeMult(t, k)
  {
    return { type: 'cauldron', t, k, N: t * k, tables: [t, 2 * t, 3 * t], base: t, noAsk: true };
  }

  // texture de potion et taille de la fiole pour une potion de ml millilitres
  // Le numéro de la planche de potion à afficher
  potKey(ml)
  {
    return this.o.base || ml;
  }

  // La taille de la fiole : plus elle contient, plus elle est grande
  potSize(ml, size)
  {
    return this.o.base ? size * (0.8 + 0.2 * (ml / this.o.base)) : size;
  }

  // La couleur du liquide
  potColor(ml)
  {
    return RM.POTIONS[this.potKey(ml)].color;
  }

  // order vient de makeMult
  constructor(scene, order, area, hooks = {})
  {
    this.scene = scene;
    this.o = order;
    this.A = area;
    this.hooks = hooks; // { setBusy(bool), onTotal(total) } fournis par StoryScene.checkActivity
    this.root = scene.add.container(0, 0);
    this.counts = {}; // table -> nombre de fioles versées
    order.tables.forEach((t) => { this.counts[t] = 0; });
    this.history = []; // ordre des fioles versées (pour « retirer »)
    this.answers = {}; // 't x n' -> 'ok' | 'miss'
    this.asking = null; // { t, n } pendant un « ? »
    this.asked = 0;
    this.locked = false;
    this.choosing = false;
    this.animating = false;
    this.revealAll = false;
    this.planSupport();
    this.build();
  }

  // ---------- Niveau de soutien ----------
  // blind = true : plus aucun résultat ni total à l'écran
  planSupport()
  {
    const f = RM.FORCE_MODE;

    this.blind = f === 3 || (!f && RM.Progress.avgOf(this.o.tables) >= 3.5);
  }

  // Faut-il poser un « ? » pour n fioles de t ml ?
  shouldAsk(t, n)
  {
    if (this.o.noAsk || this.blind || this.revealAll || RM.FORCE_MODE === 1)
    {
      return false;
    }

    if (n < 2 || this.asked >= RM.MAX_HIDDEN || this.answers[`${t}x${n}`])
    {
      return false;
    }

    return RM.FORCE_MODE === 2 || RM.Progress.level(t, n) >= 2;
  }

  // Le nombre de ml déjà versés
  total()
  {
    return this.o.tables.reduce((s, t) => s + t * this.counts[t], 0);
  }

  // ---------- Construction ----------
  build()
  {
    const s = this.scene,
      A = this.A,
      R = this.root,
      o = this.o;

    this.cx = A.x + A.w / 2;
    this.mouth = { x: this.cx + 6, y: A.y + 236 };
    this.color = this.potColor(o.tables[0]);

    // Lignes « 3 × 10 ml = 30 »
    this.lineLayer = s.add.container(0, 0);
    R.add(this.lineLayer);

    this.lineHint = RM.text(
      s,
      this.cx,
      A.y + 70,
      'Verse des fioles dans le chaudron !',
      30,
      '#6b4f7f',
    );

    R.add(this.lineHint);

    // Chaudron + liquide
    // witch-cauldron.png : 4 chaudrons de 128 px (image 0 = le chaudron noir sur le feu)
    this.cauldron = s.add.image(this.cx, A.y + 281, 'cauldron', RM.CAULDRON_FRAME).setScale(3);
    R.add(this.cauldron);
    this.liquid = s.add.ellipse(this.mouth.x, this.mouth.y + 2, 160, 38, this.color, 0.95);
    R.add(this.liquid);
    this.bubbleLayer = s.add.container(0, 0);
    R.add(this.bubbleLayer);

    // l'objectif est écrit sur le chaudron (le total versé n'est plus affiché)
    this.counter = RM.text(s, this.cx, A.y + 320, `${o.N} ml`, 64, RM.C.cream, {
      stroke: '#2a1b38',
      strokeThickness: 10,
    });

    R.add(this.counter);

    // erreur : le total versé, en plus petit, juste au-dessus de l'objectif
    this.wrongTot = RM.text(s, this.cx, A.y + 266, '', 36, RM.BAD, {
      stroke: '#ffffff',
      strokeThickness: 6,
    });

    R.add(this.wrongTot);

    // Bouton « retirer la dernière fiole »
    this.removeBtn = RM.roundButton(
      s,
      A.x + A.w - 70,
      A.y + 300,
      32,
      '−',
      () => this.removeLast(),
      { color: 0x9b7fd0, dark: 0x6b4fa0 },
    );

    R.add(this.removeBtn);
    R.add(RM.text(s, A.x + A.w - 70, A.y + 352, 'retirer', 22, '#6b4f7f'));

    // Les potions disponibles (à volonté)
    const plank = s.add.graphics();

    plank.fillStyle(RM.C.woodDark, 1).fillRoundedRect(A.x + 18, A.y + 582, A.w - 36, 22, 6);
    plank.fillStyle(RM.C.wood, 1).fillRoundedRect(A.x + 18, A.y + 578, A.w - 36, 16, 6);
    R.add(plank);

    this.stands = o.tables.map((t, i) =>
    {
      const x = this.cx + (i - (o.tables.length - 1) / 2) * 200,
        y = A.y + 500;

      const st = this.makeStand(x, y, t);

      R.add(st);
      return st;
    });

    this.bubbleTimer = s.time.addEvent({ delay: 420, loop: true, callback: () => this.bubble() });

    if (!RM.Progress.data.demo.cauldronMl)
    {
      this.demo();
    }

    this.render();
  }

  // Une potion « à volonté » : on la glisse ou on la touche, une copie part dans le chaudron
  makeStand(x, y, t)
  {
    const s = this.scene;
    const c = s.add.container(x, y);
    const sh = s.add.ellipse(0, 50, 90, 18, 0x000000, 0.25);
    const pot = RM.potion(s, 0, 0, this.potKey(t), this.potSize(t, 84));

    c.add([sh, pot]);

    const g = s.add.graphics();

    g.fillStyle(0xfffaf0, 1).fillRoundedRect(-50, 56, 100, 44, 12);
    g.lineStyle(3, this.potColor(t), 1).strokeRoundedRect(-50, 56, 100, 44, 12);
    c.add(g);
    c.add(RM.text(s, 0, 77, `${t} ml`, 32, RM.C.ink));

    c.badge = RM.text(s, 44, -40, '', 28, RM.C.cream, {
      backgroundColor: '#6b4fa0',
      padding: { x: 8, y: 2 },
    });

    c.add(c.badge);
    c.t = t;
    c.home = { x, y };
    c.setSize(120, 150);
    c.setInteractive({ draggable: true, useHandCursor: true });

    let start = null;

    c.on('dragstart', (p) =>
    {
      start = null;

      if (this.choosing || this.locked)
      {
        return; // pendant un « ? », les potions ne bougent pas
      }

      start = { x: p.x, y: p.y };
      this.root.bringToTop(c);
      c.setScale(1.1);
    });

    c.on('drag', (p, dx, dy) =>
    {
      if (start)
      {
        c.x = dx;
        c.y = dy;
      }
    });

    c.on('dragend', (p) =>
    {
      if (!start)
      {
        return;
      }

      c.setScale(1);

      const moved = start ? Phaser.Math.Distance.Between(start.x, start.y, p.x, p.y) : 0;
      const near = Phaser.Math.Distance.Between(p.x, p.y, this.cx, this.A.y + 280) < 200;
      const from = { x: c.x, y: c.y };

      c.x = c.home.x;
      c.y = c.home.y;

      if (moved < 14 || near)
      {
        this.pour(t, moved < 14 ? c.home : from);
      }
    });

    return c;
  }

  // ---------- Verser ----------
  pour(t, from)
  {
    if (this.locked || this.choosing || this.animating)
    {
      return;
    }

    this.stopDemo();
    this.animating = true;

    const s = this.scene;
    const f = RM.potion(s, from.x, from.y, this.potKey(t), this.potSize(t, 70));

    this.root.add(f);

    s.tweens.chain({
      targets: f,
      tweens: [
        {
          x: this.mouth.x + 30,
          y: this.mouth.y - 110,
          angle: -100,
          duration: 200,
          ease: 'Quad.easeOut',
        },
        {
          y: this.mouth.y - 40,
          scale: f.scale * 0.6,
          alpha: 0,
          duration: 150,
          ease: 'Quad.easeIn',
        },
      ],

      onComplete: () =>
      {
        f.destroy();
        this.counts[t]++;
        this.history.push(t);
        this.color = this.potColor(t);
        this.liquid.setFillStyle(this.color, 0.9);
        this.splash();
        RM.Sfx.count(Math.min(this.counts[t], 9));
        this.animating = false;

        const n = this.counts[t];

        if (this.shouldAsk(t, n))
        {
          this.asking = { t, n };
          this.render(t);
          this.askLine(t, n);
        }
        else
        {
          this.render(t);
        }
      },
    });
  }

  // Retire la dernière fiole versée
  removeLast()
  {
    if (this.locked || this.choosing || this.animating || !this.history.length)
    {
      return;
    }

    const t = this.history.pop();

    this.counts[t]--;

    const st = this.stands.find((x) => x.t === t);
    const f = RM.potion(this.scene, this.mouth.x, this.mouth.y - 40, this.potKey(t), 60);

    this.root.add(f);

    this.scene.tweens.add({
      targets: f,
      x: st.x,
      y: st.y,
      alpha: 0.2,
      duration: 280,
      onComplete: () => f.destroy(),
    });

    RM.Sfx.tap();
    this.render();
  }

  // ---------- Affichage ----------
  // Ce qu'on affiche après le = : le résultat, « ? », ou null pour ne rien afficher
  lineValue(t, n)
  {
    if (this.asking && this.asking.t === t && this.asking.n === n)
    {
      return '?';
    }

    if (this.revealAll)
    {
      return String(t * n);
    }

    if (this.blind)
    {
      return null;
    }

    return String(t * n);
  }

  // Redessine les lignes, les badges et le total ; popT = la potion à faire rebondir
  render(popT)
  {
    const s = this.scene,
      A = this.A;

    this.lineLayer.removeAll(true);

    const used = this.o.tables.filter((t) => this.counts[t] > 0);

    this.lineHint.setVisible(used.length === 0);

    used.forEach((t, i) =>
    {
      const n = this.counts[t];
      const y = A.y + 40 + i * 54;
      const v = this.lineValue(t, n);
      const state = this.answers[`${t}x${n}`];
      const g = s.add.graphics();

      const fill =
        v === '?' ? RM.C.gold : state === 'ok' ? 0xc9efc0 : state === 'miss' ? 0xffd8b0 : 0xfffaf0;

      g.fillStyle(fill, 1).fillRoundedRect(A.x + 150, y - 24, 380, 48, 12);
      g.lineStyle(3, this.potColor(t), 0.9).strokeRoundedRect(A.x + 150, y - 24, 380, 48, 12);

      const ic = RM.icon(s, A.x + 180, y, { key: `pot_${this.potKey(t)}`, frame: 0 }, 40);
      const str = v === null ? `${n} × ${t} ml` : `${n} × ${t} ml = ${v}`;
      const txt = RM.text(s, A.x + 210, y, str, 32, this.verdict === 'bad' ? RM.BAD : RM.C.ink).setOrigin(0, 0.5);

      this.lineLayer.add([g, ic, txt]);

      if (popT === t)
      {
        txt.setScale(1.25);
        s.tweens.add({ targets: txt, scale: 1, duration: 200, ease: 'Back.easeOut' });
      }
    });

    // badges « ×3 » sur les potions
    this.stands.forEach((st) =>
      st.badge
        .setText(this.counts[st.t] ? `×${this.counts[st.t]}` : '')
        .setVisible(this.counts[st.t] > 0),
    );

    // le chaudron affiche l'objectif (écrit une fois pour toutes dans build)
    const tot = this.total();

    if (this.hooks.onTotal && !this.locked)
    {
      this.hooks.onTotal(tot);
    }
  }

  // Après « Valider » : le bouillon devient vert (juste) ou rouge (faux)
  setVerdict(ok)
  {
    this.verdict = ok ? 'ok' : 'bad';
    this.color = ok ? RM.CORR_GREEN : RM.CORR_RED;
    this.liquid.setFillStyle(this.color, 0.95);

    if (ok)
    {
      this.counter.setColor(RM.GOOD);
    }
    else
    {
      // l'objectif reste blanc, son total s'affiche en plus petit au-dessus
      this.wrongTot.setText(`${this.total()} ml`).setScale(0);
      this.scene.tweens.add({ targets: this.wrongTot, scale: 1, duration: 260, ease: 'Back.easeOut' });
    }

    this.splash();
  }

  // ---------- Effets ----------
  // Éclaboussures quand une fiole tombe dans le chaudron
  splash()
  {
    const s = this.scene;

    for (let j = 0; j < 12; j++)
    {
      const d = s.add.circle(
        this.mouth.x + Phaser.Math.Between(-30, 30),
        this.mouth.y,
        Phaser.Math.Between(5, 10),
        this.color,
      );

      this.bubbleLayer.add(d);

      s.tweens.add({
        targets: d,
        x: d.x + Phaser.Math.Between(-90, 90),
        y: d.y - Phaser.Math.Between(50, 130),
        alpha: 0,
        scale: 0.4,
        duration: Phaser.Math.Between(350, 600),
        ease: 'Quad.easeOut',
        onComplete: () => d.destroy(),
      });
    }

    s.tweens.add({
      targets: this.cauldron,
      scaleX: 3.25,
      scaleY: 2.75,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    s.tweens.add({ targets: this.liquid, scaleX: 1.12, scaleY: 1.3, duration: 120, yoyo: true });
  }

  // Une petite bulle qui monte du chaudron (en continu)
  bubble()
  {
    if (this.choosing || !this.root.active)
    {
      return;
    }

    const s = this.scene;

    const b = s.add.circle(
      this.mouth.x + Phaser.Math.Between(-45, 45),
      this.mouth.y,
      Phaser.Math.Between(4, 9),
      0xffffff,
      0.55,
    );

    this.bubbleLayer.add(b);

    s.tweens.add({
      targets: b,
      y: b.y - Phaser.Math.Between(40, 90),
      alpha: 0,
      duration: 900,
      onComplete: () => b.destroy(),
    });
  }

  // Fumée quand la fiole choisie au « ? » est mauvaise
  smoke()
  {
    const s = this.scene;

    for (let j = 0; j < 8; j++)
    {
      const d = s.add.circle(
        this.mouth.x + Phaser.Math.Between(-40, 40),
        this.mouth.y - 10,
        Phaser.Math.Between(12, 22),
        0x8a8396,
        0.7,
      );

      this.bubbleLayer.add(d);

      s.tweens.add({
        targets: d,
        y: d.y - Phaser.Math.Between(60, 120),
        scale: 1.6,
        alpha: 0,
        duration: 800,
        onComplete: () => d.destroy(),
      });
    }
  }

  // ---------- « ? » : choisir la bonne fiole numérotée ----------
  // Pose le « ? » d'une ligne et retient le résultat
  askLine(t, n)
  {
    this.asked++;

    this.ask(t, t * n, `${n} fioles de ${t} ml : combien de ml ?`, (ok) =>
    {
      RM.Progress.record(t, n, ok, 'ba');
      this.answers[`${t}x${n}`] = ok ? 'ok' : 'miss';
      this.asking = null;
      this.render(t);
    });
  }

  // Trois fioles numérotées : on verse la bonne, puis done(ok)
  ask(t, answer, title, done)
  {
    const s = this.scene,
      A = this.A;

    this.choosing = true;

    if (this.hooks.setBusy)
    {
      this.hooks.setBusy(true);
    }

    const layer = s.add.container(0, 0);

    this.root.add(layer);
    layer.add(s.add.rectangle(this.cx, A.y + 525, A.w - 20, 190, 0x2a1b38, 1).setInteractive());
    layer.add(RM.text(s, this.cx, A.y + 452, title, 28, RM.C.goldText));

    // sans doublons (table de 2 : answer + t = answer + 2)
    const cands = RM.shuffle([
      ...new Set([answer + t, answer - t, answer + 1, answer - 1, answer + 2]),
    ]).filter((v) => v > 0 && v !== answer);

    const values = RM.shuffle([answer, cands[0], cands[1]]);
    let finished = false;

    const vials = values.map((v, j) =>
    {
      const x = this.cx - 180 + j * 180,
        y = A.y + 520;

      const c = s.add.container(x, y);

      c.add(RM.potion(s, 0, -14, this.potKey(t), 64));

      const g = s.add.graphics();

      g.fillStyle(0x000000, 0.25).fillRoundedRect(-52, 30, 104, 56, 14);
      g.fillStyle(0xfffaf0, 1).fillRoundedRect(-52, 26, 104, 56, 14);
      g.lineStyle(3, RM.C.gold, 1).strokeRoundedRect(-52, 26, 104, 56, 14);
      c.add(g);
      c.add(RM.text(s, 0, 53, String(v), 44, RM.C.ink));
      c.value = v;
      c.home = { x, y };
      c.setSize(120, 150);
      c.setInteractive({ draggable: true, useHandCursor: true });
      layer.add(c);
      c.setScale(0.2);
      s.tweens.add({ targets: c, scale: 1, duration: 260, delay: j * 80, ease: 'Back.easeOut' });

      let start = null;

      c.on('dragstart', (p) => { start = { x: p.x, y: p.y }; });

      c.on('drag', (p, dx, dy) =>
      {
        c.x = dx;
        c.y = dy;
      });

      c.on('dragend', (p) =>
      {
        const moved = start ? Phaser.Math.Distance.Between(start.x, start.y, p.x, p.y) : 0;
        const near = Phaser.Math.Distance.Between(p.x, p.y, this.cx, A.y + 280) < 200;

        if (moved < 14 || near)
        {
          pick(c);
        }
        else
        {
          s.tweens.add({ targets: c, x: c.home.x, y: c.home.y, duration: 180 });
        }
      });

      return c;
    });

    const pick = (f) =>
    {
      if (finished)
      {
        return;
      }

      finished = true;

      const ok = f.value === answer;

      vials.forEach((v) => v.disableInteractive());

      s.tweens.add({
        targets: f,
        x: this.mouth.x,
        y: this.mouth.y - 30,
        angle: -90,
        scale: 0.6,
        duration: 300,
        ease: 'Quad.easeIn',

        onComplete: () =>
        {
          if (ok)
          {
            f.setVisible(false);
            this.splash();
            RM.Sfx.good();
            RM.sparkle(s, this.mouth.x, this.mouth.y - 20, this.color, 14);
          }
          else
          {
            this.smoke();
            RM.Sfx.bad();

            s.tweens.add({
              targets: f,
              x: f.home.x,
              y: f.home.y,
              angle: 0,
              scale: 1,
              alpha: 0.35,
              duration: 300,
            });

            const good = vials.find((v) => v.value === answer);

            s.tweens.add({ targets: good, scale: 1.3, duration: 220, yoyo: true, repeat: 2 });
          }

          s.time.delayedCall(ok ? 450 : 1500, () =>
          {
            layer.destroy();
            this.choosing = false;

            if (this.hooks.setBusy)
            {
              this.hooks.setBusy(false);
            }

            done(ok);
          });
        },
      });
    };
  }

  // ---------- Démo (première fois) ----------
  demo()
  {
    const s = this.scene,
      from = this.stands[0].home;

    this.demoText = RM.text(
      s,
      this.cx,
      this.A.y + 420,
      'Touche ou glisse une potion !',
      30,
      RM.C.goldText,
      { stroke: '#2a1b38', strokeThickness: 6 },
    );

    this.root.add(this.demoText);
    this.ghost = RM.potion(s, from.x, from.y, this.potKey(this.stands[0].t), 70).setAlpha(0.7);
    this.root.add(this.ghost);

    this.demoTween = s.tweens.add({
      targets: this.ghost,
      x: this.mouth.x + 30,
      y: this.mouth.y - 80,
      angle: -100,
      duration: 1100,
      ease: 'Sine.easeInOut',
      repeat: -1,
      repeatDelay: 300,

      onRepeat: () =>
      {
        this.ghost.x = from.x;
        this.ghost.y = from.y;
        this.ghost.angle = 0;
      },
    });
  }

  // Arrête la démo au premier geste, et ne la remontre plus
  stopDemo()
  {
    if (!this.ghost)
    {
      return;
    }

    this.demoTween.stop();
    this.ghost.destroy();
    this.demoText.destroy();
    this.ghost = null;
    RM.Progress.data.demo.cauldronMl = true;
    RM.Progress.save();
  }

  // ---------- Validation ----------
  // Valider : compare le total à la commande ; renvoie { ok, results, msg }
  check()
  {
    const o = this.o;
    const tot = this.total();
    const ok = tot === o.N;

    // la mémoire (Leitner) retient les multiplications qu'elle a vraiment faites
    const used = o.tables.filter((t) => this.counts[t] > 0);

    // (v1.0, potions 1×/2×/3× : on retient le calcul de la commande, k × t)
    this.setVerdict(ok);

    const results = ok
      ? o.base
        ? [{ t: o.t, k: o.k, ok: true }]
        : used.map((t) => ({ t, k: this.counts[t], ok: true }))
      : [{ t: o.t, k: o.k, ok: false }];

    let msg = '';

    if (!ok)
    {
      const d = Math.abs(tot - o.N);

      msg = this.blind
        ? tot < o.N
          ? 'Il en manque encore ! Calcule bien chaque ligne.'
          : 'Oups, il y en a trop ! Calcule bien chaque ligne.'
        : tot < o.N
          ? `Il manque ${d} ml !`
          : `Oups, il y a ${d} ml de trop !`;
    }

    this.render();
    return Promise.resolve({ ok, results, msg });
  }

  // Solution : on garde ses fioles (en rouge) et la bonne opération s'écrit en vert par-dessus
  showSolution()
  {
    const o = this.o,
      s = this.scene,
      A = this.A;

    this.revealAll = true;
    this.render();

    const n = Math.max(1, o.tables.filter((t) => this.counts[t] > 0).length);

    // un peu en dessous de ses lignes, sans fond : on lit encore sa réponse en rouge
    const fix = RM.text(s, this.cx + 30, A.y + 40 + (n - 1) * 54 + 40, `${o.k} × ${o.t} ml = ${o.N} ml`, 42, RM.GOOD, {
      stroke: '#ffffff',
      strokeThickness: 8,
    })
      .setAngle(-4)
      .setScale(0);

    this.root.add(fix);
    RM.Sfx.pop();
    s.tweens.add({ targets: fix, scale: 1, duration: 300, ease: 'Back.easeOut' });
  }

  // Réussi : tous les résultats, des étoiles et le calcul complet
  showSuccess()
  {
    const o = this.o;

    this.revealAll = true;
    this.render();
    RM.sparkle(this.scene, this.mouth.x, this.mouth.y - 30, this.color, 18);

    this.scene.tweens.add({
      targets: this.liquid,
      scaleX: 1.25,
      scaleY: 1.6,
      duration: 200,
      yoyo: true,
      repeat: 1,
    });

    const parts = o.tables.filter((t) => this.counts[t] > 0).map((t) => `${this.counts[t]} × ${t}`);

    this.addCaption(`${parts.join(' + ')} = ${o.N} ml`);
  }

  // Le calcul affiché sous le chaudron
  addCaption(str)
  {
    if (this.caption)
    {
      this.caption.destroy();
    }

    this.caption = RM.text(
      this.scene,
      this.cx,
      this.A.y + 425,
      str,
      str.length > 22 ? 32 : 38,
      RM.C.greenText,
      { backgroundColor: '#fff6e6', padding: { x: 14, y: 4 } },
    );

    this.root.add(this.caption);
  }

  // Plus aucune fiole ne bouge (après « Valider »)
  lock()
  {
    this.locked = true;
    this.removeBtn.setEnabled(false);
  }

  // Arrête les bulles et enlève le chaudron
  destroy()
  {
    if (this.bubbleTimer)
    {
      this.bubbleTimer.remove();
    }

    this.root.destroy();
  }
};
