// ============================================================
//  LongCat — Loooooong-chat allongé (chapitre 3), en trois morceaux :
//    la tête (avant), le corps (étiré à volonté) et l'arrière avec la queue.
//  Dessin de l'auteur : planche loongchat_noirblanc.png, la pose couchée et étirée,
//  coupée en longchat_front / longchat_mid / longchat_back (même hauteur).
//  (x, y) = le bout du nez, au sol. setLength(px) change la longueur totale.
// ============================================================

RM.LongCat = class
{
  constructor(scene, x, y, scale = 3.4)
  {
    this.scene = scene;
    this.sc = scale;
    this.c = scene.add.container(x, y);

    this.front = scene.add.image(0, 0, 'longchat_front').setOrigin(0, 1).setScale(scale);
    this.mid = scene.add.image(0, 0, 'longchat_mid').setOrigin(0, 1).setScale(scale);
    this.back = scene.add.image(0, 0, 'longchat_back').setOrigin(0, 1).setScale(scale);
    this.c.add([this.mid, this.front, this.back]);

    this.fw = this.front.displayWidth;
    this.bw = this.back.displayWidth;
    this.base = this.fw + this.mid.displayWidth + this.bw; // longueur sans étirement
    this.setLength(this.base);
  }

  // Longueur totale à l'écran (jamais plus court que sans étirement)
  setLength(L)
  {
    L = Math.max(this.fw + this.bw + 2, L);
    this.len = L;
    this.mid.x = this.fw - 1;
    this.mid.displayWidth = L - this.fw - this.bw + 2;
    this.back.x = L - this.bw;
    return this;
  }

  // Hauteur à l'écran
  get height()
  {
    return this.front.displayHeight;
  }

  // Le bout de la queue, à l'écran
  tailX()
  {
    return this.c.x + this.len * this.c.scaleX;
  }

  setTint(c)
  {
    [this.front, this.mid, this.back].forEach((p) => (c === null ? p.clearTint() : p.setTint(c)));
    return this;
  }

  destroy()
  {
    this.c.destroy();
  }
};
