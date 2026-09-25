/* The Martini boss fight: a timed gauntlet across every martini-family drink. */
import { RECIPES, BOSS_ROSTER } from './data.js';
import { GLASS_LABEL, ingName } from './game.js';

const byId = Object.fromEntries(RECIPES.map(r => [r.id, r]));
export const ROSTER = BOSS_ROSTER.map(id => byId[id]).filter(Boolean);

const rnd = n => Math.floor(Math.random() * n);
function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

function spec(r) {
  return r.ings.filter(i => i.u === 'ml').slice(0, 4)
    .map(i => `${i.q} mL ${ingName(i.k)}`).join(', ');
}

function isShaken(r) { return r.tech.some(t => t.t === 'shake' || t.t === 'dry-shake'); }

/* Five question shapes, all answerable from the dataset itself. */
function qFromSpec(r, pool) {
  const wrong = shuffle(pool.filter(x => x.id !== r.id)).slice(0, 3);
  return {
    kind: 'name', hp: 10,
    q: `Which drink is this?`,
    detail: spec(r),
    options: shuffle([
      { label: r.name, ok: true },
      ...wrong.map(w => ({ label: w.name, ok: false })),
    ]),
    why: `${r.name}: ${spec(r)}.`,
  };
}

function qFromName(r, pool) {
  const wrong = shuffle(pool.filter(x => x.id !== r.id)).slice(0, 3);
  return {
    kind: 'spec', hp: 10,
    q: `What goes in a ${r.name}?`,
    detail: null,
    options: shuffle([
      { label: spec(r), ok: true },
      ...wrong.map(w => ({ label: spec(w), ok: false })),
    ]),
    why: `${r.name} is built on ${spec(r)}.`,
  };
}

function qTechnique(r) {
  return {
    kind: 'tech', hp: 8,
    q: `${r.name} — shaken or stirred?`,
    detail: null,
    options: [
      { label: isShaken(r) ? 'Shaken' : 'Stirred', ok: true },
      { label: isShaken(r) ? 'Stirred' : 'Shaken', ok: false },
    ],
    why: `${r.name} is ${isShaken(r) ? 'shaken' : 'stirred'}. ` +
         (isShaken(r)
           ? 'Citrus, dairy, egg or coffee needs aeration.'
           : 'Spirit-and-vermouth drinks are stirred to stay clear and silky.'),
  };
}

function qGlass(r, pool) {
  const wrong = shuffle([...new Set(pool.filter(x => x.id !== r.id).map(x => x.glass))])
    .filter(g => g !== r.glass).slice(0, 3);
  return {
    kind: 'glass', hp: 8,
    q: `What glass does a ${r.name} go in?`,
    detail: null,
    options: shuffle([
      { label: GLASS_LABEL[r.glass] || r.glass, ok: true },
      ...wrong.map(g => ({ label: GLASS_LABEL[g] || g, ok: false })),
    ]),
    why: `${r.name} is served in a ${GLASS_LABEL[r.glass] || r.glass}.`,
  };
}

function qOddOne(r, pool) {
  const main = r.ings.filter(i => i.u === 'ml').slice(0, 4);
  if (main.length < 2) return null;
  const odd = main[main.length - 1];
  const wrong = shuffle([...new Set(pool.filter(x => x.id !== r.id)
    .flatMap(x => x.ings.filter(i => i.u === 'ml').map(i => i.k)))]
    .filter(k => k !== odd.k && !main.some(m => m.k === k))).slice(0, 3);
  if (wrong.length < 3) return null;
  return {
    kind: 'odd', hp: 9,
    q: `Which ingredient belongs in a ${r.name}?`,
    detail: main.slice(0, -1).map(i => ingName(i.k)).join(', ') + ', …',
    options: shuffle([
      { label: ingName(odd.k), ok: true },
      ...wrong.map(k => ({ label: ingName(k), ok: false })),
    ]),
    why: `The final ingredient is ${ingName(odd.k)} at ${odd.q} mL.`,
  };
}

export function buildBoss(count = 12) {
  const pool = ROSTER;
  const picks = shuffle(pool).slice(0, Math.min(count, pool.length));
  const qs = [];
  for (const r of picks) {
    const makers = [qFromSpec, qFromName, qTechnique, qGlass, (x) => qOddOne(x, pool)];
    const candidates = shuffle(makers).map(f => f(r, pool)).filter(Boolean);
    if (candidates.length) qs.push(candidates[0]);
  }
  return qs;
}

export const BOSS_HP = 100;
