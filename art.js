/* Drawn glass illustrations, generated from each recipe's own data (glass, ice,
   ingredient colours, garnish). Used wherever there is no licensed photo.
   Pure string output, no DOM, no network, no licensing. */

const STEM = (cx, y1, y2, footW) => `M${cx} ${y1}V${y2}M${cx - footW} ${y2 + 2}H${cx + footW}`;

/* Each shape: bowl = closed path (holds the drink), top/bottom = y extent of the bowl,
   level = how full, line = extra stroke-only path (stem, handle), ice = where ice sits. */
const SHAPES = {
  coupe: { bowl: 'M18 36C18 58 34 66 50 66C66 66 82 58 82 36Z', top: 36, bottom: 66, level: 0.8, line: STEM(50, 66, 88, 14) },
  cocktail: { bowl: 'M16 24L84 24L50 62Z', top: 24, bottom: 62, level: 0.85, line: STEM(50, 62, 88, 14) },
  flute: { bowl: 'M40 10L60 10L58 62C57 70 43 70 42 62Z', top: 10, bottom: 68, level: 0.85, line: STEM(50, 68, 88, 12) },
  wine: { bowl: 'M30 24C28 52 38 66 50 66C62 66 72 52 70 24Z', top: 24, bottom: 66, level: 0.55, line: STEM(50, 66, 88, 14) },
  irish: { bowl: 'M32 30L68 30C68 50 62 66 50 68C38 66 32 50 32 30Z', top: 30, bottom: 68, level: 0.85, line: STEM(50, 68, 84, 12) },
  rocks: { bowl: 'M26 36L74 36L70 90L30 90Z', top: 36, bottom: 90, level: 0.8, ice: true },
  highball: { bowl: 'M33 14L67 14L65 90L35 90Z', top: 14, bottom: 90, level: 0.85, ice: true },
  collins: { bowl: 'M36 10L64 10L63 90L37 90Z', top: 10, bottom: 90, level: 0.88, ice: true },
  zombie: { bowl: 'M32 12L68 12L63 90L37 90Z', top: 12, bottom: 90, level: 0.88, ice: true },
  tiki: { bowl: 'M30 22L70 22L66 88L34 88Z', top: 22, bottom: 88, level: 0.85, ice: true,
    line: 'M70 32C88 32 88 66 68 68' },
  hurricane: { bowl: 'M36 12C34 40 24 46 36 64C42 76 40 84 34 90L66 90C60 84 58 76 64 64C76 46 66 40 64 12Z',
    top: 12, bottom: 90, level: 0.85, ice: true },
  julep: { bowl: 'M30 34L70 34L64 84L36 84Z', top: 34, bottom: 84, level: 0.95, ice: true, metal: true,
    line: 'M38 84V90H62V84' },
  shot: { bowl: 'M40 58L60 58L58 90L42 90Z', top: 58, bottom: 90, level: 0.9 },
};

/* x of the right-hand rim, where a garnish sits. */
const RIM_X = { coupe: 78, cocktail: 78, flute: 59, wine: 67, irish: 66, rocks: 72, highball: 65,
  collins: 62, zombie: 66, tiki: 68, hurricane: 62, julep: 68, shot: 58 };

const GLASS_SHAPE = {
  'coupe': 'coupe', 'cocktail glass': 'cocktail', 'martini glass': 'cocktail',
  'champagne flute': 'flute', 'wine glass': 'wine', 'irish coffee': 'irish', 'rocks': 'rocks',
  'highball': 'highball', 'collins': 'collins', 'zombie': 'zombie', 'tiki': 'tiki',
  'hurricane': 'hurricane', 'julep cup': 'julep', 'shot': 'shot',
};
export const GLASS_SHAPES = Object.keys(GLASS_SHAPE);

const GARNISH_COLOUR = [
  [/lime/i, '#7cc243'], [/lemon/i, '#f3dd4a'], [/orange|grapefruit/i, '#f79420'], [/cherry/i, '#b3122b'],
  [/mint|basil/i, '#3f9e4a'], [/olive/i, '#8a9e3a'], [/pineapple/i, '#f7d33a'], [/coffee/i, '#3a2413'],
  [/berr|raspberr/i, '#7a1e4a'], [/apple/i, '#9acd32'], [/celery/i, '#7dbb5a'], [/passion/i, '#f7a01f'],
  [/nutmeg|cinnamon/i, '#8a5a2c'], [/chil+i|jalape/i, '#c1121f'], [/ginger/i, '#d9a43a'],
];

const hex = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  if (!m) return [120, 100, 80];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgb = (c) => `rgb(${c.map(v => Math.round(v)).join(',')})`;

/* How much of the drink an ingredient is, for colouring. */
function weight(i) {
  if (i.u === 'count' || i.q == null && i.u !== 'top') return 0;
  return Math.min(i.ml || 0, 90);
}

/* Colour of the finished drink: ingredient colours averaged by volume. */
export function drinkColour(recipe, INGREDIENTS) {
  let tot = 0; const acc = [0, 0, 0];
  for (const i of recipe.ings) {
    const w = weight(i); const meta = INGREDIENTS[i.k];
    if (!w || !meta) continue;
    const c = hex(meta.col);
    /* Dark and saturated ingredients (Campari, coffee) colour a drink far more than pale
       ones (gin, vodka), so weight them up. */
    const mx = Math.max(...c), mn = Math.min(...c);
    const sat = mx ? (mx - mn) / mx : 0, val = mx / 255;
    const ww = w * (1 + 3 * sat + 2 * (1 - val));
    for (let n = 0; n < 3; n++) acc[n] += c[n] * ww;
    tot += ww;
  }
  return tot ? acc.map(v => v / tot) : [150, 120, 70];
}

function garnishColour(g) {
  if (!g || /^none/i.test(g)) return null;
  for (const [re, col] of GARNISH_COLOUR) if (re.test(g)) return col;
  return null;
}

/* Layers for layered shots/drinks, bottom first, in recipe order. */
function layerColours(recipe, INGREDIENTS) {
  return recipe.ings.filter(i => INGREDIENTS[i.k] && weight(i)).map(i => ({ c: hex(INGREDIENTS[i.k].col), w: weight(i) }));
}

export function glassShapeFor(recipe) {
  return GLASS_SHAPE[recipe.glass] || 'rocks';
}

/* Returns an <svg> string. */
export function glassSVG(recipe, INGREDIENTS, { size = 44 } = {}) {
  const shape = SHAPES[glassShapeFor(recipe)];
  const id = `cp-${recipe.id.replace(/[^a-z0-9-]/gi, '')}`;
  const liquidTop = shape.bottom - (shape.bottom - shape.top) * shape.level;
  const body = shape.bottom - liquidTop;
  const base = drinkColour(recipe, INGREDIENTS);
  const foamy = recipe.family === 'egg-white' || recipe.ings.some(i => i.k === 'egg white' || i.k === 'cream' || i.k === 'whipped cream');
  const stroke = shape.metal ? 'rgba(210,214,220,.9)' : 'rgba(255,255,255,.55)';
  let liquid;

  if (recipe.family === 'layered') {
    const layers = layerColours(recipe, INGREDIENTS);
    const total = layers.reduce((a, l) => a + l.w, 0) || 1;
    let y = shape.bottom;
    liquid = layers.map(l => {
      const h = body * (l.w / total); y -= h;
      return `<rect x="0" y="${y.toFixed(1)}" width="100" height="${(h + 0.6).toFixed(1)}" fill="${rgb(l.c)}"/>`;
    }).join('');
  } else {
    liquid = `<rect x="0" y="${liquidTop.toFixed(1)}" width="100" height="${(body + 1).toFixed(1)}" fill="${rgb(base)}" fill-opacity=".93"/>`;
    if (foamy) liquid += `<rect x="0" y="${liquidTop.toFixed(1)}" width="100" height="5" fill="#fbf6e8" fill-opacity=".92"/>`;
  }

  let ice = '';
  if (shape.ice && recipe.iceServe && recipe.iceServe !== 'none') {
    const y0 = liquidTop + 4, y1 = shape.bottom - 6, midY = (y0 + y1) / 2;
    if (recipe.iceServe === 'crushed') {
      const dots = [[44, y0 + 6], [56, y0 + 10], [48, midY], [58, midY + 6], [42, midY + 10], [52, y1 - 10], [46, y1 - 4], [57, y1 - 3]];
      ice = dots.map(([x, y]) => `<circle cx="${x}" cy="${y.toFixed(1)}" r="3.2" fill="#fff" fill-opacity=".38"/>`).join('');
    } else if (recipe.iceServe === 'block') {
      ice = `<rect x="38" y="${(midY - 12).toFixed(1)}" width="24" height="24" rx="3" fill="#fff" fill-opacity=".34" stroke="#fff" stroke-opacity=".5"/>`;
    } else {
      ice = [[38, y0 + 2], [52, midY - 2], [40, y1 - 14]].map(([x, y]) =>
        `<rect x="${x}" y="${y.toFixed(1)}" width="13" height="13" rx="2.5" transform="rotate(8 ${x + 6} ${y + 6})" fill="#fff" fill-opacity=".36" stroke="#fff" stroke-opacity=".5"/>`).join('');
    }
  }

  const gcol = garnishColour(recipe.garnish);
  const garnish = gcol ? `<circle cx="${RIM_X[glassShapeFor(recipe)]}" cy="${shape.top - 3}" r="6.5" fill="${gcol}" stroke="rgba(0,0,0,.25)"/>` : '';

  return `<svg class="glassart" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${recipe.glass}" xmlns="http://www.w3.org/2000/svg">
<defs><clipPath id="${id}"><path d="${shape.bowl}"/></clipPath></defs>
<g clip-path="url(#${id})">${liquid}${ice}</g>
<path d="${shape.bowl}" fill="rgba(255,255,255,.07)" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round" fill-opacity=".5"/>
${shape.line ? `<path d="${shape.line}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round"/>` : ''}
${garnish}</svg>`;
}

const escAttr = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/* Thumbnail: the licensed photo when we have one, else the drawn glass. */
export function thumbHTML(recipe, INGREDIENTS, photos = {}, { size = 44 } = {}) {
  const p = photos[recipe.id];
  if (p && p.file) {
    return `<img class="thumb" src="${escAttr(p.file)}" alt="" loading="lazy" width="${size}" height="${size}">`;
  }
  return glassSVG(recipe, INGREDIENTS, { size });
}
