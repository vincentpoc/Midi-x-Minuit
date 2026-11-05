// ============================================================
//  Mécanique E — Les coffrets
//  « Range mes 38 ingrédients dans des coffrets de 5. »
//  On glisse des coffrets sur le comptoir, puis « Valider » :
//  les ingrédients remplissent les coffrets un à un (5, 10, 15…).
//  S'il y a un reste (o.r), Midi le mange ! (o.r vaut 0 pour l'instant)
// ============================================================

RM.ChestsMech = class
{
  // order = { type: 'chests', t, k, r, N, icon, unit } (voir storeInChests dans steps.js)
  constructor(scene, order, area)
  {
    this.scene = scene;
    this.o = order;
    this.A = area;
    this.root = scene.add.container(0, 0);
    this.boxes = [];
    this.pile = [];
    this.busy = false;
    this.locked = false;

    const A = area;

    this.counterTop = A.y + 270;
    this.slots = [];

    for (let i = 0; i < 10; i++)
    {
      this.slots.push({ x: A.x + 85 + (i % 5) * 128, y: A.y + 345 + Math.floor(i / 5) * 150 });
    }

    this.build();
  }

  // Dessine le tas, la pile de coffrets et le comptoir
  build()
  {
    const s = this.scene,
      A = this.A,
      o = this.o,
      R = this.root;

    // Zone du tas
    const pg = s.add.graphics();

    pg.fillStyle(0xffffff, 0.45).fillRoundedRect(A.x + 26, A.y + 24, 410, 230, 18);
    R.add(pg);
    this.unit = o.unit || 'fioles';

    this.pileLabel = RM.text(
      s,
      A.x + 44,
      A.y + 50,
      `${o.N} ${this.unit}`,
      o.unit ? 28 : 34,
      RM.C.ink,
      { wordWrap: { width: 380 }, align: 'left' },
    ).setOrigin(0, 0.5);

    R.add(this.pileLabel);
    this.pileLayer = s.add.container(0, 0);
    R.add(this.pileLayer);
    this.buildPile();

    // Source de boîtes
    const sx = A.x + A.w - 120,
      sy = A.y + 130;

    const sg = s.add.graphics();

    sg.fillStyle(RM.C.wood, 0.25).fillRoundedRect(sx - 90, A.y + 24, 180, 230, 18);
    R.add(sg);
    R.add(RM.text(s, sx, A.y + 228, `coffrets de ${o.t}`, 26, '#6b4f7f'));

    // une pile décorative derrière
    R.add(this.makeBox(sx + 8, sy - 8, false).setAlpha(0.6));
    this.source = this.makeBox(sx, sy, true);
    R.add(this.source);
    this.sourceHome = { x: sx, y: sy };
    this.enableSource();

    // Comptoir
    const cg = s.add.graphics();

    cg.fillStyle(RM.C.wood, 1).fillRoundedRect(A.x + 20, this.counterTop, A.w - 40, 330, 18);
    cg.fillStyle(0x8a5a3c, 1).fillRoundedRect(A.x + 28, this.counterTop + 8, A.w - 56, 314, 14);

    this.slots.forEach((sl) =>
    {
      cg.lineStyle(3, 0xf6e7c8, 0.35).strokeRoundedRect(sl.x - 52, sl.y - 52, 104, 104, 12);
    });

    R.add(cg);

    this.hint = RM.text(
      s,
      A.x + A.w / 2,
      this.counterTop + 165,
      'Glisse les coffrets ici !',
      32,
      '#f6e7c8',
    );

    R.add(this.hint);
    this.boxLayer = s.add.container(0, 0);
    R.add(this.boxLayer);

    // Ordre d'affichage (dernier = au-dessus) : comptoir < boîtes posées
    // < boîte qu'on glisse < ingrédients qui volent vers les boîtes
    R.bringToTop(this.boxLayer);
    R.bringToTop(this.source);
    R.bringToTop(this.pileLayer);
  }

  // (Re)met tous les ingrédients dans le tas
  buildPile()
  {
    const s = this.scene,
      A = this.A;

    this.pileLayer.removeAll(true);
    this.pile = [];

    const cx = A.x + 231,
      cy = A.y + 158,
      rx = 178,
      ry = 78;

    // ingrédients plus grands (retour du test) : la taille diminue seulement quand il y en a beaucoup
    const N = this.o.N;
    const size = N <= 24 ? 54 : N <= 40 ? 46 : N <= 60 ? 40 : 34;

    // Disposition en tas (spirale) pour que les ingrédients ne se superposent pas trop
    for (let i = 0; i < this.o.N; i++)
    {
      const a = i * 2.39996;
      const d = Math.sqrt((i + 0.5) / Math.max(this.o.N, 12));
      const x = cx + Math.cos(a) * rx * d;
      const y = cy + Math.sin(a) * ry * d;
      const ic = RM.icon(s, x, y, this.o.icon || { key: `pot_${this.o.t}`, frame: 0 }, size);

      this.pileLayer.add(ic);
      this.pile.push(ic);
    }

    this.pileLabel.setText(`${this.o.N} ${this.unit}`);
  }

  // Dessine un coffret (avec son nombre) ; interactive = on peut le glisser
  makeBox(x, y, interactive)
  {
    const s = this.scene;
    const c = s.add.container(x, y);

    // Coffret en bois dessiné (couvercle ouvert)
    const g = s.add.graphics();

    g.fillStyle(0x3a2216, 1).fillRoundedRect(-46, -50, 92, 34, 8); // couvercle
    g.fillStyle(0x7a4a2c, 1).fillRoundedRect(-42, -46, 84, 26, 6);
    g.fillStyle(0x3a2216, 1).fillRect(-46, -18, 92, 64); // caisse
    g.fillStyle(0x8f5a34, 1).fillRect(-42, -14, 84, 56);
    g.fillStyle(0x5e3a22, 1).fillRect(-42, -14, 84, 10);

    g.fillStyle(0xf2c14e, 1)
      .fillRect(-46, 6, 92, 5)
      .fillRect(-46, -50, 6, 96)
      .fillRect(40, -50, 6, 96); // ferrures

    g.fillStyle(RM.C.purple, 1).fillCircle(0, 22, 19);
    g.lineStyle(3, 0xffffff, 0.8).strokeCircle(0, 22, 19);
    c.add(g);
    c.add(RM.text(s, 0, 20, String(this.o.t), 28, RM.C.cream));
    c.total = RM.text(s, 0, 66, '', 30, '#fff6e6', { stroke: '#3f271b', strokeThickness: 5 });
    c.add(c.total);

    if (interactive)
    {
      c.setSize(110, 110);
      c.setInteractive({ draggable: true, useHandCursor: true });
    }

    return c;
  }

  // La pile de coffrets : toucher ou glisser sur le comptoir ajoute un coffret
  enableSource()
  {
    const src = this.source;
    let start = null;

    src.on('dragstart', (p) =>
    {
      start = { x: p.x, y: p.y };
      src.setDepth(10);
      src.setScale(1.1);
    });

    src.on('drag', (p, dx, dy) =>
    {
      if (!this.busy)
      {
        src.x = dx;
        src.y = dy;
      }
    });

    src.on('dragend', (p) =>
    {
      src.setScale(1);

      const moved = start ? Phaser.Math.Distance.Between(start.x, start.y, p.x, p.y) : 0;
      const dropped = p.y > this.counterTop;

      if (!this.busy && (moved < 14 || dropped))
      {
        this.addBox(src.x, src.y);
      }

      src.x = this.sourceHome.x;
      src.y = this.sourceHome.y;
    });
  }

  // Pose un coffret sur la prochaine place libre du comptoir (10 au maximum)
  addBox(fromX, fromY)
  {
    if (this.boxes.length >= 10)
    {
      RM.Sfx.bad();
      return;
    }

    const slot = this.slots[this.boxes.length];
    const box = this.makeBox(fromX, fromY, true);

    this.boxLayer.add(box);
    this.boxes.push(box);

    this.scene.tweens.add({
      targets: box,
      x: slot.x,
      y: slot.y,
      duration: 180,
      ease: 'Back.easeOut',
    });

    RM.Sfx.pop();
    this.hint.setVisible(false);
    this.clearTotals();

    let start = null;

    box.on('dragstart', (p) =>
    {
      start = { x: p.x, y: p.y };
      box.setScale(1.1);
      this.boxLayer.bringToTop(box);
    });

    box.on('drag', (p, dx, dy) =>
    {
      if (!this.busy)
      {
        box.x = dx;
        box.y = dy;
      }
    });

    box.on('dragend', (p) =>
    {
      box.setScale(1);

      if (this.busy)
      {
        return;
      }

      const moved = start ? Phaser.Math.Distance.Between(start.x, start.y, p.x, p.y) : 0;

      // Tap ou glisser hors du comptoir = enlever la boîte
      if (moved < 14 || p.y < this.counterTop)
      {
        this.removeBox(box);
      }
      else
      {
        this.layout();
      }
    });
  }

  // Enlève un coffret du comptoir
  removeBox(box)
  {
    this.boxes = this.boxes.filter((b) => b !== box);

    this.scene.tweens.add({
      targets: box,
      alpha: 0,
      scale: 0.5,
      duration: 150,
      onComplete: () => box.destroy(),
    });

    RM.Sfx.tap();
    this.clearTotals();
    this.layout();

    if (!this.boxes.length)
    {
      this.hint.setVisible(true);
    }
  }

  // Replace les coffrets dans l'ordre, sans trou
  layout()
  {
    this.boxes.forEach((b, i) =>
    {
      this.scene.tweens.add({ targets: b, x: this.slots[i].x, y: this.slots[i].y, duration: 150 });
    });
  }

  // Efface les nombres sous les coffrets ; remet le tas si une validation l'avait vidé
  clearTotals()
  {
    this.boxes.forEach((b) => b.total.setText('').setColor('#fff6e6'));

    if (this.filled)
    {
      this.buildPile();
      this.filled = false;
    }
  }

  // Valider — animation : les ingrédients remplissent les boîtes une par une
  check()
  {
    const o = this.o;

    this.busy = true;
    this.clearTotals();
    this.filled = true;

    return new Promise((resolve) =>
    {
      const s = this.scene;
      let i = 0;
      let placed = 0;
      let partial = false;

      const step = () =>
      {
        if (!this.root.active)
        {
          return;
        }

        if (i >= this.boxes.length || partial)
        {
          return finish();
        }

        const box = this.boxes[i];
        const take = Math.min(o.t, this.pile.length);
        const moving = this.pile.splice(this.pile.length - take, take);

        moving.forEach((ic, j) =>
        {
          s.tweens.add({
            targets: ic,
            x: box.x + Phaser.Math.Between(-20, 20),
            y: box.y + Phaser.Math.Between(-10, 10),
            scale: ic.scale * 0.6,
            duration: 280,
            delay: j * 15,
            onComplete: () => ic.setVisible(false),
          });
        });

        placed += take;

        if (take < o.t)
        {
          partial = true;
          box.total.setText(take ? `${take} seulement` : 'vide !').setColor('#ffb3a8');
        }
        else
        {
          box.total.setText(String(placed));
        }

        this.pileLabel.setText(`${this.pile.length} ${this.unit}`);
        RM.Sfx.count(i);
        i++;
        s.time.delayedCall(480, step);
      };

      const finish = () =>
      {
        const left = this.pile.length;
        const b = this.boxes.length;
        const ok = !partial && b === o.k;
        let msg = '';

        if (!ok)
        {
          if (partial)
          {
            msg = "Oups ! Un coffret n'est pas plein. Il y a trop de coffrets.";
          }
          else
          {
            msg = `Il en reste encore ${left} : assez pour remplir un autre coffret !`;
          }
        }

        this.left = left;
        this.busy = this.locked; // après « Valider », les coffrets ne bougent plus
        resolve({ ok, results: [{ t: o.t, k: o.k, ok }], msg });
      };

      step();
    });
  }

  // Solution : le bon nombre de coffrets, et on rejoue le remplissage
  showSolution()
  {
    // Remet le bon nombre de boîtes puis rejoue le remplissage
    this.boxes.forEach((b) => b.destroy());
    this.boxes = [];
    this.buildPile();
    this.filled = false;

    for (let i = 0; i < this.o.k; i++)
    {
      this.addBox(this.sourceHome.x, this.sourceHome.y);
    }

    this.scene.time.delayedCall(400, () =>
    {
      if (!this.root.active)
      {
        return;
      }

      this.check().then(() => this.addCaption());
    });
  }

  // Le calcul affiché au-dessus du tas
  addCaption()
  {
    const o = this.o;

    const str = o.r
      ? `${o.N} = ${o.k} coffrets de ${o.t} + ${o.r}`
      : `${o.N} = ${o.k} coffrets de ${o.t}`;

    if (this.caption)
    {
      this.caption.destroy();
    }

    this.caption = RM.text(this.scene, this.A.x + 231, this.A.y + 228, str, 30, RM.C.greenText, {
      backgroundColor: '#fff6e6',
      padding: { x: 10, y: 4 },
    });

    this.root.add(this.caption);
  }

  // Réussi : le calcul, et Midi (target) mange le reste s'il y en a un
  showSuccess(target)
  {
    this.addCaption();

    if (this.pile.length && target)
    {
      this.scene.time.delayedCall(300 + this.pile.length * 120 + 450, () =>
      {
        if (this.root.active)
        {
          this.pileLabel.setText('Miam !');
        }
      });

      this.pile.forEach((ic, j) =>
      {
        this.scene.tweens.add({
          targets: ic,
          x: target.x,
          y: target.y,
          scale: 0.2,
          alpha: 0,
          delay: 300 + j * 120,
          duration: 450,
        });
      });
    }
  }

  // Plus aucun coffret ne bouge (après « Valider »)
  lock()
  {
    this.locked = true;
    this.busy = true;
  }

  // Enlève les coffrets de l'écran
  destroy()
  {
    this.root.destroy();
  }
};
