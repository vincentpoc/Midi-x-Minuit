// ============================================================
//  GrimoireScene — la carte de progression.
//  Une page par table (× 2 à × 10) ; chaque calcul a 3 étoiles : a × b, b × a
//  et la division. Les résultats sont toujours écrits (gris si jamais faits).
//  Étoile brisée : le dernier essai de ce calcul est raté.
// ============================================================

RM.GrimoireScene = class extends Phaser.Scene
{
  // Le nom de la scène pour Phaser
  constructor()
  {
    super('Grimoire');
  }

  // from = la scène où revenir avec « Retour »
  init(data)
  {
    this.from = (data && data.from) || 'Title';
  }

  // Dessine les onglets, la page du livre, puis affiche la table du chapitre en cours
  create()
  {
    const W = RM.W,
      H = RM.H;

    this.add.image(W / 2, H / 2, 'bg_library').setScale(3);
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d0716, 0.4);
    RM.title(this, W / 2, 70, 'Grimoire des tables', 54);

    // Onglets
    const P = RM.Progress.data;

    // 9 onglets : 5 sur la 1re ligne, 4 sur la 2e
    RM.TABLES.forEach((t, i) =>
    {
      const row = i < 5 ? 0 : 1;
      const col = row === 0 ? i : i - 5;
      const n = row === 0 ? 5 : 4;
      const x = W / 2 + (col - (n - 1) / 2) * 134;
      const y = 160 + row * 92;
      const b = RM.button(this, x, y, 122, 76, `×${t}`, () => this.show(t), { size: 34 });

      b.add(RM.moon(this, 44, -26, 11, RM.Progress.moon(t)));
    });

    // Page du livre (100 px de base, agrandie × 6,4)
    this.page = this.add.image(W / 2, 745, 'book_page').setScale(6.4);
    this.ox = W / 2 - 320;
    this.oy = 745 - 320;

    // On efface les lignes dessinées pour écrire proprement
    const g = this.add.graphics();

    g.fillStyle(0xf0d4a4, 1).fillRect(this.ox + 18 * 6.4, this.oy + 22 * 6.4, 61 * 6.4, 67 * 6.4);
    this.content = this.add.container(0, 0);

    RM.button(this, W / 2, 1210, 320, 84, 'Retour', () => this.scene.start(this.from), {
      size: 38,
    });

    this.show(RM.GROUPS[P.chapter || 0].tables[0]);
    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  // Affiche la page de la table t : ses 9 calculs, leurs étoiles et sa lune
  show(t)
  {
    const c = this.content,
      ox = this.ox,
      oy = this.oy,
      S = 6.4;

    c.removeAll(true);
    c.add(RM.text(this, RM.W / 2 - 6, oy + 16 * S, `Table de ${t}`, 40, RM.C.ink));

    // les 9 calculs : le résultat est toujours écrit (gris s'il n'a jamais été fait)
    for (let k = 2; k <= 10; k++)
    {
      const seen = !!RM.Progress.data.facts[RM.Progress.key(t, k)];
      const y = oy + 25 * S + (k - 2) * 41;

      c.add(
        RM.text(this, ox + 22 * S, y, `${t} × ${k} = ${t * k}`, 32, seen ? RM.C.ink : '#a08a70').setOrigin(0, 0.5),
      );

      // 3 étoiles : t × k, k × t et la division
      RM.Progress.stars(t, k).forEach((state, i) => this.addStar(ox + 60 * S + i * 32, y, state));
    }

    const m = RM.Progress.moon(t);

    c.add(
      RM.text(
        this,
        RM.W / 2 - 6,
        oy + 85 * S,
        m >= 1 ? 'Lune pleine !' : `Réussis : ${Math.round(m * 9)} / 9`,
        28,
        '#7a3fa0',
      ),
    );
  }

  // Dessine une étoile : dorée ('ok'), rouge et fendue ('broken') ou éteinte (null)
  addStar(x, y, state)
  {
    const c = this.content;
    const st = this.add.image(x, y, 'ui_star').setScale(0.8);

    c.add(st);

    if (!state)
    {
      st.setAlpha(0.18).setTint(0x8a7a6a);
    }

    if (state === 'broken')
    {
      st.setTint(0xe0483e);

      // la fente en zigzag, du haut vers le bas de l'étoile
      const crack = this.add.graphics();

      crack.lineStyle(3, 0x2a0d12, 1);
      crack.beginPath();
      crack.moveTo(x + 2, y - 13);
      crack.lineTo(x - 3, y - 4);
      crack.lineTo(x + 3, y + 1);
      crack.lineTo(x - 2, y + 12);
      crack.strokePath();
      c.add(crack);
    }
  }
};
