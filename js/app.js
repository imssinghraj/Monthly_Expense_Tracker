/**
 * Main Application Controller
 * Initializes and coordinates all app components
 */

import { storageService } from './services/storage.js';
import { firebaseService } from './services/firebase.js';
import { Navbar } from './components/navbar.js';
import { nowYear, nowMonth, today, getWeekStart } from './utils/helpers.js';

class App {
  constructor() {
    // Application state
    this.state = {
      viewYear: nowYear(),
      viewMonth: nowMonth(),
      viewWeekStart: getWeekStart(today()),
      activeTab: 'month',
      heatmapYear: nowYear(),
      compareMonthKey: '',
      formRows: [{ cat: 'lunch', amount: '', notes: '', rec: false, payMethod: 'upi' }],
      formDate: '',
      darkMode: false
    };

    // Component instances
    this.navbar = new Navbar(this.state);
  }

  /**
   * Initialize the application
   */
  async init() {
    // Initialize theme
    this.initTheme();

    // Load data from storage
    storageService.loadData();

    // Initialize Firebase in background
    firebaseService.init().then(() => {
      this.syncWithFirestore();
    });

    // Initial render
    this.render();

    // Bind global event listeners
    this.bindGlobalEvents();
  }

  /**
   * Initialize theme
   */
  initTheme() {
    const saved = storageService.getTheme();
    
    if (saved === 'dark' || saved === 'light') {
      this.state.darkMode = saved === 'dark';
    } else {
      // Auto: dark from 6pm to 6am
      const h = new Date().getHours();
      this.state.darkMode = h >= 18 || h < 6;
    }
    
    this.applyTheme();
  }

  /**
   * Apply theme to document
   */
  applyTheme() {
    document.documentElement.classList.toggle('dark', this.state.darkMode);
  }

  /**
   * Toggle theme
   */
  toggleTheme() {
    this.state.darkMode = !this.state.darkMode;
    storageService.saveTheme(this.state.darkMode ? 'dark' : 'light');
    this.applyTheme();
    this.render();
  }

  /**
   * Sync with Firestore
   */
  async syncWithFirestore() {
    const data = await firebaseService.loadFromFirestore();
    
    if (data) {
      storageService.budgets = data.budgets || {};
      if (data.customCats) storageService.customCats = data.customCats;
      if (data.recurring) storageService.recurring = data.recurring;
      
      const raw = data.entries || {};
      storageService.entries = {};
      
      for (const [date, val] of Object.entries(raw)) {
        if (Array.isArray(val)) {
          storageService.entries[date] = val;
        }
      }
      
      storageService.saveData();
      this.render();
    }
  }

  /**
   * Main render function
   */
  render() {
    // Render navbar
    const navArea = document.getElementById('navArea');
    if (navArea) {
      navArea.innerHTML = this.navbar.render();
    }

    // Render tabs
    const tabsArea = document.getElementById('tabsArea');
    if (tabsArea) {
      tabsArea.innerHTML = this.renderTabs();
    }

    // Render main content based on active tab
    const mainArea = document.getElementById('mainArea');
    if (mainArea) {
      mainArea.innerHTML = this.renderMainContent();
    }

    // Bind event listeners
    this.bindEvents();
  }

  /**
   * Render tabs
   */
  renderTabs() {
    const { activeTab } = this.state;
    
    return `
      <div class="tabs">
        <button class="tab ${activeTab === 'month' ? 'active' : ''}" id="tabMonth">Home</button>
        <button class="tab ${activeTab === 'week' ? 'active' : ''}" id="tabWeek">Week Overview</button>
        <button class="tab ${activeTab === 'year' ? 'active' : ''}" id="tabYear">Year Summary</button>
        <button class="tab ${activeTab === 'insights' ? 'active' : ''}" id="tabInsights">Insights</button>
      </div>
    `;
  }

  /**
   * Render main content
   */
  renderMainContent() {
    const { activeTab } = this.state;
    
    switch (activeTab) {
      case 'month':
        return this.renderMonthView();
      case 'week':
        return this.renderWeekView();
      case 'year':
        return this.renderYearView();
      case 'insights':
        return this.renderInsightsView();
      default:
        return '<div>Loading...</div>';
    }
  }

  /**
   * Render month view
   */
  renderMonthView() {
    return `
      <div class="dashboard-grid">
        <div class="dashboard-primary">
          <div class="section-title">MONTHLY OVERVIEW</div>
          <div class="stats">
            <div class="stat">
              <div class="stat-lbl">TODAY'S SPEND</div>
              <div class="stat-val">₹0</div>
              <div class="stat-sub">No expenses yet</div>
            </div>
            <div class="stat">
              <div class="stat-lbl">REMAINING TODAY</div>
              <div class="stat-val">—</div>
              <div class="stat-sub">Set a budget first</div>
            </div>
            <div class="stat">
              <div class="stat-lbl">UPDATED DAILY BUDGET</div>
              <div class="stat-val">—</div>
              <div class="stat-sub">Set a budget first</div>
            </div>
            <div class="stat">
              <div class="stat-lbl">NET SAVED / OVERSPENT</div>
              <div class="stat-val">—</div>
              <div class="stat-sub">Pending month completion</div>
            </div>
          </div>
        </div>
        <div class="dashboard-secondary">
          <div class="section-title">QUICK ACTIONS</div>
        </div>
      </div>
    `;
  }

  /**
   * Render week view
   */
  renderWeekView() {
    return '<div>Week view coming soon...</div>';
  }

  /**
   * Render year view
   */
  renderYearView() {
    return '<div>Year view coming soon...</div>';
  }

  /**
   * Render insights view
   */
  renderInsightsView() {
    return '<div>Insights view coming soon...</div>';
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Theme toggle
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Tab navigation
    const tabMonth = document.getElementById('tabMonth');
    const tabWeek = document.getElementById('tabWeek');
    const tabYear = document.getElementById('tabYear');
    const tabInsights = document.getElementById('tabInsights');

    if (tabMonth) tabMonth.addEventListener('click', () => this.switchTab('month'));
    if (tabWeek) tabWeek.addEventListener('click', () => this.switchTab('week'));
    if (tabYear) tabYear.addEventListener('click', () => this.switchTab('year'));
    if (tabInsights) tabInsights.addEventListener('click', () => this.switchTab('insights'));

    // Month navigation
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const prevYearBtn = document.getElementById('prevYearBtn');
    const nextYearBtn = document.getElementById('nextYearBtn');
    const todayBtn = document.getElementById('todayBtn');

    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => this.navigateMonth(-1));
    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => this.navigateMonth(1));
    if (prevYearBtn) prevYearBtn.addEventListener('click', () => this.navigateYear(-1));
    if (nextYearBtn) nextYearBtn.addEventListener('click', () => this.navigateYear(1));
    if (todayBtn) todayBtn.addEventListener('click', () => this.goToToday());
  }

  /**
   * Bind global event listeners
   */
  bindGlobalEvents() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' && e.ctrlKey) {
        this.navigateMonth(-1);
      } else if (e.key === 'ArrowRight' && e.ctrlKey) {
        this.navigateMonth(1);
      }
    });
  }

  /**
   * Switch active tab
   */
  switchTab(tab) {
    this.state.activeTab = tab;
    this.render();
  }

  /**
   * Navigate months
   */
  navigateMonth(delta) {
    this.state.viewMonth += delta;
    
    if (this.state.viewMonth < 0) {
      this.state.viewMonth = 11;
      this.state.viewYear--;
    } else if (this.state.viewMonth > 11) {
      this.state.viewMonth = 0;
      this.state.viewYear++;
    }
    
    this.render();
  }

  /**
   * Navigate years
   */
  navigateYear(delta) {
    this.state.viewYear += delta;
    this.render();
  }

  /**
   * Go to today
   */
  goToToday() {
    this.state.viewYear = nowYear();
    this.state.viewMonth = nowMonth();
    this.render();
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
  });
} else {
  const app = new App();
  app.init();
}

export default App;
