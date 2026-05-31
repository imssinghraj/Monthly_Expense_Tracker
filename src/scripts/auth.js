import {
  getAuthClient,
  loginWithEmail,
  loginWithProvider,
  registerWithEmail,
  resetPassword,
  toSessionUser,
  watchAuthState
} from '../services/auth-service.js';

const auth = getAuthClient();

// ── Theme ──
const _savedTheme = localStorage.getItem('exp_theme');
let darkMode = _savedTheme === 'dark' || _savedTheme === 'light'
  ? _savedTheme === 'dark'
  : (new Date().getHours() >= 18 || new Date().getHours() < 6);
function applyTheme() {
  document.documentElement.classList.toggle('dark', darkMode);
  document.getElementById('themeToggle').textContent = darkMode ? '☀️' : '🌙';
}
applyTheme();
document.getElementById('themeToggle').addEventListener('click', () => {
  darkMode = !darkMode;
  localStorage.setItem('exp_theme', darkMode ? 'dark' : 'light');
  applyTheme();
});

// ── If already signed in, redirect (only if not just signed out) ──
watchAuthState(user => {
  if (user && !sessionStorage.getItem('exp_signed_out')) {
    localStorage.setItem('exp_user', JSON.stringify(toSessionUser(user)));
    window.location.href = location.hostname==='127.0.0.1'||location.hostname==='localhost' ? 'index.html' : '/';
  }
  sessionStorage.removeItem('exp_signed_out');
});

// ── Tab switching ──
let currentTab = 'login';
window.switchTab = function(tab) {
  currentTab = tab;
  const isReg = tab === 'register';
  document.getElementById('tabLogin').classList.toggle('active', !isReg);
  document.getElementById('tabRegister').classList.toggle('active', isReg);
  document.getElementById('formHeading').textContent   = isReg ? 'Create your account' : 'Welcome back';
  document.getElementById('formSub').textContent       = isReg ? 'Start tracking your expenses for free.' : 'Sign in to your account to continue tracking expenses.';
  document.getElementById('submitText').textContent    = isReg ? 'Create Account' : 'Sign In';
  document.getElementById('nameFields').style.display  = isReg ? '' : 'none';
  document.getElementById('confirmField').style.display= isReg ? '' : 'none';
  document.getElementById('forgotLink').style.display  = isReg ? 'none' : 'block';
  document.getElementById('termsText').style.display   = isReg ? 'block' : 'none';
  document.getElementById('strengthWrap').classList.remove('show');
  document.getElementById('footerText').innerHTML = isReg
    ? 'Already have an account? <a href="#" onclick="switchTab(\'login\');return false">Sign in</a>'
    : 'Don\'t have an account? <a href="#" onclick="switchTab(\'register\');return false">Create one free</a>';
  document.getElementById('password').autocomplete = isReg ? 'new-password' : 'current-password';
  document.getElementById('emailErr').textContent = 'Enter a valid email address';
  document.getElementById('passwordErr').textContent = 'Password must be at least 8 characters';
  clearErrors();
};

// ── Password toggle ──
window.togglePw = function(inputId, btnId) {
  const inp = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
};

// ── Password strength ──
document.getElementById('password').addEventListener('input', function() {
  if (currentTab !== 'register') return;
  const val = this.value;
  const wrap = document.getElementById('strengthWrap');
  if (!val) { wrap.classList.remove('show'); return; }
  wrap.classList.add('show');
  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const colors = ['var(--red)','var(--orange)','#C4A020','var(--green)'];
  const labels = ['Weak','Fair','Good','Strong'];
  for (let i = 1; i <= 4; i++) {
    document.getElementById('sb'+i).style.background = i <= score ? colors[score-1] : 'var(--border)';
  }
  document.getElementById('strengthLabel').textContent = labels[score-1] || 'Weak';
  document.getElementById('strengthLabel').style.color = colors[score-1] || 'var(--muted)';
});

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(e => e.classList.remove('show'));
  document.querySelectorAll('.field input').forEach(e => e.classList.remove('error'));
}
function showError(fieldId, errId, msg) {
  const inp = document.getElementById(fieldId);
  const err = document.getElementById(errId);
  if (inp) inp.classList.add('error');
  if (err) { if (msg) err.textContent = msg; err.classList.add('show'); }
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
function showSuccess(isReg, name) {
  document.getElementById('formBody').style.display = 'none';
  const s = document.getElementById('successState');
  s.classList.add('show');
  document.getElementById('successTitle').textContent = isReg ? `Welcome, ${name}!` : `Welcome back, ${name}!`;
  document.getElementById('successMsg').textContent = isReg
    ? 'Your account is ready. Taking you to the dashboard…'
    : 'Signed in successfully. Taking you to the dashboard…';
  // onAuthStateChanged will redirect automatically
}

function validate() {
  clearErrors();
  let ok = true;
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (currentTab === 'register' && !document.getElementById('firstName').value.trim()) {
    showError('firstName', 'firstNameErr'); ok = false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('email', 'emailErr'); ok = false;
  }
  if (password.length < 8) {
    showError('password', 'passwordErr'); ok = false;
  }
  if (currentTab === 'register' && document.getElementById('confirmPassword').value !== password) {
    showError('confirmPassword', 'confirmErr'); ok = false;
  }
  return ok;
}

// ── Email/Password submit ──
document.getElementById('authForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!validate()) return;
  const btn = document.getElementById('submitBtn');
  btn.classList.add('loading');
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const isReg    = currentTab === 'register';
  try {
    if (isReg) {
      const name = document.getElementById('firstName').value.trim();
      const cred = await registerWithEmail({ email, password, name });
      showSuccess(true, name);
    } else {
      const cred = await loginWithEmail({ email, password });
      const name = cred.user.displayName || email.split('@')[0];
      showSuccess(false, name);
    }
  } catch(err) {
    btn.classList.remove('loading');
    const code = err.code;
    if (code === 'auth/email-already-in-use')
      showError('email', 'emailErr', 'An account with this email already exists');
    else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/invalid-email')
      showError('email', 'emailErr', 'No account found with this email');
    else if (code === 'auth/wrong-password')
      showError('password', 'passwordErr', 'Incorrect password');
    else if (code === 'auth/too-many-requests')
      showToast('Too many attempts. Try again later.');
    else if (code === 'auth/configuration-not-found' || code === 'auth/api-key-not-valid')
      showToast('Firebase not configured yet. See setup instructions.');
    else
      showToast(err.message || 'Authentication failed');
  }
});

// ── Social auth ──
window.socialAuth = async function(provider) {
  const btn = provider === 'google' ? document.getElementById('googleBtn') : document.getElementById('githubBtn');
  btn.disabled = true; btn.style.opacity = '0.6';
  try {
    const result = await loginWithProvider(provider);
    const u = result.user;
    showSuccess(false, u.displayName || u.email.split('@')[0]);
  } catch(err) {
    btn.disabled = false; btn.style.opacity = '';
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
    if (err.code === 'auth/account-exists-with-different-credential')
      showToast('Account exists with a different sign-in method');
    else if (err.code === 'auth/configuration-not-found' || err.code === 'auth/api-key-not-valid')
      showToast('Firebase not configured yet. See setup instructions.');
    else
      showToast(err.message || 'Sign-in failed');
  }
};

// ── Forgot password ──
window.forgotPassword = async function(e) {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  if (!email) { showError('email', 'emailErr'); return; }
  try {
    await resetPassword(email);
    showToast('Password reset email sent!');
  } catch(err) {
    showToast(err.message || 'Failed to send reset email');
  }
};
