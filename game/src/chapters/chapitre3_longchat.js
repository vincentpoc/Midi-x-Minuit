// ============================================================
//  Chapitre 3 — Loooooong-chat (tables de 5 et 10).
//
//  Il a mangé la gomme à mâcher d'un troll : il est devenu tout élastique. Quand on le tire,
//  il s'étire… et revient d'un coup (SCHLAC !). Le lance-chat revient tout au long du chapitre,
//  et la boutique est de plus en plus en désordre (RM.Mess). Après l'auscultation, il reste allongé dans la boutique
//  et grandit à chaque calcul, jusqu'à sortir de l'écran (derrière l'interface).
//
//  Ausculter : le lance-chat à rebonds (SlingAct).
//  Recette : seulement du 5 et du 10.
//  Multiplication : étirer Long-chat, le chat est le slider (StretchAct) — remplace le bouillon.
//  Division : le minuteur, ÷ 5 seulement (TimerAct) — remplace les boîtes.
//  Mélange : la chasse aux goûters en haut de l'armoire (SnackHuntAct) — remplace les bulles.
//  Les 4 fins (comme pour chaque client) :
//    explosée (0 vie) : tout noir · ratée (5 vies ou moins) : il fond en flaque (failed)
//    réussie : la potion n'est pas parfaite, il se replie en accordéon (Chat-cordéon) et s'enfuit.
//      Jeu de fin : l'attraper et l'étirer 5 fois à temps (SlingAct, opts.run).
//      trop lent : il reste Chat-cordéon (cordeon) · réussi : il reprend son apparence (healed)
//  Dialogues : assets/data/clients/longchat.json
// ============================================================

RM.CHAPTERS[2] = {
  // pas de rangement commun : le minuteur est propre à ce chapitre
  rangement: 'minuteur',

  // Long-chat allongé : taille des morceaux et croissance
  LC_SCALE: 3.4,
  GROW: 14, // px de plus à chaque calcul
  FINAL_LAUNCHES: 5, // jeu de fin : nombre de fois où il faut l'étirer et le lancer
  FINAL_TIME: 16000, // … et le temps pour y arriver (ms, sans compter ses vols)
  MAX_LEN: 1100,

  async run(s)
  {
    s.pos.client = 480; // allongé, il a besoin de place à droite
    await s.clientArrives();

    // un raccourci qui saute l'auscultation : il est déjà tout long
    if (!s.go('secouer'))
    {
      this.makeLong(s);
    }

    this.watchGrowth(s);
    await s.stepWelcome();

    if (s.go('secouer'))
    {
      await this.slingGame(s);
      await s.dialog(s.fill(s.client.ausculte.done));
    }

    await s.stepRecipe();
    await this.stretchStep(s);
    await s.stepReview();
    await this.timerStep(s);
    await this.huntStep(s);
    await this.potion(s);
  },

  // La recette : seulement du 5 et du 10 (des calculs d'autres chapitres seraient un piège)
  makeRecipe(s)
  {
    const ks5 = RM.shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const ks10 = RM.shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const line = (ing, t, k) => ({ ing, t, k, N: t * k });
    const mix = RM.shuffle(s.ings);

    return [
      s.ings.slice(0, 3).map((ing, i) => line(ing, 5, ks5[i])),
      s.ings.slice(3, 6).map((ing, i) => line(ing, 10, ks10[i])),
      [line(mix[0], 5, ks5[3]), line(mix[1], 10, ks10[3]), line(mix[2], 5, ks5[4])],
    ];
  },

  // ---------- Long-chat allongé dans la boutique ----------
  // Le client devient sa tête ; le corps et la queue suivent (voir update)
  makeLong(s)
  {
    const c = s.clientSprite;

    c.stop();
    c.setTexture('longchat_front').setOrigin(0.5, 1).setScale(this.LC_SCALE);

    if (!s.lcBody)
    {
      s.lcBody = {
        mid: s.add.image(0, 0, 'longchat_mid').setOrigin(0, 1).setScale(this.LC_SCALE),
        back: s.add.image(0, 0, 'longchat_back').setOrigin(0, 1).setScale(this.LC_SCALE),
      };

      s.lcBase = c.displayWidth + s.lcBody.mid.displayWidth + s.lcBody.back.displayWidth;
      s.lcLen = s.lcBase + 60;
    }
  },

  // Redevient un chat normal (assis)
  makeNormal(s, key = 'longchat')
  {
    const c = s.clientSprite;

    c.setTexture(key, 0).setOrigin(0.5, 1).setScale(key === 'chatcordeon' ? 2.4 : key === 'longchat_liquid' ? 2.6 : 3);

    if (s.lcBody)
    {
      s.lcBody.mid.destroy();
      s.lcBody.back.destroy();
      s.lcBody = null;
    }
  },

  // Il grandit à chaque calcul enregistré
  watchGrowth(s)
  {
    const prev = RM.Progress.onRecord;

    RM.Progress.onRecord = (...a) =>
    {
      if (prev)
      {
        prev(...a);
      }

      if (s.lcBody)
      {
        s.tweens.add({ targets: s, lcLen: Math.min(this.MAX_LEN, s.lcLen + this.GROW), duration: 400, ease: 'Back.easeOut' });
      }
    };
  },

  // À chaque image (appelé par StoryScene.update) : le corps suit la tête
  update(s)
  {
    const b = s.lcBody,
      c = s.clientSprite;

    if (!b || !c || !c.active)
    {
      return;
    }

    const show = c.visible && c.texture.key === 'longchat_front';
    const fw = c.displayWidth,
      bw = b.back.displayWidth;

    const left = c.x - fw / 2;
    const len = Math.max(s.lcLen, fw + bw + 4);

    b.mid.setPosition(left + fw - 1, c.y).setVisible(show);
    b.mid.displayWidth = len - fw - bw + 2;
    b.back.setPosition(left + len - bw, c.y).setVisible(show);

    [b.mid, b.back].forEach((p) =>
    {
      p.setDepth(c.depth - 0.1).setAlpha(c.alpha);

      if (c.isTinted)
      {
        p.setTint(c.tintTopLeft);
      }
      else
      {
        p.clearTint();
      }
    });
  },

  // ---------- Ausculter : le lance-chat à rebonds ----------
  async slingGame(s)
  {
    const L = s.client.ausculte;

    await s.dialog(s.fill(L.intro)); // Minuit : « Il va falloir… »
    s.say(L.start.who, L.start.text); // Midi : « LE TIRER PAR LA QUEUE ! »
    await s.wait(1200);
    s.clientSprite.setVisible(false);

    await s.activity((h) => new RM.SlingAct(s, s.area, h, { lines: L }));

    // il revient… tout long
    this.makeLong(s);
    s.clientSprite.setVisible(true);
    await s.dialog(s.fill(L.stop));
  },

  // ---------- Multiplication : étirer Long-chat ----------
  async stretchStep(s)
  {
    if (!s.go('bouillon'))
    {
      return;
    }

    const E = s.client.etirer;

    await s.dialog(s.fill(E.intro));

    const ks = [RM.shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10]), RM.shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10])];

    s.clientSprite.setVisible(false); // Long-chat est dans le cadre

    for (let i = 0; i < RM.SHORT_SERIES * RM.PER_SERIES; i++)
    {
      const serie = Math.floor(i / RM.PER_SERIES);
      const q = { t: serie ? 10 : 5, k: ks[serie][i % RM.PER_SERIES] };

      if (i === RM.PER_SERIES)
      {
        await s.dialog(s.fill(E.series, { t: q.t }));
      }

      s.say('minuit', RM.fmt(E.ask, { k: q.k, t: q.t }));

      // le désordre efface le soutien : les nombres tombent au 1er lancer, les traits à la fin de la série 1
      await s.activity(
        (h) =>
          new RM.StretchAct(s, s.area, q, h, {
            first: i === 0,
            free: i === 0, // la première fois, lâcher par accident ne coûte rien
            labels: i === 0,
            ticks: serie === 0,
            loseLabels: i === 0,
            loseTicks: i === RM.PER_SERIES - 1,
            lines: E,
          }),
      );

      if (i === 0)
      {
        await s.dialog(s.fill(E.surprise));
      }
    }

    s.clientSprite.setVisible(true);
    await s.dialog(s.fill(E.outro));
  },

  // ---------- Division : le minuteur (÷ 5) ----------
  async timerStep(s)
  {
    if (!s.go('rangement'))
    {
      return;
    }

    const M = s.client.minuteur;
    const ks = RM.shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10]);

    await s.dialog(s.fill(M.intro));

    for (let i = 0; i < RM.SHORT_SERIES * RM.PER_SERIES; i++)
    {
      const serie = Math.floor(i / RM.PER_SERIES);
      const ing = s.ings[i % s.ings.length];
      const q = { t: 5, k: ks[i], N: 5 * ks[i], ing };

      if (i === RM.PER_SERIES)
      {
        await s.dialog(s.fill(M.series));
      }

      s.say('minuit', RM.fmt(M.ask, { ingredient: ing.plural, n: q.N }));
      await s.activity((h) => new RM.TimerAct(s, s.area, q, h, { labels: serie === 0, ings: s.ings }));
    }

    await s.dialog(s.fill(M.outro));
  },

  // ---------- Mélange : la chasse aux goûters ----------
  async huntStep(s)
  {
    if (!s.go('bulles'))
    {
      return;
    }

    const C = s.client.chasse;
    const used = s.recipe[0].concat(s.recipe[1]).map((r) => `${r.t}x${r.k}`);

    // 3 petits multiples (× 2 à × 5), puis 3 grands (× 6 à × 10), en 5 et en 10
    const pick = (ks) =>
    {
      const out = [];

      RM.shuffle(ks).forEach((k) =>
      {
        const t = RM.pick([5, 10]);

        if (out.length < RM.PER_SERIES && !used.includes(`${t}x${k}`))
        {
          used.push(`${t}x${k}`);
          out.push({ t, k });
        }
      });

      while (out.length < RM.PER_SERIES)
      {
        out.push({ t: RM.pick([5, 10]), k: RM.pick(ks) });
      }

      return out;
    };

    const qs = pick([2, 3, 4, 5]).concat(pick([6, 7, 8, 9, 10]));

    await s.dialog(s.fill(C.intro));
    await this.fullScreen(s, (h) => new RM.SnackHuntAct(s, qs, s.ings, s.client, h, C));
    await s.dialog(s.fill(C.outro));
  },

  // Une activité en plein écran par-dessus la boutique (comme les bulles)
  fullScreen(s, make)
  {
    return new Promise((resolve) =>
    {
      const cam = s.cameras.main;

      s.setMain(null);
      cam.fadeOut(250, 0, 0, 0);

      cam.once('camerafadeoutcomplete', () =>
      {
        const act = make(
          s.hooks(() =>
          {
            cam.fadeOut(300, 0, 0, 0);

            cam.once('camerafadeoutcomplete', () =>
            {
              act.destroy();
              s.cur = null;
              cam.fadeIn(300, 0, 0, 0);
              resolve();
            });
          }),
        );

        s.cur = act;
        cam.fadeIn(250, 0, 0, 0);
      });
    });
  },

  // ---------- La fin ----------
  async potion(s)
  {
    await s.stepPotionIntro();

    if (!s.lcBody)
    {
      this.makeLong(s);
    }

    // ratée (5 vies ou moins) : il se ratatine… et fond en flaque
    if (!s.potionSucceeds())
    {
      RM.Sfx.bad();
      await s.wait(400);
      await this.shrink(s);
      await this.melt(s);
      await s.dialog(s.fill(s.client.fail));
      s.finishChapter(false, 'failed');
      return;
    }

    // réussie… mais pas parfaite : il se ratatine et se replie en accordéon (Chat-cordéon,
    // des notes sortent quand il parle). Il faut l'étirer pour lui redonner sa forme : il s'enfuit !
    await s.potionWorks();
    await this.shrink(s);
    this.makeNormal(s, 'chatcordeon');

    const realName = s.clientName;

    s.clientName = s.client.cordeonName || s.clientName;
    s.vars.client = s.clientName;
    s.clientSayFx = () => this.notes(s, s.clientSprite);
    await this.bounceBack(s);
    await s.dialog(s.fill(s.client.success));

    const F = s.client.finalGame;

    await s.dialog(s.fill(F.intro));
    s.clientSprite.setVisible(false);

    const res = await s.activity(
      (h) =>
        new RM.SlingAct(s, s.area, h, {
          key: 'chatcordeon',
          scale: 2,
          notes: true,
          run: true,
          launches: this.FINAL_LAUNCHES,
          timeLimit: this.FINAL_TIME,
          demo: false,
          lines: F,
        }),
    );

    s.clientSprite.setVisible(true).setPosition(s.pos.client, 478);

    // étiré 5 fois à temps : il reprend son apparence
    if (res && res.ok)
    {
      this.makeNormal(s);
      s.clientName = realName;
      s.vars.client = realName;
      s.clientSayFx = null;
      RM.Sfx.good();
      RM.sparkle(s, s.clientSprite.x, s.clientSprite.y - 90, RM.C.gold, 26);
      await this.bounceBack(s);
      await s.dialog(s.fill(F.win));
      s.finishChapter(true, 'healed');
      return;
    }

    // trop lent : il reste Chat-cordéon
    await s.dialog(s.fill(F.lose));
    s.finishChapter(true, 'cordeon');
  },

  // Il se ratatine comme un élastique qu'on lâche des deux côtés
  shrink(s)
  {
    const c = s.clientSprite;
    const extra = s.lcLen - s.lcBase;

    RM.Sfx.tone(900, 0.35, 'sawtooth', 0.06, 0, 200);

    s.tweens.add({ targets: c, x: c.x + extra / 2, duration: 380, ease: 'Cubic.easeIn' });
    return s.tween({ targets: s, lcLen: s.lcBase, duration: 380, ease: 'Cubic.easeIn' });
  },

  // Potion ratée : il s'écrase en flaque (loongchat_liquid.png), puis… GLOP !
  async melt(s)
  {
    const c = s.clientSprite;

    this.makeNormal(s, 'longchat_liquid');
    c.setScale(2.6);
    RM.Sfx.tone(240, 0.4, 'sine', 0.14, 0, 80);
    await s.tween({ targets: c, scaleY: { from: 1.2, to: 2.6 }, duration: 320, ease: 'Bounce.easeOut' });

    if (s.client.failMelt)
    {
      await s.dialog(s.fill(s.client.failMelt));
    }
    else
    {
      await s.wait(1200);
    }

    RM.Sfx.pop();
  },

  // … puis il rebondit et retourne à sa place
  async bounceBack(s)
  {
    const c = s.clientSprite;

    RM.Sfx.pop();
    RM.sparkle(s, c.x, c.y - 90, RM.C.gold, 20);
    s.tweens.add({ targets: c, x: s.pos.client, duration: 900, ease: 'Sine.easeInOut' });
    await s.tween({ targets: c, y: c.y - 140, duration: 300, yoyo: true, ease: 'Quad.easeOut' });
    await s.tween({ targets: c, y: c.y - 50, duration: 180, yoyo: true, ease: 'Quad.easeOut' });
  },

  // Chat-cordéon : des notes de musique quand il parle
  notes(s, spr)
  {
    if (!spr || !spr.visible)
    {
      return;
    }

    for (let i = 0; i < 3; i++)
    {
      const n = s.add
        .text(spr.x + Phaser.Math.Between(-50, 50), spr.y - spr.displayHeight * 0.6, RM.pick(['♪', '♫', '♬']), {
          fontFamily: 'sans-serif',
          fontSize: '44px',
          color: RM.pick(['#7a3fa0', '#1e6fa8', '#c2410c']),
          stroke: '#ffffff',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(9);

      s.tweens.add({
        targets: n,
        y: n.y - Phaser.Math.Between(80, 140),
        x: n.x + Phaser.Math.Between(-40, 40),
        alpha: 0,
        duration: 1000,
        delay: i * 120,
        onComplete: () => n.destroy(),
      });
    }

    RM.Sfx.tone(Phaser.Math.Between(380, 700), 0.2, 'square', 0.04);
  },
};
