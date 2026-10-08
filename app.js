document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupNavigation();
    renderActiveView('library'); // Opens on Library by default
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-tabbar .nav-btn');
    
    if (!navButtons.length) return;

    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetView = e.currentTarget.getAttribute('data-target');
            if (!targetView) return;
            
            // Update active states on buttons
            navButtons.forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // Switch view panels
            switchView(targetView);
        });
    });
}

function switchView(viewName) {
    const panels = document.querySelectorAll('.app-content .view-panel');
    
    panels.forEach(panel => {
        panel.classList.remove('active');
    });
    
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
                <div class="drill-container">
                    <h2>Flashcard & Speed Drills</h2>
                    <p class="section-desc">Test your muscle memory and recipe recall speed with timed flashcard challenges.</p>
                    <div id="drill-content-area"></div>
                </div>
            `;
            if (typeof window.loadDrillView === 'function') {
                window.loadDrillView(panel.querySelector('#drill-content-area') || panel);
            }
            break;

        case 'library':
            panel.innerHTML = `
                <div class="library-container">
                    <h2>Recipe Library</h2>
                    <p class="section-desc">Browse and search through all available cocktail recipes.</p>
                    <div id="library-content-area"></div>
                </div>
            `;
            if (typeof window.loadLibraryView === 'function') {
                window.loadLibraryView(panel.querySelector('#library-content-area') || panel);
            }
            break;

        case 'explore':
            panel.innerHTML = `
                <div class="explore-container">
                    <h2>Cocktail Explorer</h2>
                    <p class="section-desc">Discover new drinks grouped by base spirits, flavor profiles, and historic categories.</p>
                    <div id="explore-content-area"></div>
                </div>
            `;
            if (typeof window.loadExploreView === 'function') {
                window.loadExploreView(panel.querySelector('#explore-content-area') || panel);
            }
            break;

        case 'play':
            panel.innerHTML = `
                <div class="play-container">
                    <h2>Mixology Round</h2>
                    <p class="section-desc">Select your glass, pour ingredients, and build drinks to order.</p>
                    <div id="play-content-area"></div>
                </div>
            `;
            if (typeof window.loadPlayView === 'function') {
                window.loadPlayView(panel.querySelector('#play-content-area') || panel);
            }
            break;

        case 'boss':
            panel.innerHTML = `
                <div class="boss-container">
                    <h2>The Martini Gauntlet (Boss Fight)</h2>
                    <p class="section-desc">Face off against high-pressure customer orders and tricky variations.</p>
                    <div id="boss-content-area"></div>
                </div>
            `;
            if (typeof window.loadBossView === 'function') {
                window.loadBossView(panel.querySelector('#boss-content-area') || panel);
            }
            break;

        case 'cellar':
            panel.innerHTML = `
                <div class="cellar-container">
                    <h2>Cellar Log</h2>
                    <p class="section-desc">Track your real-life bottle inventory, ingredient stock, and unlockable rewards.</p>
                    <div id="cellar-content-area"></div>
                </div>
            `;
            if (typeof window.loadCellarView === 'function') {
                window.loadCellarView(panel.querySelector('#cellar-content-area') || panel);
            }
            break;

        default:
            panel.innerHTML = `<p>View not found.</p>`;
    }
}
