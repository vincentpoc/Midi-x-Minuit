// ============================================================
//  ShakeAct — Ausculter Chat-boîte : c'est Midi qui « soigne ».
//    Gauche-droite × 4, puis haut-bas × 4 (boîte la tête en bas, 180°),
//    puis 4 taps, toujours la tête en bas (la boîte grossit et rétrécit).
//    lines = client.ausculte (tickle, aaah, upDown, tap)
//  Les hooks viennent de StoryScene (voir hooks() dans StoryScene.js).
// ============================================================

RM.ShakeAct = class
{
  // Construit la boîte, les marques de progression et la zone de geste
  constructor(scene, area, client, hooks)
  {
    this.scene = scene;
    this.A = area;
    this.client = client;
    this.hooks = hooks;
    this.L = client.ausculte;
    this.root = scene.add.container(0, 0);
    this.SHAKES = 4; // aller-retours par geste
    this.STROKE = 55; // distance minimale d'un coup (px)
    this.phase = 'lr';
    this.count = 0; // coups dans la phase
    this.dir = 0;
    this.travel = 0;
    this.finished = false;

    const s = scene,
      A = area,
      R = this.root;

    this.hint = RM.text(
      s,
      A.x + A.w / 2,
      A.y + 50,
      'Secoue la boîte de gauche à droite !',
      32,
      '#6b4f7f',
    );

    R.add(this.hint);
    this.cx = A.x + A.w / 2;
    this.cy = A.y + 320;

    const lk = client.look;

    this.box = s.add.sprite(this.cx, this.cy, lk.sprite, 0).setScale(lk.scale * 1.8);

    if (s.anims.exists(`${lk.sprite}_idle`))
    {
      this.box.play(`${lk.sprite}_idle`);
    }

    R.add(this.box);

    // petites marques : combien de secousses dans ce geste
    this.dots = [];

    for (let i = 0; i < this.SHAKES; i++)
    {
      const d = s.add
        .circle(this.cx + (i - 1.5) * 44, A.y + A.h - 50, 13, 0xffffff, 0.35)
        .setStrokeStyle(3, RM.C.wood, 0.6);

      this.dots.push(d);
      R.add(d);
    }

    // zone de geste (tout le plan de travail)
    const zone = s.add.zone(this.cx, A.y + A.h / 2, A.w, A.h).setInteractive({ draggable: true });

    R.addAt(zone, 0);
    zone.on('drag', (p) => this.onMove(p));
    zone.on('dragend', () => this.endStroke());

    zone.on('pointerdown', () =>
    {
      if (this.phase === 'tap')
      {
        this.tap();
      }
    });
  }

  // un « coup » = un déplacement d'au moins STROKE px dans un sens ; une secousse = 2 coups
  onMove(p)
  {
    if (this.finished || this.phase === 'tap' || this.paused)
    {
      return;
    }

    const lr = this.phase === 'lr';
    const d = lr ? p.x - p.prevPosition.x : p.y - p.prevPosition.y;

    if (Math.abs(d) < 0.5)
    {
      return;
    }

    const dir = Math.sign(d);

    if (dir !== this.dir)
    {
      this.endStroke();
      this.dir = dir;
    }

    this.travel += Math.abs(d);

    if (lr)
    {
      this.box.x = Phaser.Math.Clamp(this.box.x + d * 0.7, this.cx - 130, this.cx + 130);
      this.box.angle = (this.box.x - this.cx) / 6;
    }
    else
    {
      this.box.y = Phaser.Math.Clamp(this.box.y + d * 0.7, this.cy - 110, this.cy + 110);
      this.box.angle = 180 + (this.box.y - this.cy) / 8;
    }
  }

  // Fin d'un mouvement : il compte seulement s'il est assez long
  endStroke()
  {
    if (this.travel >= this.STROKE)
    {
      this.stroke();
    }

    this.travel = 0;
  }

  // Un coup valide de plus ; tous les 2 coups, une secousse
  stroke()
  {
    if (this.finished || this.paused)
    {
      return;
    }

    this.count++;
    RM.Sfx.tick();

    if (this.count % 2 === 0)
    {
      this.shook();
    }
  }

  // une secousse complète
  shook()
  {
    const n = this.count / 2;

    RM.Sfx.pop();
    this.dots[n - 1].setFillStyle(RM.C.gold, 1);
    this.scene.tweens.add({ targets: this.dots[n - 1], scale: 1.5, duration: 120, yoyo: true });

    if (this.phase === 'lr' && n === 1)
    {
      this.hooks.say(this.L.tickle.who, this.L.tickle.text);
    }

    if (this.phase === 'ud' && n === 1)
    {
      this.hooks.say(this.L.aaah.who, this.L.aaah.text);
    }

    if (n >= this.SHAKES)
    {
      this.nextPhase();
    }
  }

  // Remet les marques à zéro pour le geste suivant
  resetDots()
  {
    this.dots.forEach((d) => d.setFillStyle(0xffffff, 0.35));
  }

  // Passe au geste suivant : gauche-droite → haut-bas → taps
  nextPhase()
  {
    const s = this.scene;

    this.paused = true;
    this.count = 0;
    this.dir = 0;
    this.travel = 0;

    s.time.delayedCall(500, () =>
    {
      this.resetDots();

      if (this.phase === 'lr')
      {
        this.phase = 'ud';
        this.hooks.say(this.L.upDown.who, this.L.upDown.text);
        this.hint.setText('Secoue la boîte de haut en bas !');

        s.tweens.add({
          targets: this.box,
          x: this.cx,
          y: this.cy,
          angle: 180,
          duration: 500,
          ease: 'Back.easeOut',
          onComplete: () => { this.paused = false; },
        });
      }
      else
      {
        this.phase = 'tap';
        this.hooks.say(this.L.tap.who, this.L.tap.text);
        this.hint.setText('Tape sur la boîte !');

        // Chat-boîte reste la tête en bas pendant les taps
        s.tweens.add({
          targets: this.box,
          x: this.cx,
          y: this.cy,
          angle: 180,
          duration: 300,
          onComplete: () => { this.paused = false; },
        });
      }
    });
  }

  // Un tap sur la boîte (dernier geste)
  tap()
  {
    if (this.finished || this.paused)
    {
      return;
    }

    this.count++;
    RM.Sfx.pop();

    const s = this.scene;

    s.tweens.killTweensOf(this.box);
    this.box.setScale(9);

    s.tweens.add({
      targets: this.box,
      scale: 11.5,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    this.dots[this.count - 1].setFillStyle(RM.C.gold, 1);

    if (this.count >= this.SHAKES)
    {
      this.finish();
    }
  }

  // Les 3 gestes sont faits : fin de l'activité
  finish()
  {
    this.finished = true;
    this.scene.time.delayedCall(500, () => this.hooks.done({}));
  }

  // Enlève l'activité de l'écran
  destroy()
  {
    this.root.destroy();
  }
};
