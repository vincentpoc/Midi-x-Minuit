// ============================================================
//  steps.js — Les étapes communes à tous les chapitres.
//
//  Ces méthodes s'ajoutent à StoryScene. Chaque fichier de src/chapters/
//  les appelle dans l'ordre de son histoire :
//    clientArrives → stepWelcome → (ausculter, propre au client)
//    → stepRecipe → stepBroth → stepReview → stepStorage → stepBubbles
//    → stepPotionIntro → (fin de la potion, propre au client)
//
//  Chaque étape vérifie elle-même si le raccourci du menu Chapitres
//  (this.startAt) demande de la sauter : voir go().
// ============================================================

// L'ordre des étapes, pour les raccourcis du menu Chapitres
RM.STEP_ORDER = ['intro', 'secouer', 'recette', 'bouillon', 'rangement', 'bulles', 'potion'];

Object.assign(RM.StoryScene.prototype, {
  // Tire les calculs du chapitre et applique le raccourci éventuel (this.startAt)
  prepareChapter()
  {
    const S = RM.STORY,
      P = RM.Progress;

    // ingrédients de la recette (uniquement les tables du chapitre)
    this.ings = RM.shuffle(S.ingredients).slice(0, 6);

    const line = (ing) =>
    {
      const t = P.pickFrom(this.tables);
      const k = P.pickK(t);

      return { ing, t, k, N: t * k };
    };

    // le chapitre peut choisir ses calculs (chapitre 2 : 3 × 2 à 3 × 6 et 3 × 10, puis les goûters de Midi)
    this.recipe = this.chapterDef.makeRecipe
      ? this.chapterDef.makeRecipe(this)
      : [
          this.ings.slice(0, 3).map(line),
          this.ings.slice(3, 6).map(line),
          RM.shuffle(this.ings).slice(0, 3).map(line),
        ];

    this.snacks = RM.shuffle(S.snacks);

    // rangement (activité de division) : choisi par le fichier du chapitre
    this.store = this.chapterDef.rangement;

    // raccourci : on saute les activités avant this.startAt
    this.fromStep = 0;
    this.forceEnd = null;

    if (this.startAt)
    {
      const k =
        {
          etagere: 'rangement',
          coffrets: 'rangement',
          boites: 'rangement',
          fin_ok: 'potion',
          fin_ko: 'potion',
        }[this.startAt] || this.startAt;

      this.fromStep = Math.max(0, RM.STEP_ORDER.indexOf(k));

      if (['etagere', 'coffrets', 'boites'].includes(this.startAt))
      {
        this.store = this.startAt;
      }

      if (this.startAt === 'fin_ok')
      {
        this.forceEnd = true;
      }

      if (this.startAt === 'fin_ko')
      {
        this.forceEnd = false;
      }
    }
  },

  // Vrai si l'étape k doit être jouée (faux si un raccourci la saute)
  go(k)
  {
    return RM.STEP_ORDER.indexOf(k) >= this.fromStep;
  },

  // Remplace les mots spéciaux ({client}, {potion}…) dans une liste de répliques
  fill(lines, extra = {})
  {
    return lines.map((l) => ({
      who: l.who,
      text: RM.fmt(l.text, Object.assign({}, this.vars, extra)),
    }));
  },

  // Le client arrive tout de suite dans la boutique
  async clientArrives()
  {
    const lk = this.look;

    this.clientSprite = this.add
      .sprite(860, 478, lk.sprite, 0)
      .setOrigin(0.5, lk.footY)
      .setScale(lk.scale)
      .setDepth(1);

    if (this.anims.exists(`${lk.sprite}_idle`))
    {
      this.clientSprite.play(`${lk.sprite}_idle`);
    }

    // si un raccourci saute le rangement, Midi a déjà rapporté son cookie du marché
    if (this.fromStep > RM.STEP_ORDER.indexOf('rangement'))
    {
      this.giveCookie();
    }

    await this.tween({
      targets: this.clientSprite,
      x: this.pos.client,
      duration: 700,
      ease: 'Back.easeOut',
    });
  },

  // Midi reçoit son cookie, si ce chapitre en prévoit un (chapterDef.midiCookie)
  giveCookie()
  {
    if (this.chapterDef.midiCookie && !this.midiProp)
    {
      this.setMidiProp(this.add.image(0, 0, 'cookie_midi').setScale(1.3));
    }
  },

  // Les premières répliques, puis l'introduction : « Tu les connais déjà ! » (rien au chapitre 1)
  async stepWelcome()
  {
    if (!this.go('intro'))
    {
      return;
    }

    const St = RM.STORY.steps;

    await this.dialog(this.fill(this.client.arrive));

    if (RM.IntroAct.known(this.chapter).length)
    {
      await this.dialog(this.fill(St.intro.start));
      await this.activity((h) => new RM.IntroAct(this, this.area, this.chapter, h));
      await this.dialog(this.fill(St.intro.end));
    }
  },

  // La recette : 3 séries de 3, toutes au slider.
  // opts.missing = true : Minuit remarque qu'il manque des ingrédients (chapitre 1)
  // Une série de goûters (lignes snack: true, chapitre 2) ne compte pas ; s'il y a eu des erreurs,
  // Minuit fait refaire les mêmes calculs avec les vrais ingrédients, et là ça compte.
  async stepRecipe(opts = {})
  {
    if (!this.go('recette'))
    {
      return;
    }

    const St = RM.STORY.steps;

    await this.dialog(this.fill(St.recette.intro));

    for (let s = 0; s < RM.SERIES; s++)
    {
      const lines = this.recipe[s];

      if (!lines[0].snack)
      {
        await this.activity((h) => new RM.RecipeAct(this, this.area, lines, h));
        continue;
      }

      // la série des goûters de Midi : sans pénalité
      const R = this.client.recette;

      await this.dialog(this.fill(R.snacks));

      const res = await this.activity(
        (h) => new RM.RecipeAct(this, this.area, lines, h, { free: true }),
      );

      if (!res || !res.misses)
      {
        await this.dialog(this.fill(R.snacksOk));
        continue;
      }

      // des erreurs : on refait les mêmes calculs avec les vrais ingrédients (cette fois ça compte)
      await this.dialog(this.fill(R.redo));

      const redo = lines.map((l, i) => ({ ing: this.ings[i % this.ings.length], t: l.t, k: l.k, N: l.N }));

      await this.activity((h) => new RM.RecipeAct(this, this.area, redo, h));
    }

    if (opts.missing)
    {
      await this.dialog(this.fill(St.recette.missing));
    }

    await this.dialog(this.fill(St.recette.outro));
  },

  // Le bouillon : 2 séries de 3, sans Midi (il est parti au marché).
  // Les potions valent 1 ×, 2 × et 3 × la table du calcul.
  // Chapitre 1 : série 1 = tables de 2 et 4 mélangées, série 2 = découverte du 8 (× 2 à × 4).
  // Deux tables sans découverte (5 et 10) : une série chacune. Une seule table : 2 séries de cette table.
  async stepBroth()
  {
    if (!this.go('bouillon'))
    {
      return;
    }

    const St = RM.STORY.steps,
      P = RM.Progress,
      T = this.tables;

    // Midi part au marché (chapitre 2 : il a faim)
    if (this.client.courses)
    {
      await this.dialog(this.fill(this.client.courses));
    }

    this.midi.setFlipX(true);
    this.tweens.add({ targets: this.midi, x: -120, duration: 700, ease: 'Quad.easeIn' });

    // les tables possibles de chaque série
    const plan = this.group.discover
      ? [T, [this.group.discover]]
      : T.length > 1
        ? T.map((t) => [t])
        : [T, T];

    let prevT = null;

    for (let s = 0; s < RM.SHORT_SERIES * RM.PER_SERIES; s++)
    {
      const serie = Math.floor(s / RM.PER_SERIES);
      const t = P.pickFrom(plan[serie % plan.length]);
      const discover = t === this.group.discover;
      const k = discover ? Phaser.Math.Between(2, 4) : P.pickK(t);
      const bo = RM.CauldronMech.makeMult(t, k);

      // une consigne complète au début, « nouvelles fioles » quand la table change, une courte sinon
      const txt = s === 0 ? St.bouillon.intro : t !== prevT ? St.bouillon.series : St.bouillon.again;

      prevT = t;

      // elle s'affiche en même temps que l'exercice : on ne touche pas l'écran devant un cadre vide
      this.quickLines(this.fill(txt, { n: bo.N, a: t, b: 2 * t, c: 3 * t }));

      const cm = new RM.CauldronMech(this, bo, this.area);

      // au premier bouillon, le client commente l'odeur après 7 s
      if (!s)
      {
        this.time.delayedCall(7000, () =>
        {
          if (cm.root.active && !this.dialogNext)
          {
            this.quickLines(this.fill(St.bouillon.twist));
          }
        });
      }

      await this.checkActivity(cm);
    }
  },

  // Le rappel des calculs ratés depuis le début (rien si c'est un sans faute)
  async stepReview()
  {
    if (!this.go('bouillon') || !this.missedQs.length)
    {
      return;
    }

    const review = this.missedQs.slice(0, 6);

    this.missedQs = [];
    await this.dialog(this.fill(RM.STORY.steps.review.start));
    await this.activity((h) => new RM.IntroAct(this, this.area, this.chapter, h, { review }));
  },

  // Le rangement (division) : Midi revient à la place du client, on range, puis chacun reprend sa place
  async stepStorage()
  {
    if (!this.go('rangement'))
    {
      return;
    }

    const St = RM.STORY.steps;

    // Midi revient… et prend la place du client, à droite
    this.midi.setFlipX(false);
    this.midi.x = RM.W + 140;

    if (this.store === 'coffrets')
    {
      this.giveCookie(); // il revient avec son cookie
    }
    else
    {
      this.setMidiProp(this.makeSacks()); // … ou avec ses sacs
    }

    this.tweens.add({
      targets: this.clientSprite,
      x: RM.W + 120,
      duration: 600,
      ease: 'Quad.easeIn',
    });

    await this.tween({
      targets: this.midi,
      x: this.pos.client,
      duration: 800,
      delay: 300,
      ease: 'Back.easeOut',
    });

    await this.dialog(this.fill(St.bouillon.outro));

    if (this.store === 'boites')
    {
      await this.storeInBoxes();
    }
    else if (this.store === 'etagere')
    {
      await this.storeOnShelf();
    }
    else
    {
      await this.storeInChests();
    }

    // chacun reprend sa place
    this.tweens.add({
      targets: this.midi,
      x: this.pos.midi,
      duration: 700,
      ease: 'Sine.easeInOut',
    });

    await this.tween({
      targets: this.clientSprite,
      x: this.pos.client,
      duration: 700,
      delay: 400,
      ease: 'Back.easeOut',
    });
  },

  // Les boîtes : Midi pose ses sacs, on cherche combien il faut de boîtes de 2, 4 ou 8
  async storeInBoxes()
  {
    const St = RM.STORY.steps;

    this.setMidiProp(null);
    await this.dialog(this.fill(St.boites.intro));

    const flat = this.recipe.flat().filter((l) => !l.snack);

    for (let b = 0; b < RM.SHORT_SERIES * RM.PER_SERIES; b++)
    {
      const t = RM.pick([2, 2, 4, 4, 8]);
      const k = t === 8 ? Phaser.Math.Between(2, 4) : Phaser.Math.Between(2, 10);
      const q = { ing: flat[b % flat.length].ing, t, k, N: t * k };

      this.say('minuit', RM.fmt(St.boites.ask, { n: q.N, ingredient: q.ing.plural, t }));
      await this.activity((h) => new RM.BoxesAct(this, this.area, q, h));
    }

    await this.dialog(this.fill(St.boites.outro));
  },

  // L'étagère : 4 exercices, sans trop gros ni trop petits nombres.
  // Le goûter de Midi est dans les sacs 1 et 3 ; chapitre 2 (midiCookie) : son cookie perdu, dans le sac 2.
  // Midi le récupère (il ne le mange pas) et le garde.
  async storeOnShelf()
  {
    const St = RM.STORY.steps;

    // il pose ses sacs
    this.setMidiProp(null);

    const bags = this.shelfBags(this.recipe, this.tables);

    const snackOf = (b) =>
      this.chapterDef.midiCookie
        ? b === 1
          ? { sprite: { key: 'cookie_midi' }, cookie: true }
          : null
        : b % 2 === 0
          ? this.snacks[b / 2]
          : null;

    for (let b = 0; b < bags.length; b++)
    {
      const bag = bags[b];

      // la consigne s'affiche en même temps que l'exercice
      this.quickLines(this.fill(St.sacs.intro, { ingredient: bag.ing.plural, n: bag.N }));

      await this.activity(
        (h) =>
          new RM.BagsAct(this, this.area, bag, b === 0, snackOf(b), h),
      );
    }

    await this.dialog(this.fill(St.sacs.outro));
  },

  // Les coffrets : 9 rangements avec les ingrédients que Midi a rapportés du marché (ceux de la recette)
  async storeInChests()
  {
    const St = RM.STORY.steps;

    for (let c = 0; c < RM.SERIES * RM.PER_SERIES; c++)
    {
      const ln = this.recipe[c % RM.SERIES][Math.floor(c / RM.SERIES) % 3];

      const co = {
        type: 'chests',
        t: ln.t,
        k: ln.k,
        r: 0,
        N: ln.N,
        icon: ln.ing.sprite,
        unit: ln.ing.plural,
      };

      await this.dialog(
        this.fill(St.coffrets.intro, { n: co.N, t: co.t, ingredient: ln.ing.plural }),
      );

      const chm = new RM.ChestsMech(this, co, this.area);

      // au premier coffret, Midi fait semblant de compter après 5 s
      if (!c)
      {
        this.time.delayedCall(5000, () =>
        {
          if (chm.root.active && !this.dialogNext)
          {
            this.quickLines(this.fill(St.coffrets.twist));
          }
        });
      }

      await this.checkActivity(chm, { target: { x: this.midi.x, y: 400 }, midi: true });
    }

    await this.dialog(this.fill(St.coffrets.outro));
  },

  // Mélanger : d'autres calculs du chapitre, en plein écran.
  // 3 petits multiples (× 2 à × 5), 3 grands (× 6 à × 10), et 3 divisions si RM.BUBBLE_DIVISIONS
  async stepBubbles()
  {
    if (!this.go('bulles'))
    {
      return;
    }

    const St = RM.STORY.steps;
    const used = this.recipe[0].concat(this.recipe[1]).map((r) => `${r.t}x${r.k}`);
    const qs = [];

    // tire n calculs dont le multiplicateur convient (okK), en évitant ceux de la recette
    const want = (n, okK, div) =>
    {
      let got = 0,
        guard = 0;

      while (got < n && guard++ < 120)
      {
        const t = RM.Progress.pickFrom(this.tables);
        const k = Phaser.Math.Between(2, 10);

        if (!okK(k))
        {
          continue;
        }

        if (!used.includes(`${t}x${k}`) || guard > 80)
        {
          used.push(`${t}x${k}`);
          qs.push({ t, k, div });
          got++;
        }
      }
    };

    want(RM.PER_SERIES, (k) => k <= RM.SMALL_MAX_K, false);

    // les calculs que le chapitre veut absolument faire travailler (chapitre 2 : 3 × 10)
    const must = (this.chapterDef.mustPractice || []).filter((f) => f.k > RM.SMALL_MAX_K);

    must.forEach((f) =>
    {
      used.push(`${f.t}x${f.k}`);
      qs.push({ t: f.t, k: f.k, div: false });
    });

    want(RM.PER_SERIES - must.length, (k) => k > RM.SMALL_MAX_K, false);

    if (RM.BUBBLE_DIVISIONS)
    {
      want(RM.PER_SERIES, () => true, true);
    }

    await this.dialog(this.fill(St.melange.intro));
    await this.bubbles(qs, this.ings, this.snacks.slice(2)); // les bravos sont faits dans la scène des bulles
    await this.dialog(this.fill(St.melange.outro));
  },

  // Le client boit la potion : la suite dépend du chapitre (voir son fichier)
  async stepPotionIntro()
  {
    await this.dialog(this.fill(RM.STORY.steps.potion.intro));
  },

  // La potion est-elle réussie ? (les raccourcis Fin réussie / Fin ratée décident à la place des vies)
  potionSucceeds()
  {
    return this.forceEnd !== null ? this.forceEnd : this.lives.left >= RM.GOOD_POTION_LIVES;
  },

  // Les sacs d'ingrédients que Midi rapporte du marché
  makeSacks()
  {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();

    [
      [-26, 6],
      [18, 0],
    ].forEach(([x, y]) =>
    {
      g.fillStyle(0x7a5232, 1).fillRoundedRect(x - 26, y - 30, 52, 56, 16);
      g.fillStyle(0xa8744a, 1).fillRoundedRect(x - 22, y - 26, 44, 48, 14);
      g.fillStyle(0x5a3a22, 1).fillRect(x - 12, y - 38, 24, 9);
    });

    c.add(g);
    return c;
  },

  // Les 4 sacs de l'étagère : des calculs de la recette, sans trop gros ni trop petits nombres
  // (de 3 à 8 rangées, de 12 à 40 ingrédients, sauf si le chapitre a sa limite : chapterDef.shelf).
  // On complète au besoin avec d'autres calculs.
  shelfBags(recipe, TW)
  {
    const L = this.chapterDef.shelf || { minK: 3, maxK: 8, minN: 12, maxN: 40 };
    const okB = (t, k) => k >= L.minK && k <= L.maxK && t * k >= L.minN && t * k <= L.maxN;
    const flat = recipe.flat().filter((l) => !l.snack); // pas les goûters de Midi
    const seen = new Set();

    const bags = RM.shuffle(flat)
      .filter((l) =>
      {
        const key = `${l.t}x${l.k}`;

        if (!okB(l.t, l.k) || seen.has(key))
        {
          return false;
        }

        seen.add(key);
        return true;
      })
      .slice(0, RM.SHELF_EXERCISES);

    let guard = 0;

    while (bags.length < RM.SHELF_EXERCISES && guard++ < 200)
    {
      const t = RM.pick(TW),
        k = Phaser.Math.Between(L.minK, L.maxK);

      if (!okB(t, k) || seen.has(`${t}x${k}`))
      {
        continue;
      }

      seen.add(`${t}x${k}`);
      bags.push({ ing: RM.pick(flat).ing, t, k, N: t * k });
    }

    // le 1er sac a ses colonnes imposées et démarre à 2 rangées : 2 rangées seraient déjà la bonne réponse
    if (bags[0].k === 2)
    {
      bags.push(bags.shift());
    }

    return bags;
  },

  // Les bulles : une « scène » en plein écran par-dessus la boutique
  bubbles(qs, ings, snacks)
  {
    return new Promise((resolve) =>
    {
      const cam = this.cameras.main;

      this.setMain(null);
      cam.fadeOut(250, 0, 0, 0);

      cam.once('camerafadeoutcomplete', () =>
      {
        const act = new RM.BubblesAct(
          this,
          qs,
          ings,
          snacks,
          this.client,
          this.hooks(() =>
          {
            cam.fadeOut(300, 0, 0, 0);

            cam.once('camerafadeoutcomplete', () =>
            {
              act.destroy();
              this.cur = null;
              cam.fadeIn(300, 0, 0, 0);
              resolve();
            });
          }),
        );

        this.cur = act;
        cam.fadeIn(250, 0, 0, 0);
      });
    });
  },
});
