document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupNavigation();
    renderActiveView('drill'); // Default view on load
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-tabbar .nav-btn');
    
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetView = e.currentTarget.getAttribute('data-target');
            
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

    // Clear and populate based on active view to prevent empty index states
    switch (viewName) {
        case 'drill':
            panel.innerHTML = `<h2>Daily Drill</h2><p>Loading your training queue...</p>`;
            if (typeof window.loadDrillView === 'function') {
                window.loadDrillView(panel);
            }
            break;
        case 'library':
            panel.innerHTML = `<h2>Recipe Library</h2><p>Browse all available cocktail recipes.</p>`;
            if (typeof window.loadLibraryView === 'function') {
                window.loadLibraryView(panel);
            }
            break;
        case 'explore':
            panel.innerHTML = `<h2>Explore Local Discovery</h2><p>Discover cocktails by category and characteristics.</p>`;
            if (typeof window.loadExploreView === 'function') {
                window.loadExploreView(panel);
            }
            break;
        case 'play':
            panel.innerHTML = `<h2>Mixology Round</h2><p>Select your glass and prep to start pouring.</p>`;
            if (typeof window.loadPlayView === 'function') {
                window.loadPlayView(panel);
            }
            break;
        case 'boss':
            panel.innerHTML = `<h2>The Martini Gauntlet (Boss Fight)</h2><p>Defeat the boss by answering correctly.</p>`;
            if (typeof window.loadBossView === 'function') {
                window.loadBossView(panel);
            }
            break;
        case 'cellar':
            panel.innerHTML = `<h2>Cellar Log</h2><p>Track your real-life creations and purchases.</p>`;
            if (typeof window.loadCellarView === 'function') {
                window.loadCellarView(panel);
            }
            break;
        default:
            panel.innerHTML = `<p>View not found.</p>`;
    }
}
