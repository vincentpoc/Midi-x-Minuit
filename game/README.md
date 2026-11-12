# Midi × Minuit — mode histoire (v0.9 : chapitres 1 à 3)

Jeu Phaser 3 (HTML/JS, sans compilation), en portrait, pour réviser les tables de × et ÷.

## Lancer le jeu sur le PC

Phaser charge les images par HTTP, donc **double-cliquer sur `index.html` ne marche pas**. Il faut un petit serveur local :

```bash
cd <dossier du dépôt>\game
python -m http.server 8000
```

Sur ce PC, `pip` tout seul n'est pas reconnu : pour installer un paquet, écris `python -m pip install <nom>`. (`py` marche aussi à la place de `python`.)

Ouvre ensuite <http://localhost:8000> dans Chrome. Pour simuler un téléphone, utilise F12, puis l'icône téléphone (Ctrl+Shift+M).

Tu peux aussi utiliser l'extension VS Code « Live Server » (clic droit sur `index.html` → *Open with Live Server*).

## Jouer sur le téléphone Android

1. Le PC et le téléphone doivent être sur le même Wi-Fi.
2. Lance le serveur comme ci-dessus.
3. Sur le téléphone, ouvre `http://<IP-du-PC>:8000`. Pour trouver l'IP, tape `ipconfig` dans un terminal Windows et prends l'« Adresse IPv4 ».
4. Dans le menu de Chrome, choisis **Ajouter à l'écran d'accueil**. Le jeu s'ouvre alors en plein écran, comme une app.

**Raccourcis de test** : dans le menu Chapitres, sous chaque chapitre, des boutons lancent directement une activité (Secouer, Recette, Bouillon, Étagère, Coffrets, Bulles, Fin réussie, Fin ratée).

La progression est sauvegardée dans le navigateur (`localStorage`). Pour la remettre à zéro : menu **Chapitres** → **Effacer la partie** (avec confirmation), ou ajoute `?reset=1` à l'adresse.

Pour tester le chaudron sans résultats ni total (il faut calculer de tête), ajoute `?mode=3`. On peut combiner : `?reset=1&mode=3`.

## Tester automatiquement

Depuis le dossier `Midi-x-Minuit` : `python tools/test.py` vérifie que le jeu démarre sans erreur et enregistre une capture dans `tests_out/`. Ajoute `--voir` pour regarder le navigateur. Il faut Playwright, à installer une seule fois (et à refaire après une mise à jour de Python) :

```bash
python -m pip install playwright
python -m playwright install chromium
```

## Modifier les dialogues ⭐

Tous les textes du mode histoire sont dans **`assets/data/`** :

- **`common.json`** : ce qui sert à tous les chapitres (introduction, étapes, commentaires de Midi et de Minuit, écran de fin, noms des ingrédients et des goûters) ;
- **`clients/chatboite.json`**, **`clients/chatcacahuete.json`** : un fichier par client, avec ses répliques et son apparence.

Format :

- Une réplique : `{ "who": "minuit", "text": "..." }` (`who` = `minuit`, `midi`, `client`, ou `both` pour Minuit et Midi ensemble).
- Dans `common.json`, `titleIntro` = l'introduction sur l'écran d'accueil. Dans un fichier de client, `ausculte` = les répliques du mini-jeu ; `success` / `fail` = les deux fins.
- Une liste de répliques s'affiche l'une après l'autre ; une liste de phrases simples (`"brag"`, `"mock"`…) est tirée au hasard.
- Mots remplacés par le jeu : `{client}`, `{potion}`, `{calc}`, `{answer}`, `{proposal}`, `{ingredient}`, `{n}`, `{chapter}`.
- **Mot fort en BD** : `[bd]CROQUER DEDANS ![/bd]` (police Bangers, sur sa propre ligne). Un seul par réplique.
- **Nombres en grand** : `[nb]3 × 7 = 21[/nb]` (police Lilita One), surtout pour les corrections.
- **Bulles d'émotion** : ajouter `"emotes": {"midi": "😋", "client": "😨"}` à une réplique d'une liste ; chaque personnage qui écoute a une bulle avec son emoji au-dessus de la tête (celui qui parle n'en a jamais).
- Après une modification, recharge la page. S'il y a une faute (virgule ou guillemet oublié), le jeu affiche le nom du fichier et le numéro de la ligne. S'il manque une réplique dont le jeu a besoin, il en donne la liste et propose « Continuer quand même ».

## Structure

```
index.html              page + ordre de chargement des scripts
lib/phaser.min.js       Phaser 3.90 (copie locale, fonctionne hors ligne)
src/data.js             ⭐ les réglages : vies, chapitres, potions, couleurs
src/progress.js         sauvegarde + boîtes de Leitner (maîtrise de chaque fait)
src/ui.js               boutons, slider, bulle, sons, voix
src/chapters/           ⭐ un fichier par chapitre et client : son déroulement et ce qui lui est propre
  chapitre1_chatboite.js   la secousse ; potion ratée = tout le monde s'envole
  chapitre2_cacahuete.js   la poursuite, le jeu du cookie ; potion ratée = beurre de cacahuète
  chapitre3_longchat.js    Loooooong-chat : lance-chat, étirer, minuteur, chasse aux goûters ; potion ratée = Chat-cordéon
src/story/
  steps.js              étapes communes : recette, bouillon, rappel, rangement, bulles
  endings.js            fins communes : potion, explosion, sauvegarde, écran de fin
src/activities/         une activité par fichier
  ShakeAct.js           secouer (3 gestes)
  RecipeAct.js          la recette au slider
  BagsAct.js            l'étagère (Midi saute sur son goûter)
  BoxesAct.js           les boîtes de 2, 4 ou 8
  BubblesAct.js         les bulles en plein écran
  IntroAct.js           « Tu les connais déjà ! » et le rappel des calculs ratés
  ChaseAct.js           la poursuite (chapitre 2)
  LongCat.js            Long-chat allongé en 3 morceaux (chapitre 3)
  SlingAct.js           le lance-chat à rebonds (chapitre 3)
  StretchAct.js         étirer Long-chat sur sa règle (chapitre 3)
  TimerAct.js           le minuteur (chapitre 3)
  SnackHuntAct.js       la chasse aux goûters en haut de l'armoire (chapitre 3)
assets/data/            ⭐ tous les dialogues : common.json + clients/<nom>.json
src/mechanics/
  CauldronMech.js       A — le chaudron : atteindre X ml en combinant les 3 potions de la série
  ChestsMech.js         E — les coffrets : ranger N fioles par paquets, le chat boit le reste
src/scenes/
  BootScene.js          chargement des assets + animations
  TitleScene.js         menu : intro en bulles, clients soignés, Midi qui vole après une potion ratée, Grimoire, Chapitres
  StoryScene.js         un chapitre : la scène et ses outils (dialogues, vies, correction, bouton principal)
  GrimoireScene.js      progression par table (lune pleine = 10 calculs réussis)
assets/                 copies retravaillées de tes assets
```

## Modifier facilement

- **Clients** : `assets/data/clients/<nom>.json` ; `chapterClients` (dans `common.json`) dit quel client vient à quel chapitre. `look` décrit son image (sprite, taille, mini-jeu `shake`, `chase` ou `sling`, forme soignée / ratée).
- **Ingrédients et goûters de Midi** (noms, images) : `ingredients` et `snacks` dans `assets/data/common.json`.
- **Nouveau client et son chapitre** :
  1. Copie sa planche depuis `MagicRevision\Assets` dans `assets/chars/`, et ajoute une ligne dans `RM.CLIENTS` (`src/data.js`, taille d'une frame et nombre de frames).
  2. Crée `assets/data/clients/<nom>.json`, ajoute `<nom>` à `RM.CLIENT_FILES` (`src/data.js`) et à `chapterClients` (`common.json`).
  3. Crée `src/chapters/chapitreN_<nom>.js` en t'inspirant d'un chapitre existant, et ajoute-le à `index.html`.
  4. Augmente `RM.PLAYABLE_CHAPTERS` (`src/data.js`).
- **Nouvelle image** : copie-la depuis `MagicRevision\Assets` dans `assets/`, puis charge-la dans `src/scenes/BootScene.js`. `game/assets` ne garde que les images utilisées.
- **Potion de chaque table** (nom, couleur) : `RM.POTIONS`. Les planches animées sont dans `assets/potions/p2.png` … `p10.png`.
- **Vies** : `RM.MAX_LIVES` et `RM.GOOD_POTION_LIVES` (5 fioles ; leurs images : `RM.LIFE_RED`, `RM.LIFE_GREEN`, `RM.LIFE_BROKEN`). **Bulles du mélange** : `RM.BOMB_CHANCE` (la bulle avec Midi arrive toujours à la dernière multiplication).
- **Chapitres** (tables de chaque chapitre) : `RM.CHAPTER_PLAN`.

## Assets

- Les décors « Witches and Wizards » ont été recadrés en portrait (240×427), pixelisés et réduits à 64 couleurs, pour aller avec les sprites pixel art. Cela fait aussi passer chaque image de ~2 Mo à ~80 Ko. Les originaux ne sont pas modifiés.
- Polices : **Twikling** (titres, Gene Gilmore : gratuite pour tout usage, voir `assets/font/Twikling-licence.txt`) et **Sunday Flower** (texte, © Keithzo). Pour Sunday Flower, vérifie la licence avant toute diffusion publique.
- Sons : générés en code (WebAudio), aucun fichier.

## Limites connues du prototype

- Pas de service worker : le jeu ne fonctionne pas hors ligne une fois installé. Le navigateur n'accepte un service worker qu'en HTTPS (ou sur localhost) : avec `http://<IP-du-PC>:8000`, ce n'est pas possible. Il faudrait héberger le jeu en HTTPS (par exemple GitHub Pages) ou l'emballer en vraie appli Android.
- La voix (bouton haut-parleur) dépend des voix françaises installées sur le téléphone.
- Sunday Flower n'a pas le « œ » (œil de crapaud) : le navigateur l'affiche avec sa police de secours.
