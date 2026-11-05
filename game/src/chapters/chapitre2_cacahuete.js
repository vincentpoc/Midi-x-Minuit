// ============================================================
//  Chapitre 2 — Chat-cacahuète, qui redevient Cookie (table de 3).
//
//  Ausculter : la poursuite (Midi veut croquer Chat-cacahuète, elle l'éloigne).
//  Recette : 2 séries de 3 × 2 à 3 × 6 et 3 × 10, puis 3 × 7, 3 × 8 et 3 × 9 avec les
//    goûters de Midi (sans pénalité) ; s'il y a eu des erreurs, on les refait
//    avec les vrais ingrédients (et là, ça compte).
//  Midi a faim et part au marché ; il revient avec « un petit quelque chose ».
//  Bouillon (3-6-9 ml), étagère de 2 à 5 rangées (on y retrouve son cookie perdu), bulles par 3
//    (3 × 10 y est toujours).
//  Potion réussie : il redevient Cookie, le chat roux, qui veut le cookie de Midi
//    (la poursuite à l'envers). Potion ratée : le client, puis Midi, deviennent
//    du beurre de cacahuète.
//  Dialogues : assets/data/clients/chatcacahuete.json
// ============================================================

RM.CHAPTERS[1] = {
  // Rangement de ce chapitre : l'étagère (les coffrets restent dans le code pour un autre chapitre)
  rangement: 'etagere',

  // Midi a perdu son cookie dans un sac de courses : on le retrouve sur l'étagère
  midiCookie: true,

  // L'étagère de ce chapitre reste facile : de 2 à 5 rangées (6, 9, 12 et 15 ingrédients)
  shelf: { minK: 2, maxK: 5, minN: 6, maxN: 15 },

  // 3 × 10 est dans la recette ; on le retrouve aussi toujours dans les bulles
  mustPractice: [{ t: 3, k: 10 }],

  // Le déroulement du chapitre, dans l'ordre de l'histoire
  async run(s)
  {
    await s.clientArrives();
    await s.stepWelcome();

    if (s.go('secouer'))
    {
      await this.chaseGame(s);
      await s.dialog(s.fill(s.client.ausculte.done));
    }

    await s.stepRecipe();
    await s.stepBroth();
    await s.stepReview();
    await s.stepStorage();
    await s.stepBubbles();
    await this.potion(s);
  },

  // La recette : 2 séries avec 3 × 2 à 3 × 6 et 3 × 10 (six calculs différents), puis les goûters de Midi : 3 × 7, 3 × 8, 3 × 9
  makeRecipe(s)
  {
    const t = s.tables[0];
    const ks = RM.shuffle([2, 3, 4, 5, 6, 10]);
    const snacks = RM.shuffle(RM.STORY.snacks);

    const line = (ing, k, snack) => ({ ing, t, k, N: t * k, snack });

    return [
      s.ings.slice(0, 3).map((ing, i) => line(ing, ks[i])),
      s.ings.slice(3, 6).map((ing, i) => line(ing, ks[i + 3])),
      [7, 8, 9].map((k, i) => line(snacks[i % snacks.length], k, true)),
    ];
  },

  // Ausculter : la poursuite. Midi veut croquer Chat-cacahuète, elle le fait glisser loin de lui.
  async chaseGame(s)
  {
    const L = s.client.ausculte;

    await s.dialog(s.fill(L.intro));
    s.say(L.start.who, L.start.text);

    // le client et Midi passent dans la zone de jeu
    s.clientSprite.setVisible(false);
    s.midi.setVisible(false);

    const res = await s.activity(
      (h) =>
        new RM.ChaseAct(
          s,
          s.area,
          {
            mode: 'protect',
            target: { key: s.look.sprite, scale: 2.2 },
            chaser: { key: 'midi_walk', scale: 2.6, walk: 'midi' },
            lines: L,
          },
          h,
        ),
    );

    s.clientSprite.setVisible(true);
    s.midi.setVisible(true);

    // le nombre de prises ne change que la réplique de fin
    await s.dialog(s.fill(res && res.catches ? L.stopCaught : L.stop));
  },

  // Fin réussie : la poursuite à l'envers, Cookie essaie de voler le cookie de Midi.
  // Renvoie true si Cookie l'attrape (il devient un cookie !)
  async cookieGame(s)
  {
    const F = s.client.finalGame;

    await s.dialog(s.fill(F.intro));
    s.say(F.start.who, F.start.text);
    s.hideProp = true; // le cookie de Midi passe dans la zone de jeu

    // Cookie et le cookie de Midi passent dans la zone de jeu
    s.clientSprite.setVisible(false);

    const res = await s.activity(
      (h) =>
        new RM.ChaseAct(
          s,
          s.area,
          {
            mode: 'reverse',
            target: { key: 'cookie_midi', scale: 2.4 },
            chaser: { key: s.look.healed, scale: 2.4 },
            lines: { hint: F.hint },
          },
          h,
        ),
    );

    s.clientSprite.setVisible(true);
    const caught = !!(res && res.caught);

    if (caught)
    {
      // retournement : il mange le cookie… et devient un cookie
      s.setMidiProp(null);
      RM.Sfx.pop();
      RM.sparkle(s, s.clientSprite.x, s.clientSprite.y - 90, RM.C.gold, 22);
      s.clientSprite.setTexture('cookie_midi').setScale(2.6);
      await s.dialog(s.fill(F.caught));
    }
    else
    {
      s.hideProp = false;
      s.clientSprite.setTexture(s.look.sleeping || s.look.healed);
      await s.dialog(s.fill(F.protected));
    }

    return caught;
  },

  // La fin du chapitre : réussie ou ratée
  async potion(s)
  {
    await s.stepPotionIntro();

    if (s.potionSucceeds())
    {
      // Chat-cacahuète redevient Cookie, le chat roux… puis le jeu du cookie
      await s.potionWorks();
      RM.sparkle(s, s.clientSprite.x, s.clientSprite.y - 90, 0xffffff, 26);
      s.clientSprite.setTexture(s.look.healed);
      s.clientName = s.client.healedName || s.clientName;
      s.vars.client = s.clientName;
      await s.dialog(s.fill(s.client.success)); // « Comment tu t'appelles ? » « Cookie. »

      const caught = await this.cookieGame(s);

      s.finishChapter(true, caught ? 'cookie' : 'healed');
    }
    else
    {
      await s.potionFails({ client: () => this.clientMelts(s), midi: () => this.midiMelts(s) });
      s.finishChapter(false, 'failed');
    }
  },

  // Potion ratée : le client se transforme en beurre de cacahuète
  clientMelts(s)
  {
    const c = s.clientSprite;

    RM.sparkle(s, c.x, c.y - 90, 0xc98a3d, 26);

    s.tweens.add({
      targets: c,
      scaleX: c.scaleX * 1.3,
      scaleY: c.scaleY * 0.7,
      duration: 160,
      yoyo: true,
      onYoyo: () => c.setTexture(s.look.failed),
    });
  },

  // Potion ratée : Midi devient lui aussi un pot de beurre de cacahuète, sur place
  async midiMelts(s)
  {
    const m = s.midi;

    RM.sparkle(s, m.x, m.y - 100, 0xc98a3d, 22);
    m.stop().setTexture(s.look.failed).setOrigin(0.5, 1).setScale(3);
    await s.tween({ targets: m, scaleX: 3 * 1.3, scaleY: 3 * 0.7, duration: 160, yoyo: true });
    await s.wait(600);
  },
};
