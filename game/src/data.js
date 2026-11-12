// ============================================================
//  data.js — Les réglages du jeu (vies, chapitres, potions, couleurs).
//  Les dialogues sont dans assets/data/.
// ============================================================

window.RM = window.RM || {};

// Résolution logique du jeu (portrait). Phaser met à l'échelle.
RM.W = 720;
RM.H = 1280;

// Polices : Sunday Flower pour le texte, Twikling pour les titres.
// (le « œ » manque dans Sunday Flower : le navigateur prend alors la police de secours)
RM.FONT = "'SundayFlower', 'Comic Sans MS', sans-serif";
RM.FONT_TITLE = "'Twikling', Georgia, serif";

// Sunday Flower est plus petite que l'ancienne police : tout le texte est agrandi de ce facteur.
RM.FONT_SCALE = 1.12;

// Le mot fort d'une réplique, façon bande dessinée : [bd]CROQUER DEDANS ![/bd] dans le texte
RM.FONT_BD = "'Bangers', 'SundayFlower', sans-serif";

// Les nombres en grand (corrections) : [nb]3 × 7 = 21[/nb] dans le texte
RM.FONT_NB = "'LilitaOne', 'SundayFlower', sans-serif";

// Les emojis des bulles d'émotion (dessinés par le téléphone)
RM.FONT_EMOJI = "'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";

// Toutes les tables du jeu (une potion et un onglet du Grimoire pour chacune).
RM.TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10];

// Mode histoire : 10 vies (5 fioles × 2 états : rouge → verte → brisée).
//  à la fin : 10 à 6 vies = bonne potion, 5 à 1 = mauvaise potion, 0 = la potion explose (tout de suite)
RM.MAX_LIVES = 10;
RM.GOOD_POTION_LIVES = 6;

// Fioles de vie (planche alchemy.png, images de 32 px) : rouge, verte, brisée
RM.LIFE_RED = 8;
RM.LIFE_GREEN = 9;
RM.LIFE_BROKEN = 10;

// Séries : 3 séries de 3 questions par activité (sauf l'étagère : 4 exercices)
RM.SERIES = 3;
RM.PER_SERIES = 3;
RM.SHELF_EXERCISES = 4;

// Le bouillon et les boîtes sont plus longs à jouer : 2 séries seulement
RM.SHORT_SERIES = 2;

// Le chaudron du bouillon : image de witch-cauldron.png (0 noir, 1 suspendu, 2 tête de mort, 3 cuivre)
RM.CAULDRON_FRAME = 0;

// Bulles du mélange : 3 petits multiples (jusqu'à × 5), 3 grands (à partir de × 6)
RM.SMALL_MAX_K = 5;

// Les 3 divisions des bulles : trop dures pour l'instant, gardées pour le futur mode difficile
RM.BUBBLE_DIVISIONS = false;

// Chance qu'une bulle-piège accompagne une question
RM.BOMB_CHANCE = 0.7;

// Bouillon juste / faux (et fumées des bulles) : le code couleur des corrections
RM.CORR_GREEN = 0x2fc24a;
RM.CORR_RED = 0xd23a2a;
RM.SMOKE_RED = 0x6e1414; // rouge sombre

// Bulles : la surface de la potion (décor du chaudron) et le fantôme de l'ingrédient (75 % transparent)
RM.POTION_Y = 1030;
RM.GHOST_ALPHA = 0.25;

// Couleurs franches pour bonne / mauvaise réponse
RM.GOOD = '#0f9a2e';
RM.BAD = '#d81e1e';

// Les chapitres (le jeu ne dit jamais « table »). GDD v1.0 :
//  1 : 2 et 4 (découverte du 8) · 2 : 3 · 3 : 5 et 10 · 4 : 6 · 5 : 8 · 6 : 7 · 7 : 9
// Seuls les chapitres déjà écrits sont dans RM.GROUPS (les autres arrivent avec leurs clients).
RM.CHAPTER_PLAN = [
  { tables: [2, 4], discover: 8 },
  { tables: [3] },
  { tables: [5, 10] },
  { tables: [6] },
  { tables: [8] },
  { tables: [7] },
  { tables: [9] },
];

// Nombre de chapitres déjà écrits
RM.PLAYABLE_CHAPTERS = 3;

// Le fichier de chaque chapitre (src/chapters/) s'inscrit ici
RM.CHAPTERS = [];

// Les fichiers de dialogues des clients (assets/data/clients/<nom>.json)
RM.CLIENT_FILES = ['chatboite', 'chatcacahuete', 'longchat'];

RM.GROUPS = RM.CHAPTER_PLAN.slice(0, RM.PLAYABLE_CHAPTERS).map((c, i) =>
  Object.assign({ id: i, name: `Chapitre ${i + 1}` }, c),
);

// Calculs déjà vus avant le chapitre n (pour l'introduction : « Tu les connais déjà ! »)
RM.knownBefore = (n) =>
{
  const set = new Set();

  RM.CHAPTER_PLAN.slice(0, n).forEach((c) =>
    c.tables.forEach((t) =>
    {
      for (let k = 2; k <= 10; k++)
      {
        set.add([t, k].sort((a, b) => a - b).join('x'));
      }
    }),
  );

  return set;
};

// Une potion par table : planche animée (frames de 16 px) + couleur du liquide.
RM.POTIONS = {
  // série 1
  2: { name: 'feuille', frames: 6, color: 0x8fdc1a },
  5: { name: 'lune bleue', frames: 6, color: 0x2f7dff },
  10: { name: 'feu', frames: 6, color: 0xff8500 },

  // série 2
  3: { name: 'rose', frames: 7, color: 0xdb1efb },
  4: { name: 'soleil', frames: 6, color: 0xe0b800 },
  8: { name: 'cerise', frames: 6, color: 0xe03030 },

  // série 3
  6: { name: 'rosée', frames: 8, color: 0x00a6ff },
  7: { name: 'ronron', frames: 7, color: 0xe93aff },
  9: { name: 'citrouille', frames: 5, color: 0xff5800 },
};

// Nombre maximum de « ? » dans une commande du chaudron.
RM.MAX_HIDDEN = 3;

// Les couleurs de l'interface
RM.C = {
  ink: '#3b2a4a',
  inkHex: 0x3b2a4a,
  cream: '#fff6e6',
  parchment: 0xf6e7c8,
  parchmentDark: 0xdcc39a,
  wood: 0x6b4430,
  woodDark: 0x3f271b,
  purple: 0x6b4fa0,
  purpleDark: 0x45306e,
  gold: 0xf2c14e,
  goldText: '#f2c14e',
  green: 0x58a65c,
  greenText: '#0f9a2e',
  red: 0xcf5f57,
  redText: '#d81e1e',
  bubble: 0xfffaf0,
};

// ---------- Clients ----------
// Les planches animées des clients, chargées par BootScene (Chat-boîte seulement pour l'instant ;
// Chat-cacahuète et Cookie sont des images fixes, chargées directement dans BootScene).
// fw/fh = taille d'une frame dans la planche ; frames = nb de frames d'animation
// Autres chats (Nuage = cream, Charbon = gray) : dans MagicRevision\Assets
// (CatPack) : copier la planche dans assets/chars/ puis ajouter une ligne ici.
RM.CLIENTS = [
  { key: 'boxcat', fw: 32, fh: 32, frames: 4, scale: 5, fps: 4, footY: 0.95 },
  { key: 'chracula', fw: 32, fh: 32, frames: 6, scale: 5, fps: 6, footY: 0.95 }, // Chat-boîte sorti de sa boîte
];

// Fin du chapitre 1 : le temps pour finir les 3 gestes de la secousse (Chat-boîte devient Chracula)
RM.SHAKE_TIME_LIMIT = 10000; // en ms, le chrono est caché et part au premier geste

// ---------- Outils ----------
// Un élément au hasard
RM.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Une copie mélangée de la liste
RM.shuffle = (arr) =>
{
  const a = arr.slice();

  for (let i = a.length - 1; i > 0; i--)
  {
    const j = Math.floor(Math.random() * (i + 1));

    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
};

// Remplace les mots spéciaux d'un texte : RM.fmt('{n} ml', { n: 3 }) donne « 3 ml »
RM.fmt = (str, vars = {}) =>
  String(str).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));

// Pour tester : ajoute ?mode=3 à l'adresse pour cacher les résultats et le total du chaudron.
// (?mode=1 et ?mode=2 ne changent rien tant que les « ? » sont désactivés : voir noAsk dans CauldronMech)
RM.FORCE_MODE = (() =>
{
  const m = /[?&]mode=(\d)/.exec(location.search);

  return m ? Number(m[1]) : 0;
})();
