/**
 * Application Constants
 * Centralized configuration and constant values
 */

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const PRESET_COLORS = [
  '#B5281C', '#1D4E8F', '#C4620D', '#534AB7',
  '#2D6A4F', '#8B5E3C', '#C44B8A', '#1A7A6A',
  '#7A3B1E', '#376B8A', '#8B2252', '#5A6B1B'
];

export const DEFAULT_CATEGORIES = {
  lunch: { label: 'Lunch', color: '#1D4E8F' },
  cig: { label: 'Cigarettes', color: '#B5281C' },
  snacks: { label: 'Snacks', color: '#C4620D' },
  shopping: { label: 'Shopping', color: '#C44B8A' },
  travel: { label: 'Travel', color: '#2D6A4F' },
  other: { label: 'Other', color: '#534AB7' }
};

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBgXYDJ0pVzTv1BwTiO21JYr3OVqNEHGrk",
  authDomain: "monthly-expense-tracker-18959.firebaseapp.com",
  projectId: "monthly-expense-tracker-18959",
  storageBucket: "monthly-expense-tracker-18959.firebasestorage.app",
  messagingSenderId: "242437385267",
  appId: "1:242437385267:web:ee951fc32eb80b9fb18746"
};

export const STORAGE_KEYS = {
  TRACKER_DATA: 'exp_tracker_v3',
  THEME: 'exp_theme',
  USER: 'exp_user',
  SIDEBAR_DATA: 'sb_data'
};

export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  HOME_LOCAL: 'index.html',
  AUTH_LOCAL: 'auth.html'
};
