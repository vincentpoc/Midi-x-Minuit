# Minuit × Midi — notes pour Claude Code

Jeu éducatif pour le joueur (un enfant de moins de 10 ans) : réviser les tables de × et ÷ (2 à 10).
Mode histoire avec Minuit (la petite sœur sorcière) et Midi (le grand frère gourmand et vantard).
Android, portrait. L'auteur décide du design dans le GDD, puis on code.

## Où sont les choses
- `GDD.md` : le plan du jeu. **La section 0 (décisions v0.8) est prioritaire sur le reste.**
- `game/` : le jeu (Phaser 3.90, JavaScript simple, sans compilation ni npm).
  - `game/README.md` : comment lancer, structure des fichiers, réglages.
  - `game/assets/data/` : TOUS les dialogues (l'auteur les modifie à la main ; garder le format une réplique par ligne). `common.json` = ce qui sert à tous les chapitres, `clients/<nom>.json` = un fichier par client.
  - `game/src/data.js` : réglages (RM.MAX_LIVES, RM.CHAPTER_PLAN, RM.CLIENT_FILES, potions…).
  - `game/src/scenes/` : TitleScene (menu + intro), StoryScene (les outils d'un chapitre), GrimoireScene, BootScene.
  - `game/src/chapters/` : un fichier par chapitre et client : son déroulement et ce qui lui est propre.
  - `game/src/story/` : `steps.js` (étapes communes : recette, bouillon, rangement, bulles), `endings.js` (potion, explosion, écran de fin).
  - `game/src/activities/` : une activité par fichier (ShakeAct, RecipeAct, BagsAct, BubblesAct, IntroAct, BoxesAct, PawAct).
  - `game/src/mechanics/` : chaudron (CauldronMech), coffrets (ChestsMech).
  - Les anciennes versions (ancien dossier game, anciennes scènes et mécaniques) sont dans `../Archive/`, hors du dépôt.
- `game/assets/` ne contient QUE les images utilisées par le jeu. Pour en ajouter une : la copier depuis `../Assets/`, puis la charger dans `BootScene.js`.
- `../Assets/` (hors du dépôt, dans `MagicRevision`) : les packs d'assets d'origine. Ne pas les modifier ni les ajouter au dépôt ; le jeu utilise des copies retravaillées dans `game/assets/`.

## Conventions
- Scripts classiques chargés dans l'ordre par `game/index.html`, tout dans l'espace global `RM`.
- Résolution logique 720 × 1280, Scale.FIT. Pixel art en NEAREST (BootScene).
- Polices : `RM.FONT` = Sunday Flower (texte, agrandi par `RM.FONT_SCALE`), `RM.FONT_TITLE` = Twikling (titres, via `RM.title`).
- Textes et commentaires en français.
- Format du code : accolades seules sur leur ligne (if, else, for, while, fonctions, classes), une instruction par ligne, lignes vides entre les blocs. Seules les petites fonctions fléchées d'une seule action restent sur une ligne. Ne pas passer Prettier sur `game/src/` : il remettrait les accolades en fin de ligne.
- Chaque fonction a un commentaire qui dit à quoi elle sert.

## Lancer
`cd game` puis `python -m http.server 8000`, ouvrir http://localhost:8000.
Sur le PC de l'auteur, `python` marche mais `pip` tout seul n'est pas reconnu : pour installer un paquet, lui donner `python -m pip install ...`.
`?reset=1` efface la sauvegarde.

## Tester (pour Claude)
Toujours passer par `python tools/test.py` (depuis `Minuit-X-Midi`) : il lance lui-même le serveur sur un port libre, ouvre le jeu dans Chromium sans fenêtre, attend la fin du chargement, enregistre les captures dans `tests_out/` et liste les erreurs JS et fichiers manquants (code de sortie 1 s'il y en a).
- Ne pas lancer `python -m http.server` en arrière-plan puis le sonder avec `curl` : le serveur n'est pas toujours prêt ou a été arrêté entre deux messages (« Exit code 7 », « 000 »).
- `--query mode=3` ajoute des paramètres ; `--garder` garde la sauvegarde ; `--scenario fichier.py` exécute un `run(page, capture)` avec des clics en coordonnées du jeu (720 × 1280).

## Façon de travailler avec l'auteur
- On décide d'abord dans le GDD, puis on code quand il le demande.
- Il veut des encouragements, mais qu'on lui dise franchement quand il se trompe.
- Pas de garde-fou sur l'humour de Midi : le joueur adore qu'il le taquine.
