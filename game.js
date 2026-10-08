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
