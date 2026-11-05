// ============================================================
//  IntroAct — L'introduction d'un chapitre : « Tu les connais déjà ! »
//  (les calculs déjà vus dans l'autre sens, jusqu'à × 5).
//  RM.IntroAct.known(chapter) est vide au chapitre 1 : pas d'introduction.
// opts.review = [{ text, answer }] : le rappel après le bouillon,
//  qui affiche seulement les calculs ratés (pas de questions).
//  Les hooks viennent de StoryScene (voir hooks() dans StoryScene.js).
// ============================================================

RM.IntroAct = class
{
  // Les calculs du chapitre déjà vus dans l'autre sens (jusqu'à × 5), sans doublons
  static known(chapter)
  {
    const tables = RM.CHAPTER_PLAN[chapter].tables;
    const known = RM.knownBefore(chapter);
    const pair = (a, b) => [a, b].sort((x, y) => x - y).join('x');

    const out = [],
      seen = new Set();

    tables.forEach((t) =>
    {
      for (let k = 2; k <= RM.SMALL_MAX_K; k++)
      {
        const p = pair(t, k);

        if (seen.has(p) || !known.has(p))
        {
          continue;
        }

        seen.add(p);
        out.push({ t, k });
      }
    });

    return out;
  }

  // Affiche soit le rappel (opts.review), soit les calculs déjà connus
  constructor(scene, area, chapter, hooks, opts = {})
  {
    this.scene = scene;
    this.A = area;
    this.hooks = hooks;
    this.root = scene.add.container(0, 0);
    this.L = RM.STORY.steps;

    if (opts.review)
    {
      this.list(
        this.L.review.title,
        opts.review,
        (f) => `${f.text} = ${f.answer}`,
        () => this.hooks.done({}),
      );

      return;
    }

    const known = RM.IntroAct.known(chapter);

    this.hooks.say('minuit', this.L.intro.known);

    this.list(
      this.L.intro.knownTitle,
      known,
      (f) => `${f.t} × ${f.k} = ${f.k} × ${f.t} = ${f.t * f.k}`,
      () => this.hooks.done({}),
    );
  }

  // une liste de calculs qui apparaissent un par un, puis « Suite »
  list(title, items, fmt, then)
  {
    const s = this.scene,
      A = this.A;

    this.root.removeAll(true);

    this.root.add(
      RM.text(s, A.x + A.w / 2, A.y + 50, title, 32, '#6b4f7f', { wordWrap: { width: A.w - 60 } }),
    );

    const gap = Math.min(70, 470 / Math.max(1, items.length));

    items.forEach((f, i) =>
    {
      const t = RM.text(
        s,
        A.x + A.w / 2,
        A.y + 130 + i * gap,
        fmt(f),
        Math.min(46, gap * 0.7),
        RM.C.ink,
      )
        .setAlpha(0)
        .setScale(0.6);

      this.root.add(t);

      s.tweens.add({
        targets: t,
        alpha: 1,
        scale: 1,
        duration: 260,
        delay: 350 + i * 450,
        ease: 'Back.easeOut',
        onStart: () => RM.Sfx.count(Math.min(i, 9)),
      });
    });

    s.time.delayedCall(350 + items.length * 450, () =>
    {
      if (!this.dead)
      {
        this.hooks.setMain('Suite', () =>
        {
          this.hooks.setMain(null);
          then();
        });
      }
    });
  }

  // Enlève l'activité de l'écran
  destroy()
  {
    this.dead = true;
    this.root.destroy();
  }
};
