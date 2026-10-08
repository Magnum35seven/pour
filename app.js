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
    <p class="muted">${BUILD.total} cocktails in the canon.</p>

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
