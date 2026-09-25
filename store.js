/* Persistent state, scoring and mistake analytics. Everything is local-first. */

const KEY = 'pour.state.v1';

export const MISTAKE_LABEL = {
  'wrong-glass':      'Wrong glass',
  'wrong-ice':        'Wrong ice',
  'wrong-vessel':     'Wrong mixing vessel',
  'wrong-prep':       'Skipped or wrong prep step',
  'wrong-amount':     'Over- or under-poured',
  'wrong-ingredient': 'Wrong ingredient reached for',
  'wrong-technique':  'Wrong technique (shaken vs stirred)',
  'wrong-duration':   'Wrong shake / stir time',
  'wrong-strain':     'Wrong strainer',
  'wrong-garnish':    'Wrong garnish',
  'wrong-order':      'Poured in the wrong order',
};

const DEFAULTS = () => ({
  v: 1,
  xp: 0,
  bestStreak: 0,
  rounds: {},          // id -> {plays, best, last, perfect}
  mistakes: [],        // {t, id, ing?, detail?, ts}   (capped at 400)
  log: [],             // cellar entries
  boss: { wins: 0, best: 0, attempts: 0 },
  badges: [],
  stats: { answered: 0, correct: 0, pours: 0, pourPerfect: 0, pouredMl: 0 },
  settings: { units: 'ml', showNumbers: false },
});

let state = null;

export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? { ...DEFAULTS(), ...JSON.parse(raw) } : DEFAULTS();
  } catch (e) {
    state = DEFAULTS();
  }
  for (const k of Object.keys(DEFAULTS())) if (state[k] === undefined) state[k] = DEFAULTS()[k];
  return state;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  return state;
}

export function reset() {
  state = DEFAULTS();
  save();
  return state;
}

export const S = () => state || load();

/* ------------------------------------------------------------------ scoring */

export function recordRound(r) {
  const s = S();
  const prev = s.rounds[r.id] || { plays: 0, best: 0, last: 0, perfect: 0 };
  s.rounds[r.id] = {
    plays: prev.plays + 1,
    best: Math.max(prev.best, r.score),
    last: r.score,
    perfect: prev.perfect + (r.perfect ? 1 : 0),
  };
  s.xp += r.score;
  s.bestStreak = Math.max(s.bestStreak, r.streakPeak || 0);
  s.stats.answered += r.answers;
  s.stats.correct += r.correct;
  s.stats.pours += r.pours;
  s.stats.pourPerfect += r.pourPerfect;
  s.stats.pouredMl += Math.round(r.pouredMl || 0);
  for (const m of r.mistakes) {
    s.mistakes.push({ ...m, id: r.id, ts: Date.now() });
  }
  if (s.mistakes.length > 400) s.mistakes = s.mistakes.slice(-400);
  for (const b of newBadges()) if (!s.badges.includes(b)) s.badges.push(b);
  return save();
}

/* ------------------------------------------------------------------ mastery */

export function mastery(id) {
  const r = S().rounds[id];
  if (!r) return { level: 0, label: 'Untried', pct: 0 };
  const pct = Math.min(100, Math.round(r.best));
  if (r.perfect >= 3 && r.best >= 95) return { level: 3, label: 'Muscle memory', pct: 100 };
  if (r.best >= 85) return { level: 2, label: 'Confident', pct: Math.max(70, pct) };
  if (r.best >= 55) return { level: 1, label: 'Learning', pct: Math.max(35, pct) };
  return { level: 0, label: 'Started', pct: Math.max(12, pct) };
}

export function level() {
  const xp = S().xp;
  const lvl = Math.floor(Math.sqrt(xp / 250)) + 1;
  const floor = 250 * (lvl - 1) ** 2;
  const ceil = 250 * lvl * lvl;
  return { lvl, xp, into: xp - floor, need: ceil - floor,
           pct: Math.round(((xp - floor) / (ceil - floor)) * 100) };
}

/* ---------------------------------------------------------------- analytics */

export function mistakeStats(limit = 12) {
  const c = {};
  for (const m of S().mistakes) c[m.t] = (c[m.t] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, limit)
    .map(([t, n]) => ({ t, n, label: MISTAKE_LABEL[t] || t }));
}

export function worstRecipes(limit = 8) {
  const c = {};
  for (const m of S().mistakes) c[m.id] = (c[m.id] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function ingredientErrors(limit = 8) {
  const c = {};
  for (const m of S().mistakes) {
    if (m.t === 'wrong-amount' && m.ing) {
      const e = c[m.ing] || (c[m.ing] = { n: 0, off: 0 });
      e.n += 1; e.off += Math.abs(m.delta || 0);
    }
  }
  return Object.entries(c)
    .map(([k, v]) => ({ ing: k, n: v.n, avg: Math.round(v.off / v.n * 10) / 10 }))
    .sort((a, b) => b.n - a.n).slice(0, limit);
}

/* Which drinks to practise next: weighted by mistakes + weak mastery. */
export function drillQueue(recipes, n = 10) {
  const mc = {};
  for (const m of S().mistakes) mc[m.id] = (mc[m.id] || 0) + 1;
  const scored = recipes.map(r => {
    const rd = S().rounds[r.id];
    const never = rd ? 0 : 3;
    const best = rd ? rd.best : 0;
    return { r, w: never * 6 + (mc[r.id] || 0) * 4 + Math.max(0, (100 - best)) * 0.25 };
  });
  scored.sort((a, b) => b.w - a.w);
  return scored.slice(0, n).map(s => s.r);
}

/* ------------------------------------------------------------------- badges */

export function newBadges() {
  const s = S();
  const out = [];
  const done = (id) => s.badges.includes(id) || out.includes(id);
  const mastered = Object.values(s.rounds).filter(r => r.best >= 85).length;
  const tried = Object.keys(s.rounds).length;
  const real = new Set(s.log.map(l => l.id)).size;
  if (tried >= 1 && !done('first-pour')) out.push('first-pour');
  if (tried >= 10 && !done('ten')) out.push('ten');
  if (tried >= 50 && !done('fifty')) out.push('fifty');
  if (mastered >= 25 && !done('mastered-25')) out.push('mastered-25');
  if (mastered >= 100 && !done('mastered-100')) out.push('mastered-100');
  if (s.boss.wins >= 1 && !done('martini-slayer')) out.push('martini-slayer');
  if (real >= 20 && !done('cellar-20')) out.push('cellar-20');
  return out;
}

export const BADGE_INFO = {
  'first-pour':      ['◍', 'First pour', 'Completed your first round'],
  'ten':             ['☰', 'On the list', 'Practised 10 different cocktails'],
  'fifty':           ['✦', 'Halfway there', 'Practised 50 different cocktails'],
  'mastered-25':     ['◈', 'Quarter master', '25 cocktails above 85%'],
  'mastered-100':    ['♛', 'Canon', '100 cocktails above 85%'],
  'martini-slayer':  ['⚔', 'Martini slayer', 'Beat the Martini boss'],
  'cellar-20':       ['✎', 'Taster', 'Logged 20 real drinks in the cellar'],
};

/* ------------------------------------------------------------------- cellar */

export function logDrink(e) {
  const s = S();
  s.log.unshift({ ts: Date.now(), ...e });
  if (s.log.length > 500) s.log = s.log.slice(0, 500);
  for (const b of newBadges()) if (!s.badges.includes(b)) s.badges.push(b);
  return save();
}

export function deleteLog(ts) {
  const s = S();
  s.log = s.log.filter(l => l.ts !== ts);
  return save();
}

export function cellarStats() {
  const s = S();
  const ids = new Set(s.log.map(l => l.id));
  const home = s.log.filter(l => l.home).length;
  const rated = s.log.filter(l => l.rating > 0);
  const avg = rated.length ? rated.reduce((a, l) => a + l.rating, 0) / rated.length : 0;
  const grams = s.log.reduce((a, l) => a + (l.grams || 0), 0);
  return { total: s.log.length, unique: ids.size, home, avg: Math.round(avg * 10) / 10, grams };
}

export function accuracy() {
  const st = S().stats;
  const ans = st.answered ? Math.round((st.correct / st.answered) * 100) : 0;
  const pour = st.pours ? Math.round((st.pourPerfect / st.pours) * 100) : 0;
  return { ans, pour, ...st };
}
