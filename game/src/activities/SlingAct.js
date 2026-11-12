// ============================================================
//  SlingAct — Ausculter Loooooong-chat (chapitre 3) : le lance-chat à rebonds.
//    On tire le chat en arrière (il reste collé dans la gomme du troll), on lâche :
//    il part dans l'autre sens, rebondit sur les bords du cadre et, au 3e rebond,
//    sort du cadre et de l'écran. Midi : « Oups. » Le client revient.
//    D'abord la main fantôme montre le geste, puis 3 lancers. On ne peut pas perdre.
//  opts.key : le dessin du chat ('longchat' ou 'chatcordeon' pour la fin ratée)
//  opts.lines : répliques (client.ausculte, ou la fin ratée)
//  opts.demo : false = pas de main fantôme (la fin ratée)
//  opts.notes : true = des notes de musique à chaque rebond (Chat-cordéon)
//  Les hooks viennent de StoryScene (voir hooks() dans StoryScene.js).
// ============================================================

RM.SLING = {
  launches: 3, // nombre de lancers
  bounces: 3, // il sort au 3e rebond
  maxPull: 230, // px
  minPull: 45, // en dessous, il revient sans partir
  minSpeed: 1250, // px/s (le 3e rebond arrive en moins de 2 s)
  maxSpeed: 1900,
};

RM.SlingAct = class
{
  constructor(scene, area, hooks, opts = {})
  {
    this.scene = scene;
    this.A = area;
    this.hooks = hooks;
    this.o = opts;
    this.L = opts.lines || {};
    this.key = opts.key || 'longchat';
    this.root = scene.add.container(0, 0);
    this.launches = 0;
    this.state = 'wait';

    const s = scene,
      A = area;

    // le point de gomme : le chat y est collé
    this.anchor = { x: A.x + A.w * 0.42, y: A.y + A.h * 0.62 };

    const gum = s.add.graphics();

    gum.fillStyle(0xff7eb6, 1).fillEllipse(this.anchor.x, this.anchor.y + 8, 120, 30);
    gum.fillStyle(0xffb3d4, 1).fillEllipse(this.anchor.x - 14, this.anchor.y + 3, 44, 10);
    this.root.add(gum);

    this.band = s.add.graphics();
    this.root.add(this.band);

    this.hint = RM.text(s, A.x + A.w / 2, A.y + 50, this.L.hint || '', 30, '#6b4f7f', {
      wordWrap: { width: A.w - 60 },
    });

    this.root.add(this.hint);

    // le chat : au-dessus de tout quand il vole (il sort du cadre)
    this.cat = s.add
      .sprite(this.anchor.x, this.anchor.y, this.key, 0)
      .setOrigin(0.5, 1)
      .setScale(opts.scale || 2.6)
      .setDepth(30);

    this.cat.setInteractive({ draggable: true, useHandCursor: true });
    this.cat.on('dragstart', () => this.dragStart());
    this.cat.on('drag', (p) => this.dragMove(p));
    this.cat.on('dragend', () => this.dragEnd());

    this.onUpdate = (t, dt) => this.update(dt / 1000);
    s.events.on('update', this.onUpdate);
    this.hooks.setMain(null);

    if (opts.demo === false)
    {
      this.state = 'ready';
    }
    else
    {
      this.demo();
    }
  }

  // La main fantôme tire le chat et le relâche (sans le lancer)
  demo()
  {
    const s = this.scene,
      c = this.cat;

    if (this.L.demo)
    {
      this.hooks.say('minuit', this.L.demo);
    }

    const hand = s.add.container(c.x, c.y - 60).setDepth(31);
    const g = s.add.graphics();

    g.fillStyle(0xffffff, 0.85).fillCircle(0, 0, 24);
    g.lineStyle(4, 0x7a3fa0, 0.9).strokeCircle(0, 0, 24);
    g.fillStyle(0x7a3fa0, 0.5).fillCircle(0, 0, 9);
    hand.add(g);
    hand.setAlpha(0);
    this.demoHand = hand;

    const to = { x: this.anchor.x + 170, y: this.anchor.y + 30 };

    s.tweens.chain({
      tweens: [
        { targets: hand, alpha: 1, duration: 250, delay: 400 },
        {
          targets: hand,
          x: to.x,
          y: to.y - 60,
          duration: 900,
          ease: 'Sine.easeInOut',
          onUpdate: () =>
          {
            c.setPosition(hand.x, hand.y + 60);
            this.drawBand();
          },
        },
        { targets: hand, alpha: 0, duration: 200 },
        {
          targets: c,
          x: this.anchor.x,
          y: this.anchor.y,
          duration: 300,
          ease: 'Back.easeOut',
          onUpdate: () => this.drawBand(),
        },
      ],
      onComplete: () =>
      {
        hand.destroy();
        this.demoHand = null;
        this.band.clear();

        if (!this.dead)
        {
          this.state = 'ready';
        }
      },
    });
  }

  // Une pose de la planche de Long-chat (Chat-cordéon n'a qu'un seul dessin)
  pose(f)
  {
    if (this.cat.texture.frameTotal > 2)
    {
      this.cat.setFrame(f);
    }
  }

  // L'élastique de gomme entre le point de colle et le chat
  drawBand()
  {
    const a = this.anchor,
      c = this.cat;

    const d = Phaser.Math.Distance.Between(a.x, a.y, c.x, c.y);

    this.band.clear();

    if (d < 4)
    {
      return;
    }

    this.band.lineStyle(Math.max(6, 22 - d / 14), 0xff7eb6, 1);
    this.band.lineBetween(a.x, a.y, c.x, c.y - 20);
  }

  dragStart()
  {
    if (this.state !== 'ready')
    {
      return;
    }

    this.state = 'pull';
    this.pose(11); // tout étiré
    RM.Sfx.tap();
  }

  dragMove(p)
  {
    if (this.state !== 'pull')
    {
      return;
    }

    const a = this.anchor;
    const v = new Phaser.Math.Vector2(p.x - a.x, p.y - a.y + 20);

    if (v.length() > RM.SLING.maxPull)
    {
      v.setLength(RM.SLING.maxPull);
    }

    this.cat.setPosition(a.x + v.x, a.y + v.y);
    this.cat.setAngle(Phaser.Math.RadToDeg(Math.atan2(-v.y, -v.x)) - 180);
    this.drawBand();
  }

  dragEnd()
  {
    if (this.state !== 'pull')
    {
      return;
    }

    const a = this.anchor,
      c = this.cat;

    const v = new Phaser.Math.Vector2(a.x - c.x, a.y - c.y);
    const d = v.length();

    this.band.clear();

    // trop petit : il revient à sa place
    if (d < RM.SLING.minPull)
    {
      this.state = 'back';
      this.pose(0);
      c.setAngle(0);

      this.scene.tweens.add({
        targets: c,
        x: a.x,
        y: a.y,
        duration: 200,
        onComplete: () => (this.state = 'ready'),
      });

      return;
    }

    // SCHLAC ! il part dans l'autre sens
    const k = Math.min(1, d / RM.SLING.maxPull);
    const sp = RM.SLING.minSpeed + (RM.SLING.maxSpeed - RM.SLING.minSpeed) * k;

    v.setLength(sp);
    this.vel = v;
    this.hits = 0;
    this.state = 'fly';
    this.pose(1); // les bras en avant, comme un super-héros
    c.setOrigin(0.5, 0.5);
    c.y -= c.displayHeight / 2;
    RM.Sfx.pop();
    this.pow(c.x, c.y - 60, 'SCHLAC !');
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

  // Des notes de musique (Chat-cordéon)
  notes(x, y)
  {
    const s = this.scene;

    for (let i = 0; i < 3; i++)
    {
      const n = s.add
        .text(x + Phaser.Math.Between(-30, 30), y, RM.pick(['♪', '♫', '♬']), {
          fontFamily: 'sans-serif',
          fontSize: '44px',
          color: RM.pick(['#7a3fa0', '#1e6fa8', '#c2410c']),
          stroke: '#ffffff',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(32);

      s.tweens.add({
        targets: n,
        y: y - Phaser.Math.Between(80, 140),
        x: n.x + Phaser.Math.Between(-40, 40),
        alpha: 0,
        duration: 900,
        delay: i * 90,
        onComplete: () => n.destroy(),
      });
    }

    RM.Sfx.tone(Phaser.Math.Between(420, 760), 0.18, 'square', 0.05);
  }

  // À chaque image : le vol et les rebonds
  update(dt)
  {
    if (this.dead || this.state !== 'fly')
    {
      return;
    }

    const c = this.cat,
      A = this.A,
      r = 50;

    dt = Math.min(dt, 0.05);
    c.x += this.vel.x * dt;
    c.y += this.vel.y * dt;
    c.angle += 900 * dt * Math.sign(this.vel.x || 1);

    const out = this.hits >= RM.SLING.bounces - 1; // le 3e mur : il passe à travers

    const hit = (axis) =>
    {
      this.hits++;

      if (this.hits >= RM.SLING.bounces)
      {
        return false; // il ne rebondit pas : il sort
      }

      this.vel[axis] *= -1;
      RM.Sfx.tap();
      this.scene.cameras.main.shake(80, 0.004);

      if (this.o.notes)
      {
        this.notes(c.x, c.y);
      }
      else
      {
        this.pow(c.x, c.y, RM.pick(['BOING !', 'BONG !', 'PAF !']));
      }

      return true;
    };

    if (!out || this.hits < RM.SLING.bounces)
    {
      if (c.x < A.x + r && this.vel.x < 0 && hit('x')) c.x = A.x + r;
      else if (c.x > A.x + A.w - r && this.vel.x > 0 && hit('x')) c.x = A.x + A.w - r;

      if (c.y < A.y + r && this.vel.y < 0 && hit('y')) c.y = A.y + r;
      else if (c.y > A.y + A.h - r && this.vel.y > 0 && hit('y')) c.y = A.y + A.h - r;
    }

    // sorti de l'écran
    if (c.x < -200 || c.x > RM.W + 200 || c.y < -200 || c.y > RM.H + 200)
    {
      this.state = 'gone';
      this.launches++;
      this.comeBack();
    }
  }

  // « Oups. » … puis il revient (ou c'est fini après le dernier lancer)
  comeBack()
  {
    const s = this.scene,
      c = this.cat;

    const oups = this.L.oups || ['Oups.'];

    this.hooks.say('midi', oups[Math.min(this.launches - 1, oups.length - 1)]);

    s.time.delayedCall(1400, () =>
    {
      if (this.dead)
      {
        return;
      }

      if (this.launches >= RM.SLING.launches)
      {
        this.hooks.done({});
        return;
      }

      // il revient par la droite, en glissant
      c.setOrigin(0.5, 1).setAngle(0);
      this.pose(0);
      c.setPosition(RM.W + 120, this.anchor.y);

      const back = this.L.back || [];

      if (back.length)
      {
        this.hooks.say('client', back[(this.launches - 1) % back.length]);
      }

      s.tweens.add({
        targets: c,
        x: this.anchor.x,
        duration: 700,
        ease: 'Back.easeOut',
        onComplete: () =>
        {
          if (!this.dead)
          {
            this.state = 'ready';
          }
        },
      });
    });
  }

  destroy()
  {
    this.dead = true;
    this.scene.events.off('update', this.onUpdate);

    if (this.demoHand)
    {
      this.demoHand.destroy();
    }

    this.cat.destroy();
    this.root.destroy();
  }
};
