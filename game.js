/* Round engine: turns a recipe into a scored sequence of decisions and pours. */
import { RECIPES, INGREDIENTS } from './data.js';

export const GLASS_LABEL = {
  'coupe': 'Coupe', 'cocktail glass': 'Cocktail glass', 'martini glass': 'Martini glass',
  'champagne flute': 'Champagne flute', 'highball': 'Highball', 'collins': 'Collins',
  'rocks': 'Rocks / old fashioned', 'hurricane': 'Hurricane', 'wine glass': 'Wine glass',
  'shot': 'Shot glass', 'julep cup': 'Julep cup', 'irish coffee': 'Irish coffee glass',
  'zombie': 'Zombie / tall tiki', 'tiki': 'Tiki mug',
};
export const ICE_LABEL = {
  'cubes': 'Cubes', 'crushed': 'Crushed / pebble', 'block': 'One large block or sphere',
  'cracked': 'Cracked', 'none': 'No ice',
};
export const VESSEL_LABEL = {
  'shaker': 'Shaker', 'mixing-glass': 'Mixing glass', 'build': 'Build in the glass',
  'blender': 'Blender',
};
export const STRAIN_LABEL = {
  'hawthorne': 'Hawthorne strainer', 'fine': 'Double / fine strain', 'julep': 'Julep strainer',
  'unstrained': 'Pour unstrained', 'none': 'No straining',
};
export const TECH_LABEL = {
  'shake': 'Shake', 'dry-shake': 'Dry shake', 'stir': 'Stir', 'muddle': 'Muddle',
  'blend': 'Blend', 'roll': 'Roll', 'float': 'Float', 'layer': 'Layer', 'rinse': 'Rinse the glass',
  'rim': 'Rim the glass', 'swizzle': 'Swizzle', 'soak': 'Soak the sugar cube',
  'build': 'Build in the glass', 'top': 'Top up', 'clap': 'Clap the herbs',
};

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

function distractors(pool, correct, n) {
  const uniq = [...new Set(pool.filter(v => v !== correct))];
  return shuffle(uniq).slice(0, n);
}

function techText(t) {
  const name = TECH_LABEL[t.t] || t.t;
  return t.s ? `${name} ${t.s}s` : name;
}

function methodText(recipe) {
  const t = recipe.tech;
  const lead = t.filter(x => ['dry-shake', 'shake', 'stir', 'blend', 'roll', 'swizzle'].includes(x.t));
  if (lead.length > 1) return lead.map(techText).join(', then ');
  if (lead.length === 1) return techText(lead[0]);
  return lead.length ? techText(lead[0]) : 'Build in the glass';
}

export function ingName(k) { return INGREDIENTS[k] ? INGREDIENTS[k].name : k; }

export function unitLabel(i) {
  if (i.u === 'ml') return 'mL';
  if (i.u === 'dash') return i.q === 1 ? 'dash' : 'dashes';
  if (i.u === 'drop') return i.q === 1 ? 'drop' : 'drops';
  if (i.u === 'pinch') return i.q === 1 ? 'pinch' : 'pinches';
  if (i.u === 'tsp') return i.q === 1 ? 'tsp' : 'tsp';
  if (i.u === 'barspoon') return i.q === 1 ? 'barspoon' : 'barspoons';
  if (i.u === 'cube') return i.q === 1 ? 'sugar cube' : 'sugar cubes';
  if (i.u === 'count') return i.q === 1 ? 'piece' : 'pieces';
  if (i.u === 'top' || i.u === 'splash') return 'to fill';
  return '';
}

/* ------------------------------------------------------------------ stages */

export function buildStages(recipe, opts = {}) {
  const all = RECIPES;
  const stages = [];

  if (!opts.skipGlass) {
    const wrong = distractors(all.map(r => r.glass), recipe.glass, 3);
    stages.push({
      type: 'choice', key: 'wrong-glass', weight: 100,
      q: 'Which glass?',
      options: shuffle([{ v: recipe.glass, label: GLASS_LABEL[recipe.glass] || recipe.glass, ok: true },
        ...wrong.map(v => ({ v, label: GLASS_LABEL[v] || v, ok: false }))]),
    });
  }

  stages.push({
    type: 'choice', key: 'wrong-ice', weight: 100,
    q: recipe.vessel === 'build' ? 'What ice goes in the glass?' : 'What ice goes in the mixing vessel?',
    options: shuffle([
      { v: recipe.icePrep, label: ICE_LABEL[recipe.icePrep], ok: true },
      ...distractors(Object.keys(ICE_LABEL), recipe.icePrep, 3)
        .map(v => ({ v, label: ICE_LABEL[v], ok: false })),
    ]),
  });

  if (recipe.iceServe !== recipe.icePrep) {
    stages.push({
      type: 'choice', key: 'wrong-ice', weight: 100,
      q: 'And what ice does it get served on?',
      options: shuffle([
        { v: recipe.iceServe, label: recipe.iceServe === 'none' ? 'None — served up' : ICE_LABEL[recipe.iceServe], ok: true },
        ...distractors(Object.keys(ICE_LABEL), recipe.iceServe, 3)
          .map(v => ({ v, label: v === 'none' ? 'None — served up' : ICE_LABEL[v], ok: false })),
      ]),
    });
  }

  stages.push({
    type: 'choice', key: 'wrong-vessel', weight: 100,
    q: 'How do you combine it?',
    options: shuffle([
      { v: recipe.vessel, label: VESSEL_LABEL[recipe.vessel], ok: true },
      ...distractors(Object.keys(VESSEL_LABEL), recipe.vessel, 3)
        .map(v => ({ v, label: VESSEL_LABEL[v], ok: false })),
    ]),
  });

  // prep steps that must happen before the pour
  const preps = recipe.tech.filter(t =>
    ['muddle', 'rinse', 'rim', 'soak', 'clap', 'dry-shake'].includes(t.t));
  for (const p of preps) {
    const others = ['muddle', 'rinse', 'rim', 'soak', 'clap', 'dry-shake', 'swizzle', 'layer']
      .filter(x => x !== p.t);
    stages.push({
      type: 'choice', key: 'wrong-prep', weight: 100,
      q: 'Before you pour — what comes first?',
      options: shuffle([
        { v: p.t, label: prepLabel(p.t, recipe), ok: true },
        ...shuffle(others).slice(0, 3).map(v => ({ v, label: prepLabel(v, recipe), ok: false })),
      ]),
    });
  }

  // pours
  for (const i of recipe.ings) {
    stages.push({ type: 'pour', key: 'wrong-amount', weight: 150, ing: i });
  }

  // method
  const correctMethod = methodText(recipe);
  const methodPool = [...new Set(all.map(methodText))];
  stages.push({
    type: 'choice', key: 'wrong-technique', weight: 150,
    q: 'How do you mix it?',
    options: shuffle([
      { v: correctMethod, label: correctMethod, ok: true },
      ...distractors(methodPool, correctMethod, 3).map(v => ({ v, label: v, ok: false })),
    ]),
  });

  // duration check when a specific time matters
  const timed = recipe.tech.find(t => t.s && ['shake', 'stir'].includes(t.t));
  if (timed) {
    const right = timed.s;
    const wrongs = [...new Set([right * 2, Math.max(3, Math.round(right / 2)), right + 10, 5, 45, 90])]
      .filter(v => v !== right).slice(0, 3);
    stages.push({
      type: 'choice', key: 'wrong-duration', weight: 100,
      q: `How long do you ${timed.t}?`,
      options: shuffle([
        { v: right, label: `${right} seconds`, ok: true },
        ...wrongs.map(v => ({ v, label: `${v} seconds`, ok: false })),
      ]),
    });
  }

  stages.push({
    type: 'choice', key: 'wrong-strain', weight: 100,
    q: 'How do you strain it into the glass?',
    options: shuffle([
      { v: recipe.strain, label: STRAIN_LABEL[recipe.strain] || recipe.strain, ok: true },
      ...distractors(Object.keys(STRAIN_LABEL), recipe.strain, 3)
        .map(v => ({ v, label: STRAIN_LABEL[v], ok: false })),
    ]),
  });

  const garnishes = [...new Set(all.map(r => r.garnish).filter(Boolean))];
  const g = recipe.garnish || 'None';
  stages.push({
    type: 'choice', key: 'wrong-garnish', weight: 100,
    q: 'Garnish?',
    options: shuffle([
      { v: g, label: shortGarnish(g), ok: true },
      ...distractors(garnishes, recipe.garnish, 3).map(v => ({ v, label: shortGarnish(v), ok: false })),
    ]),
  });

  return stages;
}

function shortGarnish(g) {
  if (!g) return 'None';
  return g.length > 42 ? g.slice(0, 40) + '…' : g;
}

function prepLabel(t, recipe) {
  switch (t) {
    case 'muddle': return 'Muddle';
    case 'rinse': return 'Rinse the glass';
    case 'rim': return 'Salt or sugar the rim';
    case 'soak': return 'Soak the sugar cube in bitters';
    case 'clap': return 'Clap the herbs';
    case 'dry-shake': return 'Dry shake (no ice yet)';
    case 'swizzle': return 'Swizzle';
    case 'layer': return 'Layer the ingredients';
    default: return TECH_LABEL[t] || t;
  }
}

/* -------------------------------------------------------------- pour scale */

export function pourScale(i) {
  const q = i.q == null ? (i.ml || 100) : i.q;
  const u = i.u;
  const maxFor = { ml: 130, dash: 4, drop: 5, pinch: 3, tsp: 3, barspoon: 2, cube: 2, count: 8 };
  let max = maxFor[u] || 130;
  if (u === 'ml' || u === 'top') max = Math.max(130, Math.ceil(q / 25) * 25 + 25);
  return { target: q, max, unit: u };
}

/* ------------------------------------------------------------- evaluation */

export function gradePour(stage, value) {
  const { target, max } = pourScale(stage.ing);
  const tol = Math.max(max * 0.03, target * 0.03);
  const diff = value - target;
  const ad = Math.abs(diff);
  let band, factor;
  if (ad <= tol) { band = 'perfect'; factor = 1; }
  else if (ad <= tol * 2.5) { band = 'good'; factor = 0.65; }
  else if (ad <= tol * 5) { band = 'ok'; factor = 0.3; }
  else { band = 'miss'; factor = 0; }
  return {
    band, factor, diff: Math.round(diff * 10) / 10, target,
    points: Math.round(stage.weight * factor),
    label: { perfect: 'Dead on', good: 'Close', ok: 'Sloppy', miss: 'Spilled it' }[band],
  };
}

export const POINT_PERFECT = (stage) => stage.weight;

export function totalPossible(recipe, stages) {
  return stages.reduce((a, s) => a + s.weight, 0);
}

export { shuffle, pick };
