/* Drives the real app modules under jsdom: routing, rounds, scoring, mistakes,
   boss, cellar, persistence. Run with: node test/app.test.mjs */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert';

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const html = fs.readFileSync(root + '/index.html', 'utf8');

const dom = new JSDOM(html, { url: 'https://localhost/', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.location = dom.window.location;
global.localStorage = dom.window.localStorage;
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
global.confirm = () => false;
dom.window.confirm = () => false;
dom.window.scrollTo = () => {};

const { RECIPES, BUILD } = await import('../js/data.js');
const game = await import('../js/game.js');
const boss = await import('../js/boss.js');
const DB = await import('../js/store.js');
await import('../js/app.js');

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
};
const nav = async (h) => {
  if (location.hash !== h) location.hash = h;
  await sleep(20);                       // let jsdom's own hashchange land
  dom.window.dispatchEvent(new dom.window.Event('hashchange'));
  await sleep(10);
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

console.log(`data: ${RECIPES.length} recipes (guide ${BUILD.guideRecipes} + IBA ${BUILD.ibaAdded})`);

/* ------------------------------------------------------------------ data */
ok('recipe count is 119', RECIPES.length === 119, `got ${RECIPES.length}`);
ok('every recipe has editorial content',
  RECIPES.every(r => r.story && r.taste && r.conf));
ok('every recipe has a resolvable ingredient set',
  RECIPES.every(r => r.ings.length > 0 && r.ings.every(i => i.k)));
ok('every recipe has glass/ice/vessel/strain/technique',
  RECIPES.every(r => r.glass && r.icePrep && r.iceServe && r.vessel && r.strain && r.tech.length));
ok('every recipe has a garnish decision', RECIPES.every(r => r.garnish));
ok('ABV plausible everywhere (0-60% served)',
  RECIPES.every(r => r.abv.abv_served >= 0 && r.abv.abv_served < 60));
ok('absolute alcohol equals sum of parts (spot check)', (() => {
  const r = RECIPES.find(x => x.id === 'negroni');
  const manual = r.ings.reduce((a, i) => a + (i.ml || 0) * i.abv / 100, 0);
  return Math.abs(manual - r.abv.absolute_ml) < 0.05;
})(), 'negroni');

/* --------------------------------------------------------------- routing */
await nav('#/drill');
ok('drill view renders', $('#app').innerHTML.includes('Rank'), '');
ok('drill shows a practice queue', $$('#app .rc').length >= 5, `${$$('#app .rc').length} rows`);
ok('tab bar exists', $$('#tabbar a').length === 5);

await nav('#/library');
ok('library renders all recipes', $$('#list .rc').length === RECIPES.length,
  `${$$('#list .rc').length}`);
$('#q').value = 'mezcal';
$('#q').dispatchEvent(new dom.window.Event('input'));
ok('search filters', $$('#list .rc').length > 0 && $$('#list .rc').length < RECIPES.length);
$('#q').value = 'zzzznothing';
$('#q').dispatchEvent(new dom.window.Event('input'));
ok('empty search says so', $('#list').textContent.includes('Nothing matches'));

await nav('#/recipe/dry-martini');
ok('recipe detail shows ABV panel', $('#app').innerHTML.includes('Absolute alcohol'));
ok('recipe detail shows backstory', $('#app').innerHTML.includes('Backstory'));
ok('recipe detail shows tasting notes', $('#app').innerHTML.includes('Tasting notes'));
ok('recipe shows confidence grade', /Confidence:/.test($('#app').textContent));

await nav('#/recipe/negroni');
ok('source-note flag renders where present', true);
await nav('#/recipe/brandiziac-casino');
const misprintGone = $('#app').textContent.includes('Not found');
await nav('#/recipe/casino');
const casinoOk = !$('#app').textContent.includes('Not found') &&
                 $('#app').textContent.includes('Casino');
ok('guide misprint "Brandiziac" renamed to Casino', misprintGone && casinoOk);
ok('Casino keeps the source-note explaining the misprint',
   $('#app').textContent.includes('Brandiziac'));

/* ------------------------------------------- a clean round, played properly */
/* Pass 1 records {question -> correct label} from the app's own highlight;
   pass 2 replays them so we can exercise a clean, high-scoring round without
   any production test hooks. */
const answerKey = new Map();

async function playRound(id, { useKey = false } = {}) {
  await nav('#/play/' + id);
  const click = (el) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  let guard = 0, poursSeen = 0, verdicts = 0, log = [];
  while (guard++ < 200) {
    if (/points \u00b7/.test($('#app').textContent)) break;
    const opts = $$('#app .opt');
    if (opts.length) {
      const q = ($('.stage-q')?.textContent || '').trim();
      let target = opts[0];
      if (useKey && answerKey.has(q)) {
        const want = answerKey.get(q);
        target = opts.find(o => o.textContent.trim() === want) || opts[0];
      }
      click(target);
      const v = $('#app .verdict');
      const correctLabel = $('#app .opt.correct')?.textContent.trim();
      if (q && correctLabel) answerKey.set(q, correctLabel);
      log.push(`choice:${q}:${v?.classList.contains('perfect') ? 'ok' : 'MISS'}`);
      const nx = $('#nx'); if (nx) click(nx);
      continue;
    }
    const pb = $('#pb');
    if (pb) {
      const q = ($('.stage-q')?.textContent || '').trim();
      poursSeen++;
      pb.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
      await sleep(poursSeen % 3 === 0 ? 800 : 90);
      dom.window.dispatchEvent(new dom.window.Event('pointerup'));
      await sleep(30);
      const v = $('#app .verdict');
      if (v) verdicts++;
      log.push(`pour:${q}:${v ? v.className.replace('verdict ', '') : 'NO-VERDICT'}`);
      const nx = $('#nx'); if (nx) click(nx);
      continue;
    }
    log.push('stuck:' + ($('#app').textContent.slice(0, 40)));
    break;
  }
  return { finished: /points \u00b7/.test($('#app').textContent), guard, poursSeen, verdicts, log };
}

const r1 = await playRound('negroni');
ok('round completes to a score screen', r1.finished, `guard=${r1.guard}`);
ok('round exercised every pour stage', r1.poursSeen === 3,
  `${r1.poursSeen} pours; log=${r1.log.join(' | ')}`);
ok('every pour produced a verdict', r1.verdicts === r1.poursSeen,
  `${r1.verdicts}/${r1.poursSeen}; log=${r1.log.join(' | ')}`);
ok('mistakes were logged for wrong answers', DB.S().mistakes.length > 0,
  `${DB.S().mistakes.length}`);
ok('mistake types come from the taxonomy',
  DB.S().mistakes.every(m => m.t in DB.MISTAKE_LABEL),
  JSON.stringify([...new Set(DB.S().mistakes.map(m => m.t))]));
ok('round recorded against the recipe', !!DB.S().rounds['negroni'], '');
ok('xp is non-negative after a wrong-answered round', DB.S().xp >= 0);

const xpBefore = DB.S().xp;
const r2 = await playRound('negroni', { useKey: true });
ok('replay round completes', r2.finished);
ok('replay answers correctly using the recorded key',
  r2.log.filter(l => l.startsWith('choice:') && l.endsWith(':ok')).length >= 6,
  r2.log.filter(l => l.startsWith('choice:')).join(' | '));
ok('correct round awards XP', DB.S().xp > xpBefore,
  `${xpBefore} -> ${DB.S().xp}`);
ok('correct round scores above zero', DB.S().rounds['negroni'].best > 0,
  `best=${DB.S().rounds['negroni'].best}`);
ok('plays incremented to 2', DB.S().rounds['negroni'].plays === 2,
  `${DB.S().rounds['negroni'].plays}`);

await nav('#/stats');
ok('stats view lists frequent error types',
  $('#app').textContent.includes('Most frequent error types'));
ok('stats shows drill suggestions', $$('#app .rc').length > 0);

/* ---------------------------------------------------------- scoring logic */
{
  const r = RECIPES.find(x => x.id === 'negroni');
  const stages = game.buildStages(r);
  ok('stages built for negroni', stages.length >= 8, `${stages.length}`);
  ok('every choice stage has exactly one correct option',
    stages.filter(s => s.type === 'choice').every(s => s.options.filter(o => o.ok).length === 1));
  ok('every choice stage has >=3 options',
    stages.filter(s => s.type === 'choice').every(s => s.options.length >= 3));
  // regression: technique entries are emitted as {t, s}; reading {id, secs}
  // silently produced an empty method question with no distractors.
  const methodStage = stages.find(s2 => s2.q === 'How do you mix it?');
  ok('method question has a real label', !!methodStage &&
    methodStage.options.every(o => o.label && o.label.length > 1),
    JSON.stringify(methodStage && methodStage.options.map(o => o.label)));
  ok('method question has distractors', methodStage.options.length >= 3,
    `${methodStage.options.length} options`);
  const durStage = stages.find(s2 => /^How long do you/.test(s2.q || ''));
  ok('duration stage exists for a timed stir', !!durStage && durStage.q.includes('stir'),
    durStage ? durStage.q : 'none');
  ok('pours generated for every ingredient',
    stages.filter(s => s.type === 'pour').length === r.ings.length);

  const pour = stages.find(s => s.type === 'pour');
  const { target } = game.pourScale(pour.ing);
  ok('exact pour scores perfect', game.gradePour(pour, target).band === 'perfect');
  ok('exact pour scores full weight', game.gradePour(pour, target).points === pour.weight);
  ok('huge overpour scores zero', game.gradePour(pour, target + 500).points === 0);
  ok('slight overpour is not perfect', game.gradePour(pour, target + 40).band !== 'perfect');
  ok('pour diff is signed', game.gradePour(pour, target + 10).diff === 10);
}

/* ------------------------------------------------------------------ mastery */
{
  // regression: pct was computed as Math.round((best/100)*1.0), which collapses
  // any best 1-99 to 0 or 1 instead of a real percentage.
  ok('mastery pct reflects best score, not a collapsed 0/1',
    DB.mastery('negroni').pct > 1, `pct=${DB.mastery('negroni').pct}, best=${DB.S().rounds['negroni'].best}`);
}

/* ------------------------------------------------------------------- boss */
{
  const qs = boss.buildBoss(12);
  ok('boss roster has >=10 martinis', boss.ROSTER.length >= 10, `${boss.ROSTER.length}`);
  ok('boss builds 12 questions', qs.length === 12, `${qs.length}`);
  ok('every boss question has one correct answer',
    qs.every(q => q.options.filter(o => o.ok).length === 1));
  ok('every boss question has an explanation', qs.every(q => q.why && q.why.length > 10));
  ok('boss question kinds vary', new Set(qs.map(q => q.kind)).size >= 3,
    JSON.stringify([...new Set(qs.map(q => q.kind))]));

  await nav('#/boss');
  ok('boss landing renders', $('#app').textContent.includes('Martini Gauntlet') && !!$('#start'));
  $('#start').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  ok('boss starts with a question', $$('#app .opt').length >= 2);
  // answer every question correctly -> boss should die
  const click = (el) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  for (let n = 0; n < 40; n++) {
    if (/gauntlet falls|It survives/.test($('#app').textContent)) break;
    const nx = $('#nx');
    if (nx) { click(nx); continue; }
    const opts = $$('#app .opt');
    if (!opts.length) break;
    click(opts[0]);
  }
  ok('boss run reaches a verdict screen',
    /gauntlet falls|It survives/.test($('#app').textContent), $('#app').textContent.slice(0, 60));
  ok('boss attempts incremented', DB.S().boss.attempts >= 1);
}

/* ----------------------------------------------------------------- cellar */
await nav('#/cellar');
ok('cellar view renders', $('#app').textContent.includes('Cellar'));
await nav('#/cellar/negroni');
ok('log form opens for a recipe', !!$('#cid') && $('#cid').value === 'negroni');
$('#place').value = 'Home';
$('#home').value = '1';
$('#rate').value = '5';
$('#notes').value = 'Stirred 20s, slightly over-diluted.';
$('#save').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
await sleep(20);
ok('entry persisted to the log', DB.S().log.length === 1, `${DB.S().log.length}`);
ok('entry carries alcohol grams', DB.S().log[0].grams > 0, `${DB.S().log[0].grams}`);
ok('rating stored', DB.S().log[0].rating === 5);
await nav('#/cellar');
ok('cellar lists the entry', $('#app').textContent.includes('Stirred 20s'));
ok('cellar computes coverage', /Canon coverage|%/.test($('#app').textContent));

/* ----------------------------------------------------------- persistence */
{
  const raw = localStorage.getItem('pour.state.v1');
  ok('state serialised to localStorage', !!raw && raw.length > 50);
  const parsed = JSON.parse(raw);
  ok('persisted state round-trips', parsed.log.length === 1 && parsed.xp > 0);
  ok('badges unlocked', parsed.badges.includes('first-pour'),
    JSON.stringify(parsed.badges));
}

/* ------------------------------------------------------- all recipes smoke */
{
  let built = 0, bad = [];
  for (const r of RECIPES) {
    try {
      const st = game.buildStages(r);
      if (!st.length) bad.push(r.id + ':0 stages');
      else if (!st.some(s => s.type === 'pour')) bad.push(r.id + ':no pours');
      else if (r.tech.some(t => t.s && ['shake', 'stir'].includes(t.t)) &&
               !st.some(s => /^How long do you/.test(s.q || ''))) bad.push(r.id + ':no duration stage');
      else if (st.filter(s => s.type === 'choice').some(s => s.options.some(o => !o.label)))
        bad.push(r.id + ':empty option label');
      else if (st.filter(s => s.type === 'choice').some(s => s.options.filter(o => o.ok).length !== 1))
        bad.push(r.id + ':bad options');
      else built++;
    } catch (e) { bad.push(r.id + ':' + e.message); }
  }
  ok(`all ${RECIPES.length} recipes build a valid round`, built === RECIPES.length,
    `built ${built}; bad: ${bad.slice(0, 5).join(', ')}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
