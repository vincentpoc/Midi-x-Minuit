// ============================================================
//  SlingAct — Ausculter Loooooong-chat (chapitre 3) : le lance-chat à rebonds.
//    Il est roulé en boule au centre. On le touche et on tire : il s'étire (sa tête suit le doigt,
//    seul son corps s'allonge : RM.LongCat). On lâche : il part dans l'autre sens en tournant,
//    rebondit sur les bords du cadre et, au 3e rebond, sort du cadre et de l'écran.
//    À chaque lancer, des objets tombent (RM.Mess) et Minuit panique. Midi : « Oups. » Le client revient.
//    D'abord la main fantôme montre le geste, puis 3 lancers. On ne peut pas perdre.
//  opts.key : le dessin du chat ('longchat' ou 'chatcordeon' pour la fin ratée)
//  opts.lines : répliques (client.ausculte, ou la fin ratée)
//  opts.demo : false = pas de main fantôme (la fin ratée)
//  opts.notes : true = des notes de musique à chaque rebond (Chat-cordéon)
//  opts.run : true = le jeu de fin : Chat-cordéon s'enfuit en courant, vite et d'un bout à l'autre
//    du cadre ; il faut l'attraper, l'étirer et le lancer opts.launches fois (5) avant la fin du temps
//    (opts.timeLimit, en ms, une barre le montre ; le temps ne passe pas pendant qu'il vole).
//    done({ ok: true }) s'il est lancé assez de fois à temps, done({ ok: false }) sinon.
//  Chat-cordéon s'étire aussi quand on le tire : ses pieds restent en place, son soufflet s'allonge.
//  Les hooks viennent de StoryScene (voir hooks() dans StoryScene.js).
// ============================================================

RM.SLING = {
  launches: 3, // nombre de lancers
  bounces: 3, // il sort au 3e rebond
  maxPull: 230, // px
  minPull: 45, // en dessous, il revient sans partir
  minSpeed: 1250, // px/s (le 3e rebond arrive en moins de 2 s)
  maxSpeed: 1900,
  runSpeed: 620, // px/s quand il s'enfuit (jeu de fin)
  runFar: 320, // il repart toujours à au moins cette distance (px) : il ne reste pas au milieu
  runGrab: 200, // largeur de la zone pour l'attraper quand il court (300 quand il ne bouge pas)
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
    this.need = opts.launches || RM.SLING.launches; // nombre de lancers
    this.sc = opts.scale || 2.6;
    this.state = 'wait';

    const s = scene,
      A = area;

    // il est au centre du cadre
    this.anchor = { x: A.x + A.w / 2, y: A.y + A.h * 0.56 };
    this.elastic = this.key === 'longchat'; // Chat-cordéon ne s'étire pas : on le tire tout entier
    this.rest = this.elastic ? 7 : 0; // la pose roulée en boule

    this.hint = RM.text(s, A.x + A.w / 2, A.y + 50, this.L.hint || '', 30, '#6b4f7f', {
      wordWrap: { width: A.w - 60 },
    });

    this.root.add(this.hint);

    // le chat : au-dessus de tout quand il vole (il sort du cadre)
    this.cat = s.add
      .sprite(this.anchor.x, this.anchor.y, this.key, this.rest)
      .setOrigin(0.5, 1)
      .setScale(opts.scale || 2.6)
      .setDepth(30);

    // étiré : la tête et les pattes gardent leur forme, seul le corps s'allonge
    if (this.elastic)
    {
      this.long = new RM.LongCat(s, 0, 0, 3.2, true);
      this.long.c.setDepth(30).setVisible(false);
    }

    // on le prend en touchant le chat (zone généreuse autour de lui)
    const gw = opts.run ? RM.SLING.runGrab : 300;

    this.grab = s.add.zone(this.anchor.x, this.anchor.y - 50, gw, gw * 0.9).setInteractive({ draggable: true, useHandCursor: true });
    this.root.add(this.grab);
    this.grab.on('dragstart', () => this.dragStart());
    this.grab.on('drag', (p) => this.dragMove(p));
    this.grab.on('dragend', () => this.dragEnd());

    // fin réussie : une barre de temps en haut du cadre
    if (opts.run)
    {
      this.timeLeft = opts.timeLimit || 20000;
      this.timeMax = this.timeLeft;
      this.bar = s.add.graphics();
      this.root.add(this.bar);
      this.hint.setY(A.y + 80);
      this.newRunTarget();
    }

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
          onUpdate: () => this.setPull(hand.x - this.anchor.x, hand.y + 60 - this.anchor.y),
        },
        { targets: hand, alpha: 0, duration: 200 },
      ],
      onComplete: () =>
      {
        hand.destroy();
        this.demoHand = null;
        this.relax();

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

  // Le doigt est à (vx, vy) du centre : le chat s'étire jusque-là
  setPull(vx, vy)
  {
    const a = this.anchor;
    const v = new Phaser.Math.Vector2(vx, vy);

    if (v.length() > RM.SLING.maxPull)
    {
      v.setLength(RM.SLING.maxPull);
    }

    this.pull = v;

    // Chat-cordéon : ses pieds restent en place, sa tête suit le doigt, son soufflet s'allonge
    if (!this.elastic)
    {
      const len = v.length();

      if (len > 6)
      {
        this.cat
          .setOrigin(0.5, 1)
          .setPosition(a.x, a.y)
          .setRotation(Math.atan2(v.y, v.x) + Math.PI / 2)
          .setScale(this.sc * (1 - len / 1500), this.sc * (1 + len / 260));
      }

      return;
    }

    const d = v.length();

    if (d < 6)
    {
      return;
    }

    // la tête suit le doigt, les pattes restent de l'autre côté du centre
    const L = this.long;
    const u = v.clone().normalize();
    const cy = a.y - 50;

    this.cat.setVisible(false);
    L.c.setVisible(true);
    L.setLength(L.base + d);
    L.c.setPosition(a.x + u.x * (d + L.base / 2), cy + u.y * (d + L.base / 2));
    L.c.setRotation(Math.atan2(-u.y, -u.x));
  }

  // Il reprend sa forme, en boule au centre
  relax()
  {
    this.pull = null;

    if (this.long)
    {
      this.long.c.setVisible(false);
    }

    this.cat.setVisible(true).setOrigin(0.5, 1).setAngle(0).setScale(this.sc).setPosition(this.anchor.x, this.anchor.y);
    this.pose(this.rest);
  }

  dragStart()
  {
    if (this.state !== 'ready')
    {
      return;
    }

    this.state = 'pull';
    this.hint.setText('');
    RM.Sfx.tap();
    RM.Sfx.tone(260, 0.25, 'sawtooth', 0.05, 0, 520); // il s'étire : « iiiiii »
  }

  dragMove(p)
  {
    if (this.state !== 'pull')
    {
      return;
    }

    this.setPull(p.x - this.anchor.x, p.y - this.anchor.y + 50);
  }

  dragEnd()
  {
    if (this.state !== 'pull')
    {
      return;
    }

    const c = this.cat;
    const v = this.pull ? this.pull.clone().negate() : new Phaser.Math.Vector2(0, 0);
    const d = v.length();

    this.relax();

    // trop petit : il reste à sa place
    if (d < RM.SLING.minPull)
    {
      this.state = 'ready';
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

    // il met la boutique en désordre : de plus en plus à chaque lancer
    RM.Mess.panic(this.scene);
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
  // Fin réussie : un nouvel endroit où courir, dans le cadre
  newRunTarget()
  {
    const A = this.A;

    const a = this.anchor;
    let p,
      guard = 0;

    // un endroit loin de lui, jusque dans les coins du cadre
    do
    {
      p = {
        x: A.x + 70 + Math.random() * (A.w - 140),
        y: A.y + 190 + Math.random() * (A.h - 230),
      };
    } while (Math.hypot(p.x - a.x, p.y - a.y) < RM.SLING.runFar && guard++ < 30);

    this.runTo = p;
  }

  // Fin réussie : le temps passe ; il court quand on ne le tient pas
  updateRun(dt)
  {
    const A = this.A;

    // le temps ne passe pas pendant qu'il vole ou qu'il revient
    if (this.state === 'ready' || this.state === 'pull')
    {
      this.timeLeft -= dt * 1000;
    }

    const k = Math.max(0, this.timeLeft / this.timeMax);

    this.bar.clear();
    this.bar.fillStyle(0x45306e, 0.25).fillRoundedRect(A.x + 40, A.y + 26, A.w - 80, 22, 11);
    this.bar.fillStyle(k > 0.3 ? RM.C.gold : RM.CORR_RED, 1).fillRoundedRect(A.x + 40, A.y + 26, (A.w - 80) * k, 22, 11);

    if (this.timeLeft <= 0 && !this.finished)
    {
      this.expired = true;

      // en plein vol : on attend qu'il sorte (comeBack termine)
      if (this.state !== 'fly' && this.state !== 'gone')
      {
        this.finish(false);
      }

      return;
    }

    if (this.state !== 'ready')
    {
      return;
    }

    const a = this.anchor,
      c = this.cat;

    const dx = this.runTo.x - a.x,
      dy = this.runTo.y - a.y;

    const d = Math.hypot(dx, dy);

    if (d < 12)
    {
      this.newRunTarget();
      return;
    }

    const st = Math.min(d, RM.SLING.runSpeed * dt);

    a.x += (dx / d) * st;
    a.y += (dy / d) * st;
    this.runT = (this.runT || 0) + dt;
    c.setPosition(a.x, a.y - Math.abs(Math.sin(this.runT * 12)) * 16); // il sautille
    c.setFlipX(dx > 0);
    this.grab.setPosition(a.x, a.y - 50);
  }

  // Fin réussie : c'est fini (ok = lancé 3 fois à temps)
  finish(ok)
  {
    if (this.finished)
    {
      return;
    }

    this.finished = true;
    this.state = 'over';
    this.grab.disableInteractive();
    this.hooks.done({ ok });
  }

  update(dt)
  {
    if (this.dead)
    {
      return;
    }

    if (this.o.run)
    {
      this.updateRun(Math.min(dt, 0.05));
    }

    if (this.state !== 'fly')
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
      RM.Mess.drop(this.scene, 2);
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

      if (this.o.run && (this.launches >= this.need || this.expired))
      {
        this.finish(this.launches >= this.need);
        return;
      }

      if (!this.o.run && this.launches >= this.need)
      {
        this.hooks.done({});
        return;
      }

      // il revient par la droite, en glissant
      c.setOrigin(0.5, 1).setAngle(0);
      this.pose(this.rest);

      if (this.o.run)
      {
        this.anchor.y = this.A.y + 200 + Math.random() * (this.A.h - 260);
        this.anchor.x = this.A.x + this.A.w - 120;
        this.newRunTarget();
      }

      c.setPosition(RM.W + 120, this.anchor.y);

      const back = this.L.back || [];

      if (back.length)
      {
        this.hooks.say('client', back[(this.launches - 1) % back.length]);
      }

      s.tweens.add({
        targets: c,
        x: this.anchor.x,
        duration: this.o.run ? 400 : 700,
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

    if (this.long)
    {
      this.long.destroy();
    }

    this.cat.destroy();
    this.root.destroy();
  }
};
