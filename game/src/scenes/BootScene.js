// ============================================================
//  BootScene — charge les images utilisées par le jeu, crée les
//  animations, puis lance l'écran titre.
//  Seules les images utilisées sont dans game/assets. Les autres sont
//  dans MagicRevision\Assets : copier celles qu'on veut ajouter.
// ============================================================

RM.BootScene = class extends Phaser.Scene
{
  // Le nom de la scène pour Phaser
  constructor()
  {
    super('Boot');
  }

  // Charge les images et les dialogues, avec une barre de progression
  preload()
  {
    const W = RM.W,
      H = RM.H;

    const bar = this.add.graphics();

    const label = this.add
      .text(W / 2, H / 2 - 60, 'Préparation des potions…', {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        color: '#f6e7c8',
      })
      .setOrigin(0.5);

    this.load.on('progress', (p) =>
    {
      bar.clear();
      bar.fillStyle(0x45306e, 1).fillRoundedRect(W / 2 - 220, H / 2, 440, 30, 15);
      bar.fillStyle(0xf2c14e, 1).fillRoundedRect(W / 2 - 220, H / 2, 440 * p, 30, 15);
    });

    this.load.on('complete', () =>
    {
      bar.destroy();
      label.destroy();
    });

    // on retient pourquoi un fichier de dialogues n'a pas pu être chargé (pour le message d'erreur)
    this.storyLoadStatus = {};

    this.load.on('loaderror', (f) =>
    {
      if (f.key.startsWith('story_'))
      {
        this.storyLoadStatus[f.key] = f.xhrLoader ? f.xhrLoader.status : '?';
      }
    });

    // Décors
    ['title', 'shop', 'cauldron', 'library'].forEach((k) =>
      this.load.image(`bg_${k}`, `assets/bg/${k}.png`),
    );

    // Personnages
    this.load.spritesheet('witch_idle', 'assets/chars/witch_idle.png', {
      frameWidth: 64,
      frameHeight: 64,
    });

    RM.CLIENTS.forEach((c) =>
      this.load.spritesheet(c.key, `assets/chars/${c.key}.png`, {
        frameWidth: c.fw,
        frameHeight: c.fh,
      }),
    );

    // Chapitre 2 (dessinés par l'auteur, 64 px, pieds au bas de l'image ; pattes en 128 px)
    [
      ['chatcacahuete', 'chars/ChatCacahuette_64px.png'],
      ['cookie_cat', 'chars/Cookie_64px.png'],
      ['cookie_sleep', 'chars/CookieSleeping_64px.png'],
      ['peanut_butter', 'items/PeanutButter.png'],
      ['cookie_midi', 'items/CookieMidi.png'],
    ].forEach(([k, f]) => this.load.image(k, `assets/${f}`));

    // Midi, le grand frère
    this.load.spritesheet('midi_idle', 'assets/chars/calico_idle.png', {
      frameWidth: 64,
      frameHeight: 64,
    });

    // sa planche de marche (la poursuite) : 4 rangées de 4 images (face, dos, gauche, droite)
    this.load.spritesheet('midi_walk', 'assets/chars/calicoKitty_walk.png', {
      frameWidth: 64,
      frameHeight: 64,
    });

    // Après l'explosion : les mêmes personnages, tout noirs (on ne voit que leurs yeux).
    // Même format que les originaux. Le client : clé « <look.sprite>_burned ».
    this.load.spritesheet('witch_burned', 'assets/chars/witch_burned.png', {
      frameWidth: 64,
      frameHeight: 64,
    });

    this.load.spritesheet('midi_burned', 'assets/chars/calico_burned.png', {
      frameWidth: 64,
      frameHeight: 64,
    });

    this.load.spritesheet('boxcat_burned', 'assets/chars/boxcat_burned.png', {
      frameWidth: 32,
      frameHeight: 32,
    });

    this.load.image('chatcacahuete_burned', 'assets/chars/ChatCacahuette_burned.png');

    // Tous les dialogues du mode histoire (modifiables à la main) : common.json et un fichier par client.
    // Chargés en texte : on les lit nous-mêmes pour pouvoir dire où est l'erreur (voir RM.readStory).
    this.load.text('story_common', 'assets/data/common.json');

    RM.CLIENT_FILES.forEach((id) =>
      this.load.text(`story_${id}`, `assets/data/clients/${id}.json`),
    );

    // Objets
    // goûters de Midi (common.json → snacks)
    ['cookies', 'pancakes', 'sandwich'].forEach((k) => this.load.image(k, `assets/items/${k}.png`));

    this.load.spritesheet('alchemy', 'assets/items/alchemy.png', {
      frameWidth: 32,
      frameHeight: 32,
    });

    this.load.spritesheet('hallow', 'assets/items/hallow.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('tiny', 'assets/items/tiny.png', { frameWidth: 16, frameHeight: 16 });
    // le chaudron du bouillon (dessiné par l'auteur) : 4 chaudrons de 128 px
    this.load.spritesheet('cauldron', 'assets/items/witch-cauldron.png', {
      frameWidth: 128,
      frameHeight: 128,
    });

    RM.TABLES.forEach((t) =>
      this.load.spritesheet(`pot_${t}`, `assets/potions/p${t}.png`, {
        frameWidth: 16,
        frameHeight: 16,
      }),
    );

    // Interface
    ['book', 'sound', 'main_menu', 'star'].forEach((k) =>
      this.load.image(`ui_${k}`, `assets/ui/${k}.png`),
    );

    this.load.image('book_page', 'assets/ui/book_page.png');
  }

  // Prépare les images et les animations, vérifie les dialogues, puis lance le menu
  create()
  {
    // Pixel art net : filtrage « plus proche voisin » sur toutes les images
    Object.keys(this.textures.list).forEach((k) =>
    {
      if (k.startsWith('__'))
      {
        return;
      }

      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });

    // Animations
    this.anims.create({
      key: 'witch_idle',
      frames: this.anims.generateFrameNumbers('witch_idle', { start: 0, end: 11 }),
      frameRate: 6,
      repeat: -1,
      repeatDelay: 1200,
    });

    // la marche de Midi : une animation par direction
    ['down', 'up', 'left', 'right'].forEach((dir, row) =>
      this.anims.create({
        key: `midi_walk_${dir}`,
        frames: this.anims.generateFrameNumbers('midi_walk', { start: row * 4, end: row * 4 + 3 }),
        frameRate: 8,
        repeat: -1,
      }),
    );

    // les mêmes animations, en version noircie par l'explosion
    this.anims.create({
      key: 'witch_burned',
      frames: this.anims.generateFrameNumbers('witch_burned', { start: 0, end: 11 }),
      frameRate: 6,
      repeat: -1,
      repeatDelay: 1200,
    });

    this.anims.create({
      key: 'midi_burned',
      frames: this.anims.generateFrameNumbers('midi_burned', { start: 0, end: 9 }),
      frameRate: 6,
      repeat: -1,
      repeatDelay: 900,
    });

    this.anims.create({
      key: 'boxcat_burned_idle',
      frames: this.anims.generateFrameNumbers('boxcat_burned', { start: 0, end: 3 }),
      frameRate: 4,
      repeat: -1,
    });

    this.anims.create({
      key: 'midi_idle',
      frames: this.anims.generateFrameNumbers('midi_idle', { start: 0, end: 9 }),
      frameRate: 6,
      repeat: -1,
      repeatDelay: 900,
    });

    RM.TABLES.forEach((t) =>
    {
      this.anims.create({
        key: `pot_${t}_anim`,
        frames: this.anims.generateFrameNumbers(`pot_${t}`, {
          start: 0,
          end: RM.POTIONS[t].frames - 1,
        }),
        frameRate: 7,
        repeat: -1,
      });
    });

    RM.CLIENTS.forEach((c) =>
    {
      this.anims.create({
        key: `${c.key}_idle`,
        frames: this.anims.generateFrameNumbers(c.key, { start: 0, end: c.frames - 1 }),
        frameRate: c.fps,
        repeat: -1,
      });
    });

    RM.Progress.load();

    // dialogues : faute de frappe = on s'arrête ici avec un message ; clés manquantes = liste + « Continuer »
    const story = RM.loadStory(this.cache.text, this.storyLoadStatus);

    if (story.error)
    {
      this.storyProblem(`Problème dans ${story.file}`, story.error, false);
      return;
    }

    RM.STORY = story.data;

    const missing = RM.checkStory(RM.STORY);

    if (missing.length)
    {
      this.storyProblem(
        'Problème dans les dialogues',
        `Il manque ${missing.length > 1 ? 'ces répliques' : 'cette réplique'} :\n\n${missing.slice(0, 14).join('\n')}` +
          (missing.length > 14 ? `\n… et ${missing.length - 14} autres` : ''),
        true,
      );

      return;
    }

    this.startTitle();
  }

  // Écran d'erreur pour l'auteur (polices simples : les polices du jeu ne sont peut-être pas prêtes)
  storyProblem(title, msg, canContinue)
  {
    const W = RM.W,
      sans = { fontFamily: 'sans-serif' };

    this.add
      .text(W / 2, 140, title, Object.assign({ fontSize: '40px', color: '#f2c14e' }, sans))
      .setOrigin(0.5);

    this.add.text(
      50,
      230,
      msg,
      Object.assign(
        {
          fontSize: '28px',
          color: '#f6e7c8',
          lineSpacing: 8,
          wordWrap: { width: W - 100, useAdvancedWrap: true },
        },
        sans,
      ),
    );

    if (canContinue)
    {
      RM.button(this, W / 2, 1150, 440, 100, 'Continuer quand même', () => this.startTitle(), {
        size: 34,
      });
    }
  }

  // Lance le menu, dès que les polices sont prêtes (2,5 s au maximum)
  startTitle()
  {
    // Attend que les polices soient prêtes (sinon le canvas utilise une police par défaut)
    const go = () => this.scene.start('Title');

    if (document.fonts && document.fonts.load)
    {
      Promise.race([
        Promise.all([
          document.fonts.load("40px 'SundayFlower'"),
          document.fonts.load("40px 'Twikling'"),
        ]),
        new Promise((r) => setTimeout(r, 2500)),
      ]).then(go, go);
    }
    else
    {
      go();
    }
  }
};

// ---------- Lecture et vérification des dialogues ----------
// Lit common.json et les fichiers des clients, puis les réunit dans un seul objet (RM.STORY).
// Renvoie { data }, ou { error, file } pour le premier fichier qui ne se lit pas.
RM.loadStory = (cache, statuses) =>
{
  const common = RM.readStory(cache.get('story_common'), statuses.story_common, 'common.json');

  if (common.error)
  {
    return { error: common.error, file: 'common.json' };
  }

  const data = common.data;

  data.clients = {};

  for (const id of RM.CLIENT_FILES)
  {
    const file = `clients/${id}.json`;
    const part = RM.readStory(cache.get(`story_${id}`), statuses[`story_${id}`], file);

    if (part.error)
    {
      return { error: part.error, file };
    }

    data.clients[id] = part.data;
  }

  return { data };
};

// Lit un fichier de dialogues (file = son nom, pour le message d'erreur).
// Renvoie { data } ou { error } (avec le numéro de ligne quand le navigateur le donne).
RM.readStory = (raw, status, file) =>
{
  if (!raw)
  {
    let why = `\n\nAdresse de la page : ${location.href}`;

    if (location.protocol === 'file:')
    {
      why +=
        '\n\nLe jeu a été ouvert directement depuis le dossier : le navigateur refuse alors de lire les fichiers.' +
        '\nLance le serveur (cd game, puis python -m http.server 8000) et ouvre http://localhost:8000';
    }
    else if (status === 404)
    {
      why +=
        '\n\nLe serveur répond « 404 : introuvable ». Le serveur est-il lancé dans le dossier game ?';
    }
    else if (status)
    {
      why += `\n\nRéponse du serveur : ${status}`;
    }
    else
    {
      why += "\n\nLe fichier est vide ou n'a pas été trouvé.";
    }

    return { error: `Le fichier assets/data/${file} n'a pas pu être chargé.${why}` };
  }

  try
  {
    return { data: JSON.parse(raw) };
  }
  catch (e)
  {
    const msg = String(e.message || e);
    let line = /line (\d+)/.exec(msg);

    line = line ? Number(line[1]) : null;

    const pos = /position (\d+)/.exec(msg);

    if (!line && pos)
    {
      line = raw.slice(0, Number(pos[1])).split('\n').length;
    }

    let where = '';

    if (line)
    {
      const lines = raw.split('\n');

      const near = lines
        .slice(Math.max(0, line - 2), line)
        .map((l, i) => `${Math.max(1, line - 1) + i} : ${l.trim()}`)
        .join('\n');

      where = `\n\nVers la ligne ${line} :\n${near}`;
    }

    return {
      error:
        `Le fichier ne se lit pas (il manque sans doute une virgule, un guillemet ou une accolade).${where}` +
        "\n\nAstuce : l'erreur est souvent à la fin de la ligne juste au-dessus.",
    };
  }
};

// Liste des répliques dont le jeu a besoin et qui manquent (ex : « clients/chatboite.json : ausculte.tickle »).
RM.checkStory = (S) =>
{
  const missing = [];

  // vrai si le chemin « a.b.c » existe dans obj
  const has = (obj, path) =>
    path.split('.').every((k) => (obj = obj && obj[k]) !== undefined && obj !== null);

  // note tous les chemins qui manquent
  const need = (obj, prefix, paths) =>
    paths.forEach((p) =>
    {
      if (!has(obj, p))
      {
        missing.push(prefix + p);
      }
    });

  need(S, 'common.json : ', [
    'characters.minuit.name',
    'characters.midi.name',
    'characters.both.name',
    'titleIntro',
    'chapterClients',
    'ingredients',
    'snacks',
    'midi.brag',
    'midi.mock',
    'minuit.celebrate',
    'minuit.solution',
    'chapterEnd.title',
    'chapterEnd.success',
    'chapterEnd.fail',
    'chapterEnd.explode',
    'chapterEnd.score',
    'chapterEnd.lives',
    'chapterEnd.remember',
    'chapterEnd.perfect',
    'chapterEnd.sessionEnd',
    'chapterEnd.next',
    'correction.title',
    'correction.next',
    'quit.title',
    'quit.yes',
    'quit.no',
  ]);

  // les répliques de chaque étape
  const steps = {
    intro: ['start', 'known', 'knownTitle', 'end'],
    recette: ['intro', 'missing', 'outro', 'line'],
    boites: ['intro', 'ask', 'outro'],
    bouillon: ['intro', 'again', 'series', 'twist', 'outro'],
    review: ['start', 'title'],
    sacs: ['intro', 'outro', 'midiEats', 'midiEatsMinuit'],
    coffrets: ['intro', 'twist', 'outro'],
    melange: [
      'intro',
      'outro',
      'divide',
      'midiBubble',
      'clientBubble',
      'midiChase',
      'midiTouched',
      'clientTouched',
      'bombTouched',
    ],
    potion: ['intro', 'explode'],
  };

  Object.keys(steps).forEach((k) =>
    need(
      S,
      'common.json : ',
      steps[k].map((p) => `steps.${k}.${p}`),
    ),
  );

  (S.chapterClients || []).forEach((id) =>
  {
    if (!S.clients || !S.clients[id])
    {
      missing.push(
        `clients/${id}.json (cité dans chapterClients, à ajouter aussi à RM.CLIENT_FILES)`,
      );
    }
  });

  Object.keys(S.clients || {}).forEach((id) =>
  {
    const c = S.clients[id];

    // le mini-jeu du client (look.game) décide quelles répliques il lui faut
    const chase = c.look && c.look.game === 'chase';

    need(
      c,
      `clients/${id}.json : `,
      [
        'name',
        'potion',
        'arrive',
        'success',
        'fail',
        'failDrink',
        'failFly',
        'look.sprite',
        'look.scale',
        'look.footY',
        'look.game',
        'look.healed',
        'look.failed',
        'ausculte.intro',
        'ausculte.start',
        'ausculte.stop',
        'ausculte.done',
      ].concat(
        chase
          ? [
              'ausculte.caught',
              'ausculte.released',
              'ausculte.hint',
              'ausculte.lick',
              'ausculte.trial',
              'ausculte.trialDone',
              'ausculte.tapHint',
              'ausculte.stopCaught',
              'recette.snacks',
              'recette.snacksOk',
              'recette.redo',
              'courses',
              'shelfCookie.found',
              'shelfCookie.minuit',
              'finalGame.intro',
              'finalGame.start',
              'finalGame.hint',
              'finalGame.protected',
              'finalGame.caught',
            ]
          : [
              'ausculte.tickle',
              'ausculte.aaah',
              'ausculte.upDown',
              'ausculte.tap',
              'ausculte.faster',
              'chracula.name',
              'chracula.out',
            ],
      ),
    );
  });

  return missing;
};
