/**
 * Utility Helper Functions
 * Common utility functions used throughout the application
 */

import { MONTHS_SHORT } from '../config/constants.js';

/**
 * Date & Time Utilities
 */
export function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function nowYear() {
  return new Date().getFullYear();
}

export function nowMonth() {
  return new Date().getMonth();
}

export function nowDay() {
  return new Date().getDate();
}

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function formatISO(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${parseInt(d)} ${MONTHS_SHORT[parseInt(m) - 1]} ${y}`;
}

export function dateToISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return { y, m: m - 1 };
}

export function monthLabelFromKey(key) {
  const { y, m } = parseMonthKey(key);
  return `${MONTHS_SHORT[m]} ${y}`;
}

/**
 * Number Formatting
 */
export function formatCurrency(number) {
  return '₹' + Math.round(Math.abs(number)).toLocaleString('en-IN');
}

export function formatPercentage(number) {
  return `${number > 0 ? '+' : ''}${number.toFixed(1)}%`;
}

/**
 * Color Utilities
 */
export function hexToRgba(hex, alpha) {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch (e) {
    return `rgba(136, 136, 136, ${alpha})`;
  }
}

/**
 * ID Generation
 */
export function generateUID() {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Route Helpers
 */
export function isLocalEnvironment() {
  return location.hostname === '127.0.0.1' || location.hostname === 'localhost';
}

export function getAuthPath() {
  return isLocalEnvironment() ? 'auth.html' : '/auth';
}

export function getHomePath() {
  return isLocalEnvironment() ? 'index.html' : '/';
}

/**
 * Week Utilities
 */
export function getWeekStart(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  date.setDate(d - day);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getWeekDates(weekStart) {
  const [y, m, d] = weekStart.split('-').map(Number);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(y, m - 1, d + i);
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    dates.push(`${yy}-${mm}-${dd}`);
  }
  return dates;
}

/**
 * Validation
 */
export function hasUnsavedChanges(formRows) {
  return formRows.some(r => parseFloat(r.amount) > 0);
}
