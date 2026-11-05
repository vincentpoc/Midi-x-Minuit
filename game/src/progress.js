// ============================================================
//  progress.js — Sauvegarde + suivi de la maîtrise de chaque
//  « fait » (ex : 5 × 7) avec des boîtes de Leitner.
//
//  Niveau d'un fait : 0 = jamais vu … 4 = maîtrisé.
//  Réussi -> +1 niveau, revient plus tard.
//  Raté -> retour au niveau 1, revient le jour même.
// ============================================================

RM.Progress = {
  // v1.0 : nouvelle clé = la partie repart à zéro (nouveau découpage des chapitres)
  KEY: 'minuit-midi-v1.0',

  // Nombre de jours avant de revoir un fait, selon son niveau.
  INTERVALS: [0, 1, 2, 4, 7],

  data: null,

  // Une sauvegarde toute neuve
  fresh()
  {
    return {
      day: 1,
      coins: 0,
      facts: {},
      lastTable: 2,
      lastGroup: 0,
      demo: {},
      chapter: 0,
      sessions: 0,
      healed: [], // (ancien) clients soignés
      clients: {}, // état de chaque client sur le menu : 'healed', 'failed' ou 'cookie'
      last: null, // dernier chapitre : { client, success, chapter } (Midi qui vole encore, client qui part…)
      chaptersPlayed: 0, // nombre de chapitres joués
      stars: {}, // calculs réussis au moins une fois, par écriture : « 4×2 », « 2×4 », « 8÷2 » (grimoire)
    };
  },

  // Lit la sauvegarde du navigateur (?reset=1 l'efface d'abord)
  load()
  {
    try
    {
      if (/[?&]reset=1/.test(location.search))
      {
        localStorage.removeItem(this.KEY);
      }

      const raw = localStorage.getItem(this.KEY);

      this.data = raw ? Object.assign(this.fresh(), JSON.parse(raw)) : this.fresh();
    }
    catch (e)
    {
      this.data = this.fresh();
    }

    if (!this.data.demo)
    {
      this.data.demo = {};
    }

    if (!Array.isArray(this.data.healed))
    {
      this.data.healed = [];
    }

    if (!this.data.clients)
    {
      // ancienne sauvegarde : les clients soignés deviennent 'healed'
      this.data.clients = {};
      this.data.healed.forEach((id) => { this.data.clients[id] = 'healed'; });

      if (this.data.last && !this.data.last.success)
      {
        this.data.clients[this.data.last.client] = 'failed';
      }
    }

    return this.data;
  },

  // Écrit la sauvegarde dans le navigateur
  save()
  {
    try
    {
      localStorage.setItem(this.KEY, JSON.stringify(this.data));
    }
    catch (e)
    {
      /* mode privé */
    }
  },

  // L'identifiant d'un fait : t = 5, k = 7 donne « 5x7 »
  key(t, k)
  {
    return `${t}x${k}`;
  },

  // Le suivi d'un fait (créé au premier appel)
  fact(t, k)
  {
    const id = this.key(t, k);

    if (!this.data.facts[id])
    {
      this.data.facts[id] = { lvl: 0, due: 0, seen: 0, ok: 0 };
    }

    return this.data.facts[id];
  },

  // Le suivi d'un fait, ou null s'il n'a jamais été vu
  get(t, k)
  {
    return this.data.facts[this.key(t, k)] || null;
  },

  // Le niveau d'un fait (0 s'il n'a jamais été vu)
  level(t, k)
  {
    const f = this.get(t, k);

    return f ? f.lvl : 0;
  },

  // L'écriture d'un calcul pour les étoiles du grimoire.
  // kind : 'ab' = « t × k », 'ba' = « k × t », 'div' = « tk ÷ t », 'divk' = « tk ÷ k »
  expr(t, k, kind)
  {
    return kind === 'ab'
      ? `${t}×${k}`
      : kind === 'ba'
        ? `${k}×${t}`
        : kind === 'divk'
          ? `${t * k}÷${k}`
          : `${t * k}÷${t}`;
  },

  // Les 3 étoiles d'une ligne du grimoire « a × b » : [a × b réussi, b × a réussi, une division réussie]
  stars(a, b)
  {
    const S = this.data.stars || {};

    return [!!S[`${a}×${b}`], !!S[`${b}×${a}`], !!(S[`${a * b}÷${a}`] || S[`${a * b}÷${b}`])];
  },

  // Enregistre une réponse : monte ou redescend le niveau du fait, puis sauvegarde.
  // kind (voir expr) : quelle écriture du calcul a été réussie, pour les étoiles du grimoire
  record(t, k, success, kind)
  {
    if (success && kind)
    {
      this.data.stars = this.data.stars || {};
      this.data.stars[this.expr(t, k, kind)] = true;
    }

    if (this.onRecord)
    {
      this.onRecord(t, k, success); // score du chapitre en cours (StoryScene)
    }

    const f = this.fact(t, k);

    f.seen++;

    if (success)
    {
      f.ok++;
      f.lvl = Math.min(4, f.lvl + 1);
      f.due = this.data.day + this.INTERVALS[f.lvl];
    }
    else
    {
      f.lvl = 1;
      f.due = this.data.day;
    }

    this.save();
  },

  // Moyenne de maîtrise d'une table (0 à 4)
  avg(t)
  {
    let s = 0;

    for (let k = 1; k <= 10; k++)
    {
      s += this.level(t, k);
    }

    return s / 10;
  },

  // Choisit une table dans une liste, en privilégiant les plus faibles.
  pickFrom(pool)
  {
    const w = pool.map((t) => 4.5 - this.avg(t));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);

    for (let i = 0; i < pool.length; i++)
    {
      r -= w[i];

      if (r <= 0)
      {
        return pool[i];
      }
    }

    return pool[pool.length - 1];
  },

  // Lune d'une table : part des 10 calculs déjà réussis au moins une fois (0 à 1).
  // Lune pleine = toute la table a été réussie.
  moon(t)
  {
    let n = 0;

    for (let k = 1; k <= 10; k++)
    {
      const f = this.get(t, k);

      if (f && f.ok > 0)
      {
        n++;
      }
    }

    return n / 10;
  },

  // La lune moyenne de plusieurs tables (0 à 1)
  moonOf(tables)
  {
    return tables.reduce((a, t) => a + this.moon(t), 0) / tables.length;
  },

  // Moyenne de maîtrise d'une liste de tables (0 à 4)
  avgOf(tables)
  {
    return tables.reduce((a, t) => a + this.avg(t), 0) / tables.length;
  },

  // Choisit un multiplicateur k pour la table t (privilégie les faits faibles / à revoir).
  pickK(t, avoid = [])
  {
    const day = this.data.day;

    // Évite de reposer le même fait deux fois dans la même journée
    const used = (this.todayUsed && this.todayUsed[t]) || [];
    const all = avoid.concat(used.length < 8 ? used : []);
    const cands = [];

    for (let k = 1; k <= 10; k++)
    {
      if (all.includes(k))
      {
        continue;
      }

      const f = this.get(t, k);
      const lvl = f ? f.lvl : 0;
      const due = !f || f.due <= day;

      // priorité 1 : les calculs jamais faits ; priorité 2 : ceux à revoir (ratés ou « dus »)
      let w = !f ? 24 : due ? (5 - lvl) * 2 : 0.5;

      if (k === 1)
      {
        w *= 0.25; // 1 × t est trop facile
      }

      cands.push({ k, w });
    }

    if (!cands.length)
    {
      return 2 + Math.floor(Math.random() * 9);
    }

    let r = Math.random() * cands.reduce((s, c) => s + c.w, 0);
    let k = cands[cands.length - 1].k;

    for (const c of cands)
    {
      r -= c.w;

      if (r <= 0)
      {
        k = c.k;
        break;
      }
    }

    if (this.todayUsed)
    {
      (this.todayUsed[t] = this.todayUsed[t] || []).push(k);
    }

    return k;
  },

  // Nouvelle partie de la journée : on oublie les calculs déjà posés
  startDay()
  {
    this.todayUsed = {};
  },
};
