/**
 * Navbar Component
 * Renders and manages the top navigation bar
 */

import { MONTHS } from '../config/constants.js';
import { getAuthPath } from '../utils/helpers.js';
import { storageService } from '../services/storage.js';

export class Navbar {
  constructor(state) {
    this.state = state;
  }

  /**
   * Build navbar HTML
   */
  render() {
    const user = storageService.getUser();
    const { viewYear, viewMonth, activeTab, viewWeekStart } = this.state;

    const userBtn = user
      ? this.renderUserButton(user)
      : this.renderSignInButton();

    const themeBtn = this.renderThemeButton();
    const menuBtn = this.renderMenuButton();
    const bellBtn = this.renderBellButton();
    const logoHtml = this.renderLogo();

    if (activeTab === 'week') {
      return this.renderWeekNav(logoHtml, themeBtn, bellBtn, userBtn, menuBtn);
    }

    const isCurrentMonth = (viewYear === new Date().getFullYear() && viewMonth === new Date().getMonth());

    return `
      <div class="nav">
        <div class="nav-side left">
          ${logoHtml}
          <div class="nav-arrows">
            <button class="nav-btn" id="prevYearBtn" aria-label="Previous year">«</button>
            <button class="nav-btn" id="prevMonthBtn" aria-label="Previous month">‹</button>
          </div>
        </div>
        <div class="nav-center">
          <div class="nav-title">${MONTHS[viewMonth]} ${viewYear}</div>
          ${isCurrentMonth 
            ? '<div class="nav-sub">Current month</div>' 
            : '<button class="today-btn" id="todayBtn">Today</button>'}
        </div>
        <div class="nav-side right">
          <div class="nav-arrows">
            <button class="nav-btn" id="nextMonthBtn" aria-label="Next month">›</button>
            <button class="nav-btn" id="nextYearBtn" aria-label="Next year">»</button>
          </div>
          ${themeBtn}
          ${bellBtn}
          ${userBtn}
          ${menuBtn}
        </div>
      </div>
    `;
  }

  renderLogo() {
    return `
      <a class="nav-logo-wrap" href="/" title="Budgetra">
        <div class="nav-logo-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 18L8 14L12 16L20 8M20 8V13M20 8H15" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="8" cy="14" r="1.5" fill="white"/>
            <circle cx="12" cy="16" r="1.5" fill="white"/>
            <circle cx="20" cy="8" r="1.5" fill="white"/>
          </svg>
        </div>
        <span class="nav-logo-name">Budget<span>ra</span></span>
      </a>
    `;
  }

  renderUserButton(user) {
    return `
      <div class="menu-wrap" style="position:relative">
        <button class="nav-btn" id="userMenuBtn" title="${user.name}" 
                style="font-size:12px;font-weight:700;gap:4px;width:auto;padding:0 10px;letter-spacing:0">
          <span style="width:22px;height:22px;border-radius:50%;background:var(--text);color:var(--surface);
                       display:inline-flex;align-items:center;justify-content:center;font-size:11px;
                       font-weight:700;flex-shrink:0">
            ${user.name.charAt(0).toUpperCase()}
          </span>
          <span style="max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${user.name}
          </span>
        </button>
      </div>
    `;
  }

  renderSignInButton() {
    return `
      <button class="nav-btn" onclick="window.location.href='${getAuthPath()}'" 
              style="font-size:12px;font-weight:600;width:auto;padding:0 12px">
        Sign In
      </button>
    `;
  }

  renderThemeButton() {
    const isDark = document.documentElement.classList.contains('dark');
    return `
      <button class="theme-toggle" id="themeToggleBtn" 
              title="${isDark ? 'Switch to light mode' : 'Switch to dark mode'}">
        ${isDark ? '☀️' : '🌙'}
      </button>
    `;
  }

  renderMenuButton() {
    return `
      <div class="menu-wrap">
        <button class="nav-btn" id="menuBtn" title="More options" style="font-size:18px;letter-spacing:1px">
          ⋮
        </button>
      </div>
    `;
  }

  renderBellButton() {
    // Bell button logic would go here
    // For now, return empty string
    return '';
  }

  renderWeekNav(logoHtml, themeBtn, bellBtn, userBtn, menuBtn) {
    // Week navigation logic would go here
    return `
      <div class="nav">
        <div class="nav-side left">${logoHtml}</div>
        <div class="nav-center">
          <div class="nav-title">Week View</div>
        </div>
        <div class="nav-side right">
          ${themeBtn}
          ${bellBtn}
          ${userBtn}
          ${menuBtn}
        </div>
      </div>
    `;
  }
}
