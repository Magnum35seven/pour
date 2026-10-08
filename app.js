import { allRecipes } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupNavigation();
    renderActiveView('library'); // Explicitly loads Library on startup
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-tabbar .nav-btn');
    if (!navButtons.length) return;

    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetView = e.currentTarget.getAttribute('data-target');
            if (!targetView) return;
            
            navButtons.forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            switchView(targetView);
        });
    });
}

function switchView(viewName) {
    const panels = document.querySelectorAll('.app-content .view-panel');
    panels.forEach(panel => panel.classList.remove('active'));
    
    const activePanel = document.getElementById(`view-${viewName}`);
    if (activePanel) {
        activePanel.classList.add('active');
        renderActiveView(viewName);
    }
}

function renderActiveView(viewName) {
    const panel = document.getElementById(`view-${viewName}`);
    if (!panel) return;

    switch (viewName) {
        case 'drill':
            panel.innerHTML = `
                <div class="drill-inner-view">
                    <h2>⚡ Flashcard & Speed Drills</h2>
                    <p class="subtitle">Timed recipe memory training and ingredient recall tests.</p>
                    <div class="drill-controls">
                        <button id="start-drill-btn" class="action-btn">Start Speed Drill</button>
                    </div>
                    <div id="drill-dynamic-area"></div>
                </div>
            `;
            if (typeof window.loadDrillView === 'function') {
                window.loadDrillView(panel.querySelector('#drill-dynamic-area'));
            }
            break;

        case 'library':
            panel.innerHTML = `
                <div class="library-inner-view">
                    <h2>📖 Recipe Library</h2>
                    <p class="subtitle">Complete database of official IBA and classic cocktail specifications.</p>
                    <div class="search-bar-container">
                        <input type="text" id="recipe-search-input" placeholder="Search cocktails or ingredients (e.g. vodka, rum)..." />
                    </div>
                    <div id="library-list-area"></div>
                </div>
            `;
            
            // Initial render of all recipes and setup search behavior
            renderLibraryList(allRecipes);
            setupLibrarySearch();

            if (typeof window.loadLibraryView === 'function') {
                window.loadLibraryView(panel.querySelector('#library-list-area'), allRecipes);
            }
            break;

        case 'explore':
            panel.innerHTML = `
                <div class="explore-inner-view">
                    <h2>🗺️ Cocktail Explorer</h2>
                    <p class="subtitle">Discover drinks categorized by flavor profiles, glassware, and era.</p>
                    <div class="filter-chips">
                        <button class="chip" data-filter="sour">Sours</button>
                        <button class="chip" data-filter="tiki">Tiki & Tropical</button>
                        <button class="chip" data-filter="highball">Highballs</button>
                    </div>
                    <div id="explore-results-area"></div>
                </div>
            `;
            if (typeof window.loadExploreView === 'function') {
                window.loadExploreView(panel.querySelector('#explore-results-area'));
            }
            break;

        case 'play':
            panel.innerHTML = `
                <div class="play-inner-view">
                    <h2>🍸 Mixology Pour Station</h2>
                    <p class="subtitle">Pick your glassware, choose ingredients, and pour precise proportions.</p>
                    <div id="play-station-area"></div>
                </div>
            `;
            if (typeof window.loadPlayView === 'function') {
                window.loadPlayView(panel.querySelector('#play-station-area'));
            }
            break;

        case 'boss':
            panel.innerHTML = `
                <div class="boss-inner-view">
                    <h2>🥊 The Gauntlet (Boss Fight)</h2>
                    <p class="subtitle">Handle rushed customer orders under strict time penalties.</p>
                    <div id="boss-arena-area"></div>
                </div>
            `;
            if (typeof window.loadBossView === 'function') {
                window.loadBossView(panel.querySelector('#boss-arena-area'));
            }
            break;

        case 'cellar':
            panel.innerHTML = `
                <div class="cellar-inner-view">
                    <h2>🍷 Cellar Log</h2>
                    <p class="subtitle">Manage bottle inventory and track home bar supplies.</p>
                    <div id="cellar-inventory-area"></div>
                </div>
            `;
            if (typeof window.loadCellarView === 'function') {
                window.loadCellarView(panel.querySelector('#cellar-inventory-area'));
            }
            break;

        default:
            panel.innerHTML = `<p>View not loaded.</p>`;
    }
}

function setupLibrarySearch() {
    const searchInput = document.getElementById('recipe-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        const filtered = allRecipes.filter(recipe => {
            if (!query) return true;
            const terms = recipe.searchTerms || `${recipe.name} ${recipe.cat} ${recipe.story || ''}`.toLowerCase();
            return terms.includes(query);
        });

        renderLibraryList(filtered);
    });
}

function renderLibraryList(recipesToRender) {
    const listArea = document.getElementById('library-list-area');
    if (!listArea) return;

    if (recipesToRender.length === 0) {
        listArea.innerHTML = `<p class="no-results" style="padding: 20px; color: #777;">No cocktails found matching your search.</p>`;
        return;
    }

    listArea.innerHTML = recipesToRender.map(recipe => `
        <div class="recipe-card" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; background: #fff;">
            <h3 style="margin: 0 0 5px 0;">${recipe.name}</h3>
            <span style="font-size: 0.8em; background: #eee; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">${recipe.cat}</span>
            <p style="margin: 8px 0; font-size: 0.95em; color: #441;">${recipe.story}</p>
            <p style="font-size: 0.9em; color: #666; margin: 0;"><strong>Ingredients:</strong> ${recipe.ings.map(i => `${i.v}${i.u}${i.n}`).join(', ')}</p>
        </div>
    `).join('');
}
