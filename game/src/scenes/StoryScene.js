// ============================================================
//  StoryScene — un chapitre du mode histoire : les outils communs.
//
//  Où est le reste du chapitre :
//    src/chapters/    le déroulement et ce qui est propre à chaque client
//    src/story/steps.js    les étapes communes (recette, bouillon, rangement, bulles)
//    src/story/endings.js  les fins (potion, explosion, écran de fin)
//
//  Erreur = une vie en moins + la correction en grand (on touche pour continuer).
//  10 vies : 10 à 6 = bonne potion, 5 à 1 = mauvaise potion, 0 = la potion explose tout de suite.
//  Tous les textes viennent de assets/data/ (RM.STORY).
// ============================================================

RM.StoryScene = class extends Phaser.Scene
{
  // Le nom de la scène pour Phaser
  constructor()
  {
    super('Story');
  }

  // Lit les options de lancement (chapitre, session, raccourci)
  init(data)
  {
    this.chapter =
      data && data.chapter !== undefined ? data.chapter : RM.Progress.data.chapter || 0;

    this.session = !!(data && data.session); // true = on enchaîne les chapitres

    // Raccourci (menu Chapitres) : commencer directement à une activité.
    // 'intro', 'secouer', 'recette', 'bouillon', 'rangement', 'etagere', 'coffrets', 'boites', 'bulles', 'fin_ok', 'fin_ko'
    this.startAt = (data && data.startAt) || null;
  }

  // Remet le chapitre à zéro, dessine la boutique, puis lance l'histoire (run)
  create()
  {
    const W = RM.W,
      S = RM.STORY;

    this.area = { x: 20, y: 482, w: 680, h: 626 };
    this.group = RM.GROUPS[this.chapter];

    // le fichier du chapitre (src/chapters/)
    this.chapterDef = RM.CHAPTERS[this.chapter];
    this.tables = this.group.tables;
    this.errors = 0;
    this.cur = null;

    // score du chapitre (écran de fin) et calculs ratés à rappeler
    this.asked = 0;
    this.good = 0;
    this.missed = [];
    this.missedQs = [];
    this.exploded = false;
    this.corrBox = null;

    // true = les réponses ne comptent pas dans le score (toujours false pour l'instant)
    this.noScore = false;

    // chaque réponse enregistrée compte dans le score du chapitre
    RM.Progress.onRecord = (t, k, ok) =>
    {
      if (this.noScore)
      {
        return;
      }

      this.asked++;

      if (ok)
      {
        this.good++;
      }
    };

    this.events.once('shutdown', () => { RM.Progress.onRecord = null; });

    // Phaser réutilise la même scène d'un chapitre à l'autre : on efface l'état du chapitre précédent
    this.midiProp = null;
    this.hideProp = false;
    this.dialogNext = false;
    this.quickTimer = null;
    this.quitBox = null;
    this.clientSayFx = null; // un effet quand le client parle (chapitre 3 : les notes de Chat-cordéon)
    this.lcBody = null; // chapitre 3 : le corps de Long-chat allongé
    this.time.paused = false;
    RM.Progress.startDay();

    // le client du chapitre (common.json → chapterClients)
    const ids = S.chapterClients || Object.keys(S.clients);

    this.clientId =
      ids[this.chapter] && S.clients[ids[this.chapter]]
        ? ids[this.chapter]
        : RM.pick(Object.keys(S.clients));

    this.client = S.clients[this.clientId];
    this.look = this.client.look;
    this.clientName = this.client.name;
    this.vars = { client: this.client.name, potion: this.client.potion, chapter: this.chapter + 1 };

    this.add.image(W / 2, RM.H / 2, 'bg_shop').setScale(3);

    // --- barre du haut : chapitre + fioles de vie (au-dessus de tout, même des bulles) ---
    this.add.rectangle(W / 2, 38, W, 76, 0x1d1428, 0.8).setDepth(40);

    RM.text(this, 30, 38, `Chapitre ${this.chapter + 1}`, 32, RM.C.cream)
      .setOrigin(0, 0.5)
      .setDepth(40);

    this.lives = new RM.Lives(this, 320, 36).setDepth(41);

    RM.roundButton(this, W - 44, 38, 26, { key: 'ui_main_menu' }, () => this.confirmQuit(), {
      color: 0x5a4380,
      dark: 0x3a2a55,
    }).setDepth(41);

    // --- personnages ---
    this.pos = { minuit: 100, midi: 255, client: 590 };

    // les ombres suivent Minuit et Midi (et disparaissent quand ils sortent ou s'envolent)
    this.shadows = [
      { e: this.add.ellipse(this.pos.minuit, 472, 130, 22, 0x000000, 0.3), who: () => this.minuit },
      { e: this.add.ellipse(this.pos.midi, 472, 150, 24, 0x000000, 0.3), who: () => this.midi },
    ];

    this.minuit = this.add
      .sprite(this.pos.minuit, 478, 'witch_idle')
      .setOrigin(0.5, 0.95)
      .setScale(3)
      .play('witch_idle');

    this.midi = this.add
      .sprite(this.pos.midi, 478, 'midi_idle')
      .setOrigin(0.5, 0.95)
      .setScale(3.75)
      .play('midi_idle')
      .setDepth(2);

    this.bubble = new RM.Bubble(this, 20, 88, 680, 170);
    this.bubble.c.setDepth(5);

    RM.panel(this, this.area.x, this.area.y, this.area.w, this.area.h);

    this.mainBtn = RM.button(this, W / 2, 1190, 520, 112, 'Suite', () => this.onMain(), {
      color: RM.C.green,
      dark: 0x3b7a40,
      size: 48,
    });

    // « Suite » n'est plus un bouton : on touche le cadre sous les personnages (ou la bulle).
    // Une petite flèche qui clignote sous le cadre, à droite, montre qu'on peut avancer.
    const A = this.area;

    this.tapZone = this.add
      .zone(A.x + A.w / 2, A.y + A.h / 2, A.w, A.h)
      .setDepth(45)
      .setInteractive({ useHandCursor: true });

    this.tapZone.on('pointerup', () => this.onTap());

    // sous le cadre, à droite : elle ne cache jamais une activité (avant, elle chevauchait le curseur)
    this.tapHint = RM.text(this, A.x + A.w - 40, A.y + A.h + 46, '▶', 60, '#f3e6c8', {
      fontFamily: 'sans-serif',
      stroke: '#2a1b38',
      strokeThickness: 8,
    }).setDepth(46);

    this.tweens.add({
      targets: this.tapHint,
      x: '+=12',
      alpha: 0.55,
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.tapCb = null;
    this.mainCb = null;
    this.setMain(null);

    // toucher la bulle fait aussi avancer le dialogue
    this.bubble.g.setInteractive(
      new Phaser.Geom.Rectangle(20, 88, 680, 170),
      Phaser.Geom.Rectangle.Contains,
    );

    this.bubble.g.on('pointerup', () => this.onTap());

    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.run();
  }

  // ---------- outils ----------
  // Attente simple (promesse)
  wait(ms)
  {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  // Attente qu'on peut passer : le bouton « Suite » apparaît et avance tout de suite
  pause(ms)
  {
    return new Promise((resolve) =>
    {
      let done = false;

      const finish = () =>
      {
        if (done)
        {
          return;
        }

        done = true;
        timer.remove();

        if (this.tapCb === skip)
        {
          this.setMain(null);
        }

        resolve();
      };

      const skip = () =>
      {
        if (this.quickTimer)
        {
          this.quickTimer.remove();
        }

        finish();
      };

      const timer = this.time.delayedCall(ms, finish);

      this.setMain('Suite', skip);
    });
  }

  // Animation qu'on peut attendre (promesse)
  tween(cfg)
  {
    return new Promise((r) => this.tweens.add(Object.assign({}, cfg, { onComplete: r })));
  }

  // Le bouton principal a été touché
  onMain()
  {
    if (this.mainCb)
    {
      const cb = this.mainCb;

      cb();
    }
  }

  // Le cadre (ou la bulle) a été touché : avance le dialogue
  onTap()
  {
    if (this.tapCb && !this.quitBox)
    {
      const cb = this.tapCb;

      cb();
    }
  }

  // Bouton menu : on demande avant de quitter (le jeu est en pause pendant la question)
  confirmQuit()
  {
    if (this.quitBox)
    {
      return;
    }

    const W = RM.W,
      Q = RM.STORY.quit;

    this.time.paused = true;
    this.tweens.pauseAll();

    const c = this.add.container(0, 0).setDepth(70);

    this.quitBox = c;
    c.add(this.add.rectangle(W / 2, RM.H / 2, W, RM.H, 0x000000, 0.6).setInteractive());
    c.add(RM.panel(this, 80, 490, W - 160, 300));
    c.add(RM.text(this, W / 2, 580, Q.title, 44, RM.C.ink));

    c.add(
      RM.button(this, W / 2 - 130, 700, 220, 84, Q.yes, () => this.scene.start('Title'), {
        size: 32,
        color: RM.C.red,
        dark: 0x9a3f39,
      }),
    );

    c.add(
      RM.button(
        this,
        W / 2 + 130,
        700,
        220,
        84,
        Q.no,
        () =>
        {
          c.destroy();
          this.quitBox = null;
          this.time.paused = false;
          this.tweens.resumeAll();
        },
        { size: 32, color: RM.C.green, dark: 0x3b7a40 },
      ),
    );
  }

  // Change le bouton principal (label = null : on le cache).
  // « Suite » : pas de bouton, on touche le cadre sous les personnages (voir onTap).
  // « Valider » reste un vrai bouton, sous le cadre.
  setMain(label, cb)
  {
    this.mainBtn.setVisible(false);
    this.mainCb = null;
    this.tapCb = null;
    this.tapZone.input.enabled = false;
    this.tapHint.setVisible(false);

    if (!label)
    {
      return;
    }

    if (label === 'Suite')
    {
      this.tapCb = cb;
      this.tapZone.input.enabled = true;
      this.tapHint.setVisible(true);
      return;
    }

    this.mainBtn.setVisible(true).setLabel(label).setEnabled(true);
    this.mainCb = cb;
  }

  // Le sprite d'un personnage : 'midi', 'minuit' ou le client
  spriteOf(who)
  {
    return who === 'midi' ? this.midi : who === 'minuit' ? this.minuit : this.clientSprite;
  }

  // Position x de la queue de la bulle, vers celui qui parle
  tail(who)
  {
    const s = this.spriteOf(who);

    return Phaser.Math.Clamp(s ? s.x : this.pos.minuit, 70, 650);
  }

  // Le nom affiché dans la bulle
  nameOf(who)
  {
    return who === 'client' ? this.clientName : RM.STORY.characters[who].name;
  }

  // Un objet que Midi porte (son cookie, ses sacs) : il suit Midi à chaque image
  setMidiProp(obj)
  {
    if (this.midiProp)
    {
      this.midiProp.destroy();
    }

    this.midiProp = obj || null;
  }

  // À chaque image : les ombres et l'objet porté par Midi suivent les personnages
  update()
  {
    // ce qui est propre au chapitre (chapitre 3 : le corps de Long-chat suit sa tête)
    if (this.chapterDef && this.chapterDef.update)
    {
      this.chapterDef.update(this);
    }

    (this.shadows || []).forEach(({ e, who }) =>
    {
      const spr = who();

      if (!spr)
      {
        return;
      }

      e.x = spr.x;

      const lift = Math.max(0, 478 - spr.y); // plus il vole haut, plus l'ombre s'efface

      e.setAlpha(spr.visible ? Math.max(0, 1 - lift / 120) : 0);
    });

    const m = this.midi,
      p = this.midiProp;

    if (!m || !p || !p.active)
    {
      return;
    }

    p.setPosition(m.x + (m.flipX ? -46 : 46), m.y - 70);

    // pas de cookie quand Midi est devenu un pot de beurre de cacahuète
    p.setVisible(m.visible && !this.hideProp && m.texture.key === 'midi_idle');
    p.setDepth(m.depth + 0.1);

    if (p.setTint)
    {
      if (m.isTinted)
      {
        p.setTint(m.tintTopLeft);
      }
      else
      {
        p.clearTint();
      }
    }
  }

  // réplique rapide (n'attend pas)
  // emotes (facultatif) : { minuit: '😠', client: '😨' }, des bulles d'émotion au-dessus des
  // personnages qui écoutent. Celui qui parle n'en a jamais (trop d'informations à la fois).
  say(who, text, emotes)
  {
    this.bubble.say(RM.fmt(text, this.vars), this.tail(who), this.nameOf(who));
    this.showEmotes(emotes, who);

    if (who === 'client' && this.clientSayFx)
    {
      this.clientSayFx();
    }

    const spr = this.spriteOf(who);

    if (spr && spr.visible && !this.tweens.isTweening(spr))
    {
      this.tweens.add({ targets: spr, y: spr.y - 14, duration: 120, yoyo: true });
    }
  }

  // Les bulles d'émotion d'une réplique (les précédentes s'en vont)
  showEmotes(emotes, speaker)
  {
    (this.emotes || []).forEach((e) => e.destroy());
    this.emotes = [];

    Object.keys(emotes || {}).forEach((who) =>
    {
      const spr = this.spriteOf(who);

      if (who !== speaker && spr && spr.visible && spr.active)
      {
        this.emotes.push(RM.emote(this, spr, emotes[who]));
      }
    });
  }

  // répliques rapides enchaînées (2,6 s chacune)
  quickLines(lines)
  {
    if (this.quickTimer)
    {
      this.quickTimer.remove();
    }

    let i = 0;

    const step = () =>
    {
      if (i >= lines.length)
      {
        return;
      }

      this.say(lines[i].who, lines[i].text, lines[i].emotes);
      i++;
      this.quickTimer = this.time.delayedCall(2600, step);
    };

    step();
  }

  // dialogue bloquant : on touche « Suite » (ou la bulle) pour avancer
  dialog(lines)
  {
    if (this.quickTimer)
    {
      this.quickTimer.remove();
    }

    return new Promise((resolve) =>
    {
      let i = 0;

      const show = () =>
      {
        if (i >= lines.length)
        {
          this.dialogNext = false;
          this.setMain(null);
          this.showEmotes(null);
          resolve();
          return;
        }

        this.say(lines[i].who, lines[i].text, lines[i].emotes);
        i++;
        this.dialogNext = true;
        this.setMain('Suite', show);
      };

      show();
    });
  }

  // Une erreur : une vie en moins
  error()
  {
    if (this.exploded)
    {
      return;
    }

    this.errors++;
    this.lives.lose();

    // plus aucune vie : la potion explose, le chapitre s'arrête tout de suite
    if (this.lives.left <= 0)
    {
      this.time.delayedCall(700, () => this.explode());
    }
  }

  // La correction en grand : « 4 × 8 = 32 » au centre, au moins 2 s, puis on touche pour continuer.
  // free = série sans pénalité (le calcul n'est pas mis dans les rappels de fin)
  correction(calc, answer, opts = {})
  {
    if (!opts.free && this.missed.length < 20)
    {
      this.missed.push(`${calc} = ${answer}`);
    }

    // pour l'essai sans risque (après le bouillon) : les calculs ratés, avec leurs nombres
    if (!opts.free)
    {
      const m = /(\d+)\s*([×÷])\s*(\d+)/.exec(calc);

      if (m && !this.missedQs.some((q) => q.text === calc))
      {
        const a = Number(m[1]),
          b = Number(m[3]);

        this.missedQs.push(
          m[2] === '×'
            ? { text: calc, answer, t: b, k: a, step: b }
            : { text: calc, answer, step: 1 },
        );
      }
    }

    // La bonne réponse s'affiche dans la bulle de dialogue (plus de fenêtre par-dessus le jeu).
    // On peut toucher le cadre pour continuer après 1,5 s, le temps de la lire.
    return new Promise((resolve) =>
    {
      if (this.exploded)
      {
        return;
      }

      const C = RM.STORY.correction;

      RM.Sfx.pop();
      this.say('minuit', `${C.title} [nb]${calc} = ${answer}[/nb]`); // les nombres en grand
      this.setMain(null);

      this.time.delayedCall(1500, () =>
      {
        if (this.exploded)
        {
          return;
        }

        this.dialogNext = true;

        this.setMain('Suite', () =>
        {
          this.dialogNext = false;
          this.setMain(null);
          resolve();
        });
      });
    });
  }

  // Midi commente : 'brag' (réussi) ou 'mock' (raté)
  midiSays(kind)
  {
    this.say('midi', RM.pick(RM.STORY.midi[kind]));
  }

  // Midi saute sur son goûter (étagère), le récupère et retourne à sa place : ce n'est pas une erreur.
  // Il ne le mange pas : il le garde (chapitre 2 : c'est son cookie perdu, pour le jeu de la fin)
  midiEat(x, y, icon, snack)
  {
    const m = this.midi,
      S = RM.STORY.steps.sacs,
      C = (snack && snack.cookie && this.client.shelfCookie) || null;

    const home = { x: m.x, y: m.y };

    m.setDepth(8);
    this.say('midi', C ? C.found : S.midiEats);
    this.tweens.add({ targets: m, x, duration: 420, ease: 'Sine.easeInOut' });

    this.tweens.add({
      targets: m,
      y: y + 70,
      duration: 420,
      ease: 'Back.easeIn',

      onComplete: () =>
      {
        RM.Sfx.pop();
        RM.sparkle(this, icon.x, icon.y, 0xffffff, 10);
        icon.destroy();

        // il le tient maintenant (il le porte comme ses sacs)
        const spec = (snack && snack.sprite) || { key: 'cookie_midi' };

        this.setMidiProp(
          spec.key === 'cookie_midi'
            ? this.add.image(0, 0, 'cookie_midi').setScale(1.3)
            : RM.icon(this, 0, 0, spec, 56),
        );

        this.tweens.add({ targets: m, scaleY: 3.4, duration: 90, yoyo: true, repeat: 2 });

        this.time.delayedCall(700, () =>
        {
          this.say('minuit', C ? C.minuit : S.midiEatsMinuit);

          this.tweens.add({
            targets: m,
            x: home.x,
            y: home.y,
            duration: 500,
            ease: 'Quad.easeOut',
            onComplete: () => m.setDepth(2),
          });
        });
      },
    });
  }

  // Ce que les activités peuvent demander à la scène :
  //   say(who, text)       réplique rapide (sans attendre)
  //   lines(list)          répliques rapides enchaînées
  //   error()              une vie en moins (à 0, la potion explose)
  //   midi(kind)           Midi commente : 'brag' ou 'mock'
  //   midiEat(x, y, icon, snack)  Midi récupère son goûter (il le garde)
  //   correct(calc, answer, cb, opts)  la correction en grand, puis cb()
  //   remember(calc, answer)  ajoute un calcul aux rappels de fin, sans correction
  //   pause(ms, cb)        attente qu'on peut passer, puis cb()
  //   setMain(label, cb)   bouton principal (null = caché)
  //   done(result)         l'activité est finie
  hooks(done)
  {
    return {
      say: (who, t) => this.say(who, t),
      lines: (l) => this.quickLines(l),
      error: () => this.error(),
      midi: (k) => this.midiSays(k),
      midiEat: (x, y, ic, sn) => this.midiEat(x, y, ic, sn),
      correct: (calc, answer, cb, o) => this.correction(calc, answer, o).then(cb),

      remember: (calc, answer) =>
      {
        if (!this.noScore)
        {
          this.missed.push(`${calc} = ${answer}`);
        }
      },

      pause: (ms, cb) => this.pause(ms).then(cb),
      setMain: (label, cb) => this.setMain(label, cb),
      done,
    };
  }

  // Sons, étoiles et félicitations de Minuit
  celebrate()
  {
    RM.Sfx.good();
    RM.sparkle(this, RM.W / 2, this.area.y + 250, RM.C.gold, 20);
    this.say('minuit', RM.pick(RM.STORY.minuit.celebrate));
    return this.pause(1300);
  }

  // Lance une activité qui appelle hooks.done()
  activity(make)
  {
    return new Promise((resolve) =>
    {
      const act = make(
        this.hooks((res) =>
        {
          if (this.quickTimer)
          {
            this.quickTimer.remove();
          }

          act.destroy();
          this.cur = null;
          resolve(res);
        }),
      );

      this.cur = act;
    });
  }

  // Activité « à valider » (chaudron, coffrets) : un seul essai.
  // Raté = une erreur, la solution s'affiche un instant, puis on continue.
  checkActivity(mech, opts = {})
  {
    return new Promise((resolve) =>
    {
      this.cur = mech;

      let validating = false;

      mech.hooks = {
        setBusy: (b) =>
        {
          if (this.mainCb)
          {
            this.mainBtn.setEnabled(!b);
          }
        },

        // chaudron : « Valider » n'apparaît que s'il y a au moins une potion dans le chaudron
        onTotal: (tot) =>
        {
          if (!validating)
          {
            this.setMain(tot > 0 ? 'Valider' : null, validate);
          }
        },
      };

      const end = () =>
      {
        mech.destroy();
        this.cur = null;
        resolve();
      };

      const validate = () =>
      {
        validating = true;
        this.setMain(null);
        mech.lock();

        mech.check().then((res) =>
        {
          // étoiles du grimoire : le chaudron écrit « k × t », les coffrets sont des divisions
          const kind = mech instanceof RM.ChestsMech ? 'div' : 'ba';

          res.results.forEach((r) => RM.Progress.record(r.t, r.k, r.ok, kind));

          if (res.ok)
          {
            mech.showSuccess(opts.target || { x: this.pos.client, y: 380 });

            if (opts.midi)
            {
              this.wait(1400).then(() => this.midiSays('brag'));
            }

            this.celebrate()
              .then(() => this.pause(opts.midi ? 1600 : 900))
              .then(end);
          }
          else
          {
            RM.Sfx.bad();
            this.error();
            this.say('minuit', `${res.msg} ${RM.pick(RM.STORY.minuit.solution)}`);

            const solTime = mech instanceof RM.ChestsMech ? 1400 + mech.o.k * 480 + 1800 : 3000;

            // la correction en grand : le premier calcul raté (ou le calcul de la commande)
            const bad = res.results.find((r) => !r.ok) ||
              res.results[0] || { t: mech.o.t, k: mech.o.k };

            this.wait(1200)
              .then(() =>
              {
                mech.showSolution();

                if (opts.midi)
                {
                  this.wait(900).then(() => this.midiSays('mock'));
                }

                return this.pause(solTime);
              })
              .then(() => this.correction(`${bad.k} × ${bad.t}`, bad.k * bad.t))
              .then(end);
          }
        });
      };

      const hasTotal = typeof mech.total === 'function';

      this.setMain(!hasTotal || mech.total() > 0 ? 'Valider' : null, validate);
    });
  }

  // ---------- le chapitre ----------
  // Prépare les calculs du chapitre, puis laisse son fichier (src/chapters/) dérouler l'histoire.
  async run()
  {
    this.prepareChapter();
    await this.chapterDef.run(this);
  }
};
