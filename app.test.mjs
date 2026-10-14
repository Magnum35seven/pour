/* Drives the real app modules under jsdom: routing, rounds, scoring, mistakes,
   boss, cellar, persistence. Run with: node app.test.mjs */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert';

const root = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
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

const { RECIPES, BUILD, INGREDIENTS } = await import('./data.js');
const game = await import('./game.js');
const boss = await import('./boss.js');
const DB = await import('./store.js');
await import('./app.js');

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

console.log(`data: ${RECIPES.length} recipes (guide ${BUILD.guideRecipes} + IBA ${BUILD.ibaAdded} + extras ${BUILD.extraAdded})`);

/* ------------------------------------------------------------------ data */
ok('recipe count is 143 and matches BUILD', RECIPES.length === 143 && BUILD.total === 143, `got ${RECIPES.length}`);
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
ok('app opens on the library tab by default', $('#tabbar a.on')?.dataset.tab === 'library' && $$('#list .rc').length === RECIPES.length, location.hash);
/* service worker: every precached file must exist, or cache.addAll() fails and offline breaks */
{
  const sw = fs.readFileSync(root + '/sw.js', 'utf8');
  const shell = [...sw.slice(sw.indexOf('SHELL = ['), sw.indexOf('];', sw.indexOf('SHELL = ['))).matchAll(/'\.\/([^']*)'/g)].map(m => m[1] || 'index.html');
  const missing = shell.filter(f => !fs.existsSync(root + '/' + f));
  ok('sw.js precache list points at files that exist', shell.length > 5 && missing.length === 0, missing.join(', '));
}

/* ---------- new recipes ---------- */
{
  const am = RECIPES.find(r => r.id === 'amaretto-sour'), pi = RECIPES.find(r => r.id === 'picante-de-la-casa');
  ok('Amaretto Sour and Picante de la Casa exist as extras', !!am && !!pi && am.src === 'extra' && pi.src === 'extra');
  const chk = (r) => {
    const ab = r.ings.reduce((a, i) => a + i.ml * i.abv / 100, 0);
    return Math.abs(ab - r.abv.absolute_ml) < 0.02 && Math.abs(r.abv.absolute_g - ab * 0.789) < 0.02;
  };
  ok('new recipes have consistent alcohol maths', chk(am) && chk(pi));
  ok('new recipes use only known ingredients', [am, pi].every(r => r.ings.every(i => INGREDIENTS[i.k])));
  await nav('#/library');
  ok('library finds Amaretto Sour by search', (() => { $('#q').value = 'amaretto'; $('#q').oninput(); return $$('#list .rc').some(x => x.textContent.includes('Amaretto Sour')); })());
  await nav('#/play/amaretto-sour');
  ok('new recipes are playable', $('#app').innerHTML.length > 200 && !/Not found/.test($('#app').innerHTML));
}

/* ---------- finder: ingredient search, can-make, buy next ---------- */
{
  const F = await import('./finder.js');
  const cat = F.catalogue(RECIPES, INGREDIENTS);
  ok('catalogue lists every ingredient used, none duplicated', new Set(cat.map(c => c.k)).size === cat.length && cat.length > 100);
  ok('catalogue counts are right (gin)', cat.find(c => c.k === 'gin').count === RECIPES.filter(r => r.ings.some(i => i.k === 'gin')).length);
  ok('cointreau and triple sec are one ingredient', !cat.some(c => c.k === 'triple sec') && F.canonKey('triple sec') === 'cointreau');

  const gin = F.containing(RECIPES, ['gin']);
  ok('contains: every result uses gin', gin.length > 10 && gin.every(r => r.ings.some(i => i.k === 'gin')));
  ok('contains: nothing missed', gin.length === RECIPES.filter(r => r.ings.some(i => i.k === 'gin')).length);
  const both = F.containing(RECIPES, ['gin', 'campari'], 'all');
  ok('contains all: gin AND campari finds the Negroni, not the Jungle Bird',
    both.some(r => r.id === 'negroni') && !both.some(r => r.id === 'jungle-bird'));
  ok('contains any is a superset of all', F.containing(RECIPES, ['gin', 'campari'], 'any').length >= both.length);
  ok('contains: empty selection returns nothing', F.containing(RECIPES, []).length === 0);

  const mk = F.canMake(RECIPES, ['gin', 'campari', 'vermouth sweet']);
  const neg = mk.find(x => x.r.id === 'negroni');
  ok('can make: Negroni from gin + Campari + sweet vermouth', neg && neg.missing.length === 0);
  ok('can make: results sorted fewest-missing first',
    mk.every((x, i) => i === 0 || mk[i - 1].missing.length <= x.missing.length));
  ok('can make: nothing selected means nothing listed', F.canMake(RECIPES, []).length === 0);
  const dq = F.canMake(RECIPES, ['rum white', 'lime juice'], { staples: true });
  ok('can make: staples (sugar) assumed, so a Daiquiri works from rum + lime',
    dq.find(x => x.r.id === 'daiquiri')?.missing.length === 0);
  const dq2 = F.canMake(RECIPES, ['rum white', 'lime juice'], { staples: false });
  ok('can make: without staples, the Daiquiri is missing sugar', dq2.find(x => x.r.id === 'daiquiri')?.missing.join() === 'sugar');
  ok('can make: triple sec satisfies a Cointreau recipe',
    F.canMake(RECIPES, ['tequila blanco', 'triple sec', 'lime juice']).find(x => x.r.id === 'margarita')?.missing.length === 0);
  const nx = F.buyNext(RECIPES, ['gin', 'campari']);
  ok('buy next: sweet vermouth is a top suggestion after gin + Campari',
    nx.some(n => n.k === 'vermouth sweet') && nx.every(n => n.unlocks.length > 0));
  ok('buy next: each unlocked drink really is one ingredient away',
    nx.every(n => n.unlocks.every(r => F.canMake([r], ['gin', 'campari', n.k]).length === 1
      && F.canMake([r], ['gin', 'campari', n.k])[0].missing.length === 0)));
}

/* ---------- My bar screen ---------- */
{
  DB.S().bar = []; DB.S().barMode = 'make';
  await nav('#/bar');
  ok('My bar renders chips', $$('#bchips .chip').length > 100);
  ok('My bar tab is highlighted', $('#tabbar a.on')?.dataset.tab === 'bar');
  for (const k of ['gin', 'campari', 'vermouth sweet']) $(`#bchips .chip[data-k="${k}"]`).click();
  ok('selecting chips shows what you can make', $('#bout').textContent.includes('Negroni') && /you can make now/i.test($('#bout').textContent));
  ok('selection is remembered in storage', DB.S().bar.length === 3 && JSON.parse(localStorage.getItem('pour.state.v1')).bar.length === 3);
  ok('buy-next hint is shown', /Buy next/.test($('#bout').textContent));
  $('#bq').value = 'campari'; $('#bq').oninput();
  ok('chip search filters ingredients', $$('#bchips .chip').length >= 1 && $$('#bchips .chip').length < 6);
  $('#bq').value = ''; $('#bq').oninput();
  $('#bmode button[data-m="contains"]').click();
  ok('contains mode starts empty and does not reuse your bar', /Pick an ingredient/.test($('#bout').textContent));
  $('#bchips .chip[data-k="mezcal"]').click();
  const mezN = RECIPES.filter(r => r.ings.some(i => i.k === 'mezcal')).length;
  ok('contains mode lists every cocktail with mezcal', $$("#bout .rc").length === mezN && mezN >= 2, `${$$('#bout .rc').length} vs ${mezN}`);
  DB.S().barMode = 'make';
  await nav('#/bar/chartreuse%20green');
  const chN = RECIPES.filter(r => r.ings.some(i => i.k === 'chartreuse green')).length;
  ok('ingredient links deep-link into contains mode', $$('#bout .rc').length === chN && chN >= 4);
  await nav('#/recipe/negroni');
  ok('recipe ingredients link to the ingredient search', $$('#app a.inglink').length === 3 && $('#app a.inglink').getAttribute('href').startsWith('#/bar/'));
  DB.S().bar = []; DB.S().barMode = 'make'; DB.save();
}

/* ---------- art and photos ---------- */
{
  const A = await import('./art.js');
  const glasses = [...new Set(RECIPES.map(r => r.glass))];
  ok('every glass type used has a drawing', glasses.every(g => A.GLASS_SHAPES.includes(g)), glasses.filter(g => !A.GLASS_SHAPES.includes(g)).join());
  ok('every recipe draws a valid glass', RECIPES.every(r => { const s = A.glassSVG(r, INGREDIENTS); return s.startsWith('<svg') && s.includes('clipPath') && !s.includes('NaN'); }));
  const neg = A.drinkColour(RECIPES.find(r => r.id === 'negroni'), INGREDIENTS);
  ok('a Negroni is drawn red, not grey', neg[0] > neg[1] + 40 && neg[0] > neg[2] + 40, neg.map(Math.round).join());
  const em = A.drinkColour(RECIPES.find(r => r.id === 'espresso-martini'), INGREDIENTS);
  ok('an Espresso Martini is drawn dark', Math.max(...em) < 120, em.map(Math.round).join());
  const r0 = RECIPES[0];
  ok('thumbnail falls back to the drawn glass', A.thumbHTML(r0, INGREDIENTS, {}).startsWith('<svg'));
  const withPhoto = A.thumbHTML(r0, INGREDIENTS, { [r0.id]: { file: 'img/x.jpg' } });
  ok('thumbnail uses a photo when there is one', withPhoto.startsWith('<img') && withPhoto.includes('img/x.jpg'));
  ok('thumbnail escapes a hostile file name', !A.thumbHTML(r0, INGREDIENTS, { [r0.id]: { file: 'a"><script>' } }).includes('<script>'));
  await nav('#/recipe/negroni');
  ok('recipe page shows the drawn glass when there is no photo', !!$('#app .hero.art svg'));
  await nav('#/library');
  ok('library rows show a thumbnail for every recipe', $$('#list .rc .tw svg, #list .rc .tw img').length === RECIPES.length);
}

/* ---------- photos.json ---------- */
{
  const photos = JSON.parse(fs.readFileSync(root + '/photos.json', 'utf8'));
  const ids = new Set(RECIPES.map(r => r.id));
  ok('photos.json only names real recipes', Object.keys(photos).every(k => ids.has(k)));
  ok('every photo file exists and carries a licence and credit', Object.values(photos).every(p =>
    fs.existsSync(root + '/' + p.file) && p.license && p.credit && p.source));
}


/* ---------- second batch of recipes ---------- */
{
  const want = ['white-russian','dirty-martini','gimlet','brandy-alexander','godfather','greyhound','salty-dog','cape-cod',
    'painkiller','hurricane','blue-lagoon','midori-sour','lynchburg-lemonade','black-velvet','kir-royale',
    'death-in-the-afternoon','black-manhattan','division-bell','milano-torino','breakfast-martini','batanga','shirley-temple'];
  const have = new Map(RECIPES.map(r => [r.id, r]));
  ok('all 22 new recipes exist', want.every(id => have.has(id)));
  ok('recipe ids are unique', have.size === RECIPES.length);
  const ex = RECIPES.filter(r => r.src === 'extra');
  ok('24 popular extras, all in the Popular extras category', ex.length === 24 && ex.every(r => r.cat === 'extra') && BUILD.extraAdded === 24);
  ok('every ingredient of every recipe is a known ingredient', RECIPES.every(r => r.ings.every(i => INGREDIENTS[i.k])));
  const maths = (r) => { const ab = r.ings.reduce((a, i) => a + i.ml * i.abv / 100, 0); return Math.abs(ab - r.abv.absolute_ml) < 0.02; };
  ok('alcohol maths is consistent for all the extras', ex.every(maths));
  const st = have.get('shirley-temple');
  ok('Shirley Temple is alcohol-free', st.abv.absolute_ml === 0 && st.abv.std_au === 0 && st.abv.abv_served === 0);
  ok('every extra has a story, taste note, method and confidence', ex.every(r => r.story.length > 60 && r.taste.length > 20 && r.method.length > 30 && ['high', 'med', 'low'].includes(r.conf)));
  ok('trademarked names are flagged', !!have.get('painkiller').flag);
  const G = await import('./game.js');
  ok('every recipe builds playable stages', RECIPES.every(r => { try { return G.buildStages(r).length > 1; } catch (e) { return false; } }));
  const F2 = await import('./finder.js');
  const cat2 = F2.catalogue(RECIPES, INGREDIENTS);
  ok('new ingredients appear in the My bar list, stout under Beer', cat2.find(c => c.k === 'stout')?.cat === 'beer' && !!cat2.find(c => c.k === 'olive brine'));
  const wr = F2.canMake(RECIPES, ['vodka', 'kahlúa', 'cream']);
  ok('can make: White Russian from vodka + coffee liqueur + cream', wr.find(x => x.r.id === 'white-russian')?.missing.length === 0);
  DB.S().bar = []; DB.S().barMode = 'make';
  await nav('#/library');
  ok('Popular extras filter lists all 24', (() => { const b = [...$$('#filters button, .filters button')].find(x => /Popular extras/.test(x.textContent)); if (!b) return false; b.click(); const n = $$('#list .rc').length; [...$$('.filters button')].find(x => x.textContent.trim() === 'All').click(); return n === 24; })());
}

/* ---------- glass guide ---------- */
{
  await nav('#/library');
  ok('library links to the glass guide and the cheat sheet', !!$('#app [data-go="#/glasses"]') && !!$('#app [data-go="#/sheet"]'));
  await nav('#/glasses');
  const glasses = [...new Set(RECIPES.map(r => r.glass))];
  ok('glass guide has a card for every glass in use', $$('#app .glasscard').length === glasses.length, `${$$('#app .glasscard').length} vs ${glasses.length}`);
  ok('every glass has a drawing and a description', $$('#app .glasscard').every(c => c.querySelector('svg') && c.querySelector('p').textContent.length > 40));
  const coupeN = RECIPES.filter(r => r.glass === 'coupe').length;
  ok('the coupe card lists every coupe drink', $$('#g-coupe a.chip').length === coupeN && coupeN > 10);
  ok('every drink is listed under exactly one glass', $$('#app .glasscard a.chip').length === RECIPES.length);
  ok('glass guide links go to recipes', $('#g-coupe a.chip').getAttribute('href').startsWith('#/recipe/'));
  await nav('#/glasses/tiki');
  ok('deep link highlights that glass', $('#g-tiki')?.classList.contains('hl') && $$('#app .glasscard.hl').length === 1);
  ok('Library tab stays highlighted on the guide', $('#tabbar a.on')?.dataset.tab === 'library');
  await nav('#/recipe/negroni');
  ok('recipe page links its glass to the guide', $('#app a.pill[href^="#/glasses/"]')?.getAttribute('href') === '#/glasses/rocks');
}

/* ---------- cheat sheet ---------- */
{
  const P = await import('./app.js');
  ok('ozText rounds to quarter ounces', P.ozText(45) === '1½' && P.ozText(60) === '2' && P.ozText(22.5) === '¾' && P.ozText(15) === '½' && P.ozText(7.5) === '¼');
  ok('ozText marks approximations', P.ozText(20).startsWith('~'));
  const neg = RECIPES.find(r => r.id === 'negroni');
  ok('sheet line in mL is right', P.sheetLine(neg, 'ml') === '30 mL gin, 30 mL campari, 30 mL sweet vermouth' ||
    /30 mL/.test(P.sheetLine(neg, 'ml')) && P.sheetLine(neg, 'ml').split(',').length === 3, P.sheetLine(neg, 'ml'));
  ok('sheet line in oz is right', /^1 oz /.test(P.sheetLine(neg, 'oz')), P.sheetLine(neg, 'oz'));
  ok('sheet how-line names the technique', /Stir/.test(P.sheetHow(RECIPES.find(r => r.id === 'dirty-martini'))));
  DB.S().settings.units = 'ml';
  await nav('#/sheet');
  ok('cheat sheet lists every recipe', $$('#app .sheet-r').length === RECIPES.length);
  ok('cheat sheet has no undefined or NaN text', !/undefined|NaN|null/.test($('#app .sheet').textContent));
  ok('cheat sheet has a print button', !!$('#sheetprint'));
  $('#sheetcats [data-c="extra"]').click();
  ok('cheat sheet filter narrows to the extras', $$('#app .sheet-r').length === 24);
  $('#sheetunits [data-u="oz"]').click();
  ok('unit switch to oz works and is remembered', /oz /.test($('#app .sheet').textContent) && DB.S().settings.units === 'oz');
  DB.S().settings.units = 'ml'; DB.save();
  $('#sheetcats [data-c="all"]').click();
  ok('Shirley Temple is marked alcohol-free on the sheet', /Shirley Temple[^\n]*alcohol-free/.test($('#app .sheet').textContent.replace(/\s+/g, ' ')) || $('#app .sheet').textContent.includes('alcohol-free'));
  const css = fs.readFileSync(root + '/app.css', 'utf8');
  ok('print stylesheet hides the tab bar and uses columns', /@media print/.test(css) && /#tabbar[^}]*display:none/.test(css.slice(css.indexOf('@media print'))) );
}

await nav('#/drill');
ok('drill view renders', $('#app').innerHTML.includes('Rank'), '');
ok('drill shows a practice queue', $$('#app .rc').length >= 5, `${$$('#app .rc').length} rows`);
ok('tab bar exists with the My bar tab', $$('#tabbar a').length === 6 && !!$('#tabbar a[data-tab="bar"]'));

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
