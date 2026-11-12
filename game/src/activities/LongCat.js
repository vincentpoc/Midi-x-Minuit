// ============================================================
//  LongCat — Loooooong-chat allongé (chapitre 3), en trois morceaux :
//    la tête (avant), le corps (étiré à volonté) et l'arrière avec la queue.
//  Dessin de l'auteur : planche loongchat_noirblanc.png, la pose couchée et étirée,
//  coupée en longchat_front / longchat_mid / longchat_back (même hauteur).
//  (x, y) = le bout du nez, au sol. setLength(px) change la longueur totale.
// ============================================================

RM.LongCat = class
{
  // center = true : les morceaux sont centrés en hauteur (pour le faire tourner autour de son axe)
  constructor(scene, x, y, scale = 3.4, center = false)
  {
    this.scene = scene;
    this.sc = scale;
    this.c = scene.add.container(x, y);

    const oy = center ? 0.5 : 1;

    this.front = scene.add.image(0, 0, 'longchat_front').setOrigin(0, oy).setScale(scale);
    this.mid = scene.add.image(0, 0, 'longchat_mid').setOrigin(0, oy).setScale(scale);
    this.back = scene.add.image(0, 0, 'longchat_back').setOrigin(0, oy).setScale(scale);
    this.c.add([this.mid, this.front, this.back]);

    this.fw = this.front.displayWidth;
    this.bw = this.back.displayWidth;
    this.base = this.fw + this.mid.displayWidth + this.bw; // longueur sans étirement
    this.setLength(this.base);
  }

  // Longueur totale à l'écran (jamais plus court que sans étirement)
  setLength(L)
  {
    L = Math.max(this.fw + this.bw + 2, L);
    this.len = L;
    this.mid.x = this.fw - 1;
    this.mid.displayWidth = L - this.fw - this.bw + 2;
    this.back.x = L - this.bw;
    return this;
  }

  // Hauteur à l'écran
  get height()
  {
    return this.front.displayHeight;
  }

  // Le bout de la queue, à l'écran
  tailX()
  {
    return this.c.x + this.len * this.c.scaleX;
  }

  setTint(c)
  {
    [this.front, this.mid, this.back].forEach((p) => (c === null ? p.clearTint() : p.setTint(c)));
    return this;
  }

  destroy()
  {
    this.c.destroy();
  }
};

// ============================================================
//  RM.bounce — Un objet lancé qui rebondit sur les bords du cadre en tournant.
//  opts : vx, vy (px/s) · bounces (nombre de rebonds) · r (rayon) · spin (degrés/s)
//         exit : true = après le dernier rebond il traverse le bord et sort de l'écran
//         onHit(x, y, n) à chaque rebond · onDone() à la fin
// ============================================================
RM.bounce = (scene, obj, A, opts) =>
{
  const v = { x: opts.vx, y: opts.vy };
  const r = opts.r || 40;
  let hits = 0,
    over = false;

  const end = () =>
  {
    if (over)
    {
      return;
    }

    over = true;
    scene.events.off('update', step);

    if (opts.onDone)
    {
      opts.onDone();
    }
  };

  const hit = (axis) =>
  {
    hits++;

    if (hits > opts.bounces)
    {
      return false;
    }

    v[axis] *= -1;

    if (opts.onHit)
    {
      opts.onHit(obj.x, obj.y, hits);
    }

    return true;
  };

  const step = (t, ms) =>
  {
    if (over || !obj.active)
    {
      end();
      return;
    }

    const dt = Math.min(ms / 1000, 0.05);

    obj.x += v.x * dt;
    obj.y += v.y * dt;
    obj.angle += (opts.spin || 900) * dt * Math.sign(v.x || 1);

    if (hits <= opts.bounces)
    {
      if (obj.x < A.x + r && v.x < 0 && hit('x')) obj.x = A.x + r;
      else if (obj.x > A.x + A.w - r && v.x > 0 && hit('x')) obj.x = A.x + A.w - r;

      if (obj.y < A.y + r && v.y < 0 && hit('y')) obj.y = A.y + r;
      else if (obj.y > A.y + A.h - r && v.y > 0 && hit('y')) obj.y = A.y + A.h - r;
    }

    // sans sortie : il s'arrête après le dernier rebond
    if (!opts.exit && hits >= opts.bounces)
    {
      end();
      return;
    }

    if (obj.x < -200 || obj.x > RM.W + 200 || obj.y < -200 || obj.y > RM.H + 200)
    {
      end();
    }
  };

  scene.events.on('update', step);
  return { stop: end };
};

// ============================================================
//  RM.Mess — Le désordre dans la boutique (chapitre 3).
//  À chaque lancer de Long-chat, des potions et des objets bizarres tombent du haut de l'écran
//  et restent en tas au fond du cadre. Il en tombe de plus en plus au fil du chapitre.
//  Les objets : assets/items/junk.png (16 images de 16 px, choisies dans Assets/sprites).
// ============================================================
RM.Mess = {
  MAX: 30, // objets gardés par terre (les plus vieux disparaissent)
  FRAMES: 16,

  // n objets tombent (plus le niveau de désordre). opts.icons : des ingrédients à la place (RM.icon)
  drop(scene, n, opts = {})
  {
    const A = scene.area;

    if (!A)
    {
      return;
    }

    scene.messItems = scene.messItems || [];
    scene.messLevel = (scene.messLevel || 0) + 0.25;
    n += Math.floor(scene.messLevel);

    for (let i = 0; i < n; i++)
    {
      const x = A.x + 40 + Math.random() * (A.w - 80);
      const floor = A.y + A.h - 16 - Math.random() * 26;
      let o;

      if (opts.icons && opts.icons.length)
      {
        o = RM.icon(scene, x, -60, RM.pick(opts.icons), 56);
      }
      else
      {
        o = scene.add.image(x, -60, 'junk', Math.floor(Math.random() * this.FRAMES)).setScale(3.5);
      }

      o.setDepth(6).setAngle(Math.random() * 360);

      scene.tweens.add({
        targets: o,
        y: floor,
        angle: o.angle + (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360),
        duration: 700 + Math.random() * 500,
        delay: i * 70 + Math.random() * 120,
        ease: 'Bounce.easeOut',
        onStart: () => (o.y = -60),
        onComplete: () =>
        {
          o.setDepth(0);
          RM.Sfx.tone(160 + Math.random() * 200, 0.05, 'square', 0.03);
        },
      });

      scene.messItems.push(o);
    }

    while (scene.messItems.length > this.MAX)
    {
      scene.messItems.shift().destroy();
    }
  },

  // Minuit court de droite à gauche, paniquée
  panic(scene)
  {
    const m = scene.minuit;

    if (!m || !m.active || !m.visible || scene.messPanic)
    {
      return;
    }

    const home = m.x,
      flip = m.flipX;

    scene.messPanic = true;

    // sa bulle d'émotion la suit, puis s'en va
    const em = RM.emote(scene, m, '😱');

    const run = (x, ms) => ({
      targets: m,
      x,
      duration: ms,
      ease: 'Sine.easeInOut',
      onStart: () => m.setFlipX(x < m.x),
      onUpdate: () => em.active && (em.x = m.x),
    });

    scene.tweens.chain({
      tweens: [run(640, 520), run(70, 620), run(520, 520), run(home, 480)],
      onComplete: () =>
      {
        m.setFlipX(flip);
        em.destroy();
        scene.messPanic = false;
      },
    });
  },
};
