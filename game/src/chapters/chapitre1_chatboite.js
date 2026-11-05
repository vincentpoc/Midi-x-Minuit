// ============================================================
//  Chapitre 1 — Chat-boîte (2 et 4, découverte du 8).
//
//  Chat-boîte est coincé dans sa boîte. Midi le secoue pour « l'ausculter ».
//  Potion réussie : il préfère rester dedans… et Midi le re-secoue !
//    Secoué assez vite (RM.SHAKE_TIME_LIMIT), il sort de sa boîte : c'est Chracula.
//  Potion ratée : le client, puis Midi, s'envolent.
//  Dialogues : assets/data/clients/chatboite.json
// ============================================================

RM.CHAPTERS[0] = {
  // Rangement de ce chapitre : les boîtes
  rangement: 'boites',

  // Le déroulement du chapitre, dans l'ordre de l'histoire
  async run(s)
  {
    await s.clientArrives();
    await s.stepWelcome();

    if (s.go('secouer'))
    {
      await this.shakeGame(s);
      await s.dialog(s.fill(s.client.ausculte.done));
    }

    await s.stepRecipe({ missing: true }); // « Il manque des ingrédients ! »
    await s.stepBroth();
    await s.stepReview();
    await s.stepStorage();
    await s.stepBubbles();
    await this.potion(s);
  },

  // Ausculter : Midi secoue le client (aussi rejoué à la fin).
  // replay = true : fin réussie, Midi vient de crier « ON VA LE SECOUER ! » (avec le chrono caché)
  // Renvoie le résultat de la secousse : { fast }
  async shakeGame(s, replay = false)
  {
    const L = s.client.ausculte;

    if (!replay)
    {
      await s.dialog(s.fill(L.intro)); // Minuit : « Il va falloir… »
      s.say(L.start.who, L.start.text); // Midi lui coupe la parole (reste affiché)
    }

    s.tweens.add({ targets: s.minuit, x: -120, duration: 700, ease: 'Quad.easeIn' }); // Minuit sort

    if (s.clientSprite)
    {
      s.clientSprite.setVisible(false);
    }

    const res = await s.activity(
      (h) => new RM.ShakeAct(s, s.area, s.client, h, { timeLimit: replay ? RM.SHAKE_TIME_LIMIT : 0 }),
    );

    if (s.clientSprite)
    {
      s.clientSprite.setVisible(true);
    }

    await s.tween({ targets: s.minuit, x: s.pos.minuit, duration: 450, ease: 'Quad.easeOut' }); // revient en courant
    s.cameras.main.shake(200, 0.006);
    await s.dialog(s.fill(L.stop)); // « Arrête ! »
    return res;
  },

  // Secoué assez vite : Chat-boîte saute hors de sa boîte et devient Chracula
  async chraculaOut(s)
  {
    const C = s.client.chracula,
      c = s.clientSprite;

    RM.Sfx.pop();
    await s.tween({ targets: c, y: c.y - 60, duration: 180, yoyo: true, ease: 'Quad.easeOut' });
    RM.sparkle(s, c.x, c.y - 90, RM.C.gold, 26);
    c.play('chracula_idle');
    s.clientName = C.name;
    s.vars.client = C.name;
    await s.dialog(s.fill(C.out));
  },

  // La fin du chapitre : réussie ou ratée
  async potion(s)
  {
    await s.stepPotionIntro();

    if (s.potionSucceeds())
    {
      await s.potionWorks();
      await s.dialog(s.fill(s.client.success)); // il ne veut pas sortir… « ON VA LE SECOUER ! »

      const res = await this.shakeGame(s, true);

      if (res && res.fast)
      {
        await this.chraculaOut(s);
        s.finishChapter(true, 'chracula');
      }
      else
      {
        s.finishChapter(true, 'healed');
      }
    }
    else
    {
      // la bulle de dialogue descend dans la zone du bas : le client et Midi s'envolent au-dessus
      s.bubble.moveTo(s.area.y + 60, true);
      await s.potionFails({ client: () => this.clientFloats(s), midi: () => this.midiFlies(s) });
      s.finishChapter(false, 'failed');
    }
  },

  // Potion ratée : Chat-boîte flotte
  clientFloats(s)
  {
    const c = s.clientSprite;

    c.setDepth(6);
    s.tweens.add({ targets: c, y: 330, duration: 1400, ease: 'Sine.easeOut' });

    s.tweens.add({
      targets: c,
      angle: { from: -15, to: 15 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  },

  // Potion ratée : Midi s'envole lui aussi
  midiFlies(s)
  {
    const m = s.midi;

    m.setDepth(6);

    s.tweens.add({
      targets: m,
      angle: { from: -12, to: 12 },
      duration: 450,
      yoyo: true,
      repeat: -1,
    });

    return s.tween({ targets: m, y: 360, x: 430, duration: 1300, ease: 'Sine.easeOut' });
  },
};
