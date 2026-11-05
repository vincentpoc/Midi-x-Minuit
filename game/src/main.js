// ============================================================
//  main.js — démarre Phaser
// ============================================================

RM.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: RM.W,
  height: RM.H,
  backgroundColor: '#1d1428',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },

  // Lissage pour le texte ; le pixel art est passé en « plus proche voisin » dans BootScene
  render: { antialias: true, roundPixels: true },
  input: { activePointers: 2 },
  scene: [RM.BootScene, RM.TitleScene, RM.StoryScene, RM.GrimoireScene],
});
