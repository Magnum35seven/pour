/* Router, views and the pour minigame. No framework, no build step. */
import { RECIPES, INGREDIENTS, BUILD } from './data.js';
import { buildStages, gradePour, pourScale, GLASS_LABEL, ICE_LABEL, VESSEL_LABEL,
         STRAIN_LABEL, TECH_LABEL, ingName, unitLabel } from './game.js';
import { buildBoss, BOSS_HP, ROSTER } from './boss.js';
import * as DB from './store.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const byId = Object.fromEntries(RECIPES.map(r => [r.id, r]));
DB.load();

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('on');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 1900);
}

function flash() {
  const f = document.createElement('div'); f.className = 'flash';
  document.body.appendChild(f); setTimeout(() => f.remove(), 420);
}

const CAT_LABEL = { unforgettables: 'The Unforgettables', contemporary: 'Contemporary Classics',
                    newera: 'New Era Drinks', noniba: 'Non-IBA classics' };

/* ------------------------------------------------------------------ router */

const routes = {};
function route(path, fn) { routes[path] = fn; }

function render() {
  const h = location.hash.replace(/^#/, '') || '/drill';
  const [path, ...rest] = h.split('/').filter(Boolean);
  const key = '/' + (path || 'drill');
  const fn = routes[key] || routes['/drill'];
  document.querySelectorAll('#tabbar a').forEach(a =>
    a.classList.toggle('on', a.getAttribute('href') === '#' + key ||
      (key === '/recipe' || key === '/play') && a.dataset.tab === 'library'));
  window.scrollTo(0, 0);
  fn(...rest);
}
window.addEventListener('hashchange', render);

/* ------------------------------------------------------------------- drill */

route('/drill', () => {
  const lv = DB.level();
  const acc = DB.accuracy();
  const q = DB.drillQueue(RECIPES, 8);
  const st = DB.S();
  app.innerHTML = `
    <h1>Pour</h1>
    <p class="muted">${BUILD.total} recipes — ${BUILD.guideRecipes} from your guide, plus
      ${BUILD.ibaAdded} IBA-official drinks the guide was missing.</p>

    <div class="card">
      <div class="spread">
        <div><div class="dim" style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em">Rank</div>
          <div style="font-size:1.5rem;font-weight:700">${rankName(lv.lvl)}</div></div>
        <div style="text-align:right"><div class="dim" style="font-size:.72rem">XP</div>
          <div style="font-size:1.5rem;font-weight:700;color:var(--amber)">${lv.xp.toLocaleString()}</div></div>
      </div>
      <div class="bar" style="margin-top:9px"><i style="width:${lv.pct}%"></i></div>
      <div class="spread" style="margin-top:9px;font-size:.78rem;color:var(--ink3)">
        <span>${lv.into} / ${lv.need} XP to next rank</span>
        <span>Decision accuracy ${acc.ans}% · Pour accuracy ${acc.pour}%</span>
      </div>
    </div>

    <h2 style="margin-top:16px">Practise this</h2>
    <p class="muted" style="font-size:.85rem">Chosen from what you've never tried and where you keep
      making the same mistake.</p>
    ${q.map(r => recipeRow(r)).join('')}

    <div class="card" style="margin-top:16px">
      <h3>Badges</h3>
      <div class="grid g2" style="gap:6px">
        ${Object.entries(DB.BADGE_INFO).map(([id, [ic, nm, dsc]]) =>
          `<div style="opacity:${st.badges.includes(id) ? 1 : .32};padding:6px 0">
             <b>${ic} ${esc(nm)}</b><div class="dim" style="font-size:.74rem">${esc(dsc)}</div></div>`).join('')}
      </div>
    </div>
    <p class="dim" style="font-size:.76rem;margin-top:14px">Drink responsibly. The absolute alcohol
      figures in this app are there so you can judge what you're actually serving.</p>`;
});

function rankName(l) {
  return ['Barback', 'Bartender', 'Barback no more', 'Chef de Partie', 'Head Bartender',
          'Bar Manager', 'Brand Ambassador', 'Legend'][Math.min(7, Math.floor((l - 1) / 2))];
}

function recipeRow(r) {
  const m = DB.mastery(r.id);
  const c = colourFor(r);
  return `<button class="rc" data-go="#/recipe/${r.id}">
    <span class="swatch" style="background:${c}"></span>
    <span style="flex:1">
      <span class="nm">${esc(r.name)}</span>
      <span class="meta"><span>${CAT_LABEL[r.cat]}</span><span>·</span>
        <span>${r.abv.abv_served}% ABV</span><span>·</span><span>${r.abv.std_au} std</span></span>
    </span>
    <span class="right">${m.level ? `<span class="pill ${m.level === 3 ? 'green' : m.level === 2 ? 'gold' : ''}">${m.label}</span>`
      : '<span class="pill">New</span>'}<br><span style="font-size:.68rem">${m.pct}%</span></span>
  </button>`;
}

function colourFor(r) {
  const cols = r.ings.filter(i => INGREDIENTS[i.k]).map(i => INGREDIENTS[i.k].col);
  if (!cols.length) return '#3a332c';
  return `linear-gradient(135deg, ${cols[0]}, ${cols[cols.length - 1]})`;
}

/* ----------------------------------------------------------------- library */

let libFilter = 'all';
route('/library', () => {
  app.innerHTML = `
    <h1>Library</h1>
    <div class="search">
      <input id="q" placeholder="Search 119 cocktails, spirits, garnishes…" autocomplete="off">
      <div class="filters" id="fl">
        ${[['all', 'All'], ['unforgettables', 'Unforgettables'], ['contemporary', 'Contemporary'],
           ['newera', 'New Era'], ['noniba', 'Non-IBA'], ['guide', 'From your guide'],
           ['iba2024', 'Added from IBA'], ['strong', 'Over 2 std']].map(([v, l]) =>
          `<button data-f="${v}" class="${libFilter === v ? 'on' : ''}">${l}</button>`).join('')}
      </div>
    </div>
    <div id="list"></div>`;
  const list = $('#list');
  const draw = () => {
    const term = ($('#q').value || '').toLowerCase().trim();
    let out = RECIPES.filter(r => {
      if (libFilter === 'guide' || libFilter === 'iba2024') { if (r.src !== libFilter) return false; }
      else if (libFilter === 'strong') { if (r.abv.std_au < 2) return false; }
      else if (libFilter !== 'all' && r.cat !== libFilter) return false;
      if (!term) return true;
      return (r.name + ' ' + r.family + ' ' + (r.garnish || '') + ' ' +
              r.ings.map(i => ingName(i.k)).join(' ')).toLowerCase().includes(term);
    });
    list.innerHTML = out.length ? out.map(recipeRow).join('')
      : `<p class="muted" style="padding:20px 0">Nothing matches that.</p>`;
    list.querySelectorAll('[data-go]').forEach(b =>
      b.onclick = () => location.hash = b.dataset.go);
  };
  $('#q').oninput = draw;
  $('#fl').onclick = (e) => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    libFilter = b.dataset.f;
    $('#fl').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    draw();
  };
  draw();
});

/* ----------------------------------------------------------------- recipe */

route('/recipe', (id) => {
  const r = byId[id];
  if (!r) { app.innerHTML = '<p>Not found.</p>'; return; }
  const a = r.abv;
  const m = DB.mastery(id);
  const rd = DB.S().rounds[id];
  app.innerHTML = `
    <button class="btn ghost small" data-go="#/library">← Library</button>
    <h1 style="margin-top:12px">${esc(r.name)}</h1>
    <div class="row wrap" style="margin-bottom:10px">
      <span class="pill gold">${CAT_LABEL[r.cat]}</span>
      <span class="pill">${r.family}</span>
      <span class="pill ${r.src === 'guide' ? '' : 'blue'}">${r.src === 'guide' ? 'From your guide' : 'Added from IBA 2024'}</span>
      <span class="pill ${m.level >= 2 ? 'green' : ''}">${m.label} ${m.pct}%</span>
    </div>

    ${r.flag ? `<div class="myth"><h4>Source note</h4><p style="margin:0;font-size:.87rem">${esc(r.flag)}</p></div>` : ''}

    <div class="card">
      <h3>Build</h3>
      <div class="row wrap" style="gap:6px;margin-bottom:9px">
        <span class="pill">${GLASS_LABEL[r.glass] || r.glass}</span>
        <span class="pill">Ice: ${ICE_LABEL[r.icePrep]}</span>
        ${r.iceServe !== r.icePrep ? `<span class="pill">Served: ${ICE_LABEL[r.iceServe]}</span>` : ''}
        <span class="pill">${VESSEL_LABEL[r.vessel]}</span>
        <span class="pill">${STRAIN_LABEL[r.strain]}</span>
        ${r.tech.map(t => `<span class="pill">${t.s ? TECH_LABEL[t.t] + ' ' + t.s + 's' : TECH_LABEL[t.t]}</span>`).join('')}
      </div>
      ${r.ings.map(i => `<div class="ingline">
        <span class="amt">${i.q == null ? 'fill' : i.q + ' ' + unitLabel(i)}</span>
        <span class="nm2">${esc(i.l)}${i.abv ? `<span class="dim" style="font-size:.75rem"> · ${i.abv}%</span>` : ''}</span>
        <span class="pct">${i.abv && a.absolute_ml ? Math.round((i.q * i.abv / 100) / a.absolute_ml * 100) + '%' : ''}</span>
      </div>`).join('')}
      <p class="dim" style="font-size:.82rem;margin:9px 0 0"><b>Garnish:</b> ${esc(r.garnish || 'None')}</p>
    </div>

    <div class="card">
      <h3>Alcohol</h3>
      <div class="abvgrid">
        <div class="abvcell"><div class="v">${a.abv_served}%</div><div class="k">ABV as served</div></div>
        <div class="abvcell"><div class="v">${a.absolute_ml} mL</div><div class="k">Absolute alcohol</div></div>
        <div class="abvcell"><div class="v">${a.absolute_g} g</div><div class="k">Ethanol by weight</div></div>
        <div class="abvcell"><div class="v">${a.std_au}</div><div class="k">AU standard drinks</div></div>
      </div>
      <p class="dim" style="font-size:.76rem;margin:9px 0 0">
        ${a.volume_pre_ml} mL of liquid before dilution, ${a.dilution_pct}% added by
        ${r.tech.some(t => t.t === 'shake') ? 'shaking' : r.tech.some(t => t.t === 'stir') ? 'stirring' : 'ice contact'}
        → ${a.volume_served_ml} mL in the glass. ${a.abv_pre}% before dilution,
        ${a.std_us} US standard drinks. ${a.has_top ? 'The "fill" ingredient is estimated from glass size.' : ''}
        Figures are computed from each ingredient's labelled strength, so they are estimates, not lab results.</p>
    </div>

    <div class="card">
      <h3>Tasting notes</h3>
      <p class="story">${esc(r.taste)}</p>
      <h3 style="margin-top:12px">Backstory</h3>
      <p class="story">${esc(r.story)}</p>
      ${r.myth ? `<div class="myth"><h4>Myth check</h4><p style="margin:0;font-size:.87rem">${esc(r.myth)}</p></div>` : ''}
      <p class="dim" style="font-size:.74rem;margin-top:9px">Confidence:
        ${{ high: 'high — corroborated by multiple sources or primary print',
             med: 'medium — single reliable source, or well known but thinly documented',
             low: 'low — contested or folklore; read it as a tradition, not a fact' }[r.conf] || 'not graded'}</p>
    </div>

    <div class="grid g2">
      <button class="btn" data-go="#/play/${r.id}">Practise this</button>
      <button class="btn ghost" id="logit">Log a real one</button>
    </div>
    ${rd ? `<p class="dim" style="font-size:.78rem;margin-top:10px;text-align:center">
      ${rd.plays} attempt${rd.plays > 1 ? 's' : ''} · best ${rd.best} · last ${rd.last}</p>` : ''}`;
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => location.hash = b.dataset.go);
  $('#logit').onclick = () => location.hash = '#/cellar/' + r.id;
});

/* -------------------------------------------------------------------- play */

route('/play', (id) => {
  const r = byId[id];
  if (!r) { app.innerHTML = '<p>Not found.</p>'; return; }
  const stages = buildStages(r);
  const possible = stages.reduce((a, s) => a + s.weight, 0);
  let i = 0, score = 0, streak = 0, streakPeak = 0, mistakes = [], answers = 0, correct = 0;
  let pours = 0, pourPerfect = 0, pouredMl = 0;
  const marks = [];

  const drawHud = () => `
    <div class="hud">
      <span class="dim">${esc(r.name)} · ${i + 1}/${stages.length}</span>
      <span class="score">${score} pts${streak > 1 ? ` <span class="pill gold">×${mult(streak).toFixed(1)}</span>` : ''}</span>
    </div>
    <div class="steps">${stages.map((_, n) =>
      `<i class="${n < i ? (marks[n] ? 'done' : 'bad') : n === i ? 'now' : ''}"></i>`).join('')}</div>`;

  const mult = (s) => Math.min(2, 1 + (s - 1) * 0.1);

  let next = () => {
    if (i >= stages.length) return finish();
    const s = stages[i];
    app.innerHTML = drawHud() + (s.type === 'pour' ? pourView(r, s) : choiceView(s));
    if (s.type === 'pour') wirePour(s); else wireChoice(s);
  };

  const choiceView = (s) => `
    <div class="card">
      <p class="stage-q">${esc(s.q)}</p>
      <div class="opts">${s.options.map((o, n) =>
        `<button class="opt" data-n="${n}">${esc(o.label)}</button>`).join('')}</div>
      <div id="why"></div>
    </div>`;

  const wireChoice = (s) => {
    let done = false;
    app.querySelectorAll('.opt').forEach(b => {
      b.onclick = () => {
        if (done) return; done = true;
        const o = s.options[+b.dataset.n];
        app.querySelectorAll('.opt').forEach(x => {
          const ox = s.options[+x.dataset.n];
          if (ox.ok) x.classList.add('correct');
          else if (x === b) x.classList.add('wrong');
        });
        answers++;
        if (o.ok) {
          correct++; streak++; streakPeak = Math.max(streakPeak, streak);
          const pts = Math.round(s.weight * mult(streak));
          score += pts; marks[i] = true;
          $('#why').innerHTML = `<div class="verdict perfect">Correct · +${pts}</div>
            <button class="btn" id="nx">Next</button>`;
        } else {
          streak = 0; marks[i] = false;
          mistakes.push({ t: s.key, detail: String(o.label).slice(0, 60) });
          const right = s.options.find(x => x.ok);
          $('#why').innerHTML = `<div class="verdict miss">
              ${esc({ 'wrong-glass': 'Wrong glass', 'wrong-ice': 'Wrong ice',
                      'wrong-vessel': 'Wrong vessel', 'wrong-prep': 'Wrong prep step',
                      'wrong-technique': 'Wrong technique', 'wrong-duration': 'Wrong timing',
                      'wrong-strain': 'Wrong strainer', 'wrong-garnish': 'Wrong garnish' }[s.key] || 'Wrong')}
            </div><p class="muted" style="font-size:.85rem">It should be <b>${esc(right.label)}</b>.</p>
            <button class="btn" id="nx">Next</button>`;
        }
        $('#nx').onclick = () => { i++; next(); };
      };
    });
  };

  /* -------- the pour minigame: hold to fill, release to lock -------- */
  const pourView = (r, s) => {
    const ing = s.ing;
    const { target, max } = pourScale(ing);
    const showN = DB.S().settings.showNumbers;
    return `
    <div class="card">
      <p class="stage-q">Pour the ${esc(ingName(ing.k))}</p>
      <p class="muted" style="font-size:.85rem;margin:-2px 0 6px">
        ${showN ? `Target ${target} ${unitLabel(ing)}` : 'Feel it — the number is hidden until you let go.'}</p>
      <div class="glasswrap">
        <div class="glass" id="gl" style="width:${glassW(r)}px;height:180px;border-radius:4px 4px 12px 12px">
          <div class="target" style="bottom:${(target / max) * 100}%"></div>
          <div class="liquid" id="lq" style="height:0%;background:${INGREDIENTS[ing.k] ? INGREDIENTS[ing.k].col : '#c9a'}"></div>
        </div>
      </div>
      <div class="readout" id="ro">${showN ? '0' : '—'}</div>
      <button class="pourbtn" id="pb">HOLD TO POUR</button>
      <div id="why"></div>
    </div>`;
  };

  const glassW = (r) => ({ coupe: 96, 'cocktail glass': 84, 'martini glass': 100, 'champagne flute': 58,
    highball: 78, collins: 68, rocks: 96, hurricane: 100, 'wine glass': 84, shot: 46,
    'julep cup': 92, 'irish coffee': 80, zombie: 86, tiki: 92 }[r.glass] || 84);

  const wirePour = (s) => {
    const { target, max, unit } = pourScale(s.ing);
    const lq = $('#lq'), ro = $('#ro'), pb = $('#pb');
    const showN = DB.S().settings.showNumbers;
    let level = 0, holding = false, raf = null, done = false, last = 0;

    const tick = (t) => {
      if (!holding) return;
      const dt = last ? Math.min(64, t - last) : 16; last = t;
      level = Math.min(1.06, level + dt / 1500);        // ~1.5 s to fill the scale
      lq.style.height = (level * 100) + '%';
      if (showN) ro.textContent = Math.round(level * max * 10) / 10;
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (done || holding) return; holding = true; last = 0; pb.classList.add('holding'); pb.textContent = 'POURING…'; raf = requestAnimationFrame(tick); };
    const stop = () => {
      if (!holding || done) return;
      holding = false; cancelAnimationFrame(raf); pb.classList.remove('holding'); pb.textContent = 'HOLD TO POUR';
      const value = Math.round(level * max * 100) / 100;
      ro.textContent = Math.round(value * 10) / 10;
      const g = gradePour(s, value);
      pours++; pouredMl += value;
      if (g.band === 'perfect') pourPerfect++;
      answers++;
      if (g.factor > 0) {
        const pts = Math.round(g.points * mult(streak + 1));
        score += pts; streak++; streakPeak = Math.max(streakPeak, streak);
        correct++; marks[i] = g.band === 'perfect';
        $('#why').innerHTML = `<div class="verdict ${g.band === 'perfect' ? 'perfect' : 'good'}">
            ${g.label} · +${pts}</div>
          <p class="muted" style="font-size:.85rem">${fmt(value, unit)} poured, ${fmt(target, unit)} wanted
            ${g.diff ? `(${g.diff > 0 ? '+' : ''}${fmt(g.diff, unit)}).` : '— exact.'}</p>
          <button class="btn" id="nx">Next</button>`;
      } else {
        streak = 0; marks[i] = false;
        mistakes.push({ t: 'wrong-amount', ing: s.ing.k, delta: g.diff });
        $('#why').innerHTML = `<div class="verdict miss">${g.label}</div>
          <p class="muted" style="font-size:.85rem">${fmt(value, unit)} poured, ${fmt(target, unit)} wanted
            (${g.diff > 0 ? '+' : ''}${fmt(g.diff, unit)}).</p>
          <button class="btn" id="nx">Next</button>`;
      }
      done = true;
      $('#nx').onclick = () => { i++; next(); };
    };

    pb.addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
    window.addEventListener('pointerup', stop, { once: false });
    pb.addEventListener('pointerleave', () => { if (holding) stop(); });
    const kd = (e) => { if (e.code === 'Space') { e.preventDefault(); start(); } };
    const ku = (e) => { if (e.code === 'Space') { e.preventDefault(); stop(); } };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    window._pourCleanup = () => {
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      window.removeEventListener('pointerup', stop);
    };
  };

  const finish = () => {
    const pct = Math.round((score / possible) * 100);
    const perfect = pct >= 95 && mistakes.length === 0;
    DB.recordRound({ id: r.id, score, mistakes, answers, correct, pours, pourPerfect,
                     pouredMl, streakPeak, perfect });
    const newly = DB.newBadges();
    if (perfect) flash();
    app.innerHTML = `
      <div class="card" style="text-align:center">
        <div style="font-size:2.6rem;font-weight:800;color:var(--amber);line-height:1">${score}</div>
        <div class="dim" style="font-size:.78rem;text-transform:uppercase;letter-spacing:.05em">
          points · ${pct}% of ${possible}</div>
        <p style="margin:12px 0 0">${perfect
          ? 'Perfect round. No mistakes, every pour on the line.'
          : mistakes.length
            ? `${mistakes.length} mistake${mistakes.length > 1 ? 's' : ''} — all logged so you can drill them.`
            : 'Clean round.'}</p>
      </div>
      ${mistakes.length ? `<div class="card"><h3>What went wrong</h3>
        ${mistakes.map(m => `<div class="mrow"><span class="lbl">
          <b>${esc(DB.MISTAKE_LABEL[m.t] || m.t)}</b>
          ${m.ing ? `<span class="dim">· ${esc(ingName(m.ing))} ${m.delta ? '(' + (m.delta > 0 ? '+' : '') + m.delta + ')' : ''}</span>`
                  : m.detail ? `<span class="dim">· chose ${esc(m.detail)}</span>` : ''}
        </span></div>`).join('')}</div>` : ''}
      <div class="card"><h3>${esc(r.name)}</h3>
        <p class="story">${esc(r.taste)}</p>
        <p class="story">${esc(r.story)}</p>
        <div class="abvgrid">
          <div class="abvcell"><div class="v">${r.abv.abv_served}%</div><div class="k">ABV served</div></div>
          <div class="abvcell"><div class="v">${r.abv.std_au}</div><div class="k">AU std drinks</div></div>
        </div></div>
      <div class="grid g2">
        <button class="btn" id="again">Go again</button>
        <button class="btn ghost" data-go="#/recipe/${r.id}">Read it</button>
      </div>
      <div class="grid g2" style="margin-top:8px">
        <button class="btn ghost" data-go="#/drill">Done</button>
        <button class="btn ghost" data-go="#/cellar/${r.id}">Log a real one</button>
      </div>`;
    app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => location.hash = b.dataset.go);
    $('#again').onclick = () => { if (window._pourCleanup) window._pourCleanup(); render(); };
    toast(`Best for ${r.name}: ${DB.S().rounds[r.id].best}`);
  };

  const wrapNext = next;
  next = () => { if (window._pourCleanup) { window._pourCleanup(); window._pourCleanup = null; } wrapNext(); };
  next();
});

function fmt(v, unit) {
  if (unit === 'ml' || unit === 'top') return `${Math.round(v * 10) / 10} mL`;
  if (unit === 'dash') return `${v} dash${v === 1 ? '' : 'es'}`;
  if (unit === 'drop') return `${v} drop${v === 1 ? '' : 's'}`;
  if (unit === 'pinch') return `${v} pinch${v === 1 ? '' : 'es'}`;
  if (unit === 'tsp') return `${v} tsp`;
  if (unit === 'barspoon') return `${v} barspoon${v === 1 ? '' : 's'}`;
  if (unit === 'cube') return `${v} cube${v === 1 ? '' : 's'}`;
  if (unit === 'count') return `${v}`;
  return String(v);
}

/* -------------------------------------------------------------------- boss */

route('/boss', () => {
  app.innerHTML = `
    <h1>The Martini Gauntlet</h1>
    <p class="muted">Every martini-family drink in the canon: ${ROSTER.length} of them. The boss has
      ${BOSS_HP} HP. Correct answers hurt it; wrong answers heal it. Twelve questions, no second tries.</p>
    <div class="card" style="text-align:center">
      <div class="bossface">♛</div>
      <p class="muted" style="font-size:.88rem">Dry, dirty, vesper, Martinez, Bijou, Tuxedo, Hanky Panky,
        Casino, Corpse Reviver #2, Cardinale, Remember the Maine — plus every drink that borrowed the
        name without ever containing vermouth.</p>
      <button class="btn" id="start" style="margin-top:10px">Begin</button>
    </div>
    <div class="card">
      <h3>Record</h3>
      <p class="muted" style="font-size:.88rem;margin:0">Wins: ${DB.S().boss.wins} ·
        Attempts: ${DB.S().boss.attempts} · Lowest HP left: ${DB.S().boss.best || '—'}</p>
    </div>`;
  $('#start').onclick = () => runBoss();
});

function runBoss() {
  const qs = buildBoss(12);
  let i = 0, hp = BOSS_HP;
  const draw = (q) => {
    app.innerHTML = `
      <div class="hud"><span class="dim">Question ${i + 1} of ${qs.length}</span>
        <span class="score">Boss HP ${Math.max(0, hp)}</span></div>
      <div class="hpbar"><i style="width:${Math.max(0, hp)}%"></i></div>
      <div class="card" style="margin-top:12px">
        <h3>${esc(q.q)}</h3>
        ${q.detail ? `<p class="muted" style="font-size:.9rem">${esc(q.detail)}</p>` : ''}
        <div class="opts" style="${q.kind === 'spec' ? 'grid-template-columns:1fr' : ''}">
          ${q.options.map((o, n) => `<button class="opt" data-n="${n}">${esc(o.label)}</button>`).join('')}
        </div>
        <div id="why"></div>
      </div>`;
    let done = false;
    app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (done) return; done = true;
      const o = q.options[+b.dataset.n];
      app.querySelectorAll('.opt').forEach(x => {
        const ox = q.options[+x.dataset.n];
        if (ox.ok) x.classList.add('correct'); else if (x === b) x.classList.add('wrong');
      });
      if (o.ok) { hp -= q.hp; flash(); }
      else { hp = Math.min(BOSS_HP, hp + 12); $('.bossface')?.classList.add('shake'); }
      $('#why').innerHTML = `<div class="verdict ${o.ok ? 'perfect' : 'miss'}">
          ${o.ok ? `Hit for ${q.hp}` : 'Missed — the boss heals 12'}</div>
        <p class="muted" style="font-size:.85rem">${esc(q.why)}</p>
        <button class="btn" id="nx">${i + 1 >= qs.length || hp <= 0 ? 'Finish' : 'Next'}</button>`;
      $('#nx').onclick = () => { i++; if (hp <= 0 || i >= qs.length) endBoss(hp); else draw(qs[i]); };
    });
  };
  const endBoss = (hpLeft) => {
    const won = hpLeft <= 0;
    const s = DB.S();
    s.boss.attempts++;
    if (won) s.boss.wins++;
    s.boss.best = s.boss.best ? Math.min(s.boss.best, Math.max(0, hpLeft)) : Math.max(0, hpLeft);
    for (const b of DB.newBadges()) if (!s.badges.includes(b)) s.badges.push(b);
    DB.save();
    app.innerHTML = `
      <div class="card" style="text-align:center">
        <div style="font-size:3rem">${won ? '☠' : '♛'}</div>
        <h2>${won ? 'The gauntlet falls' : 'It survives'}</h2>
        <p class="muted">${won
          ? 'You know your martinis — every spec, every glass, every shake-or-stir call.'
          : `It finished on ${hpLeft} HP. Drill the martini family in the library and come back.`}</p>
        <div class="grid g2" style="margin-top:12px">
          <button class="btn" id="again">Again</button>
          <button class="btn ghost" data-go="#/drill">Drill instead</button>
        </div>
      </div>`;
    app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => location.hash = b.dataset.go);
    $('#again').onclick = () => render();
  };
  draw(qs[0]);
}

/* ------------------------------------------------------------------- stats */

route('/stats', () => {
  const ms = DB.mistakeStats();
  const worst = DB.worstRecipes();
  const ings = DB.ingredientErrors();
  const acc = DB.accuracy();
  const total = DB.S().mistakes.length;
  app.innerHTML = `
    <h1>Your mistakes</h1>
    <p class="muted">${total} logged error${total === 1 ? '' : 's'} (the last 400 are kept).</p>

    <div class="card">
      <div class="abvgrid">
        <div class="abvcell"><div class="v">${acc.ans}%</div><div class="k">Decision accuracy</div></div>
        <div class="abvcell"><div class="v">${acc.pour}%</div><div class="k">Perfect pours</div></div>
        <div class="abvcell"><div class="v">${acc.pours}</div><div class="k">Pours made</div></div>
        <div class="abvcell"><div class="v">${DB.S().bestStreak}</div><div class="k">Best streak</div></div>
      </div>
    </div>

    <div class="card">
      <h3>Most frequent error types</h3>
      ${ms.length ? ms.map(m => {
        const max = ms[0].n;
        return `<div class="mrow"><span class="n">${m.n}</span>
          <span class="lbl">${esc(m.label)}</span>
          <span class="mini"><span class="bar"><i style="width:${Math.round(m.n / max * 100)}%"></i></span></span>
        </div>`;
      }).join('') : '<p class="muted">No mistakes logged yet. Do a round.</p>'}
    </div>

    ${ings.length ? `<div class="card">
      <h3>Ingredients you keep mis-pouring</h3>
      ${ings.map(e => `<div class="mrow"><span class="n">${e.n}</span>
        <span class="lbl">${esc(ingName(e.ing))}<span class="dim"> · avg ${e.avg > 0 ? '+' : ''}${e.avg} out</span></span>
      </div>`).join('')}</div>` : ''}

    ${worst.length ? `<div class="card">
      <h3>Drill these</h3>
      <p class="muted" style="font-size:.85rem">Where your errors are concentrated.</p>
      ${worst.map(([id, n]) => {
        const r = byId[id]; if (!r) return '';
        return `<button class="rc" data-go="#/play/${id}">
          <span class="swatch" style="background:${colourFor(r)}"></span>
          <span style="flex:1"><span class="nm">${esc(r.name)}</span>
            <span class="meta"><span>${n} error${n > 1 ? 's' : ''}</span></span></span>
          <span class="right"><span class="pill gold">Practise</span></span></button>`;
      }).join('')}</div>` : ''}

    <div class="card">
      <h3>Settings</h3>
      <div class="spread" style="padding:6px 0">
        <span class="muted">Show live mL while pouring</span>
        <input type="checkbox" id="sn" style="width:auto" ${DB.S().settings.showNumbers ? 'checked' : ''}>
      </div>
      <p class="dim" style="font-size:.78rem;margin:0 0 10px">Off is harder and closer to the real bar:
        you learn the volume by feel, and only see the number after you release.</p>
      <button class="btn ghost small" id="reset">Reset all progress</button>
    </div>`;
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => location.hash = b.dataset.go);
  $('#sn').onchange = (e) => { DB.S().settings.showNumbers = e.target.checked; DB.save(); };
  $('#reset').onclick = () => { if (confirm('Erase all progress, mistakes and cellar entries?')) { DB.reset(); render(); } };
});

/* ------------------------------------------------------------------ cellar */

route('/cellar', (id) => {
  if (id) return logForm(id);
  const cs = DB.cellarStats();
  const st = DB.S();
  app.innerHTML = `
    <h1>Cellar</h1>
    <p class="muted">Everything you've actually drunk or made. ${cs.unique} different cocktails logged
      out of ${BUILD.total} in the canon.</p>
    <div class="card">
      <div class="abvgrid">
        <div class="abvcell"><div class="v">${cs.total}</div><div class="k">Entries</div></div>
        <div class="abvcell"><div class="v">${cs.unique}</div><div class="k">Distinct drinks</div></div>
        <div class="abvcell"><div class="v">${cs.avg || '—'}</div><div class="k">Avg rating</div></div>
        <div class="abvcell"><div class="v">${Math.round(cs.unique / BUILD.total * 100)}%</div><div class="k">Canon coverage</div></div>
      </div>
      <p class="dim" style="font-size:.76rem;margin:9px 0 0">${cs.home} made at home ·
        ${(cs.grams / 1000).toFixed(2)} kg of ethanol across all logged drinks,
        for the record.</p>
    </div>
    <button class="btn" data-go="#/cellar/new" style="margin-bottom:12px">+ Log a drink</button>
    <div class="card">
      ${st.log.length ? st.log.map(l => {
        const r = byId[l.id];
        return `<div class="logrow">
          <div class="spread">
            <b>${esc(r ? r.name : l.id)}</b>
            <span class="dim" style="font-size:.76rem">${new Date(l.ts).toLocaleDateString()}</span>
          </div>
          <div class="row wrap" style="gap:6px;margin-top:3px">
            ${l.rating ? `<span class="stars">${'★'.repeat(l.rating)}${'☆'.repeat(5 - l.rating)}</span>` : ''}
            <span class="pill">${l.home ? 'Made at home' : 'Bought out'}</span>
            ${l.place ? `<span class="pill">${esc(l.place)}</span>` : ''}
            ${l.grams ? `<span class="pill">${r ? r.abv.std_au : '?'} std</span>` : ''}
            <button class="pill red" data-del="${l.ts}" style="margin-left:auto">delete</button>
          </div>
          ${l.notes ? `<p class="muted" style="font-size:.86rem;margin:6px 0 0">${esc(l.notes)}</p>` : ''}
        </div>`;
      }).join('') : '<p class="muted">Nothing logged yet.</p>'}
    </div>`;
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => location.hash = b.dataset.go);
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
    DB.deleteLog(+b.dataset.del); render();
  });
});

function logForm(id) {
  const isNew = id === 'new';
  app.innerHTML = `
    <button class="btn ghost small" data-go="#/cellar">← Cellar</button>
    <h1 style="margin-top:12px">Log a drink</h1>
    <div class="card">
      <label class="f">Cocktail</label>
      <select id="cid">${RECIPES.map(r =>
        `<option value="${r.id}" ${r.id === id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
      <div style="height:10px"></div>
      <label class="f">Where</label>
      <input id="place" placeholder="Home, or the name of the bar">
      <div style="height:10px"></div>
      <div class="grid g2">
        <div><label class="f">Made at home?</label>
          <select id="home"><option value="0">Bought out</option><option value="1">Made at home</option></select></div>
        <div><label class="f">Rating</label>
          <select id="rate">${[0,1,2,3,4,5].map(n =>
            `<option value="${n}" ${n === 4 ? 'selected' : ''}>${n ? '★'.repeat(n) : '—'}</option>`).join('')}</select></div>
      </div>
      <div style="height:10px"></div>
      <label class="f">Notes</label>
      <textarea id="notes" placeholder="How was it? What would you change?"></textarea>
      <button class="btn" id="save" style="margin-top:12px">Save</button>
    </div>`;
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => location.hash = b.dataset.go);
  if (!isNew && byId[id]) $('#cid').value = id;
  $('#save').onclick = () => {
    const cid = $('#cid').value;
    const r = byId[cid];
    DB.logDrink({ id: cid, place: $('#place').value.trim(), home: $('#home').value === '1',
                  rating: +$('#rate').value, notes: $('#notes').value.trim(),
                  grams: r ? r.abv.absolute_g : 0 });
    toast('Logged');
    location.hash = '#/cellar';
  };
}

/* --------------------------------------------------------------- wire up */

document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { location.hash = g.dataset.go; }
});

render();
