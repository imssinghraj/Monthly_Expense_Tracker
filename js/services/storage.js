/**
 * Storage Service
 * Handles localStorage and data persistence
 */

import { STORAGE_KEYS, DEFAULT_CATEGORIES } from '../config/constants.js';
import { generateUID } from '../utils/helpers.js';

class StorageService {
  constructor() {
    this.entries = {};
    this.budgets = {};
    this.customCats = { ...DEFAULT_CATEGORIES };
    this.recurring = [];
    this.sidebarData = {};
  }

  /**
   * Load all data from localStorage
   */
  loadData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TRACKER_DATA);
      if (stored) {
        const data = JSON.parse(stored);
        this.budgets = data.budgets || {};
        
        if (data.customCats) {
          this.customCats = data.customCats;
        }
        
        if (data.recurring) {
          this.recurring = data.recurring;
        }
        
        // Handle legacy entry format
        const raw = data.entries || {};
        this.entries = {};
        
        for (const [date, val] of Object.entries(raw)) {
          if (Array.isArray(val)) {
            this.entries[date] = val;
          } else {
            // Convert old format to new
            const arr = [];
            for (const cat of Object.keys(DEFAULT_CATEGORIES)) {
              const amt = parseFloat(val[cat]) || 0;
              if (amt > 0) {
                arr.push({ id: generateUID(), cat, amount: amt });
              }
            }
            if (arr.length) {
              this.entries[date] = arr;
            }
          }
        }
      }
      
      // Load sidebar data
      const sbData = localStorage.getItem(STORAGE_KEYS.SIDEBAR_DATA);
      if (sbData) {
        this.sidebarData = JSON.parse(sbData);
      }
      
      // Initialize sidebar data structure if needed
      if (!this.sidebarData.catBudgets) {
        this.sidebarData.catBudgets = {};
      }
      if (!this.sidebarData.alertSettings) {
        this.sidebarData.alertSettings = { enabled: false, threshold: 80 };
      }
      
    } catch (e) {
      console.error('Error loading data:', e);
    }
  }

  /**
   * Save all data to localStorage
   */
  saveData() {
    try {
      const data = {
        entries: this.entries,
        budgets: this.budgets,
        customCats: this.customCats,
        recurring: this.recurring
      };
      localStorage.setItem(STORAGE_KEYS.TRACKER_DATA, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving data:', e);
    }
  }

  /**
   * Save sidebar data
   */
  saveSidebarData() {
    try {
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_DATA, JSON.stringify(this.sidebarData));
    } catch (e) {
      console.error('Error saving sidebar data:', e);
    }
  }

  /**
   * Get user from localStorage
   */
  getUser() {
    try {
      const user = localStorage.getItem(STORAGE_KEYS.USER);
      return user ? JSON.parse(user) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Save user to localStorage
   */
  saveUser(user) {
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (e) {
      console.error('Error saving user:', e);
    }
  }

  /**
   * Get theme preference
   */
  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME);
  }

  /**
   * Save theme preference
   */
  saveTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }

  /**
   * Clear all data
   */
  clearAll() {
    this.entries = {};
    this.budgets = {};
    this.customCats = { ...DEFAULT_CATEGORIES };
    this.recurring = [];
    this.sidebarData = {};
    this.saveData();
    this.saveSidebarData();
  }
}

// Export singleton instance
export const storageService = new StorageService();
