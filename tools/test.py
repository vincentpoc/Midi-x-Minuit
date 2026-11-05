# ============================================================
#  test.py — lance le jeu dans un navigateur sans fenêtre et vérifie qu'il démarre
#
#  Tout se fait dans un seul programme : le serveur web tourne ici même
#  (pas de « python -m http.server » à lancer à part, donc plus d'erreur
#  « Exit code 7 / 000 » parce que le serveur n'est pas prêt ou a été arrêté).
#
#  Utilisation (depuis le dossier Minuit-X-Midi) :
#    python tools/test.py                       démarrage simple + capture
#    python tools/test.py --query mode=3        ajoute des paramètres à l'adresse
#    python tools/test.py --scenario s.py       exécute un scénario (voir plus bas)
#    python tools/test.py --voir                ouvre une vraie fenêtre de navigateur
#
#  Un scénario est un fichier Python qui définit :
#    def run(page, capture):
#        page.mouse.click(360, 900)    # coordonnées du jeu (720 × 1280)
#        capture('apres-clic')         # enregistre tests_out/apres-clic.png
#
#  Il faut Playwright :  python -m pip install playwright  puis  python -m playwright install chromium
#  Code de sortie : 0 si tout va bien, 1 s'il y a eu une erreur dans le jeu.
# ============================================================

import argparse
import functools
import importlib.util
import os
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOSSIER_JEU = os.path.join(RACINE, 'game')
DOSSIER_SORTIE = os.path.join(RACINE, 'tests_out')

# Taille de la fenêtre : le jeu est en 720 × 1280, on le montre à moitié taille
LARGEUR = 360
HAUTEUR = 640
ECHELLE = LARGEUR / 720


class ServeurSilencieux(SimpleHTTPRequestHandler):
    """Sert les fichiers du jeu sans écrire une ligne par requête et sans cache."""

    def log_message(self, *args):
        """Ne rien afficher pour chaque fichier servi."""
        pass

    def end_headers(self):
        """Désactive le cache pour toujours tester la dernière version des fichiers."""
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


def demarrer_serveur():
    """Démarre le serveur web dans un fil à part, sur un port libre, et rend son adresse."""
    gestionnaire = functools.partial(ServeurSilencieux, directory=DOSSIER_JEU)

    # Port 0 : le système choisit un port libre, donc pas de conflit avec un autre serveur
    serveur = ThreadingHTTPServer(('127.0.0.1', 0), gestionnaire)
    fil = threading.Thread(target=serveur.serve_forever, daemon=True)
    fil.start()

    # Le serveur écoute dès sa création : il est prêt avant même la première requête
    return serveur, 'http://127.0.0.1:%d/' % serveur.server_address[1]


def charger_scenario(chemin):
    """Charge le fichier scénario et rend sa fonction run(page, capture)."""
    spec = importlib.util.spec_from_file_location('scenario', chemin)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.run


def lire_arguments():
    """Lit les options de la ligne de commande."""
    p = argparse.ArgumentParser(description='Teste le démarrage du jeu Minuit × Midi.')
    p.add_argument('--query', default='', help='paramètres en plus de reset=1, ex. mode=3')
    p.add_argument('--garder', action='store_true', help='ne pas effacer la sauvegarde (pas de reset=1)')
    p.add_argument('--scenario', help='fichier Python qui définit run(page, capture)')
    p.add_argument('--attente', type=float, default=15, help='secondes max pour que le jeu démarre')
    p.add_argument('--voir', action='store_true', help='montrer la fenêtre du navigateur')
    return p.parse_args()


def main():
    """Lance le serveur, ouvre le jeu, attend le menu, fait les captures et fait le bilan."""
    args = lire_arguments()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Playwright manque. Installe-le avec :')
        print('  python -m pip install playwright')
        print('  python -m playwright install chromium')
        return 1

    os.makedirs(DOSSIER_SORTIE, exist_ok=True)
    serveur, adresse = demarrer_serveur()

    parametres = [] if args.garder else ['reset=1']
    if args.query:
        parametres.append(args.query.lstrip('?&'))

    url = adresse + ('?' + '&'.join(parametres) if parametres else '')
    erreurs = []

    try:
        with sync_playwright() as pw:
            navigateur = pw.chromium.launch(headless=not args.voir)
            page = navigateur.new_page(viewport={'width': LARGEUR, 'height': HAUTEUR})

            # On note tout ce qui va mal dans le jeu
            page.on('pageerror', lambda e: erreurs.append('Erreur JS : %s' % e))
            page.on('console', lambda m: m.type == 'error' and erreurs.append('Console : %s' % m.text))
            page.on('response', lambda r: r.status >= 400 and erreurs.append('Fichier introuvable (%d) : %s' % (r.status, r.url.replace(adresse, ''))))

            def capture(nom):
                """Enregistre une capture de l'écran du jeu dans tests_out/."""
                chemin = os.path.join(DOSSIER_SORTIE, nom + '.png')
                page.screenshot(path=chemin)
                print('  capture : %s' % os.path.relpath(chemin, RACINE))

            print('Ouverture de %s' % url)
            page.goto(url)

            # Attend qu'une scène autre que BootScene soit active (= chargement fini)
            try:
                page.wait_for_function(
                    """() => window.RM && RM.game && RM.game.scene &&
                        RM.game.scene.getScenes(true).some(s => s.scene.key !== 'BootScene')""",
                    timeout=args.attente * 1000,
                )
                scenes = page.evaluate("RM.game.scene.getScenes(true).map(s => s.scene.key).join(', ')")
                print('Le jeu a démarré. Scène active : %s' % scenes)
            except Exception:
                erreurs.append('Le jeu n\'a pas quitté le chargement après %g s' % args.attente)

            page.wait_for_timeout(500)
            capture('demarrage')

            if args.scenario:
                print('Scénario : %s' % args.scenario)

                # Le scénario parle en coordonnées du jeu (720 × 1280)
                souris = page.mouse
                clic_origine = souris.click
                souris.click = lambda x, y, **k: clic_origine(x * ECHELLE, y * ECHELLE, **k)

                try:
                    charger_scenario(args.scenario)(page, capture)
                except Exception as e:
                    erreurs.append('Le scénario a planté : %r' % e)
                    capture('plantage')

            navigateur.close()
    finally:
        serveur.shutdown()

    print()
    if erreurs:
        print('ÉCHEC — %d problème(s) :' % len(erreurs))
        for e in erreurs:
            print('  - ' + e)
        return 1

    print('OK — aucune erreur.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
