// ============================================================
//  StretchAct — Étirer Long-chat (chapitre 3, multiplication) : le chat est le slider.
//    « 7 × 5 cm » : on tire sa queue jusqu'à la bonne longueur (la longueur s'affiche en grand),
//    puis on lâche… SCHLAC ! Il part comme au lance-chat, rebondit dans le cadre, des potions
//    et des objets bizarres tombent (RM.Mess), Minuit panique. Ensuite seulement : juste ou faux.
//    Lâcher = répondre. La première fois (opts.free), une erreur ne coûte rien : on s'attend
//    à ce que le joueur lâche par accident, c'est la surprise.
//    Soutien effacé par le désordre : au 1er lancer les nombres de la règle tombent
//    (opts.loseLabels), plus tard ses traits aussi (opts.loseTicks). L'aiguille… pardon, la queue
//    avance toujours de t en t.
//  q = { t, k }   opts : labels, ticks, loseLabels, loseTicks, free, first, lines
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
    this.value = 0;
    this.state = 'pull';
    this.hooks.setMain(null);
    this.build();
  }

  build()
  {
    const s = this.scene,
      A = this.A,
      R = this.root,
      q = this.q;

    this.calcText = RM.text(s, A.x + A.w / 2, A.y + 54, `${q.k} × ${q.t} = ? cm`, 46, RM.C.ink);
    this.read = RM.text(s, A.x + A.w / 2, A.y + 150, '0 cm', 76, '#45306e', { fontFamily: RM.FONT_NB });
    R.add([this.calcText, this.read]);

    // le chat : son nez à gauche ; le bout de sa queue est le zéro de la règle
    this.cat = new RM.LongCat(s, A.x + 26, A.y + 330, 2);
    R.add(this.cat.c);

    this.x0 = this.cat.tailX();
    this.step = (A.x + A.w - 34 - this.x0) / 10; // px pour un coup de t cm
    this.ry = A.y + 352;

    const g = s.add.graphics();

    g.fillStyle(0xf2d38a, 1).fillRoundedRect(this.x0 - 10, this.ry - 4, this.step * 10 + 20, 34, 6);
    g.lineStyle(3, RM.C.wood, 0.9).strokeRoundedRect(this.x0 - 10, this.ry - 4, this.step * 10 + 20, 34, 6);
    R.add(g);

    // les traits et les nombres : des objets séparés, pour qu'ils puissent tomber
    this.ticks = [];
    this.labels = [];

    for (let i = 0; i <= 10; i++)
    {
      const x = this.x0 + i * this.step;

      if (this.o.ticks !== false)
      {
        const t = s.add.rectangle(x, this.ry + 6, 4, 20, RM.C.woodDark);

        this.ticks.push(t);
        R.add(t);
      }

      if (this.o.labels)
      {
        const l = RM.text(s, x, this.ry + 50, String(i * q.t), 22, RM.C.ink);

        this.labels.push(l);
        R.add(l);
      }
    }

    this.hint = RM.text(s, A.x + A.w / 2, A.y + 470, this.o.first ? this.L.hintFirst || '' : this.L.hint || '', 30, '#6b4f7f', {
      wordWrap: { width: A.w - 60 },
      align: 'center',
    });

    R.add(this.hint);

    // un rond qui pulse sur la queue
    const ty = this.cat.c.y - this.cat.height * 0.5;

    this.glow = s.add.circle(this.x0 - 10, ty, 34, RM.C.gold, 0.45);
    R.add(this.glow);
    s.tweens.add({ targets: this.glow, scale: 1.3, alpha: 0.15, duration: 500, yoyo: true, repeat: -1 });

    // on tire la queue vers la droite (zone large : toute la bande du chat et de la règle)
    const zone = s.add
      .zone(A.x + A.w / 2, ty + 10, A.w, 220)
      .setInteractive({ draggable: true, useHandCursor: true });

    R.add(zone);
    this.zone = zone;
    zone.on('dragstart', (p) => this.drag(p, true));
    zone.on('drag', (p) => this.drag(p));
    zone.on('dragend', () => this.release());
  }

  // La queue suit le doigt, de t en t
  drag(p, start)
  {
    if (this.state !== 'pull')
    {
      return;
    }

    if (start)
    {
      // on doit prendre la queue (pas le nez)
      this.held = Math.abs(p.x - this.cat.tailX()) < 110;

      if (this.held)
      {
        RM.Sfx.tap();
      }
    }

    if (!this.held)
    {
      return;
    }

    const n = Phaser.Math.Clamp(Math.round((p.x - this.x0) / this.step), 0, 10);

    this.set(n * this.q.t);
  }

  // Longueur v (en cm) : le chat, le rond et le nombre en grand
  set(v)
  {
    if (v === this.value)
    {
      return;
    }

    this.value = v;
    this.cat.setLength(this.cat.base + (v / this.q.t) * this.step);
    this.glow.x = this.cat.tailX() - 10;
    this.read.setText(`${v} cm`);
    RM.Sfx.tone(300 + (v / this.q.t) * 45, 0.07, 'triangle', 0.08);
  }

  // On lâche : c'est la réponse… et il part !
  release()
  {
    if (this.state !== 'pull' || !this.held)
    {
      return;
    }

    this.held = false;

    if (this.value === 0)
    {
      return;
    }

    const s = this.scene,
      A = this.A,
      c = this.cat;

    this.state = 'fly';
    this.guess = this.value;
    this.zone.disableInteractive();
    this.glow.destroy();
    this.hint.setText('');

    // SCHLAC : il reprend sa forme et part dans l'autre sens, en tournant
    const fly = s.add
      .sprite(c.c.x + 80, c.c.y - 50, 'longchat', 1)
      .setScale(2.4)
      .setDepth(30);

    c.c.setVisible(false);
    this.fly = fly;
    RM.Sfx.pop();
    this.pow(A.x + A.w / 2, A.y + 250, 'SCHLAC !');
    RM.Mess.panic(s);

    // le désordre emporte le soutien : les nombres de la règle, puis ses traits
    if (this.o.loseLabels)
    {
      this.fall(this.labels);
    }

    if (this.o.loseTicks)
    {
      this.fall(this.ticks);
    }

    RM.bounce(s, fly, A, {
      vx: -1300,
      vy: -1000 - Math.random() * 300,
      bounces: 3,
      exit: true,
      r: 50,
      onHit: (x, y) =>
      {
        RM.Sfx.tap();
        s.cameras.main.shake(80, 0.004);
        this.pow(x, y, RM.pick(['BOING !', 'BONG !', 'PAF !']));
        RM.Mess.drop(s, 2);
      },
      onDone: () =>
      {
        fly.destroy();

        if (!this.dead)
        {
          s.time.delayedCall(350, () => this.check());
        }
      },
    });
  }

  // Des morceaux de la règle tombent au fond du cadre
  fall(list)
  {
    const s = this.scene,
      A = this.A;

    list.forEach((o, i) =>
    {
      s.tweens.add({
        targets: o,
        y: A.y + A.h - 20 - Math.random() * 20,
        x: o.x + Phaser.Math.Between(-30, 30),
        angle: Phaser.Math.Between(-200, 200),
        alpha: 0.5,
        duration: 600 + Math.random() * 400,
        delay: 150 + i * 40,
        ease: 'Bounce.easeOut',
      });
    });
  }

  // Un mot de bande dessinée qui saute et disparaît
  pow(x, y, word)
  {
    const s = this.scene;

    const t = s.add
      .text(x, y, word, {
        fontFamily: RM.FONT_BD,
        fontSize: '64px',
        color: '#e8590c',
        stroke: '#3b2a4a',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(32)
      .setAngle(Phaser.Math.Between(-10, 10))
      .setScale(0.3);

    s.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.easeOut' });
    s.tweens.add({ targets: t, alpha: 0, y: y - 40, delay: 600, duration: 400, onComplete: () => t.destroy() });
  }

  // Juste ou faux ?
  check()
  {
    const s = this.scene,
      q = this.q,
      ans = q.t * q.k,
      ok = this.guess === ans,
      free = !!this.o.free;

    const finish = () => !this.dead && this.hooks.done({});

    // la première fois, une erreur ne compte pas (ni vie, ni grimoire)
    if (ok || !free)
    {
      RM.Progress.record(q.t, q.k, ok, 'ba'); // écrit « k × t »
    }

    if (ok)
    {
      this.calcText.setText(`${q.k} × ${q.t} = ${ans} cm ✓`).setColor(RM.GOOD);
      this.read.setColor(RM.GOOD);
      RM.Sfx.good();
      RM.sparkle(s, this.A.x + this.A.w / 2, this.A.y + 150, RM.C.gold, 16);
      this.hooks.midi('brag');
      this.hooks.pause(1500, finish);
      return;
    }

    // comme à l'école : sa réponse reste en rouge, la bonne s'écrit en vert
    this.read.setText(`${this.guess} cm ✗`).setColor(RM.BAD);
    this.calcText.setText(`${q.k} × ${q.t} = ${ans} cm`).setColor(RM.GOOD);
    RM.Sfx.bad();

    if (!free)
    {
      this.hooks.error();
    }

    s.time.delayedCall(700, () =>
    {
      if (!this.dead)
      {
        this.hooks.correct(`${q.k} × ${q.t}`, ans, finish, { free });
      }
    });
  }

  destroy()
  {
    this.dead = true;

    if (this.fly && this.fly.active)
    {
      this.fly.destroy();
    }

    this.root.destroy();
  }
};
