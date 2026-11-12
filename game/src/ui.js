// ============================================================
//  ui.js — Petits outils d'interface réutilisables :
//  texte, bouton, panneau, slider, bulle de dialogue, sons, voix.
// ============================================================

// ---------- Texte ----------
// Un texte centré, dans la police du jeu. extra = options de style Phaser
RM.text = (scene, x, y, str, size = 36, color = RM.C.ink, extra = {}) =>
{
  if (!extra.fontFamily)
  {
    size = Math.round(size * RM.FONT_SCALE);
  }

  const style = Object.assign(
    {
      fontFamily: RM.FONT,
      fontSize: `${size}px`,
      color,
      align: 'center',
      resolution: 2,

      // marge haut/bas : les accents des majuscules (É, À) et les jambages (g, p) ne sont jamais coupés
      padding: { x: 2, y: Math.round(size * 0.18) },
    },
    extra,
  );

  return scene.add.text(x, y, str, style).setOrigin(0.5);
};

// Texte clair avec contour (lisible sur les décors)
RM.title = (scene, x, y, str, size = 56) =>
  RM.text(scene, x, y, str, size, RM.C.cream, {
    fontFamily: RM.FONT_TITLE,
    stroke: '#2a1b38',
    strokeThickness: Math.round(size / 6),
  });

// ---------- Icône d'un ingrédient / objet ----------
// spec = { key, frame? } ; size = taille d'affichage en px
RM.icon = (scene, x, y, spec, size = 64) =>
{
  const img =
    spec.frame !== undefined
      ? scene.add.image(x, y, spec.key, spec.frame)
      : scene.add.image(x, y, spec.key);

  const base = Math.max(img.width, img.height);

  img.setScale(size / base);
  return img;
};

// ---------- Panneau parchemin ----------
// Un panneau en bois et parchemin. opts = { radius, border, fill, alpha }
RM.panel = (scene, x, y, w, h, opts = {}) =>
{
  const g = scene.add.graphics();
  const r = opts.radius || 24;

  g.fillStyle(0x000000, 0.25).fillRoundedRect(x + 6, y + 8, w, h, r);
  g.fillStyle(opts.border || RM.C.wood, 1).fillRoundedRect(x, y, w, h, r);

  g.fillStyle(opts.fill || RM.C.parchment, opts.alpha || 1).fillRoundedRect(
    x + 8,
    y + 8,
    w - 16,
    h - 16,
    r - 6,
  );

  return g;
};

// ---------- Bouton ----------
// Un bouton rectangulaire. opts = { color, dark, size }.
// Renvoie un container avec setEnabled(b) et setLabel(s).
RM.button = (scene, x, y, w, h, label, cb, opts = {}) =>
{
  const c = scene.add.container(x, y);
  const color = opts.color || RM.C.purple;
  const dark = opts.dark || RM.C.purpleDark;
  const g = scene.add.graphics();

  const draw = () =>
  {
    g.clear();
    g.fillStyle(dark, 1).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, h / 3);
    g.fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2, w, h - 4, h / 3);
    g.fillStyle(0xffffff, 0.18).fillRoundedRect(-w / 2 + 10, -h / 2 + 6, w - 20, h / 3, h / 6);
  };

  draw();

  const t = RM.text(scene, 0, -2, label, opts.size || Math.round(h * 0.42), RM.C.cream, {
    stroke: '#2a1b38',
    strokeThickness: 4,
  });

  c.add([g, t]);
  c.label = t;
  c.setSize(w, h);
  c.setInteractive({ useHandCursor: true });

  let enabled = true;

  c.on('pointerdown', () =>
  {
    if (enabled)
    {
      c.setScale(0.94);
      RM.Sfx.tap();
    }
  });

  c.on('pointerout', () => c.setScale(1));

  c.on('pointerup', () =>
  {
    if (!enabled)
    {
      return;
    }

    c.setScale(1);
    cb && cb();
  });

  // Active ou désactive le bouton
  c.setEnabled = (b) =>
  {
    enabled = b;
    c.setAlpha(b ? 1 : 0.45);
    return c;
  };

  // Change le texte du bouton
  c.setLabel = (s) =>
  {
    t.setText(s);
    return c;
  };

  return c;
};

// Petit bouton rond (icône ou caractère)
// content = un texte, ou une image { key, frame }. opts = { color, dark }.
// Renvoie un container avec setEnabled(b).
RM.roundButton = (scene, x, y, r, content, cb, opts = {}) =>
{
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();

  g.fillStyle(opts.dark || RM.C.purpleDark, 1).fillCircle(0, 5, r);
  g.fillStyle(opts.color || RM.C.purple, 1).fillCircle(0, 0, r);
  c.add(g);

  if (typeof content === 'string')
  {
    c.add(
      RM.text(scene, 0, -3, content, r * 1.3, RM.C.cream, {
        stroke: '#2a1b38',
        strokeThickness: 4,
      }),
    );
  }
  else if (content)
  {
    c.add(RM.icon(scene, 0, 0, content, r * 1.2));
  }

  c.setSize(r * 2.2, r * 2.2);
  c.setInteractive({ useHandCursor: true });

  let enabled = true;

  c.on('pointerdown', () =>
  {
    if (enabled)
    {
      c.setScale(0.9);
      RM.Sfx.tap();
    }
  });

  c.on('pointerout', () => c.setScale(1));

  c.on('pointerup', () =>
  {
    if (!enabled)
    {
      return;
    }

    c.setScale(1);
    cb && cb();
  });

  // Active ou désactive le bouton
  c.setEnabled = (b) =>
  {
    enabled = b;
    c.setAlpha(b ? 1 : 0.4);
    return c;
  };

  return c;
};

// ---------- Slider ----------
// Un slider horizontal avec boutons − et + pour l'ajustement fin.
// Le slider n'indique JAMAIS si la valeur est bonne : on valide avec « Valider ».
RM.Slider = class
{
  // onChange(valeur, fromUser) est appelé à chaque changement. opts.labels = false : pas de nombres
  constructor(scene, x, y, width, min, max, value, onChange, opts = {})
  {
    this.scene = scene;
    this.min = min;
    this.max = max;
    this.onChange = onChange;
    this.enabled = true;
    this.c = scene.add.container(x, y);

    const btnR = 30;

    this.trackW = width - btnR * 4 - 20;

    const tw = this.trackW;

    const g = scene.add.graphics();

    g.fillStyle(RM.C.woodDark, 1).fillRoundedRect(-tw / 2 - 6, -12, tw + 12, 24, 12);
    g.fillStyle(RM.C.parchmentDark, 1).fillRoundedRect(-tw / 2, -6, tw, 12, 6);

    // Graduations : grande tous les 10 (ou 5), petite à chaque unité si la plage est petite
    const range = max - min;
    const major = range > 20 ? 10 : 5;
    const minor = range <= 20 ? 1 : range <= 50 ? 1 : 5;

    for (let v = min; v <= max; v += minor)
    {
      const px = this.xFor(v);
      const isMajor = v % major === 0;

      g.fillStyle(RM.C.woodDark, isMajor ? 0.9 : 0.45);
      g.fillRect(px - (isMajor ? 2 : 1), 14, isMajor ? 4 : 2, isMajor ? 16 : 8);
    }

    this.c.add(g);

    if (opts.labels !== false)
    {
      for (let v = min; v <= max; v++)
      {
        if (v % major === 0)
        {
          this.c.add(RM.text(scene, this.xFor(v), 44, String(v), 22, RM.C.ink));
        }
      }
    }

    // Zone cliquable de la piste
    const zone = scene.add.zone(0, 0, tw + 40, 80).setInteractive();

    zone.on('pointerdown', (p) => this.setFromPointer(p));
    this.c.add(zone);

    // Poignée
    this.knob = scene.add.container(0, 0);

    const kg = scene.add.graphics();

    kg.fillStyle(RM.C.woodDark, 1).fillCircle(0, 4, 28);
    kg.fillStyle(RM.C.gold, 1).fillCircle(0, 0, 28);
    kg.fillStyle(0xffffff, 0.35).fillCircle(-8, -9, 9);
    this.knob.add(kg);
    this.knob.setSize(80, 80);
    this.knob.setInteractive({ draggable: true, useHandCursor: true });
    this.knob.on('drag', (p) => this.setFromPointer(p));
    this.knob.on('pointerdown', (p) => this.setFromPointer(p));
    this.c.add(this.knob);

    // Boutons − et +
    this.minus = RM.roundButton(scene, -width / 2 + btnR, 0, btnR, '−', () =>
      this.set(this.value - 1, true),
    );

    this.plus = RM.roundButton(scene, width / 2 - btnR, 0, btnR, '+', () =>
      this.set(this.value + 1, true),
    );

    this.c.add([this.minus, this.plus]);

    this.set(value, false);
  }

  // Position x de la poignée pour la valeur v
  xFor(v)
  {
    return -this.trackW / 2 + ((v - this.min) / (this.max - this.min)) * this.trackW;
  }

  // Place la poignée là où est le doigt
  setFromPointer(p)
  {
    if (!this.enabled)
    {
      return;
    }

    const local = p.x - this.c.x - (this.c.parentContainer ? this.c.parentContainer.x : 0);
    const ratio = Phaser.Math.Clamp((local + this.trackW / 2) / this.trackW, 0, 1);

    this.set(Math.round(this.min + ratio * (this.max - this.min)), true);
  }

  // Change la valeur ; fromUser = true si c'est un geste du joueur
  set(v, fromUser)
  {
    if (fromUser && !this.enabled)
    {
      return;
    }

    v = Phaser.Math.Clamp(Math.round(v), this.min, this.max);

    const changed = v !== this.value;

    this.value = v;
    this.knob.x = this.xFor(v);

    if (changed && fromUser)
    {
      RM.Sfx.tick();
    }

    if (this.onChange)
    {
      this.onChange(v, fromUser);
    }
  }

  // Active ou désactive le slider
  setEnabled(b)
  {
    this.enabled = b;
    this.minus.setEnabled(b);
    this.plus.setEnabled(b);
    this.knob.setAlpha(b ? 1 : 0.6);
  }
};

// ---------- Bulle de dialogue ----------
RM.Bubble = class
{
  // Le rectangle de la bulle, son texte, le nom de celui qui parle et le bouton de lecture à voix haute
  constructor(scene, x, y, w, h)
  {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.c = scene.add.container(0, 0);
    this.g = scene.add.graphics();
    this.who = RM.text(scene, x + 28, y + 26, '', 24, '#7a5c96').setOrigin(0, 0.5);

    this.t = RM.text(scene, x + w / 2, y + h / 2 + 10, '', 34, RM.C.ink, {
      wordWrap: { width: w - 70, useAdvancedWrap: true },
      lineSpacing: 4,
    });

    // le mot fort ([bd]…[/bd]) ou les nombres en grand ([nb]…[/nb]), sur leur propre ligne
    this.big = scene.add.text(x + w / 2, y + h / 2 + 40, '', { fontFamily: RM.FONT_BD, fontSize: '60px' })
      .setOrigin(0.5)
      .setPadding(6, 4, 6, 8);

    this.c.add([this.g, this.who, this.t, this.big]);

    this.speakBtn = RM.roundButton(
      scene,
      x + w - 34,
      y + 30,
      22,
      { key: 'ui_sound' },
      () => RM.speak(this.plain || this.t.text),
      { color: 0xb59ad8, dark: 0x8d70b5 },
    );

    this.c.add(this.speakBtn);
  }

  // Affiche une réplique. side = 'left', 'right' ou une position x ; who = le nom affiché
  say(text, side = 'right', who = '')
  {
    const { x, y, w, h, g } = this;

    g.clear();
    g.fillStyle(0x000000, 0.2).fillRoundedRect(x + 4, y + 6, w, h, 28);
    g.fillStyle(RM.C.bubble, 1).fillRoundedRect(x, y, w, h, 28);

    // queue de la bulle (vers le personnage qui parle). side = 'left', 'right' ou une position x
    const tx = typeof side === 'number' ? side : side === 'right' ? x + w - 150 : x + 120;
    const lean = tx > x + w / 2 ? 20 : -20;

    if (this.tailUp)
    {
      g.fillTriangle(tx - 22, y + 2, tx + 22, y + 2, tx + lean, y - 30);
    }
    else
    {
      g.fillTriangle(tx - 22, y + h - 2, tx + 22, y + h - 2, tx + lean, y + h + 30);
    }

    this.who.setText(who);

    // [bd]…[/bd] : le mot fort en police BD ; [nb]…[/nb] : les nombres en grand.
    // Le reste du texte reste au-dessus, en plus petit.
    const m = /\[(bd|nb)\]([\s\S]*?)\[\/\1\]/.exec(text);
    const rest = m ? (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim() : text;

    this.plain = m ? `${rest} ${m[2]}`.trim() : text; // pour la lecture à voix haute
    this.t.setText(rest);

    // réduit la taille si le texte est long
    let size = Math.round((m ? 30 : 34) * RM.FONT_SCALE);

    this.t.setFontSize(size);

    while (this.t.height > (m ? h - 120 : h - 50) && size > 22)
    {
      size -= 2;
      this.t.setFontSize(size);
    }

    if (m)
    {
      const bd = m[1] === 'bd';

      this.big
        .setText(m[2])
        .setFontFamily(bd ? RM.FONT_BD : RM.FONT_NB)
        .setFontSize(bd ? 60 : 64)
        .setColor(bd ? '#c2410c' : '#45306e')
        .setStroke('#3b2a4a', bd ? 8 : 0)
        .setShadow(bd ? 3 : 0, bd ? 3 : 0, '#3b2a4a', 0, bd, bd)
        .setAngle(bd ? -4 : 0)
        .setVisible(true);

      // trop large : on réduit
      let bigSize = bd ? 60 : 64;

      while (this.big.width > w - 60 && bigSize > 30)
      {
        bigSize -= 4;
        this.big.setFontSize(bigSize);
      }

      // seul (toute la réplique est le mot fort) : au milieu ; sinon sous le texte
      if (rest)
      {
        this.t.setY(y + 26 + (h - 26) * 0.32);
        this.big.setY(y + 26 + (h - 26) * 0.7);
      }
      else
      {
        this.big.setY(y + h / 2 + 10);
      }
    }
    else
    {
      this.big.setVisible(false);
      this.t.setY(y + h / 2 + 10);
    }

    this.c.setScale(0.96);
    this.scene.tweens.add({ targets: this.c, scale: 1, duration: 160, ease: 'Back.easeOut' });
  }

  // Déplace la bulle (haut à newY) ; tailUp = la queue pointe vers le haut
  moveTo(newY, tailUp = false)
  {
    this.tailUp = tailUp;
    this.c.y = newY - this.y;
  }
};

// ---------- Bulles d'émotion ----------
// Le haut de la tête d'un personnage, à l'écran : la première rangée de pixels visibles de son image
// (le dessin ne remplit pas toute l'image). Gardé en mémoire pour chaque image.
RM.headTop = (scene, spr) =>
{
  const b = spr.getBounds();
  const key = spr.texture.key,
    frame = spr.frame.name;

  RM.headRows = RM.headRows || {};

  const id = `${key}#${frame}`;

  if (RM.headRows[id] === undefined)
  {
    const fw = spr.frame.width,
      fh = spr.frame.height;

    let row = 0;

    search: for (let y = 0; y < fh; y++)
    {
      for (let x = 0; x < fw; x++)
      {
        if (scene.textures.getPixelAlpha(x, y, key, frame) > 0)
        {
          row = y;
          break search;
        }
      }
    }

    RM.headRows[id] = row / fh;
  }

  return b.top + RM.headRows[id] * b.height;
};

// Une bulle d'émotion (vide) avec un emoji dedans, posée au-dessus de la tête d'un personnage
RM.emote = (scene, spr, emoji) =>
{
  const c = scene.add.container(spr.x, RM.headTop(scene, spr) - 4).setDepth(9);

  // la bulle fait 16 px (dessin Kenney), agrandie × 4 ; sa pointe touche la tête
  const img = scene.add.image(0, 0, 'ui_emote_bubble').setOrigin(0.5, 1).setScale(4);

  const t = scene.add
    .text(0, -38, emoji, { fontFamily: RM.FONT_EMOJI, fontSize: '32px' })
    .setOrigin(0.5)
    .setPadding(4, 4, 4, 4);

  c.add([img, t]);
  c.setScale(0);
  scene.tweens.add({ targets: c, scale: 1, duration: 220, ease: 'Back.easeOut' });

  return c;
};

// ---------- Noircis par l'explosion ----------
// La clé noircie d'un personnage : witch_idle → witch_burned, midi_idle → midi_burned,
// un client → « <look.sprite>_burned » (null si ce dessin n'existe pas encore)
RM.burnedKey = (scene, key) =>
{
  const k = { witch_idle: 'witch_burned', midi_idle: 'midi_burned' }[key] || `${key}_burned`;

  return scene.textures.exists(k) ? k : null;
};

// Remplace le dessin d'un personnage par sa version noircie (et garde son animation)
RM.burn = (scene, spr, key) =>
{
  const k = RM.burnedKey(scene, key || spr.texture.key);

  if (!k)
  {
    spr.setTint(0x222222); // pas encore de dessin : on le noircit simplement
    return;
  }

  spr.stop().clearTint().setTexture(k, 0);

  if (scene.anims.exists(k))
  {
    spr.play(k);
  }
  else if (scene.anims.exists(`${k}_idle`))
  {
    spr.play(`${k}_idle`);
  }
};

// Un petit nuage de suie (fumée noire qui monte)
RM.soot = (scene, x, y, n = 10) =>
{
  for (let i = 0; i < n; i++)
  {
    const p = scene.add
      .circle(x + Phaser.Math.Between(-60, 60), y + Phaser.Math.Between(-30, 30), Phaser.Math.Between(14, 30), 0x2a2a2a, 0.8)
      .setDepth(31);

    scene.tweens.add({
      targets: p,
      y: p.y - Phaser.Math.Between(80, 160),
      scale: 1.8,
      alpha: 0,
      duration: Phaser.Math.Between(900, 1500),
      delay: i * 60,
      ease: 'Sine.easeOut',
      onComplete: () => p.destroy(),
    });
  }
};

// ---------- Petites étincelles ----------
RM.sparkle = (scene, x, y, color = RM.C.gold, n = 14) =>
{
  for (let i = 0; i < n; i++)
  {
    const a = (i / n) * Math.PI * 2;
    const s = scene.add.star(x, y, 5, 5, 12, color).setDepth(60);

    scene.tweens.add({
      targets: s,
      x: x + Math.cos(a) * Phaser.Math.Between(60, 120),
      y: y + Math.sin(a) * Phaser.Math.Between(60, 120),
      alpha: 0,
      angle: 180,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => s.destroy(),
    });
  }
};

// ---------- Sons (générés, pas de fichiers) ----------
RM.Sfx = {
  ctx: null,
  muted: false,

  // Le navigateur n'autorise le son qu'après un premier toucher (voir plus bas)
  init()
  {
    try
    {
      if (!this.ctx)
      {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }

      if (this.ctx.state === 'suspended')
      {
        this.ctx.resume();
      }
    }
    catch (e)
    {
      /* pas d'audio */
    }
  },

  // Joue une note : fréquence, durée, forme d'onde, volume, délai, glissement vers slideTo
  tone(freq, dur, type = 'sine', vol = 0.12, when = 0, slideTo = null)
  {
    if (!this.ctx || this.muted)
    {
      return;
    }

    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    o.type = type;
    o.frequency.setValueAtTime(freq, t0);

    if (slideTo)
    {
      o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    }

    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  },

  // Toucher un bouton
  tap()
  {
    this.tone(700, 0.05, 'triangle', 0.06);
  },

  // Petit déclic (slider, limite atteinte)
  tick()
  {
    this.tone(1200, 0.025, 'square', 0.025);
  },

  // Apparition, saut
  pop()
  {
    this.tone(300, 0.12, 'sine', 0.15, 0, 900);
  },

  // Bonne réponse
  good()
  {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.1, i * 0.08));
  },

  // Mauvaise réponse
  bad()
  {
    this.tone(330, 0.25, 'sine', 0.1, 0, 220);
  },

  // Compter : la note monte avec i
  count(i)
  {
    this.tone(440 + i * 60, 0.09, 'triangle', 0.08);
  },
};

document.addEventListener('pointerdown', () => RM.Sfx.init(), { passive: true });

// ---------- Lecture à voix haute ----------
// Sur Android, la liste des voix est souvent vide au début : on la reprend quand elle arrive (voiceschanged).
RM.voice = null;

// Choisit une voix française (québécoise de préférence)
RM.pickVoice = () =>
{
  try
  {
    const voices = speechSynthesis.getVoices();

    RM.voice =
      voices.find((v) => v.lang === 'fr-CA') ||
      voices.find((v) => v.lang && v.lang.startsWith('fr')) ||
      null;
  }
  catch (e)
  {
    /* pas de voix */
  }
};

if ('speechSynthesis' in window)
{
  RM.pickVoice();

  if (speechSynthesis.addEventListener)
  {
    speechSynthesis.addEventListener('voiceschanged', RM.pickVoice);
  }
  else
  {
    speechSynthesis.onvoiceschanged = RM.pickVoice;
  }
}

// Lit un texte à voix haute (× et ÷ sont lus en mots)
RM.speak = (text) =>
{
  if (!('speechSynthesis' in window) || !text)
  {
    return;
  }

  try
  {
    speechSynthesis.cancel();

    const clean = text.replace(/×/g, ' fois ').replace(/÷/g, ' divisé par ').replace(/\n/g, ' ');
    const u = new SpeechSynthesisUtterance(clean);

    if (!RM.voice)
    {
      RM.pickVoice();
    }

    const v = RM.voice;

    if (v)
    {
      u.voice = v;
    }

    u.lang = v ? v.lang : 'fr-CA';
    u.rate = 0.95;
    u.pitch = 1.15;
    speechSynthesis.speak(u);
  }
  catch (e)
  {
    /* pas de voix */
  }
};

// ---------- Lune de progression ----------
// fraction 0 = nouvelle lune (vide) … 1 = pleine lune.
// La partie éclairée est un polygone : bord droit du disque + « terminateur » elliptique.
RM.moon = (scene, x, y, r, fraction) =>
{
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();

  g.fillStyle(0x2a1f3d, 1).fillCircle(0, 0, r + 3);
  g.fillStyle(0x4a3d63, 1).fillCircle(0, 0, r);

  const f = Phaser.Math.Clamp(fraction, 0, 1);

  if (f > 0.02)
  {
    const pts = [];
    const N = 24;

    for (let i = 0; i <= N; i++)
    {
      // bord éclairé (à droite)
      const a = -Math.PI / 2 + (i / N) * Math.PI;

      pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
    }

    for (let i = N; i >= 0; i--)
    {
      // terminateur
      const a = -Math.PI / 2 + (i / N) * Math.PI;

      pts.push({ x: r * (1 - 2 * f) * Math.cos(a), y: r * Math.sin(a) });
    }

    g.fillStyle(0xf6e7a8, 1).fillPoints(pts, true);
  }

  c.add(g);
  return c;
};

// ---------- Fiole animée d'une table ----------
RM.potion = (scene, x, y, t, size = 56) =>
{
  // sans animation (une seule image), pour que le jeu reste calme
  return scene.add.sprite(x, y, `pot_${t}`, 0).setScale(size / 16);
};

// ---------- Fioles de vie : 5 fioles = 10 vies ----------
// Erreurs 1 à 5 : une fiole rouge devient verte (de droite à gauche).
// Erreurs 6 à 10 : une fiole verte devient vide et brisée (de droite à gauche).
RM.Lives = class
{
  // Dessine les 5 fioles, à partir de (x, y)
  constructor(scene, x, y, spacing = 56, scale = 1.6)
  {
    this.scene = scene;
    this.icons = [];
    this.lost = 0;
    this.n = Math.ceil(RM.MAX_LIVES / 2);

    for (let i = 0; i < this.n; i++)
    {
      this.icons.push(scene.add.image(x + i * spacing, y, 'alchemy', RM.LIFE_RED).setScale(scale));
    }

    this.scale = scale;
  }

  // Place toutes les fioles au même plan
  setDepth(d)
  {
    this.icons.forEach((i) => i.setDepth(d));
    return this;
  }

  // Le nombre de vies restantes
  get left()
  {
    return Math.max(0, RM.MAX_LIVES - this.lost);
  }

  // Enlève une vie : la fiole concernée change d'état avec un petit rebond
  lose()
  {
    if (this.lost >= RM.MAX_LIVES)
    {
      return;
    }

    this.lost++;

    const broken = this.lost > this.n;
    const i = this.n - 1 - ((this.lost - 1) % this.n);
    const ic = this.icons[i];

    if (!ic)
    {
      return;
    }

    this.scene.tweens.add({
      targets: ic,
      scale: this.scale * 1.7,
      duration: 160,
      yoyo: true,
      onYoyo: () => ic.setFrame(broken ? RM.LIFE_BROKEN : RM.LIFE_GREEN),
    });
  }
};
