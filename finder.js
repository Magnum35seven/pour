/* Ingredient search, "what can I make?" and "buy next". Pure functions, no DOM,
   so they can be tested directly. Works only on the bundled recipes: offline, no API. */

/* Things most kitchens have. Treated as always-in-stock when "assume basics" is on. */
export const STAPLES = ['water', 'salt', 'sugar', 'black pepper'];

/* Close substitutes that are the same product for practical purposes. The first
   key in each group is the one the app uses to represent the group. */
const EQUIV = [
  ['cointreau', 'triple sec'],
  ['agave syrup', 'agave nectar'],
  ['allspice dram', 'allspice liqueur'],
];
const CANON = {};
for (const g of EQUIV) for (const k of g) CANON[k] = g[0];

export const canonKey = (k) => CANON[k] || k;

/* Display order for ingredient groups. */
export const CAT_ORDER = ['spirit', 'liqueur', 'fortified', 'wine', 'sparkling', 'bitters',
  'mixer', 'sweetener', 'dairy', 'hot', 'herb', 'spice', 'fruit', 'veg', 'garnish', 'other'];
export const CAT_NAME = {
  spirit: 'Spirits', liqueur: 'Liqueurs', fortified: 'Fortified wines & vermouth', wine: 'Wine',
  sparkling: 'Sparkling wine', bitters: 'Bitters', mixer: 'Juices & mixers', sweetener: 'Syrups & sweeteners',
  dairy: 'Dairy, egg & cream', hot: 'Coffee', herb: 'Herbs', spice: 'Spices & chilli', fruit: 'Fruit',
  veg: 'Vegetables', garnish: 'Garnishes', other: 'Pantry & other',
};

/* Set of canonical ingredient keys a recipe needs. */
export function needs(recipe, { staples = true } = {}) {
  const out = new Set();
  for (const i of recipe.ings) {
    const k = canonKey(i.k);
    if (staples && STAPLES.includes(k)) continue;
    out.add(k);
  }
  return out;
}

/* Every ingredient used by at least one recipe, with how many recipes use it.
   [{ k, name, cat, count }] sorted by group, then most-used first. */
export function catalogue(recipes, INGREDIENTS) {
  const counts = new Map();
  for (const r of recipes) {
    for (const k of needs(r, { staples: false })) counts.set(k, (counts.get(k) || 0) + 1);
  }
  const rows = [...counts].map(([k, count]) => {
    const meta = INGREDIENTS[k] || {};
    return { k, count, name: meta.name || k, cat: CAT_ORDER.includes(meta.cat) ? meta.cat : 'other' };
  });
  rows.sort((a, b) => CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat)
    || b.count - a.count || a.name.localeCompare(b.name));
  return rows;
}

const byName = (a, b) => a.name.localeCompare(b.name);

/* Recipes that contain ingredients. mode 'any' = at least one, 'all' = every one chosen.
   Staples are not skipped here: if you search for sugar you get the drinks that use it. */
export function containing(recipes, keys, mode = 'any') {
  const want = [...new Set([...keys].map(canonKey))];
  if (!want.length) return [];
  return recipes.filter(r => {
    const have = needs(r, { staples: false });
    return mode === 'all' ? want.every(k => have.has(k)) : want.some(k => have.has(k));
  }).sort(byName);
}

/* What you can make from what you own. Returns [{ r, missing: [key...] }], fewest
   missing first, only recipes missing at most maxMissing ingredients. */
export function canMake(recipes, owned, { staples = true, maxMissing = 2 } = {}) {
  const have = new Set([...owned].map(canonKey));
  if (!have.size) return [];
  const rows = [];
  for (const r of recipes) {
    const missing = [...needs(r, { staples })].filter(k => !have.has(k));
    if (missing.length <= maxMissing) rows.push({ r, missing });
  }
  rows.sort((a, b) => a.missing.length - b.missing.length || byName(a.r, b.r));
  return rows;
}

/* "Buy next": the single ingredient that would unlock the most extra drinks right
   now (drinks that are exactly one ingredient away). [{ k, unlocks: [recipe...] }] */
export function buyNext(recipes, owned, { staples = true, limit = 5 } = {}) {
  const have = new Set([...owned].map(canonKey));
  if (!have.size) return [];
  const by = new Map();
  for (const r of recipes) {
    const missing = [...needs(r, { staples })].filter(k => !have.has(k));
    if (missing.length === 1) {
      if (!by.has(missing[0])) by.set(missing[0], []);
      by.get(missing[0]).push(r);
    }
  }
  return [...by].map(([k, unlocks]) => ({ k, unlocks: unlocks.sort(byName) }))
    .sort((a, b) => b.unlocks.length - a.unlocks.length || a.k.localeCompare(b.k))
    .slice(0, limit);
}
