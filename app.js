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
            
            // Hook up search listener and load library view safely
            setupLibrarySearch();
            if (typeof window.loadLibraryView === 'function') {
                window.loadLibraryView(panel.querySelector('#library-list-area'));
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

/**
 * Attaches real-time search filtering to the library search input.
 * Works seamlessly with existing global recipe sources (window.allRecipes, window.recipes, etc.)
 */
function setupLibrarySearch() {
    const searchInput = document.getElementById('recipe-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        // Retrieve recipes from whichever global variable your app uses
        const recipes = window.allRecipes || window.recipes || window. cocktailDatabase || [];
        if (!recipes.length) return;

        const filtered = recipes.filter(recipe => {
            if (!query) return true;
            const terms = recipe.searchTerms || `${recipe.name} ${recipe.cat} ${recipe.story || ''}`.toLowerCase();
            return terms.includes(query);
        });

        const listArea = document.getElementById('library-list-area');
        if (listArea && typeof window.loadLibraryView === 'function') {
            window.loadLibraryView(listArea, filtered);
        }
    });
}
