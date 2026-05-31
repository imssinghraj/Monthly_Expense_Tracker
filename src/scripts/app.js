/* ── CONSTANTS ───────────────────────────────────── */
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PRESET_COLORS = [
  '#B5281C','#1D4E8F','#C4620D','#534AB7',
  '#2D6A4F','#8B5E3C','#C44B8A','#1A7A6A',
  '#7A3B1E','#376B8A','#8B2252','#5A6B1B',
];
const DEFAULT_CATS = {
  lunch:    { label:'Lunch',      color:'#1D4E8F' },
  cig:      { label:'Cigarettes', color:'#B5281C' },
  snacks:   { label:'Snacks',     color:'#C4620D' },
  shopping: { label:'Shopping',   color:'#C44B8A' },
  travel:   { label:'Travel',     color:'#2D6A4F' },
  other:    { label:'Other',      color:'#534AB7' },
};

/* ── STATE ───────────────────────────────────────── */
let entries = {}, budgets = {}, customCats = {...DEFAULT_CATS}, recurring = [], noExpenseDays = {};
// Initialize sbData early so budget modal can access it before sidebar JS runs
let sbData = JSON.parse(localStorage.getItem('sb_data')||'{}');
if(!sbData.catBudgets) sbData.catBudgets={};
if(!sbData.alertSettings) sbData.alertSettings={enabled:false,threshold:80};
function defaultPaymentMethod(){ return sbData.payMethod || 'upi'; }
let viewYear, viewMonth, viewWeekStart, activeTab = 'month';
let formRows = [{ cat:'lunch', amount:'', notes:'', rec:false, payMethod:defaultPaymentMethod() }];
let formDate = '';
let heatmapYear;
let compareMonthKey = '';
let darkMode = false;

/* ── DARK MODE ───────────────────────────────────── */
function initTheme(){
  const saved = localStorage.getItem('exp_theme');
  if(saved === 'dark' || saved === 'light'){
    darkMode = saved === 'dark';
  } else {
    // Auto: dark from 6pm to 6am, light otherwise
    const h = new Date().getHours();
    darkMode = h >= 18 || h < 6;
  }
  applyTheme();
}
function toggleTheme(){
  darkMode = !darkMode;
  localStorage.setItem('exp_theme', darkMode ? 'dark' : 'light');
  applyTheme();
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = darkMode ? '☀️' : '🌙';
    btn.title = darkMode ? 'Switch to light mode' : 'Switch to dark mode';
  });
}
function applyTheme(){
  document.documentElement.classList.toggle('dark', darkMode);
}

/* ── PERSISTENCE ─────────────────────────────────── */
let _db = null, _fbUid = null;

async function initFirebase(){
  try{
    const { firebaseConfig } = await import('../firebase/config.js');
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore, doc, setDoc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    _db = getFirestore(app);
    const auth = getAuth(app);
    // Get current user uid
    await new Promise(resolve => {
      const unsub = onAuthStateChanged(auth, user => {
        if(user){ _fbUid = user.uid; }
        unsub(); resolve();
      });
    });
  }catch(e){ console.warn('Firebase init failed', e); }
}

function loadData(){
  try{
    const s = localStorage.getItem('exp_tracker_v3');
    if(s){
      const d = JSON.parse(s);
      budgets = d.budgets || {};
      if(d.customCats) customCats = d.customCats;
      if(d.recurring) recurring = d.recurring;
      noExpenseDays = d.noExpenseDays || {};
      const raw = d.entries || {};
      entries = {};
      for(const [date, val] of Object.entries(raw)){
        if(Array.isArray(val)){
          entries[date] = val;
          if(val._noExpense) noExpenseDays[date] = true;
        } else if(val && val._noExpense){
          noExpenseDays[date] = true;
        } else {
          const arr = [];
          for(const cat of Object.keys(DEFAULT_CATS)){
            const amt = parseFloat(val[cat]) || 0;
            if(amt > 0) arr.push({ id: uid(), cat, amount: amt });
          }
          if(arr.length) entries[date] = arr;
        }
      }
    }
  }catch(e){}
  viewYear = nowYear(); viewMonth = nowMonth();
  viewWeekStart = getWeekStart(today());
  heatmapYear = nowYear();
}

async function loadFromFirestore(){
  if(!_db || !_fbUid) return;
  try{
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDoc(doc(_db, 'users', _fbUid));
    if(snap.exists()){
      const d = snap.data();
      budgets = d.budgets || {};
      if(d.customCats) customCats = d.customCats;
      if(d.recurring) recurring = d.recurring;
      noExpenseDays = d.noExpenseDays || {};
      const raw = d.entries || {};
      entries = {};
      for(const [date, val] of Object.entries(raw)){
        if(Array.isArray(val)) entries[date] = val;
        else if(val && val._noExpense) noExpenseDays[date] = true;
      }
      // Update localStorage cache
      localStorage.setItem('exp_tracker_v3', JSON.stringify({entries, budgets, customCats, recurring, noExpenseDays}));
      render();
    }
  }catch(e){ console.warn('Firestore load failed', e); }
}

function saveData(){
  // Save to localStorage immediately (fast)
  try{ localStorage.setItem('exp_tracker_v3', JSON.stringify({entries, budgets, customCats, recurring, noExpenseDays})); }catch(e){}
  // Save to Firestore in background (cross-device sync)
  if(_db && _fbUid){
    import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').then(({doc, setDoc})=>{
      setDoc(doc(_db,'users',_fbUid), {entries, budgets, customCats, recurring, noExpenseDays}).catch(e=>console.warn('Firestore save failed',e));
    });
  }
}
function uid(){ return Math.random().toString(36).slice(2,9); }

/* ── ALERT HELPERS ───────────────────────────────── */
function getAlertId(a){ return `${a.cat}-${a.type}`; }
function getAlerts(includeRead=false){
  if(sbData.alertSettings?.enabled!==true) return [];
  const threshold=sbData.alertSettings?.threshold||80;
  const spent=monthCatTotals(viewYear,viewMonth);
  const readSet=new Set(sbData.readAlerts||[]);
  const alerts=[];
  Object.entries(sbData.catBudgets||{}).forEach(([k,limit])=>{
    if(!(limit>0)) return;
    const c=customCats[k];
    if(!c) return;
    const s=spent[k]||0;
    const pct=(s/limit)*100;
    let type=null;
    if(s>=limit) type='over';
    else if(pct>=threshold) type='near';
    if(!type) return;
    const id=`${k}-${type}`;
    if(!includeRead&&readSet.has(id)) return;
    alerts.push({id,type,cat:k,label:c.label,color:c.color,spent:s,limit,pct:Math.round(pct)});
  });
  return alerts;
}
function markAllAlertsRead(){
  const all=getAlerts(true); // get all including already-read
  if(!sbData.readAlerts) sbData.readAlerts=[];
  all.forEach(a=>{ if(!sbData.readAlerts.includes(a.id)) sbData.readAlerts.push(a.id); });
  saveSbData();
  render(); // re-render nav badge + home banner
}

/* ── UTILS ───────────────────────────────────────── */
// Detect local vs Vercel — use .html extension locally, clean URLs on Vercel
function authPath(){ return location.hostname==='127.0.0.1'||location.hostname==='localhost'?'auth.html':'/auth'; }
function homePath(){ return location.hostname==='127.0.0.1'||location.hostname==='localhost'?'index.html':'/'; }
function today(){ const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function nowYear(){ return new Date().getFullYear(); }
function nowMonth(){ return new Date().getMonth(); }
function nowDay(){ return new Date().getDate(); }
function daysInMonth(y,m){ return new Date(y,m+1,0).getDate(); }
function monthKey(y,m){ return `${y}-${String(m+1).padStart(2,'0')}`; }
function fmtISO(y,m,d){ return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function fmtDate(iso){ const [y,m,d]=iso.split('-'); return `${parseInt(d)} ${MONTHS_S[parseInt(m)-1]} ${y}`; }
function fmt(n){ return '₹'+Math.round(Math.abs(n)).toLocaleString('en-IN'); }
function fmtPct(n){ return `${n>0?'+':''}${n.toFixed(1)}%`; }
function dayTotal(iso){ return (entries[iso]||[]).reduce((s,e)=>s+e.amount,0); }
function isRentCat(cat){ return (customCats[cat]&&customCats[cat].label||'').toLowerCase()==='rent'; }
function dayTotalExcluding(iso,excludeCats){ return (entries[iso]||[]).filter(e=>!excludeCats.includes(e.cat)).reduce((s,e)=>s+e.amount,0); }
function dayTotalExcludingRent(iso){ return (entries[iso]||[]).filter(e=>!isRentCat(e.cat)).reduce((s,e)=>s+e.amount,0); }
function isNoExpenseDay(iso){ return noExpenseDays[iso] === true; }
function markNoExpenseDay(iso){ delete entries[iso]; noExpenseDays[iso] = true; }
function clearNoExpenseDay(iso){ delete noExpenseDays[iso]; }
function monthDates(y,m){
  const p=monthKey(y,m);
  const dates=new Set([
    ...Object.keys(entries).filter(k=>k.startsWith(p)&&(entries[k]||[]).length>0),
    ...Object.keys(noExpenseDays).filter(k=>k.startsWith(p)&&isNoExpenseDay(k))
  ]);
  return [...dates].sort((a,b)=>b.localeCompare(a));
}
function monthSpent(y,m){ return monthDates(y,m).reduce((s,k)=>s+dayTotal(k),0); }
function parseMonthKey(key){ const [y,m] = key.split('-').map(Number); return { y, m: m - 1 }; }
function monthLabelFromKey(key){ const {y,m} = parseMonthKey(key); return `${MONTHS_S[m]} ${y}`; }
function getMonthBudget(y,m){
  const raw=budgets[monthKey(y,m)];
  if(!raw) return null;
  // Support both old plain number and new object format
  return typeof raw==='object'?raw.amount:raw;
}
function getBudgetDays(y,m){
  const raw=budgets[monthKey(y,m)];
  if(!raw) return daysInMonth(y,m);
  if(typeof raw==='object') return raw.daysConsidered;
  // Legacy plain number: use full month days
  return daysInMonth(y,m);
}
function getBudgetRange(y,m){
  const raw=budgets[monthKey(y,m)];
  const fallback={start:new Date(y,m,1),end:new Date(y,m,daysInMonth(y,m)),days:daysInMonth(y,m)};
  if(!raw||typeof raw!=='object') return fallback;
  const start=new Date(raw.startYear??y,raw.startMonth??m,raw.startDay??1);
  const end=new Date(raw.endYear??y,raw.endMonth??m,raw.endDay??daysInMonth(y,m));
  return {start,end,days:raw.daysConsidered||fallback.days};
}
function inclusiveDays(start,end){
  const ms=24*60*60*1000;
  return Math.max(0,Math.floor((end-start)/ms)+1);
}
function budgetElapsedDays(y,m){
  const range=getBudgetRange(y,m);
  const cap=(y===nowYear()&&m===nowMonth())?new Date(nowYear(),nowMonth(),nowDay()):range.end;
  const end=cap<range.end?cap:range.end;
  return Math.min(range.days,inclusiveDays(range.start,end));
}
function budgetDaysLeft(y,m){
  if(!(y===nowYear()&&m===nowMonth())) return 0;
  const range=getBudgetRange(y,m);
  const current=new Date(nowYear(),nowMonth(),nowDay());
  if(current>range.end) return 0;
  const start=current>range.start?current:range.start;
  return Math.min(range.days,inclusiveDays(start,range.end));
}
function dailyLimit(y,m){ const b=getMonthBudget(y,m); return b?b/getBudgetDays(y,m):null; }
function daysLeft(y,m){ return (y===nowYear()&&m===nowMonth())?Math.max(0,daysInMonth(y,m)-nowDay()+1):0; }
function monthCatTotals(y,m){
  const t={};
  Object.keys(customCats).forEach(k=>{ t[k]=0; });
  monthDates(y,m).forEach(iso=>(entries[iso]||[]).forEach(e=>{ t[e.cat]=(t[e.cat]||0)+e.amount; }));
  return t;
}
function netSavedOverspent(y,m){
  const budget=getMonthBudget(y,m);
  if(!budget) return {value:null, pending:false};
  const isCurrentMonth=(y===nowYear()&&m===nowMonth());
  if(isCurrentMonth) return {value:null, pending:true};
  // Completed month: budget - total expenditure (excluding rent)
  const spent=monthDates(y,m).reduce((s,k)=>s+dayTotalExcludingRent(k),0);
  return {value:budget-spent, pending:false};
}
function dateToISO(dt){ return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; }
function getHeatmapYears(){
  const current = nowYear();
  return [current, current - 1, current - 2];
}
function statusFor(spent,limit){
  if(!limit||!spent) return{label:'',cls:''};
  const p=spent/limit;
  if(p<1) return{label:'Saved',cls:'pill-saved'};
  if(p===1) return{label:'OK',cls:'pill-ok'};
  if(p<=1.25) return{label:'High',cls:'pill-high'};
  return{label:'Over',cls:'pill-over'};
}
function computeStreak(){
  if(!Object.keys(entries).length&&!Object.keys(noExpenseDays).length) return{current:0,best:0};

  const allKeys=[...new Set([
    ...Object.keys(entries).filter(k=>(entries[k]||[]).length>0),
    ...Object.keys(noExpenseDays).filter(k=>isNoExpenseDay(k))
  ])].sort();
  if(!allKeys.length) return{current:0,best:0};

  const startISO=allKeys[0];
  const endISO=today();

  // Build every calendar day from first entry to today
  const days=[];
  const cur=new Date(startISO+'T00:00:00');
  const end=new Date(endISO+'T00:00:00');
  while(cur<=end){
    const iso=`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
    days.push(iso);
    cur.setDate(cur.getDate()+1);
  }

  function isUnderLimit(iso){
    const[y,m]=iso.split('-').map(Number);
    const dl=dailyLimit(y,m-1);
    if(!dl) return null; // no budget — skip day
    const dayEntries=entries[iso];
    // No entry at all — streak breaks
    if(isNoExpenseDay(iso)) return true;
    if(!dayEntries) return false;
    // Explicitly marked as no-expense — counts as ₹0, under limit
    // Has entries — check if under limit
    return dayTotal(iso)<dl;
  }

  // ── Best streak ──
  let best=0,streak=0;
  days.forEach(iso=>{
    const result=isUnderLimit(iso);
    if(result===null) return; // skip no-budget days
    if(result){ streak++; if(streak>best) best=streak; }
    else streak=0;
  });

  // ── Current streak: count backwards from today ──
  let current=0;
  for(let i=days.length-1;i>=0;i--){
    const result=isUnderLimit(days[i]);
    if(result===null) continue; // skip no-budget days
    if(result) current++;
    else break;
  }

  return{current,best};
}
function momChange(y,m){
  const curr=monthSpent(y,m);
  let pm=m-1,py=y; if(pm<0){pm=11;py--;}
  const prev=monthSpent(py,pm);
  if(!prev) return null; // can't divide by zero
  return ((curr-prev)/prev*100);
}
function getWeekStart(iso){
  // Parse date parts directly to avoid timezone issues
  const [y,m,d]=iso.split('-').map(Number);
  const date=new Date(y,m-1,d);
  const day=date.getDay(); // 0=Sun,1=Mon,...,6=Sat
  date.setDate(d-day);     // go back to Sunday
  const yy=date.getFullYear();
  const mm=String(date.getMonth()+1).padStart(2,'0');
  const dd=String(date.getDate()).padStart(2,'0');
  return `${yy}-${mm}-${dd}`;
}
function getWeekDates(weekStart){
  const [y,m,d]=weekStart.split('-').map(Number);
  const dates=[];
  for(let i=0;i<7;i++){
    const date=new Date(y,m-1,d+i);
    const yy=date.getFullYear();
    const mm=String(date.getMonth()+1).padStart(2,'0');
    const dd=String(date.getDate()).padStart(2,'0');
    dates.push(`${yy}-${mm}-${dd}`);
  }
  return dates;
}

function getWeekOptions(){
  const weeks = [];
  const currentWeek = getWeekStart(today());
  const [cy,cm,cd] = currentWeek.split('-').map(Number);

  // Generate 12 weeks: current + 11 past (newest first)
  for(let i = 0; i >= -11; i--){
    const base = new Date(cy, cm-1, cd + (i * 7));
    const yy = base.getFullYear();
    const mm = String(base.getMonth()+1).padStart(2,'0');
    const dd = String(base.getDate()).padStart(2,'0');
    const weekStart = `${yy}-${mm}-${dd}`;

    const weekDates = getWeekDates(weekStart);
    const [sy,sm,sd] = weekDates[0].split('-').map(Number);
    const [ey,em,ed] = weekDates[6].split('-').map(Number);

    const startStr = `${sd} ${MONTHS_S[sm-1]}`;
    const endStr   = `${ed} ${MONTHS_S[em-1]} ${ey}`;
    const label = (sm === em)
      ? `${sd}-${ed} ${MONTHS_S[sm-1]} ${sy}`
      : `${startStr} – ${endStr}`;

    weeks.push({ value: weekStart, label, isCurrent: weekStart === currentWeek });
  }
  
  return weeks;
}

function hexToRgba(hex,alpha){
  try{
    const r=parseInt(hex.slice(1,3),16);
    const g=parseInt(hex.slice(3,5),16);
    const b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }catch(e){ return `rgba(136,136,136,${alpha})`; }
}
function hasUnsavedChanges(){
  return formRows.some(r=>parseFloat(r.amount)>0);
}
function navigateWithCheck(action){
  if(hasUnsavedChanges()){
    customConfirm('You have unsaved entries. Leave anyway?', action, null);
  } else {
    action();
  }
}
function getComparisonMonths(baseYear, baseMonth){
  const baseKey = monthKey(baseYear, baseMonth);
  const currentYear = nowYear();
  const currentMonth = nowMonth();
  const months = [];

  getHeatmapYears().forEach(year => {
    const maxMonth = year === currentYear ? currentMonth : 11;
    for(let month = maxMonth; month >= 0; month--){
      const key = monthKey(year, month);
      if(key !== baseKey) months.push(key);
    }
  });

  return months;
}
function getActiveComparisonKey(baseYear, baseMonth){
  const options = getComparisonMonths(baseYear, baseMonth);
  if(options.includes(compareMonthKey)) return compareMonthKey;
  const baseDate = new Date(baseYear, baseMonth, 1);
  const closest = options.reduce((best, key) => {
    const { y, m } = parseMonthKey(key);
    const diff = Math.abs(baseDate - new Date(y, m, 1));
    if(!best || diff < best.diff) return { key, diff };
    return best;
  }, null);
  return closest ? closest.key : '';
}

/* ── DATE VALIDATION ── */
function getMinAllowedDate(y, m){
  return fmtISO(y, m, 1);
}
function getMaxAllowedDate(y, m){
  const monthEnd = fmtISO(y, m, daysInMonth(y, m));
  return y === nowYear() && m === nowMonth() && monthEnd > today() ? today() : monthEnd;
}
function isDateInViewedMonth(iso){
  return typeof iso === 'string' && iso.startsWith(monthKey(viewYear, viewMonth));
}
function normalizeEntryDate(iso){
  const minDate = getMinAllowedDate(viewYear, viewMonth);
  const maxDate = getMaxAllowedDate(viewYear, viewMonth);
  if(!iso || iso < minDate) return minDate;
  if(iso > maxDate) return maxDate;
  return iso;
}
function validateEntryDate(iso){
  if(!isDateInViewedMonth(iso)){
    showToast(`Select a date in ${MONTHS[viewMonth]} ${viewYear}`);
    return false;
  }
  if(iso > today()){
    showToast("Future dates aren't allowed");
    return false;
  }
  return true;
}
function buildEntryDatePicker(){
  const maxDate = getMaxAllowedDate(viewYear, viewMonth);
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const dayCount = daysInMonth(viewYear, viewMonth);
  const blanks = Array.from({length:firstDay}, () => '<span class="entry-date-blank"></span>').join('');
  const days = Array.from({length:dayCount}, (_, idx) => {
    const day = idx + 1;
    const iso = fmtISO(viewYear, viewMonth, day);
    const disabled = iso > maxDate;
    const active = iso === formDate;
    return `<button type="button" class="entry-date-day${active?' active':''}" data-date="${iso}"${disabled?' disabled':''}>${day}</button>`;
  }).join('');

  return `<div class="entry-date-popover" id="entryDatePopover" hidden>
    <div class="entry-date-popover-head">${MONTHS[viewMonth]} ${viewYear}</div>
    <div class="entry-date-weekdays">
      <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
    </div>
    <div class="entry-date-grid">${blanks}${days}</div>
  </div>`;
}

/* ── CAT HELPERS ─────────────────────────────────── */
function catPill(cat){
  const c=customCats[cat]||{label:cat,color:'#888'};
  return `<span class="cat-pill" style="background:${hexToRgba(c.color,.12)};color:${c.color};border:1px solid ${hexToRgba(c.color,.28)}"><span class="cat-dot" style="background:${c.color}"></span>${c.label}</span>`;
}
function catOptions(selected){
  return Object.entries(customCats).map(([k,c])=>`<option value="${k}"${selected===k?' selected':''}>${c.label}</option>`).join('');
}

function adjustHistoryScroll(){
  document.querySelectorAll('.history-list-scrollable').forEach(list=>{
    const cards=[...list.children].filter(el=>el.classList.contains('day-card'));
    if(cards.length<=4) return;
    const styles=getComputedStyle(list);
    const gap=parseFloat(styles.rowGap||styles.gap)||0;
    const visibleHeight=cards.slice(0,4).reduce((sum,card)=>sum+card.getBoundingClientRect().height,0)+(gap*3);
    list.style.setProperty('max-height', `${Math.ceil(visibleHeight)}px`, 'important');
    list.style.overflowY='auto';
  });
}

/* ── RENDER ──────────────────────────────────────── */
function render(){
  document.getElementById('navArea').innerHTML  = buildNav();
  document.getElementById('tabsArea').innerHTML = buildTabs();
  document.getElementById('mainArea').innerHTML =
    activeTab==='month'?buildMonthView():
    activeTab==='week' ?buildWeekView() :
    activeTab==='year' ?buildYearView() :buildInsightsView();
  requestAnimationFrame(adjustHistoryScroll);
  setTimeout(adjustHistoryScroll,0);
  bindEvents();
  requestAnimationFrame(animateCounters);
  // Re-render sidebar sections that depend on expense data
  if(typeof renderCatBudgets==='function'&&document.getElementById('catBudgetList')) renderCatBudgets();
  if(typeof renderPaySplit==='function'&&document.getElementById('sbPaySection')?.classList.contains('open')) renderPaySplit();
}

/* ── NAV ─────────────────────────────────────────── */
function buildNav(){
  const user = JSON.parse(localStorage.getItem('exp_user') || 'null');
  const userBtn = user
    ? `<div class="menu-wrap" style="position:relative">
        <button class="nav-btn" id="userMenuBtn" type="button" title="${user.name}" aria-label="Open user menu" style="font-size:12px;font-weight:700;gap:4px;width:auto;padding:0 10px;letter-spacing:0">
          <span style="width:22px;height:22px;border-radius:50%;background:var(--text);color:var(--surface);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${user.name.charAt(0).toUpperCase()}</span>
          <span style="max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user.name}</span>
        </button>
      </div>`
    : `<button class="nav-btn" type="button" onclick="window.location.href=authPath()" style="font-size:12px;font-weight:600;width:auto;padding:0 12px">Sign In</button>`;
  const themeBtn = `<button class="theme-toggle" id="themeToggleBtn" type="button" title="${darkMode?'Switch to light mode':'Switch to dark mode'}" aria-label="${darkMode?'Switch to light mode':'Switch to dark mode'}">${darkMode?'☀️':'🌙'}</button>`;
  const menuBtn = `<div class="menu-wrap"><button class="nav-btn" id="menuBtn" type="button" title="More options" aria-label="Open more options" style="font-size:18px;letter-spacing:1px">⋮</button></div>`;
  // Bell icon — only shown when alerts explicitly enabled
  const alerts=getAlerts(); // unread alerts only
  const allAlerts=getAlerts(true); // all alerts including read
  const bellBtn=sbData.alertSettings?.enabled===true?`<div class="notif-wrap">
    <button class="notif-btn" id="notifBtn" type="button" title="Budget alerts" aria-label="Open budget alerts">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      ${alerts.length?`<span class="notif-badge">${alerts.length}</span>`:''}
    </button>
  </div>`:'';
  const logoHtml=`<a class="nav-logo-wrap" href="/" title="Budgetra">
    <div class="nav-logo-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 18L8 14L12 16L20 8M20 8V13M20 8H15" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="8" cy="14" r="1.5" fill="white"/>
        <circle cx="12" cy="16" r="1.5" fill="white"/>
        <circle cx="20" cy="8" r="1.5" fill="white"/>
      </svg>
    </div>
    <span class="nav-logo-name">Budget<span>ra</span></span>
  </a>`;
  if(activeTab==='week'){
    const dates=getWeekDates(viewWeekStart);
    const [sy,sm,sd]=dates[0].split('-');
    const [ey,em,ed]=dates[6].split('-');
    const startStr=`${parseInt(sd)} ${MONTHS_S[parseInt(sm)-1]}`;
    const endStr=`${parseInt(ed)} ${MONTHS_S[parseInt(em)-1]} ${ey}`;
    const isCurrentWeek=viewWeekStart===getWeekStart(today());
    const weekOptions = getWeekOptions();
    
    return `<div class="nav">
      <div class="nav-side left">
        ${logoHtml}
        <div class="nav-arrows">
          <button class="nav-btn" id="prevWeekBtn" type="button" aria-label="Previous week">‹</button>
        </div>
      </div>
      <div class="nav-center">
        <div class="nav-title">${startStr} – ${endStr}</div>
        ${isCurrentWeek?'<div class="nav-sub">Current week</div>':'<button class="today-btn" id="todayBtn" type="button">This week</button>'}
      </div>
      <div class="nav-side right">
        <select id="weekPicker" class="heatmap-year-select week-picker" aria-label="Select week">
          ${weekOptions.map(w => `<option value="${w.value}"${w.value===viewWeekStart?' selected':''}>${w.label}</option>`).join('')}
        </select>
        <div class="nav-arrows">
          <button class="nav-btn" id="nextWeekBtn" type="button" aria-label="Next week">›</button>
        </div>
        ${themeBtn}${bellBtn}${userBtn}${menuBtn}
      </div>
    </div>`;
  }
  const ic=(viewYear===nowYear()&&viewMonth===nowMonth());
  return `<div class="nav">
    <div class="nav-side left">
      ${logoHtml}
      <div class="nav-arrows">
        <button class="nav-btn" id="prevYearBtn" type="button" aria-label="Previous year">«</button>
        <button class="nav-btn" id="prevMonthBtn" type="button" aria-label="Previous month">‹</button>
      </div>
    </div>
    <div class="nav-center">
      <div class="nav-title">${MONTHS[viewMonth]} ${viewYear}</div>
      ${ic?'<div class="nav-sub">Current month</div>':'<button class="today-btn" id="todayBtn" type="button">Today</button>'}
    </div>
    <div class="nav-side right">
      <div class="nav-arrows">
        <button class="nav-btn" id="nextMonthBtn" type="button" aria-label="Next month">›</button>
        <button class="nav-btn" id="nextYearBtn" type="button" aria-label="Next year">»</button>
      </div>
      ${themeBtn}${bellBtn}${userBtn}${menuBtn}
    </div>
  </div>`;
}

function buildTabs(){
  return `<div class="tabs">
    <button class="tab ${activeTab==='month'?'active':''}" id="tabMonth" type="button">Home</button>
    <button class="tab ${activeTab==='week'?'active':''}" id="tabWeek" type="button">Week Overview</button>
    <button class="tab ${activeTab==='year'?'active':''}" id="tabYear" type="button">Year Summary</button>
    <button class="tab ${activeTab==='insights'?'active':''}" id="tabInsights" type="button">Insights</button>
  </div>`;
}

function buildBudgetBanner(y,m){
  const b=getMonthBudget(y,m);
  const dl=b?b/getBudgetDays(y,m):null;
  if(!b) return `<div class="budget-banner unset" id="budgetBanner">
    <div class="bb-left"><div class="bb-label">Monthly budget</div><div class="bb-val" style="color:var(--orange)">Not set</div><div class="bb-sub">Set a budget to track spending</div></div>
    <div class="bb-right"><button class="btn btn-orange btn-sm" id="setBudgetBtn">Set budget</button></div>
  </div>`;
  const bd=getBudgetDays(y,m);
  const spent=monthSpent(y,m);
  const remaining=b-spent;
  const raw=budgets[monthKey(y,m)];
  const isProrated=typeof raw==='object'&&raw.daysConsidered<daysInMonth(y,m);
  return `<div class="budget-banner" id="budgetBanner">
    <div class="bb-left">
      <div class="bb-label">Monthly budget - ${MONTHS_S[m]} ${y}</div>
      <div class="bb-val">${fmt(b)}</div>
      <div class="bb-sub">${bd} budget days${isProrated?` · day ${raw.startDay}-${daysInMonth(y,m)}`:''}</div>
    </div>
    <div class="budget-summary-kpis">
      <div class="budget-summary-item"><span>Target</span><strong>${fmt(b)}</strong></div>
      <div class="budget-summary-item"><span>Spent</span><strong>${fmt(spent)}</strong></div>
      <div class="budget-summary-item"><span>Daily plan</span><strong>${fmt(dl)}</strong></div>
      <div class="budget-summary-item ${remaining>=0?'is-positive':'is-negative'}"><span>Remaining</span><strong>${remaining>=0?fmt(remaining):fmt(remaining)+' over'}</strong></div>
    </div>
    <div class="bb-right"><button class="btn btn-ghost btn-sm" id="editBudgetBtn">Edit</button></div>
  </div>`;
}

/* ── MONTH VIEW ──────────────────────────────────── */
function buildMonthView(){
  const budget=getMonthBudget(viewYear,viewMonth);
  const budgetDays=budget?getBudgetDays(viewYear,viewMonth):0;
  const dl=budget&&budgetDays?budget/budgetDays:null;
  const mt=monthSpent(viewYear,viewMonth);
  const ic=(viewYear===nowYear()&&viewMonth===nowMonth());
  const mr=budget?budget-mt:null;
  const pct=budget?Math.min(100,(mt/budget)*100):0;
  const left=budget?budgetDaysLeft(viewYear,viewMonth):daysLeft(viewYear,viewMonth);
  const tdISO=today();
  const budgetRange=budget?getBudgetRange(viewYear,viewMonth):null;
  const budgetStartISO=budgetRange?`${budgetRange.start.getFullYear()}-${String(budgetRange.start.getMonth()+1).padStart(2,'0')}-${String(budgetRange.start.getDate()).padStart(2,'0')}`:monthKey(viewYear,viewMonth)+'-01';
  const budgetEndISO=budgetRange?`${budgetRange.end.getFullYear()}-${String(budgetRange.end.getMonth()+1).padStart(2,'0')}-${String(budgetRange.end.getDate()).padStart(2,'0')}`:`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(daysInMonth(viewYear,viewMonth)).padStart(2,'0')}`;

  // ── Rent exclusion (fixed committed expense, excluded from daily budget calc) ──
  const rentSpentThisMonth=monthDates(viewYear,viewMonth).reduce((s,k)=>
    s+(entries[k]||[]).filter(e=>isRentCat(e.cat)).reduce((a,e)=>a+e.amount,0),0);

  // ── Discretionary budget = total budget minus rent already paid ──
  const discretionaryBudget=budget?budget-rentSpentThisMonth:null;

  // ── Spend before today (excl. rent) — fixed at midnight, doesn't change during the day ──
  const spentBeforeToday=budget?Object.keys(entries)
    .filter(k=>k.startsWith(monthKey(viewYear,viewMonth))&&k>=budgetStartISO&&k<=budgetEndISO&&k<tdISO)
    .reduce((s,k)=>s+dayTotalExcludingRent(k),0):0;

  // ── Today's spend (excl. rent) — real-time ──
  const tdRaw=(ic&&(entries[tdISO]||[]).length)?dayTotal(tdISO):null;
  const tdNoRent=(ic&&(entries[tdISO]||[]).length)?dayTotalExcludingRent(tdISO):null;
  const td=tdRaw;
  const todaySpendNoRent=tdNoRent||0;

  // ── Today's limit: fixed at start of day (midnight calculation) ──
  // = discretionary budget remaining before today / days left including today
  const todayLimit=(discretionaryBudget&&left>0)?(discretionaryBudget-spentBeforeToday)/left:dl;

  // ── UDB logic ──
  // Normal: UDB = todayLimit (fixed for the day, refreshes at midnight)
  // Overspending: UDB recalculates in real-time to show damage to future days
  const isOverspendingToday=todaySpendNoRent>(todayLimit||0);
  let udb;
  if(!budget||!left){
    udb=null;
  } else if(isOverspendingToday){
    // Real-time: spread remaining discretionary budget over days AFTER today
    const remainingAfterToday=discretionaryBudget-spentBeforeToday-todaySpendNoRent;
    const daysAfterToday=Math.max(0,left-1);
    udb=daysAfterToday>0?remainingAfterToday/daysAfterToday:Math.max(0,remainingAfterToday);
  } else {
    // Fixed for today = todayLimit
    udb=todayLimit;
  }

  // ── Burn rate for UDB subtitle ──
  const daysLogged=monthDates(viewYear,viewMonth).length;
  const elapsedBudgetDays=budget?Math.max(1,budgetElapsedDays(viewYear,viewMonth)):daysLogged;
  const actualDailyAvg=elapsedBudgetDays>0?(mt-rentSpentThisMonth)/elapsedBudgetDays:0;
  const burnRateRatio=todayLimit>0?actualDailyAvg/todayLimit:0;
  const projectedTotal=rentSpentThisMonth+(actualDailyAvg*(budgetDays||daysInMonth(viewYear,viewMonth)));
  const projectedOverrun=budget?projectedTotal-budget:null;

  // ── Remaining today ──
  const tr=todayLimit!==null?(todayLimit-todaySpendNoRent):null;
  const {value:dns, pending:dnsPending}=netSavedOverspent(viewYear,viewMonth);
  const mom=momChange(viewYear,viewMonth);
  const categoryHtml=buildCategoryBreakdown(viewYear,viewMonth);
  const recurringHtml=buildRecurringSection();
  const formHtml=buildForm();
  const comparisonHtml=buildMonthComparison(viewYear,viewMonth);
  const historyHtml=buildHistory(viewYear,viewMonth);

  const dayLimitValue=todayLimit||dl||0;
  const todayStatus=td!==null?statusFor(todaySpendNoRent,dayLimitValue):null;
  const todayPctRaw=dayLimitValue?(todaySpendNoRent/dayLimitValue)*100:0;
  const todayPct=Math.min(100,todayPctRaw);
  const remainingToday=tr!==null?tr:dayLimitValue;
  const remainingPct=dayLimitValue?Math.min(100,(Math.max(0,remainingToday)/dayLimitValue)*100):0;
  const daysAfterToday=Math.max(0,left-1);
  const updatedDailyBudget=udb===null?null:Math.max(0,udb);
  const udbPct=dayLimitValue&&updatedDailyBudget!==null?Math.min(100,(updatedDailyBudget/dayLimitValue)*100):0;
  const monthPctRaw=budget?(mt/budget)*100:null;
  const monthPctLabel=budget?`${Math.round(monthPctRaw)}% used`:'No budget';
  const monthRemainingLabel=budget?(mr>=0?`${fmt(mr)} left`:`${fmt(mr)} over`):'Set a budget';
  const projectedNet=budget?budget-projectedTotal:null;
  const projectedNetLabel=projectedNet===null?'Set budget':projectedNet>=0?`${fmt(projectedNet)} projected saved`:`${fmt(projectedNet)} projected over`;
  const netValue=dnsPending
    ?(projectedNet===null?'—':`${projectedNet>=0?'+':'-'}${fmt(Math.abs(projectedNet))}`)
    :(dns===null?'—':`${dns>=0?'+':'-'}${fmt(Math.abs(dns))}`);
  const netTone=dnsPending?(projectedNet===null?'':projectedNet>=0?'green':'red'):(dns===null?'':dns>=0?'green':'red');
  const netSub=dnsPending?'Projected at current pace':dns===null?'Set a budget to track':dns>=0?'Saved after month close':'Overspent after month close';
  const paceLabel=dayLimitValue?`${Math.round(burnRateRatio*100)}% of plan`:'No pace';
  const monthTone=budget&&monthPctRaw>100?'metric-card--red':budget&&monthPctRaw>85?'metric-card--amber':'metric-card--blue';
  const monthBadgeTone=budget&&monthPctRaw>100?'metric-badge--red':budget&&monthPctRaw>85?'metric-badge--amber':'metric-badge--blue';
  const momBadge=mom!==null?`<span class="mom-badge metric-badge ${mom>0?'metric-badge--amber':mom<0?'metric-badge--green':'metric-badge--blue'}">${mom>0?'Up':mom<0?'Down':'Stable'} ${Math.abs(mom).toFixed(0)}% vs last mo.</span>`:'';

  let s=`<div class="stats dashboard-kpis metric-card-grid section-block"><div class="stat stat-kpi kpi-card metric-card ${monthTone}">
    <div class="kpi-head">
      <div>
        <div class="stat-lbl">Monthly spend</div>
        <div class="kpi-caption">${ic?`Day ${nowDay()} of ${daysInMonth(viewYear,viewMonth)}`:`${MONTHS_S[viewMonth]} ${viewYear}`}</div>
      </div>
      ${momBadge||`<span class="kpi-badge metric-badge ${monthBadgeTone}">${monthPctLabel}</span>`}
    </div>
    <div class="kpi-card-body">
      <div class="kpi-main">
        <div class="stat-val">${fmt(mt)}</div>
        ${budget?`<div class="stat-sub">against ${fmt(budget)} monthly budget</div>`:'<div class="stat-sub kpi-warn">No monthly budget set</div>'}
      </div>
      ${budget?`<div class="kpi-progress-block">
        <div class="prog-meta kpi-progress-head"><span>${monthPctLabel}</span><span>${monthRemainingLabel}</span></div>
        <div class="prog-bg"><div class="prog-fill" style="width:${pct}%;background:${monthPctRaw>100?'var(--red)':monthPctRaw>85?'var(--orange)':'var(--blue)'}"></div></div>
      </div>
      <div class="kpi-mini-grid kpi-mini-grid-3">
        <div class="kpi-mini"><span>Target</span><strong>${fmt(budget)}</strong></div>
        <div class="kpi-mini"><span>Daily plan</span><strong>${fmt(dl||0)}</strong></div>
        <div class="kpi-mini"><span>${ic?'Remaining':'Result'}</span><strong>${monthRemainingLabel}</strong></div>
      </div>`:`<div class="kpi-mini-grid kpi-mini-grid-2">
        <div class="kpi-mini"><span>Days logged</span><strong>${monthDates(viewYear,viewMonth).length}</strong></div>
        <div class="kpi-mini"><span>Average spend</span><strong>${fmt(monthDates(viewYear,viewMonth).length?mt/monthDates(viewYear,viewMonth).length:0)}</strong></div>
      </div>`}
    </div>
  </div>`;

  if(ic&&budget){
    s+=`
    <div class="stat stat-kpi kpi-card metric-card ${td!==null?(todaySpendNoRent>dayLimitValue*1.25?'metric-card--red':todaySpendNoRent>dayLimitValue?'metric-card--amber':todaySpendNoRent>0&&todaySpendNoRent<dayLimitValue?'metric-card--green':'metric-card--blue'):'metric-card--blue'}">
      <div class="kpi-head"><div><div class="stat-lbl">Today's spend</div><div class="kpi-caption">Discretionary pace</div></div>${td!==null&&todayStatus.label?`<span class="pill metric-badge ${todaySpendNoRent>dayLimitValue?'metric-badge--amber':'metric-badge--green'}">${todayStatus.label}</span>`:'<span class="kpi-badge metric-badge metric-badge--blue">No entry</span>'}</div>
      <div class="kpi-card-body">
        <div class="kpi-main"><div class="stat-val">${td!==null?fmt(td):'—'}</div><div class="stat-sub">${fmt(todaySpendNoRent)} counted vs limit</div></div>
        <div class="kpi-progress-block"><div class="prog-meta kpi-progress-head"><span>${Math.round(todayPctRaw)}% used</span><span>${fmt(dayLimitValue)} limit</span></div><div class="prog-bg"><div class="prog-fill" style="width:${todayPct}%;background:${todayPctRaw>100?'var(--red)':todayPctRaw>80?'var(--orange)':'var(--green)'}"></div></div></div>
      </div>
      <div class="kpi-mini-grid kpi-mini-grid-3">
        <div class="kpi-mini"><span>Target</span><strong>${fmt(dayLimitValue)}</strong></div>
        <div class="kpi-mini"><span>Daily plan</span><strong>${fmt(dl||0)}</strong></div>
        <div class="kpi-mini"><span>Remaining</span><strong>${fmt(Math.max(0,remainingToday))}</strong></div>
      </div>
    </div>
    <div class="stat stat-kpi kpi-card metric-card ${tr!==null&&tr<0?'metric-card--red':tr!==null&&tr<dayLimitValue*.3?'metric-card--amber':'metric-card--green'}">
      <div class="kpi-head"><div><div class="stat-lbl">Remaining today</div><div class="kpi-caption">${left>1?`${left} days left`:left===1?'Last day':'Month ended'}</div></div><span class="kpi-badge metric-badge ${remainingToday>=0?'metric-badge--green':'metric-badge--red'}">${remainingToday>=0?'On track':'Over'}</span></div>
      <div class="kpi-card-body">
        <div class="kpi-main"><div class="stat-val">${fmt(Math.max(0,remainingToday))}</div><div class="stat-sub">${remainingToday>=0?'available before reset':`${fmt(remainingToday)} above limit`}</div></div>
        <div class="kpi-progress-block"><div class="prog-meta kpi-progress-head"><span>${Math.round(remainingPct)}% unused</span><span>${fmt(dayLimitValue)} limit</span></div><div class="prog-bg"><div class="prog-fill" style="width:${remainingPct}%;background:${remainingToday<0?'var(--red)':remainingToday<dayLimitValue*.3?'var(--orange)':'var(--green)'}"></div></div></div>
        <div class="kpi-mini-grid kpi-mini-grid-3">
          <div class="kpi-mini"><span>Target</span><strong>${fmt(dayLimitValue)}</strong></div>
          <div class="kpi-mini"><span>Daily plan</span><strong>${fmt(dl||0)}</strong></div>
          <div class="kpi-mini"><span>Remaining</span><strong>${fmt(Math.max(0,remainingToday))}</strong></div>
        </div>
      </div>
    </div>
    <div class="stat stat-kpi kpi-card metric-card ${netTone==='green'?'metric-card--green':netTone==='red'?'metric-card--red':'metric-card--gray'}">
      <div class="kpi-head"><div><div class="stat-lbl">Net saved / overspent</div><div class="kpi-caption">${dnsPending?'Live projection':'Closed month'}</div></div><span class="kpi-badge metric-badge ${dnsPending?'metric-badge--gray':netTone==='green'?'metric-badge--green':netTone==='red'?'metric-badge--red':'metric-badge--gray'}">${dnsPending?'Projected':'Final'}</span></div>
      <div class="kpi-card-body">
        <div class="kpi-main"><div class="stat-val">${netValue}</div><div class="stat-sub">${netSub}</div></div>
        <div class="kpi-progress-block"><div class="prog-meta kpi-progress-head"><span>${dnsPending?'Projected':'Final'}</span><span>${projectedNetLabel}</span></div><div class="prog-bg"><div class="prog-fill" style="width:${budget?Math.min(100,Math.abs(projectedNet||dns||0)/budget*100):0}%;background:${netTone==='green'?'var(--green)':netTone==='red'?'var(--red)':'#9CA3AF'}"></div></div></div>
        <div class="kpi-mini-grid kpi-mini-grid-3">
          <div class="kpi-mini"><span>Target</span><strong>${fmt(budget)}</strong></div>
          <div class="kpi-mini"><span>Daily plan</span><strong>${fmt(dl||0)}</strong></div>
          <div class="kpi-mini"><span>Remaining</span><strong>${netValue}</strong></div>
        </div>
      </div>
    </div>
    <div class="stat stat-kpi kpi-card metric-card ${isOverspendingToday?'metric-card--amber':'metric-card--blue'}">
      <div class="kpi-head"><div><div class="stat-lbl">Updated daily budget</div><div class="kpi-caption">Future-day allowance</div></div><span class="kpi-badge metric-badge ${isOverspendingToday?'metric-badge--amber':'metric-badge--blue'}">${isOverspendingToday?'Repriced':'Stable'}</span></div>
      <div class="kpi-card-body">
        <div class="kpi-main"><div class="stat-val">${updatedDailyBudget===null?'—':fmt(updatedDailyBudget)}</div><div class="stat-sub">${isOverspendingToday?'Adjusted after overspend':'Fixed for today'}</div></div>
        <div class="kpi-progress-block"><div class="prog-meta kpi-progress-head"><span>${paceLabel}</span><span>${daysAfterToday} future days</span></div><div class="prog-bg"><div class="prog-fill" style="width:${udbPct}%;background:${isOverspendingToday?'var(--orange)':'var(--blue)'}"></div></div></div>
      </div>
      <div class="kpi-mini-grid kpi-mini-grid-3">
        <div class="kpi-mini"><span>Target</span><strong>${fmt(dayLimitValue)}</strong></div>
        <div class="kpi-mini"><span>Daily plan</span><strong>${fmt(updatedDailyBudget||0)}</strong></div>
        <div class="kpi-mini"><span>Remaining</span><strong>${fmt(Math.max(0,discretionaryBudget-spentBeforeToday-todaySpendNoRent))}</strong></div>
      </div>
    </div>`;
  } else if(!ic&&budget){
    const dr=monthDates(viewYear,viewMonth).length;
    const avg=dr>0?mt/dr:0;
    s+=`
    <div class="stat stat-kpi kpi-card ${dns===null?'':dns>=0?'green':'red'}">
      <div class="kpi-head"><div><div class="stat-lbl">Net saved / overspent</div><div class="kpi-caption">Closed month</div></div><span class="kpi-badge ${dns===null?'neutral':dns>=0?'green':'red'}">Final</span></div>
      <div class="kpi-card-body">
        <div class="kpi-main"><div class="stat-val">${dns===null?'—':(dns>=0?'+':'-')+fmt(Math.abs(dns))}</div><div class="stat-sub">${dns===null?'No budget set':dns>=0?'saved this month':'overspent this month'}</div></div>
        <div class="kpi-mini-grid kpi-mini-grid-2"><div class="kpi-mini"><span>Spent</span><strong>${fmt(mt)}</strong></div><div class="kpi-mini"><span>Budget</span><strong>${fmt(budget)}</strong></div></div>
      </div>
    </div>
    <div class="stat stat-kpi kpi-card blue">
      <div class="kpi-head"><div><div class="stat-lbl">Avg per day</div><div class="kpi-caption">Recorded activity</div></div><span class="kpi-badge blue">${dr} days</span></div>
      <div class="kpi-card-body"><div class="kpi-main"><div class="stat-val">${fmt(avg)}</div><div class="stat-sub">${dr} days recorded</div></div><div class="kpi-footer"><span>Daily budget</span><strong>${fmt(dl||0)}</strong></div></div>
    </div>`;
  } else if(ic&&!budget){
    const dr=monthDates(viewYear,viewMonth).length;
    const avg=dr>0?mt/dr:0;
    s+=`
    <div class="stat stat-kpi kpi-card blue">
      <div class="kpi-head"><div><div class="stat-lbl">Avg per day</div><div class="kpi-caption">Current month</div></div><span class="kpi-badge blue">${dr} days</span></div>
      <div class="kpi-card-body"><div class="kpi-main"><div class="stat-val">${fmt(avg)}</div><div class="stat-sub">based on recorded days</div></div><div class="kpi-footer"><span>Total spend</span><strong>${fmt(mt)}</strong></div></div>
    </div>
    <div class="stat stat-kpi kpi-card">
      <div class="kpi-head"><div><div class="stat-lbl">Days logged</div><div class="kpi-caption">Budget insights locked</div></div><span class="kpi-badge neutral">Setup</span></div>
      <div class="kpi-card-body"><div class="kpi-main"><div class="stat-val">${dr}</div><div class="stat-sub">Set a budget to unlock limits, projections, and net savings</div></div></div>
    </div>
    <div class="budget-nudge-card kpi-nudge" id="budgetNudgeCard">
      <div class="bnc-icon">💡</div>
      <div class="bnc-body">
        <div id="budgetNudgeText" class="bnc-title"></div>
        <div class="bnc-sub">Set a budget to unlock full insights</div>
      </div>
      <button class="bnc-btn" id="budgetNudgeBtn">Set Budget</button>
    </div>`;
  }
  s+='</div>';
  return `
    <div class="dashboard-shell">
      <div class="dashboard-budget-strip section-block">${buildBudgetBanner(viewYear,viewMonth)}</div>
      ${s}
      <div class="dashboard-main-grid section-block">
        <section class="dashboard-trend-panel">
          ${comparisonHtml}
        </section>
        <aside class="dashboard-action-stack">
          ${formHtml}
          ${recurringHtml||''}
        </aside>
      </div>
      <div class="dashboard-lower-grid section-block">
        <section class="dashboard-category-panel">
          <div class="cat-insight-row">
            ${categoryHtml}
            <div class="cat-insight-box" id="catInsightBox" style="display:none">
              <div id="catInsightText" style="transition:opacity .3s ease"></div>
              <div style="display:flex;gap:5px;margin-top:auto;flex-shrink:0;padding-top:8px" id="catInsightDots"></div>
            </div>
          </div>
        </section>
        <section class="dashboard-history-card cat-chart">
          ${historyHtml}
        </section>
      </div>
    </div>`;
}

function buildMonthComparison(y,m){
  const currentKey = monthKey(y,m);
  const currentSpent = monthSpent(y,m);
  const compareKey = getActiveComparisonKey(y,m);
  compareMonthKey = compareKey;
  const { y: compareYear, m: compareMonth } = parseMonthKey(compareKey);
  const previousSpent = monthSpent(compareYear, compareMonth);
  const diff = currentSpent - previousSpent;
  const pct = previousSpent > 0 ? (diff / previousSpent) * 100 : null;
  const tone = diff > 0 ? 'red' : diff < 0 ? 'green' : 'blue';
  const summary = pct === null
    ? (previousSpent === 0 && currentSpent === 0 ? 'No spending in either month' : 'No baseline to calculate change')
    : `${fmtPct(pct)} ${pct >= 0 ? 'vs' : 'from'} ${monthLabelFromKey(compareKey)}`;

  // Build daily cumulative data for both months
  function dailyCumulative(yr, mo) {
    const days = new Date(yr, mo + 1, 0).getDate();
    const data = [];
    let cum = 0;
    for (let d = 1; d <= days; d++) {
      const iso = `${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      cum += dayTotal(iso);
      data.push(cum);
    }
    return data;
  }

  const curData  = dailyCumulative(y, m);
  const cmpData  = dailyCumulative(compareYear, compareMonth);
  const maxDays  = Math.max(curData.length, cmpData.length);
  const maxVal   = Math.max(...curData, ...cmpData, 1);

  // SVG dimensions
  const W = 260, H = 180, PL = 38, PR = 8, PT = 8, PB = 22;
  const gW = W - PL - PR, gH = H - PT - PB;

  function toX(i, total) { return PL + (i / (total - 1 || 1)) * gW; }
  function toY(v) { return PT + gH - (v / maxVal) * gH; }

  function makePath(data, color, dashed) {
    if (!data.length) return '';
    const pts = data.map((v, i) => `${toX(i, data.length).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
    const d = 'M ' + pts.split(' ').join(' L ');
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${dashed?' stroke-dasharray="5,3"':''} opacity="0.9"/>`;
  }

  function makeArea(data, color) {
    if (!data.length) return '';
    const pts = data.map((v, i) => `${toX(i, data.length).toFixed(1)},${toY(v).toFixed(1)}`);
    const d = `M ${pts.join(' L ')} L ${toX(data.length-1, data.length).toFixed(1)},${(PT+gH).toFixed(1)} L ${PL},${(PT+gH).toFixed(1)} Z`;
    return `<path d="${d}" fill="${color}" opacity="0.08"/>`;
  }

  // Y-axis ticks
  const ticks = [0, 0.5, 1].map(t => {
    const v = Math.round(maxVal * t);
    const yp = toY(v).toFixed(1);
    return `<line x1="${PL}" y1="${yp}" x2="${W-PR}" y2="${yp}" stroke="var(--border)" stroke-width="1"/>
            <text class="cmp-axis-label" x="${PL-4}" y="${yp}" text-anchor="end" dominant-baseline="middle">₹${v>=1000?(v/1000).toFixed(1)+'k':v}</text>`;
  }).join('');

  // X-axis day labels
  const xLabels = [1, Math.ceil(maxDays/2), maxDays].map(d => {
    const x = toX(d-1, maxDays).toFixed(1);
    return `<text class="cmp-axis-label" x="${x}" y="${H-4}" text-anchor="middle">${d}</text>`;
  }).join('');

  const curColor = '#3B82F6';
  const cmpColor = '#94A3B8';

  // Show chart when either month has expenses
  const hasExpenses = currentSpent > 0 || previousSpent > 0;
  const showChart = hasExpenses;

  // SVG with smooth curves and gradient fills
  function makeSmoothPath(data, color, dashed) {
    if (data.length < 2) return '';
    let d = `M ${toX(0, data.length).toFixed(1)},${toY(data[0]).toFixed(1)}`;
    for (let i = 1; i < data.length; i++) {
      const x0 = toX(i-1, data.length), y0 = toY(data[i-1]);
      const x1 = toX(i,   data.length), y1 = toY(data[i]);
      const cx = (x0 + x1) / 2;
      d += ` C ${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"${dashed?' stroke-dasharray="6,4"':''} opacity="0.95"/>`;
  }

  function makeSmoothArea(data, gradId) {
    if (data.length < 2) return '';
    let d = `M ${toX(0, data.length).toFixed(1)},${toY(data[0]).toFixed(1)}`;
    for (let i = 1; i < data.length; i++) {
      const x0 = toX(i-1, data.length), y0 = toY(data[i-1]);
      const x1 = toX(i,   data.length), y1 = toY(data[i]);
      const cx = (x0 + x1) / 2;
      d += ` C ${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
    d += ` L ${toX(data.length-1, data.length).toFixed(1)},${(PT+gH).toFixed(1)} L ${PL},${(PT+gH).toFixed(1)} Z`;
    return `<path d="${d}" fill="url(#${gradId})" opacity="1"/>`;
  }

  const svgChart = `
    <svg class="cmp-svg" viewBox="0 0 ${W} ${H}" height="${H}" style="overflow:visible">
      <defs>
        <linearGradient id="gradCur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${curColor}" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="${curColor}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="gradCmp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${cmpColor}" stop-opacity="0.10"/>
          <stop offset="100%" stop-color="${cmpColor}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${ticks}
      ${xLabels}
      ${makeSmoothArea(cmpData, 'gradCmp')}
      ${makeSmoothArea(curData, 'gradCur')}
      ${makeSmoothPath(cmpData, cmpColor, true)}
      ${makeSmoothPath(curData, curColor, false)}
      ${curData.length ? `<circle cx="${toX(curData.length-1,curData.length).toFixed(1)}" cy="${toY(curData[curData.length-1]).toFixed(1)}" r="4" fill="${curColor}" stroke="var(--surface)" stroke-width="2"/>` : ''}
      ${cmpData.length ? `<circle cx="${toX(cmpData.length-1,cmpData.length).toFixed(1)}" cy="${toY(cmpData[cmpData.length-1]).toFixed(1)}" r="3.5" fill="${cmpColor}" stroke="var(--surface)" stroke-width="2"/>` : ''}
    </svg>`;

  const chartSection = showChart ? `
    <div class="cmp-chart-wrap">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div class="cmp-chart-title" style="margin-bottom:0">Cumulative spend</div>
        <div class="cmp-chart-legend">
          <span class="cmp-legend-item"><span class="cmp-legend-line" style="background:${curColor};border-radius:2px"></span>${monthLabelFromKey(currentKey)}</span>
          <span class="cmp-legend-item"><span class="cmp-legend-line" style="background:transparent;border-bottom:2.5px dashed ${cmpColor}"></span>${monthLabelFromKey(compareKey)}</span>
        </div>
      </div>
      ${svgChart}
    </div>` : `<div style="display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;text-align:center;padding:28px 20px">
      Add some expenses to see the comparison chart
    </div>`;

  // Stat cards with trend indicators
  const trendIcon = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
  const trendColor = diff > 0 ? 'var(--red)' : diff < 0 ? 'var(--green)' : 'var(--muted)';

  return `<div class="cat-chart${!showChart ? ' stretch' : ''}">
    <div class="history-header" style="margin-bottom:16px">
      <div class="section-title" style="margin-bottom:0">Spending trend</div>
      <select id="compareMonthSelect" class="heatmap-year-select" aria-label="Select comparison month">
        ${getComparisonMonths(y,m).map(key => `<option value="${key}"${key===compareKey?' selected':''}>${monthLabelFromKey(key)}</option>`).join('')}
      </select>
    </div>

    <!-- Spend summary row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
      <div class="stat blue" style="position:relative;overflow:hidden;border-left:3px solid var(--blue)">
        <div class="stat-lbl">${monthLabelFromKey(currentKey)}</div>
        <div class="stat-val" style="font-size:24px">${fmt(currentSpent)}</div>
        <div class="stat-sub">Selected month</div>
      </div>
      <div class="stat" style="position:relative;overflow:hidden;border-left:3px solid var(--border)">
        <div class="stat-lbl">${monthLabelFromKey(compareKey)}</div>
        <div class="stat-val" style="font-size:24px">${fmt(previousSpent)}</div>
        <div class="stat-sub">Comparison month</div>
      </div>
    </div>

    <!-- Diff + pct row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:0">
      <div class="stat ${tone}" style="border-left:3px solid ${diff>0?'var(--red)':diff<0?'var(--green)':'var(--border)'}">
        <div class="stat-lbl">Difference</div>
        <div class="stat-val" style="font-size:20px;display:flex;align-items:center;gap:5px">
          <span style="font-size:16px;color:${trendColor};font-weight:900">${trendIcon}</span>
          ${diff===0?'₹0':`${diff>0?'+':'-'}${fmt(Math.abs(diff))}`}
        </div>
        <div class="stat-sub">${summary}</div>
      </div>
      <div class="stat ${pct===null?'':tone}" style="border-left:3px solid ${pct===null?'var(--border)':diff>0?'var(--red)':diff<0?'var(--green)':'var(--border)'}">
        <div class="stat-lbl">% change</div>
        <div class="stat-val" style="font-size:20px">${pct===null?'—':fmtPct(pct)}</div>
        <div class="stat-sub">${pct===null?'Need comparison data':diff>0?'Increase':diff<0?'Decrease':'No change'}</div>
      </div>
    </div>

    ${chartSection}
  </div>`;
}

function buildCategoryBreakdown(y,m){
  const dates=monthDates(y,m);
  if(!dates.length) return '';
  const t=monthCatTotals(y,m);
  const total=Object.values(t).reduce((a,b)=>a+b,0);
  if(!total) return `<div class="cat-chart category-card category-empty-card">
    <div class="category-card-head">
      <div>
        <div class="section-title">Category breakdown</div>
        <div class="category-card-title">No category spend yet</div>
      </div>
    </div>
    <div class="category-empty-state">
      <div class="category-empty-icon">%</div>
      <div>
        <strong>No expenses logged for this month</strong>
        <span>Add an expense and Budgetra will build your category mix automatically.</span>
      </div>
    </div>
  </div>`;

  // Find top category
  const entries=Object.entries(customCats).map(([k,c])=>({k,c,amt:t[k]||0})).filter(x=>x.amt>0).sort((a,b)=>b.amt-a.amt);
  const top=entries[0];
  const topPct=top?Math.round(top.amt/total*100):0;
  const catCount=entries.length;
  const topThreeTotal=entries.slice(0,3).reduce((sum,x)=>sum+x.amt,0);
  const concentration=Math.round((topThreeTotal/total)*100);

  // Insight text
  const insights=[
    `<strong>${top?top.c.label:'—'}</strong> is your top spend at ${topPct}% of total.`,
    `Spending across <strong>${catCount}</strong> categor${catCount===1?'y':'ies'} this month.`,
    entries.length>1?`<strong>${entries[entries.length-1].c.label}</strong> is your lowest spend.`:`Only <strong>${top?top.c.label:'—'}</strong> logged so far.`,
  ];

  let offset=0;
  const donutSegments=entries.map(({c,amt})=>{
    const pct=amt/total*100;
    const start=offset;
    offset+=pct;
    return `${c.color} ${start.toFixed(2)}% ${offset.toFixed(2)}%`;
  }).join(',');

  const barsHtml=entries.map(({k,c,amt},idx)=>{
    const pct=Math.round(amt/total*100);
    const insight=idx===0?'Top category':idx===entries.length-1&&entries.length>1?'Lowest category':`${pct}% of spend`;
    return `<div class="category-row" style="--cat-color:${c.color};--cat-pct:${pct}%">
      <div class="category-rank">${idx+1}</div>
      <div class="category-main">
        <div class="category-label-line">
          <span class="category-color"></span>
          <span class="category-name">${c.label}</span>
          <span class="category-meta">${insight}</span>
        </div>
        <div class="category-progress" aria-label="${c.label} ${pct}%"><span></span></div>
      </div>
      <div class="category-values">
        <strong>${fmt(amt)}</strong>
        <span>${pct}%</span>
      </div>
    </div>`;
  }).join('');

  return `<div class="cat-chart category-card">
    <div class="category-card-head">
      <div>
        <div class="section-title">Category breakdown</div>
        <div class="category-card-title">${catCount} categor${catCount===1?'y':'ies'} tracked</div>
      </div>
      <div class="category-total">
        <span>Total spend</span>
        <strong>${fmt(total)}</strong>
      </div>
    </div>

    <div class="category-analytics">
      <div class="category-donut-wrap">
        <div class="category-donut" style="background:conic-gradient(${donutSegments})">
          <div class="category-donut-hole">
            <strong>${topPct}%</strong>
            <span>${top?top.c.label:'Top'}</span>
          </div>
        </div>
        <div class="category-insight">${insights[0]}</div>
      </div>

      <div class="category-list">
        ${barsHtml}
      </div>
    </div>

    <div class="category-card-foot">
      <span>${entries.length===1?'Single category month':`Top 3 categories make up ${concentration}% of spend`}</span>
      <strong>${fmt(total/catCount)} avg/category</strong>
    </div>
  </div>`;
}

/* ── RECURRING SECTION ───────────────────────────── */
function buildRecurringSection(){
  if(!recurring.length) return '';
  return `<div class="recurring-section">
    <div class="section-title">Recurring</div>
    <div class="recurring-list">
      ${recurring.map(r=>`<div class="recurring-item">
        ${catPill(r.cat)}
        ${r.notes?`<span class="rec-note-text">${r.notes}</span>`:''}
        <span class="entry-spacer"></span>
        <span class="rec-amt">${fmt(r.amount)}</span>
        <div class="entry-actions">
          <button class="icon-btn" data-rid="${r.id}" id="logRec-${r.id}" title="Log for current form date">Log</button>
          <button class="icon-btn del del-rec" data-rid="${r.id}" title="Delete template">✕</button>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

/* ── FORM ────────────────────────────────────────── */
function buildForm(){
  if(!formDate){
    if(viewYear===nowYear()&&viewMonth===nowMonth()) formDate=today();
    else formDate=fmtISO(viewYear,viewMonth,daysInMonth(viewYear,viewMonth));
  }
  formDate = normalizeEntryDate(formDate);
  const maxDate = getMaxAllowedDate(viewYear, viewMonth);
  const minDate = getMinAllowedDate(viewYear, viewMonth);
  const total=formRows.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const rowsHtml=formRows.map((r,i)=>buildFormBlock(r,i,i===0)).join('');
  return `<div class="form-card expense-form-card" id="formCard">
    <div class="form-card-head"><span class="section-title" style="margin-bottom:0">Quick add expense</span></div>
    <div class="date-row">
      <span class="date-disp" id="formDateDisp">${fmtDate(formDate)}</span>
      <div class="entry-date-control" id="entryDateControl">
        <input type="date" id="entryDate" value="${formDate}" max="${maxDate}" min="${minDate}" aria-label="Expense date">
        ${buildEntryDatePicker()}
      </div>
    </div>
    ${rowsHtml}
    <button class="add-row-btn" id="addRowBtn">+ Add another item</button>
    <div class="form-footer">
      <div class="live-total">Total: <strong id="liveTotal">${total>0?fmt(total):'₹0'}</strong></div>
      <div class="btns">
        <button class="btn btn-ghost btn-sm" id="noExpenseBtn" title="Mark this day as no expense — keeps your streak alive" style="color:var(--green);border-color:var(--green-bd)">✓ Mark Day as No Expense</button>
        <button class="btn btn-ghost" id="clearFormBtn">Clear</button>
        <button class="btn btn-primary" id="saveBtn">Save</button>
      </div>
    </div>
  </div>`;
}

function buildFormBlock(r,i,showLabel){
  const QUICK_AMTS=[50,100,150,200,500];
  const methods=[{id:'upi',label:'UPI'},{id:'cash',label:'Cash'},{id:'card',label:'Card'},{id:'nb',label:'Net banking'}];
  const pm=r.payMethod||'upi';
  return `<div class="entry-block" data-idx="${i}">
    <div class="entry-row">
      <div class="field">
        ${showLabel?'<label>Category &amp; Amount</label>':''}
        <select class="row-cat" data-idx="${i}">${catOptions(r.cat)}</select>
      </div>
      <div class="field">
        ${showLabel?'<label>&nbsp;</label>':''}
        <input type="number" class="row-amt" data-idx="${i}" placeholder="₹ 0" min="0" step="0.01" value="${r.amount||''}">
      </div>
      <button class="remove-row-btn" data-idx="${i}"${formRows.length===1?' style="visibility:hidden"':''}>✕</button>
    </div>
    <div class="entry-chip-row">
      <div class="pay-method-row">
        ${methods.map(m=>`<button type="button" class="pay-method-btn${pm===m.id?' active':''}" data-idx="${i}" data-method="${m.id}">${m.label}</button>`).join('')}
      </div>
      <div class="quick-amount-row">
        ${QUICK_AMTS.map(v=>`<button class="qa-btn" data-idx="${i}" data-val="${v}">₹${v}</button>`).join('')}
      </div>
    </div>
    <div class="quick-row" style="margin-top:6px">
      <label class="rec-label"><input type="checkbox" class="row-rec-chk" data-idx="${i}"${r.rec?' checked':''}> Recurring</label>
    </div>
    <div class="notes-row">
      <input type="text" class="row-note" data-idx="${i}" placeholder="Add a note (optional)..." value="${r.notes||''}">
    </div>
  </div>`;
}

/* ── HISTORY ─────────────────────────────────────── */
function buildEntryItems(iso,items){
  return items.map(e=>`<div class="entry-item" id="ei-${e.id}" data-iso="${iso}" data-eid="${e.id}">
    <span class="entry-cat-col">${catPill(e.cat)}</span>
    ${e.notes?`<span class="entry-note-badge" title="${e.notes}">${e.notes}</span>`:''}
    <span class="entry-spacer"></span>
    <span class="entry-amt">${fmt(e.amount)}</span>
    <div class="entry-actions">
      <button class="icon-btn edit-btn" data-iso="${iso}" data-eid="${e.id}">Edit</button>
      <button class="icon-btn del" data-iso="${iso}" data-eid="${e.id}">✕</button>
    </div>
    <div class="swipe-del-bg">Delete</div>
  </div>`).join('');
}

function buildHistory(y,m){
  const dl=dailyLimit(y,m);
  const dates=monthDates(y,m);
  const scrollClass=dates.length>4?' history-list-scrollable':'';
  let html=`<div class="history-header" style="margin-top:20px">
    <div class="section-title" style="margin-bottom:0">Recent transactions</div>
    ${dates.length?`<button class="btn btn-ghost btn-sm" id="clearAllBtn" style="font-size:11px;color:var(--muted)">Clear month</button>`:''}
  </div><div class="history-list${scrollClass}">`;
  if(!dates.length){
    html+=buildEmptyState('No entries yet for '+MONTHS[m]+' '+y);
  } else {
    dates.forEach(iso=>{
      const items=entries[iso]||[];
      const isNoExpense=isNoExpenseDay(iso)&&items.length===0;
      const t=dayTotal(iso);
      const saved=dl!==null?dl-t:null;
      const st=statusFor(t,dl);
      const day=parseInt(iso.split('-')[2]);
      const usedCats=[...new Set(items.map(e=>e.cat))];
      html+=`<div class="day-card" id="dc-${iso}" data-iso="${iso}">
        <div class="day-header" data-iso="${iso}">
          <div class="day-badge">${day}</div>
          <div class="day-main">
            <div class="date-str">${fmtDate(iso)}</div>
            <div class="total-str">${isNoExpense?'<span style="color:var(--green);font-size:13px">✓ No expense</span>':fmt(t)+` <span style="color:var(--muted);font-size:12px;font-weight:400">${items.length} item${items.length!==1?'s':''}</span>`}</div>
            <div class="pills-row">${usedCats.map(c=>catPill(c)).join('')}</div>
          </div>
          <div class="day-right">
            ${isNoExpense?`<span class="pill pill-saved">Streak ✓</span>`:(st.cls?`<span class="pill ${st.cls}">${st.label}</span>`:'')}
            ${!isNoExpense&&saved!==null?`<span class="saved-amt ${saved>=0?'c-green':'c-red'}">${saved>=0?'↓':'↑'} ${fmt(Math.abs(saved))}</span>`:''}
            <span class="chevron">▼</span>
          </div>
        </div>
        <div class="entry-list" id="el-${iso}" style="display:none">${isNoExpense?'<div style="padding:12px;text-align:center;color:var(--muted);font-size:13px">No expenses logged — streak maintained ✓</div>':buildEntryItems(iso,items)}</div>
      </div>`;
    });
  }
  return html+'</div>';
}

function buildEmptyState(msg){
  return `<div class="empty">
    <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="14" width="40" height="36" rx="6" stroke="currentColor" stroke-width="1.5" opacity=".3"/>
      <rect x="16" y="22" width="28" height="3" rx="1.5" fill="currentColor" opacity=".2"/>
      <rect x="16" y="29" width="20" height="3" rx="1.5" fill="currentColor" opacity=".2"/>
      <rect x="16" y="36" width="14" height="3" rx="1.5" fill="currentColor" opacity=".2"/>
    </svg>
    <div class="empty-title">${msg}</div>
    <div>Start logging to see your data here.</div>
  </div>`;
}

/* ── WEEK VIEW ───────────────────────────────────── */
function buildWeekView(){
  const dates=getWeekDates(viewWeekStart);
  const weekTotal=dates.reduce((s,iso)=>s+dayTotal(iso),0);
  let weekBudget=0;
  dates.forEach(iso=>{
    const[y,m]=iso.split('-').map(Number);
    const dl=dailyLimit(y,m-1);
    if(dl) weekBudget+=dl;
  });
  const pct=weekBudget?Math.min(100,(weekTotal/weekBudget)*100):0;
  const maxDay=Math.max(...dates.map(iso=>dayTotal(iso)),1);

  let html=`<div class="stats" style="margin-bottom:14px"><div class="stat stat-wide">
    <div class="stat-lbl">Week total</div>
    <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
      <div class="stat-val">${fmt(weekTotal)}</div>
      ${weekBudget?`<div class="stat-sub">of ${fmt(weekBudget)}</div>`:'<div class="stat-sub" style="color:var(--orange)">No budget set</div>'}
    </div>
    ${weekBudget?`<div class="prog-bg"><div class="prog-fill" style="width:${pct}%;background:${pct>90?'var(--red)':pct>70?'var(--orange)':'var(--text)'}"></div></div><div class="prog-meta"><span>Sun – Sat</span><span>${Math.round(pct)}% of week budget</span></div>`:''}
  </div></div>`;

  html+=`<div class="week-bars">`;
  dates.forEach(iso=>{
    const[y,m,d]=iso.split('-');
    const t=dayTotal(iso);
    const dl2=dailyLimit(parseInt(y),parseInt(m)-1);
    const barPct=t>0?Math.max(4,(t/maxDay)*100):0;
    const color=dl2?(t>dl2*1.25?'var(--red)':t>dl2?'var(--orange)':t>0?'var(--green)':'var(--border)'):'var(--blue)';
    const isToday=iso===today();
    const dayName=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(iso+'T00:00:00').getDay()];
    html+=`<div class="week-bar-item${isToday?' today':''}">
      <div class="week-bar-amt">${t>0?fmt(t):''}</div>
      <div class="week-bar-bg"><div class="week-bar-fill" style="height:${barPct}%;background:${color}"></div></div>
      <div class="week-bar-label">${dayName}</div>
      <div class="week-bar-date">${parseInt(d)}</div>
    </div>`;
  });
  html+=`</div>`;

  const hasDates=dates.filter(iso=>(entries[iso]||[]).length>0);
  html+=`<div class="section-title" style="margin-bottom:8px">Daily breakdown</div>`;
  if(!hasDates.length){
    html+=buildEmptyState('No entries this week');
  } else {
    html+=`<div class="history-list">`;
    hasDates.slice().reverse().forEach(iso=>{
      const[y,m,d]=iso.split('-').map(Number);
      const dl2=dailyLimit(y,m-1);
      const items=entries[iso]||[];
      const t=dayTotal(iso);
      const saved=dl2!==null?dl2-t:null;
      const st=statusFor(t,dl2);
      const usedCats=[...new Set(items.map(e=>e.cat))];
      html+=`<div class="day-card" id="dc-${iso}" data-iso="${iso}">
        <div class="day-header" data-iso="${iso}">
          <div class="day-badge">${d}</div>
          <div class="day-main">
            <div class="date-str">${fmtDate(iso)}</div>
            <div class="total-str">${fmt(t)} <span style="color:var(--muted);font-size:12px;font-weight:400">${items.length} item${items.length!==1?'s':''}</span></div>
            <div class="pills-row">${usedCats.map(c=>catPill(c)).join('')}</div>
          </div>
          <div class="day-right">
            ${st.cls?`<span class="pill ${st.cls}">${st.label}</span>`:''}
            ${saved!==null?`<span class="saved-amt ${saved>=0?'c-green':'c-red'}">${saved>=0?'↓':'↑'} ${fmt(Math.abs(saved))}</span>`:''}
            <span class="chevron">▼</span>
          </div>
        </div>
        <div class="entry-list" id="el-${iso}" style="display:none">${buildEntryItems(iso,items)}</div>
      </div>`;
    });
    html+=`</div>`;
  }
  return html;
}

/* ── YEAR VIEW ───────────────────────────────────── */
function buildYearView(){
  let html='<div class="year-grid">';
  for(let m=0;m<12;m++){
    const mt=monthSpent(viewYear,m);
    const b=getMonthBudget(viewYear,m);
    const pct=b?Math.min(100,(mt/b)*100):0;
    const ic=(viewYear===nowYear()&&m===nowMonth());
    const hasData=monthDates(viewYear,m).length>0;
    const col=pct>90?'var(--red)':pct>70?'var(--orange)':'var(--blue)';
    html+=`<div class="month-card ${ic?'current-month':''}" data-month="${m}">
      <div class="mc-name">${MONTHS_S[m]}${ic?' ·':''}</div>
      ${b?`<div class="mc-budget">Budget: ${fmt(b)}</div>`:`<div class="mc-no-budget">No budget</div>`}
      <div class="mc-val" style="color:${hasData?(pct>90?'var(--red)':pct>70?'var(--orange)':'var(--green)'):'var(--muted)'}">${hasData?fmt(mt):'—'}</div>
      <div class="mc-sub">${b&&hasData?`${Math.round(pct)}% of budget`:hasData?'Spent':'No data'}</div>
      ${b&&hasData?`<div class="mc-bar"><div class="mc-fill" style="width:${pct}%;background:${col}"></div></div>`:''}
    </div>`;
  }
  html+='</div>';
  const ys=Array.from({length:12},(_,m)=>monthSpent(viewYear,m)).reduce((a,b)=>a+b,0);
  const yb=Array.from({length:12},(_,m)=>getMonthBudget(viewYear,m)||0).reduce((a,b)=>a+b,0);
  const ynet=yb-ys;
  const mt=Array.from({length:12},(_,m)=>monthDates(viewYear,m).length>0).filter(Boolean).length;
  html+=`<div class="insight-row">
    <div class="ins-card"><div class="ins-val">${fmt(ys)}</div><div class="ins-lbl">Total spent ${viewYear}</div></div>
    <div class="ins-card"><div class="ins-val" style="color:${yb?(ynet>=0?'var(--green)':'var(--red)'):'var(--muted)'}">${yb?(ynet>=0?'+':'')+fmt(ynet):'—'}</div><div class="ins-lbl">Net vs budget</div></div>
    <div class="ins-card"><div class="ins-val">${mt}</div><div class="ins-lbl">Months tracked</div></div>
  </div>`;
  return html;
}

/* ── INSIGHTS VIEW ───────────────────────────────── */
function buildInsightsView(){
  const allDates=Object.keys(entries).filter(k=>(entries[k]||[]).length>0).sort();
  const hm=buildHeatmap(heatmapYear);
  if(!allDates.length) return hm+`<div class="empty">No expense data yet. Start logging to see insights.</div>`;
  const at={};
  Object.keys(customCats).forEach(k=>{at[k]=0;});
  allDates.forEach(iso=>(entries[iso]||[]).forEach(e=>{ at[e.cat]=(at[e.cat]||0)+e.amount; }));
  const grand=Object.values(at).reduce((a,b)=>a+b,0);
  const avgDay=grand/allDates.length;
  const savedDays=allDates.filter(k=>{const[y,m]=k.split('-').map(Number);const dl=dailyLimit(y,m-1);return dl?dayTotal(k)<dl:false;}).length;
  const dwb=allDates.filter(k=>{const[y,m]=k.split('-').map(Number);return!!dailyLimit(y,m-1);}).length;
  const pctSaved=dwb?Math.round(savedDays/dwb*100):0;
  const best=allDates.reduce((a,b)=>dayTotal(a)<dayTotal(b)?a:b);
  const worst=allDates.reduce((a,b)=>dayTotal(a)>dayTotal(b)?a:b);
  const sd=computeStreak();
  return `${hm}<div class="insight-row">
    <div class="ins-card"><div class="ins-val">${fmt(grand)}</div><div class="ins-lbl">All-time total</div></div>
    <div class="ins-card"><div class="ins-val">${fmt(avgDay)}</div><div class="ins-lbl">Avg daily spend</div></div>
    <div class="ins-card"><div class="ins-val" style="color:${pctSaved>=50?'var(--green)':'var(--orange)'}">${dwb?pctSaved+'%':'—'}</div><div class="ins-lbl">Days under limit</div></div>
  </div>
  <div class="stats" style="margin-bottom:14px">
    <div class="stat green"><div class="stat-lbl">Best day</div><div class="stat-val">${fmt(dayTotal(best))}</div><div class="stat-sub">${fmtDate(best)}</div></div>
    <div class="stat red"><div class="stat-lbl">Highest day</div><div class="stat-val">${fmt(dayTotal(worst))}</div><div class="stat-sub">${fmtDate(worst)}</div></div>
    <div class="stat blue"><div class="stat-lbl">Current streak</div><div class="stat-val">${sd.current}</div><div class="stat-sub">days under limit</div></div>
    <div class="stat purple"><div class="stat-lbl">Best streak</div><div class="stat-val">${sd.best}</div><div class="stat-sub">days under limit</div></div>
  </div>
  <div class="cat-chart"><div class="section-title">All-time category split</div>
    ${Object.entries(customCats).map(([k,c])=>{
      const amt=at[k]||0;
      if(!amt) return '';
      return `<div class="cat-row">
        <span class="cat-name">${c.label}</span>
        <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${grand?Math.round(amt/grand*100):0}%;background:${c.color}"></div></div>
        <span class="cat-amt">${fmt(amt)} <span style="color:var(--muted);font-weight:400">(${grand?Math.round(amt/grand*100):0}%)</span></span>
      </div>`;
    }).join('')}
  </div>
  <div class="section-title" style="margin-top:14px">Total days logged: ${allDates.length}</div>`;
}

/* ── HEATMAP — GitHub/LeetCode Style ────────────── */
function buildHeatmap(y){
  const allYears=[...new Set(Object.keys(entries).map(k=>k.split('-')[0]))].map(Number).sort();
  if(!allYears.length) allYears.push(nowYear());
  if(!allYears.includes(nowYear())) allYears.push(nowYear());
  allYears.sort();

  const todayISO = today();

  // Max spend for intensity scaling (within this year)
  const yearTotals = Object.entries(entries)
    .filter(([k]) => k.startsWith(y+'-'))
    .map(([k]) => dayTotal(k));
  const maxSpend = yearTotals.length ? Math.max(...yearTotals, 1) : 1;

  const yearBtns = allYears.map(yr =>
    `<button class="heatmap-year-btn${yr===y?' active':''}" data-hmy="${yr}"${yr>nowYear()?` disabled`:``}>${yr}</button>`
  ).join('');

  // Build week columns — each column = one week Sun..Sat
  // Start from the Sunday on or before Jan 1 of the year
  const jan1 = new Date(y, 0, 1);
  const dec31 = new Date(y, 11, 31);

  const startSunday = new Date(jan1);
  startSunday.setDate(jan1.getDate() - jan1.getDay()); // go back to Sunday

  const weeks = [];
  const cur = new Date(startSunday);

  while(true) {
    const week = [];
    for(let d = 0; d < 7; d++) {
      const dt = new Date(cur);
      const iso = dt.toISOString().slice(0, 10);
      const inYear = dt.getFullYear() === y;
      week.push(inYear ? iso : null);
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    // Stop after we've passed Dec 31 and completed the week
    if(new Date(cur) > dec31) break;
  }

  // Cell geometry
  const CELL = 13, GAP = 2, STEP = CELL + GAP;

  // Month labels: one per month, positioned at the week column where it starts
  const monthPositions = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    for(const iso of week) {
      if(!iso) continue;
      const m = parseInt(iso.slice(5, 7)) - 1;
      if(m !== lastMonth) {
        monthPositions.push({ wi, label: MONTHS_S[m] });
        lastMonth = m;
        break;
      }
    }
  });

  // Build month label spans with pixel-accurate widths
  const monthHtml = monthPositions.map((mp, i) => {
    const nextWi = i + 1 < monthPositions.length ? monthPositions[i+1].wi : weeks.length;
    const w = (nextWi - mp.wi) * STEP;
    return `<span class="hm-month-label" style="width:${w}px">${mp.label}</span>`;
  }).join('');

  // Display order: Mon(1), Tue(2), Wed(3), Thu(4), Fri(5), Sat(6), Sun(0)
  const displayDOW = [1, 2, 3, 4, 5, 6, 0];
  const DOW_LABELS  = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

  const dayLabelsHtml = DOW_LABELS.map(l =>
    `<div class="hm-day-label">${l}</div>`
  ).join('');

  // Build week columns
  const weeksHtml = weeks.map(week => {
    const cells = displayDOW.map(dow => {
      const iso = week[dow];

      // Padding cell (before Jan 1 or after Dec 31)
      if(!iso) return `<div class="hm-cell hm-empty" style="width:${CELL}px;height:${CELL}px"></div>`;

      const isFuture = iso > todayISO;
      const isToday  = iso === todayISO;
      const t = dayTotal(iso);
      const items = entries[iso] || [];

      // Future days — faint placeholder
      if(isFuture) {
        return `<div class="hm-cell hm-no-data${isToday?' hm-today':''}" style="opacity:.15;width:${CELL}px;height:${CELL}px"></div>`;
      }

      // No data
      if(!t) {
        return `<div class="hm-cell hm-no-data${isToday?' hm-today':''}" data-iso="${iso}" data-has="0" style="width:${CELL}px;height:${CELL}px"></div>`;
      }

      // Color by budget ratio + intensity
      const [iy, im] = iso.split('-').map(Number);
      const dl = dailyLimit(iy, im - 1);
      const intensity = Math.min(1, t / maxSpend);
      let bg;

      if(dl) {
        const ratio = t / dl;
        if(ratio < 0.5)       bg = `rgba(45,106,79,${(0.22 + intensity * 0.3).toFixed(2)})`;
        else if(ratio < 0.85) bg = `rgba(45,106,79,${(0.42 + intensity * 0.3).toFixed(2)})`;
        else if(ratio < 1.0)  bg = `rgba(45,106,79,${(0.62 + intensity * 0.3).toFixed(2)})`;
        else if(ratio < 1.25) bg = `rgba(196,98,13,${(0.50 + intensity * 0.4).toFixed(2)})`;
        else                  bg = `rgba(181,40,28,${(0.55 + intensity * 0.4).toFixed(2)})`;
      } else {
        bg = `rgba(29,78,143,${(0.15 + intensity * 0.80).toFixed(2)})`;
      }

      // Tooltip text (encoded for data-attr)
      const count = items.length;
      let topLabel = '';
      if(count > 0) {
        const cc = {};
        items.forEach(e => { cc[e.cat] = (cc[e.cat]||0) + 1; });
        const top = Object.entries(cc).reduce((a,b) => b[1]>a[1]?b:a)[0];
        topLabel = customCats[top]?.label || top;
      }
      const tip = `${fmtDate(iso)}\n${fmt(t)} · ${count} entr${count!==1?'ies':'y'}${topLabel?'\nTop: '+topLabel:''}`;

      return `<div class="hm-cell${isToday?' hm-today':''}" style="background:${bg};width:${CELL}px;height:${CELL}px" data-iso="${iso}" data-has="1" data-tip="${encodeURIComponent(tip)}"></div>`;
    }).join('');

    return `<div class="hm-week">${cells}</div>`;
  }).join('');

  // Legend
  const legendColors = [
    'var(--border)',
    'rgba(45,106,79,.28)',
    'rgba(45,106,79,.55)',
    'rgba(45,106,79,.85)',
    'rgba(181,40,28,.80)',
  ];
  const legendHtml = legendColors.map(c =>
    `<div class="hm-legend-cell" style="background:${c}"></div>`
  ).join('');

  return `<div class="heatmap-wrap">
    <div class="heatmap-title">
      <div class="section-title" style="margin-bottom:0">Spending heatmap</div>
      <div class="heatmap-year-btns">${yearBtns}</div>
    </div>
    <div class="hm-scroll-inner">
      <div class="hm-month-row">${monthHtml}</div>
      <div class="hm-body">
        <div class="hm-day-labels">${dayLabelsHtml}</div>
        <div class="hm-weeks" id="heatmapGrid">${weeksHtml}</div>
      </div>
    </div>
    <div class="hm-legend">
      <span>Less</span>${legendHtml}<span>More</span>
    </div>
  </div>`;
}

/* ── HEATMAP DAY MODAL ───────────────────────────── */
function buildHeatmap(y){
  const allYears = getHeatmapYears();
  const selectedYear = allYears.includes(y) ? y : allYears[0];

  const todayISO = today();
  const yearTotals = Object.entries(entries)
    .filter(([k]) => k.startsWith(selectedYear+'-'))
    .map(([k]) => dayTotal(k));
  const maxSpend = yearTotals.length ? Math.max(...yearTotals, 1) : 1;

  const yearSelect = `<select class="heatmap-year-select" id="heatmapYearSelect" aria-label="Select heatmap year">
    ${allYears.map(yr => `<option value="${yr}"${yr===selectedYear?' selected':''}>${yr}</option>`).join('')}
  </select>`;

  const monthBlocksHtml = Array.from({length:12}, (_, m) => {
    const grid = buildMonthHeatmapGrid(selectedYear, m);
    const cellsHtml = grid.cells.map(cell => {
      const inMonth = cell.date.startsWith(`${selectedYear}-${String(m + 1).padStart(2,'0')}`);
      const row = cell.day === 0 ? 7 : cell.day;

      if(!inMonth){
        return `<div class="hm-cell hm-empty" style="grid-column:${cell.week + 1};grid-row:${row}"></div>`;
      }

      const iso = cell.date;
      const isFuture = iso > todayISO;
      const isToday = iso === todayISO;
      const t = dayTotal(iso);
      const items = entries[iso] || [];

      if(isFuture){
        return `<div class="hm-cell hm-no-data${isToday?' hm-today':''}" style="grid-column:${cell.week + 1};grid-row:${row};opacity:.15"></div>`;
      }

      if(!t){
        return `<div class="hm-cell hm-no-data${isToday?' hm-today':''}" data-iso="${iso}" data-has="0" style="grid-column:${cell.week + 1};grid-row:${row}"></div>`;
      }

      const dl = dailyLimit(selectedYear, m);
      const intensity = Math.min(1, t / maxSpend);
      let bg;

      if(dl) {
        const ratio = t / dl;
        if(ratio < 0.5)       bg = `rgba(45,106,79,${(0.22 + intensity * 0.3).toFixed(2)})`;
        else if(ratio < 0.85) bg = `rgba(45,106,79,${(0.42 + intensity * 0.3).toFixed(2)})`;
        else if(ratio < 1.0)  bg = `rgba(45,106,79,${(0.62 + intensity * 0.3).toFixed(2)})`;
        else if(ratio < 1.25) bg = `rgba(196,98,13,${(0.50 + intensity * 0.4).toFixed(2)})`;
        else                  bg = `rgba(181,40,28,${(0.55 + intensity * 0.4).toFixed(2)})`;
      } else {
        bg = `rgba(29,78,143,${(0.15 + intensity * 0.80).toFixed(2)})`;
      }

      const count = items.length;
      let topLabel = '';
      if(count > 0) {
        const cc = {};
        items.forEach(e => { cc[e.cat] = (cc[e.cat]||0) + 1; });
        const top = Object.entries(cc).reduce((a,b) => b[1]>a[1]?b:a)[0];
        topLabel = customCats[top]?.label || top;
      }
      const tip = `${fmtDate(iso)}\n${fmt(t)} - ${count} entr${count!==1?'ies':'y'}${topLabel?'\nTop: '+topLabel:''}`;

      return `<div class="hm-cell${isToday?' hm-today':''}" style="grid-column:${cell.week + 1};grid-row:${row};background:${bg}" data-iso="${iso}" data-has="1" data-tip="${encodeURIComponent(tip)}"></div>`;
    }).join('');

    return `<div class="hm-month-block">
      <div class="hm-month-label">${MONTHS_S[m]}</div>
      <div class="heatmap-grid" style="grid-template-columns:repeat(${grid.weekCount},13px)">${cellsHtml}</div>
    </div>`;
  }).join('');

  const legendColors = [
    'var(--border)',
    'rgba(45,106,79,.28)',
    'rgba(45,106,79,.55)',
    'rgba(45,106,79,.85)',
    'rgba(181,40,28,.80)',
  ];
  const legendHtml = legendColors.map(c =>
    `<div class="hm-legend-cell" style="background:${c}"></div>`
  ).join('');

  return `<div class="heatmap-wrap">
    <div class="heatmap-title">
      <div class="section-title" style="margin-bottom:0">Spending heatmap</div>
      ${yearSelect}
    </div>
    <div class="hm-scroll-inner">
      <div class="hm-month-strip" id="heatmapGrid">${monthBlocksHtml}</div>
    </div>
    <div class="hm-legend">
      <span>Less</span>${legendHtml}<span>More</span>
    </div>
  </div>`;
}

function buildHeatmapGrid(year){
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const firstDay = new Date(start);
  const day = firstDay.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  firstDay.setDate(firstDay.getDate() + diff);

  const cells = [];
  const current = new Date(firstDay);

  while(current <= end || current.getDay() !== 1){
    cells.push({
      date: dateToISO(current),
      day: current.getDay(),
      week: getWeekIndex(firstDay, current)
    });
    current.setDate(current.getDate() + 1);
  }

  return {
    startDate: new Date(firstDay),
    weekCount: cells.length ? cells[cells.length - 1].week + 1 : 0,
    cells
  };
}

function getWeekIndex(start, current){
  const diff = (current - start) / (1000 * 60 * 60 * 24);
  return Math.floor(diff / 7);
}

function getMonthPositions(year, startDate){
  const positions = [];

  for(let m = 0; m < 12; m++){
    const first = new Date(year, m, 1);
    const diff = (first - startDate) / (1000 * 60 * 60 * 24);
    positions.push({
      month: MONTHS_S[m],
      col: Math.floor(diff / 7) + 1
    });
  }

  return positions;
}

function buildMonthHeatmapGrid(year, month){
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const firstDay = new Date(start);
  const startDay = firstDay.getDay();
  const diff = startDay === 0 ? -6 : 1 - startDay;
  firstDay.setDate(firstDay.getDate() + diff);

  const cells = [];
  const current = new Date(firstDay);

  while(current <= end || current.getDay() !== 1){
    cells.push({
      date: dateToISO(current),
      day: current.getDay(),
      week: getWeekIndex(firstDay, current)
    });
    current.setDate(current.getDate() + 1);
  }

  return {
    weekCount: cells.length ? cells[cells.length - 1].week + 1 : 0,
    cells
  };
}

function openHeatmapDayModal(iso){
  const items = entries[iso] || [];
  const t = dayTotal(iso);
  const [y,m] = iso.split('-').map(Number);
  const dl = dailyLimit(y, m-1);
  const saved = dl !== null ? dl - t : null;
  const st = statusFor(t, dl);

  let content = '';
  if(!items.length){
    content = `<div class="hm-empty-day">No expenses logged for this day.</div>`;
  } else {
    content = items.map(e=>`<div class="hm-entry-row">
      ${catPill(e.cat)}
      ${e.notes?`<span style="font-size:12px;color:var(--muted);font-style:italic;margin-left:4px">${e.notes}</span>`:''}
      <span class="hm-entry-spacer"></span>
      <span class="hm-entry-amt">${fmt(e.amount)}</span>
    </div>`).join('');
    content += `<div class="hm-total-row">
      <span class="hm-total-lbl">Total</span>
      <div style="display:flex;align-items:center;gap:8px">
        ${st.cls?`<span class="pill ${st.cls}">${st.label}</span>`:''}
        <span class="hm-total-amt">${fmt(t)}</span>
      </div>
    </div>`;
    if(saved !== null){
      content += `<div style="text-align:right;margin-top:6px;font-size:12px;font-weight:600;color:${saved>=0?'var(--green)':'var(--red)'}">
        ${saved>=0?`↓ Saved ${fmt(saved)}`:`↑ Over by ${fmt(Math.abs(saved))}`}
      </div>`;
    }
  }

  document.getElementById('modalArea').innerHTML=`
    <div class="hm-day-modal-overlay" id="hmModalOverlay">
      <div class="hm-day-modal">
        <h3>${fmtDate(iso)}</h3>
        <div class="hm-day-sub">${items.length} item${items.length!==1?'s':''} logged</div>
        ${content}
        <div class="modal-footer" style="margin-top:16px">
          <button class="btn btn-ghost btn-sm" id="closeHmModal">Close</button>
        </div>
      </div>
    </div>`;

  document.getElementById('closeHmModal').addEventListener('click', closeModal);
  document.getElementById('hmModalOverlay').addEventListener('click', e=>{
    if(e.target===e.currentTarget) closeModal();
  });
}

/* ── BUDGET MODAL ────────────────────────────────── */
function openBudgetModal(y,m){
  const ex=getMonthBudget(y,m);
  const exRaw=budgets[monthKey(y,m)];
  const exCatBudgets=sbData?.catBudgets||{};

  // Restore saved range or default to full month
  const savedStart=exRaw&&typeof exRaw==='object'?exRaw.startDay:1;
  const savedDays=exRaw&&typeof exRaw==='object'?exRaw.daysConsidered:daysInMonth(y,m);
  const savedEnd=savedStart+savedDays-1;
  const savedSM=exRaw&&typeof exRaw==='object'&&exRaw.startMonth!=null?exRaw.startMonth:m;
  const savedSY=exRaw&&typeof exRaw==='object'&&exRaw.startYear!=null?exRaw.startYear:y;
  const savedEM=exRaw&&typeof exRaw==='object'&&exRaw.endMonth!=null?exRaw.endMonth:m;
  const savedEY=exRaw&&typeof exRaw==='object'&&exRaw.endYear!=null?exRaw.endYear:y;

  let calYear=y, calMonth=m;
  let selStart={y:savedSY,m:savedSM,d:savedStart};
  let selEnd={y:savedEY,m:savedEM,d:Math.min(savedEnd,daysInMonth(savedEY,savedEM))};
  let picking='start';
  let budgetTab='general'; // 'general' | 'category'

  // Build category rows HTML
  const catRowsHtml=Object.entries(customCats).map(([k,c])=>`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="width:10px;height:10px;border-radius:50%;background:${c.color};flex-shrink:0;display:inline-block"></span>
      <span style="flex:1;font-size:13px;color:var(--text)">${c.label}</span>
      <div style="display:flex;align-items:center;gap:4px">
        <span style="font-size:13px;color:var(--muted)">₹</span>
        <input type="number" class="cat-budget-inp" data-cat="${k}" placeholder="No limit" min="0"
          value="${exCatBudgets[k]||''}"
          style="width:90px;border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 8px;font-family:inherit;font-size:13px;color:var(--text);background:var(--surface-2);outline:none;text-align:right">
      </div>
    </div>`).join('');

  document.getElementById('modalArea').innerHTML=`
    <div class="modal-overlay" id="modalOverlay"><div class="modal" style="max-width:420px;max-height:90vh;overflow-y:auto">
      <h3>${ex?'Edit':'Set'} budget — ${MONTHS[m]} ${y}</h3>

      <!-- Tab switcher -->
      <div style="display:flex;gap:4px;background:var(--surface-2);border-radius:var(--radius-sm);padding:3px;margin-bottom:16px">
        <button id="tabGeneral" onclick="switchBudgetTab('general')" style="flex:1;padding:7px;border:none;border-radius:7px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;background:var(--text);color:var(--surface);transition:all .15s">Overall Budget</button>
        <button id="tabCategory" onclick="switchBudgetTab('category')" style="flex:1;padding:7px;border:none;border-radius:7px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;background:transparent;color:var(--muted);transition:all .15s">Category-wise</button>
      </div>

      <!-- General budget panel -->
      <div id="panelGeneral">
        <p style="font-size:13px;color:var(--muted);margin-bottom:12px">Set an overall monthly budget with a custom date range.</p>
        <div class="modal-input-wrap" style="margin-bottom:16px"><span>₹</span>
          <input type="number" id="budgetInput" placeholder="e.g. 5250" min="100" step="1" value="${ex||''}">
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Date range</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <button id="pickStartBtn" class="bc-range-pill bc-range-pill-active">
            <span style="font-size:10px;color:var(--muted);display:block;margin-bottom:1px">START</span>
            <span id="startLabel" style="font-weight:700;font-size:13px"></span>
          </button>
          <span style="color:var(--muted);font-size:18px">→</span>
          <button id="pickEndBtn" class="bc-range-pill">
            <span style="font-size:10px;color:var(--muted);display:block;margin-bottom:1px">END</span>
            <span id="endLabel" style="font-weight:700;font-size:13px"></span>
          </button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <button id="calPrev" class="nav-btn" style="width:28px;height:28px;font-size:13px">‹</button>
          <span id="calMonthLabel" style="font-size:13px;font-weight:600"></span>
          <button id="calNext" class="nav-btn" style="width:28px;height:28px;font-size:13px">›</button>
        </div>
        <div id="budgetCal" class="budget-cal"></div>
        <div class="modal-hint" id="dailyHint" style="margin-top:10px"></div>
      </div>

      <!-- Category-wise panel -->
      <div id="panelCategory" style="display:none">
        <p style="font-size:13px;color:var(--muted);margin-bottom:10px">Set individual spend limits per category for ${MONTHS_S[m]} ${y}.</p>
        <div style="background:var(--orange-bg);border:1px solid var(--orange-bd);border-radius:var(--radius-sm);padding:10px 12px;margin-bottom:14px;display:flex;gap:8px;align-items:flex-start">
          <span style="font-size:15px;flex-shrink:0">ℹ️</span>
          <div style="font-size:12px;color:var(--orange);line-height:1.5">
            <strong>Note:</strong> Category budgets are for tracking only. They do not replace the overall budget — daily limits, UDB, and all calculations are based on the <strong>Overall Budget</strong>. Please set an overall budget too.
          </div>
        </div>
        <div style="max-height:160px;overflow-y:auto;padding-right:4px;margin-bottom:8px">
          ${catRowsHtml}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
          <button id="resetCatBudgetsBtn" class="btn btn-ghost btn-sm" style="color:var(--red);border-color:var(--red-bd);font-size:11px">↺ Reset all limits</button>
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Date range</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <button id="pickStartBtnCat" class="bc-range-pill bc-range-pill-active">
            <span style="font-size:10px;color:var(--muted);display:block;margin-bottom:1px">START</span>
            <span id="startLabelCat" style="font-weight:700;font-size:13px"></span>
          </button>
          <span style="color:var(--muted);font-size:18px">→</span>
          <button id="pickEndBtnCat" class="bc-range-pill">
            <span style="font-size:10px;color:var(--muted);display:block;margin-bottom:1px">END</span>
            <span id="endLabelCat" style="font-weight:700;font-size:13px"></span>
          </button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <button id="calPrevCat" class="nav-btn" style="width:28px;height:28px;font-size:13px">‹</button>
          <span id="calMonthLabelCat" style="font-size:13px;font-weight:600"></span>
          <button id="calNextCat" class="nav-btn" style="width:28px;height:28px;font-size:13px">›</button>
        </div>
        <div id="budgetCalCat" class="budget-cal"></div>
        <div class="modal-hint" id="catDateHint" style="margin-top:8px"></div>
      </div>

      <div class="modal-footer" style="margin-top:14px">
        ${ex?`<button class="btn btn-ghost" id="removeBudgetBtn">Remove</button>`:''}
        <button class="btn btn-ghost" id="cancelModalBtn">Cancel</button>
        <button class="btn btn-primary" id="saveBudgetBtn">Save</button>
      </div>
    </div></div>`;

  // Track category budget values in memory as user types
  // Pre-populate with existing saved values
  const catBudgetDraft={...sbData.catBudgets};

  // Bind input listeners — also capture pre-filled values immediately
  setTimeout(()=>{
    document.querySelectorAll('.cat-budget-inp').forEach(el=>{
      const existing=parseFloat(el.value)||0;
      if(existing>0) catBudgetDraft[el.dataset.cat]=existing;
      else if(catBudgetDraft[el.dataset.cat]===undefined) delete catBudgetDraft[el.dataset.cat];
      el.addEventListener('input',()=>{
        const val=parseFloat(el.value)||0;
        if(val>0) catBudgetDraft[el.dataset.cat]=val;
        else delete catBudgetDraft[el.dataset.cat];
      });
    });
  },0);

  if(!document.getElementById('budgetCalStyle')){
    const s=document.createElement('style');
    s.id='budgetCalStyle';
    s.textContent=`
      .budget-cal{border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;user-select:none}
      .budget-cal-head{display:grid;grid-template-columns:repeat(7,1fr);background:var(--bg);border-bottom:1px solid var(--border)}
      .budget-cal-head span{text-align:center;font-size:10px;font-weight:700;color:var(--muted);padding:6px 0;text-transform:uppercase}
      .budget-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:6px}
      .bc-day{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;transition:all .12s;color:var(--text)}
      .bc-day:hover:not(.bc-empty){background:var(--surface-2)}
      .bc-day.bc-sel-start,.bc-day.bc-sel-end{background:var(--text)!important;color:var(--surface)!important;font-weight:700}
      .bc-day.bc-in-range{background:var(--surface-2);border-radius:0}
      .bc-day.bc-sel-start{border-radius:6px 0 0 6px}
      .bc-day.bc-sel-end{border-radius:0 6px 6px 0}
      .bc-day.bc-sel-start.bc-sel-end{border-radius:6px}
      .bc-day.bc-today{font-weight:700;outline:2px solid var(--blue);outline-offset:-2px}
      .bc-day.bc-today.bc-sel-start,.bc-day.bc-today.bc-sel-end{outline:none}
      .bc-day.bc-empty{cursor:default;pointer-events:none}
      .bc-range-pill{flex:1;padding:8px 12px;border:2px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);cursor:pointer;text-align:left;font-family:inherit;transition:all .15s;color:var(--text)}
      .bc-range-pill.bc-range-pill-active{border-color:var(--text);background:var(--surface)}
      .bc-range-pill:hover{border-color:var(--text)}
    `;
    document.head.appendChild(s);
  }

  const inp=document.getElementById('budgetInput');
  const hint=document.getElementById('dailyHint');

  function dMs(dy,dm,dd){ return new Date(dy,dm,dd).getTime(); }
  function fmtSel(s){ return s?`${MONTHS_S[s.m]} ${s.d}, ${s.y}`:'—'; }

  function updateLabels(){
    document.getElementById('startLabel').textContent=fmtSel(selStart);
    document.getElementById('endLabel').textContent=fmtSel(selEnd);
    document.getElementById('calMonthLabel').textContent=`${MONTHS[calMonth]} ${calYear}`;
  }

  function updateHint(){
    if(!selStart||!selEnd) return;
    const ms1=dMs(selStart.y,selStart.m,selStart.d);
    const ms2=dMs(selEnd.y,selEnd.m,selEnd.d);
    if(ms2<ms1){ hint.textContent='End date must be after start date'; return; }
    const days=Math.round((ms2-ms1)/86400000)+1;
    const v=parseFloat(inp.value);
    if(v&&v>0){
      hint.innerHTML=`<strong>${fmt(v/days)}/day</strong> &nbsp;·&nbsp; ${days} day${days!==1?'s':''} &nbsp;·&nbsp; ${fmtSel(selStart)} – ${fmtSel(selEnd)}`;
    } else {
      hint.textContent=`${days} day${days!==1?'s':''} · ${fmtSel(selStart)} – ${fmtSel(selEnd)}`;
    }
  }

  function setPicking(mode){
    picking=mode;
    document.getElementById('pickStartBtn').classList.toggle('bc-range-pill-active',mode==='start');
    document.getElementById('pickEndBtn').classList.toggle('bc-range-pill-active',mode==='end');
  }

  function renderCal(){
    const cal=document.getElementById('budgetCal');
    if(!cal) return;
    const totalD=daysInMonth(calYear,calMonth);
    const firstDow=new Date(calYear,calMonth,1).getDay();
    const todayISO=today();
    const msS=selStart?dMs(selStart.y,selStart.m,selStart.d):null;
    const msE=selEnd?dMs(selEnd.y,selEnd.m,selEnd.d):null;

    let html=`<div class="budget-cal-head">`;
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d=>{ html+=`<span>${d}</span>`; });
    html+=`</div><div class="budget-cal-grid">`;
    for(let i=0;i<firstDow;i++) html+=`<div class="bc-day bc-empty"></div>`;
    for(let d=1;d<=totalD;d++){
      const ms=dMs(calYear,calMonth,d);
      const isStart=msS&&ms===msS;
      const isEnd=msE&&ms===msE;
      const inRange=msS&&msE&&ms>msS&&ms<msE;
      const isToday=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`===todayISO;
      let cls='bc-day';
      if(isStart) cls+=' bc-sel-start';
      if(isEnd) cls+=' bc-sel-end';
      if(inRange) cls+=' bc-in-range';
      if(isToday) cls+=' bc-today';
      html+=`<div class="${cls}" data-d="${d}">${d}</div>`;
    }
    html+=`</div>`;
    cal.innerHTML=html;

    cal.querySelectorAll('.bc-day[data-d]').forEach(el=>{
      el.addEventListener('click',()=>{
        const d=parseInt(el.dataset.d);
        const ms=dMs(calYear,calMonth,d);

        if(picking==='start'){
          selStart={y:calYear,m:calMonth,d};
          // If end is now before new start, clear it
          if(selEnd&&dMs(selEnd.y,selEnd.m,selEnd.d)<=ms) selEnd=null;
          // Switch to end picking after setting start
          setPicking('end');
        } else {
          // picking === 'end'
          const msS=selStart?dMs(selStart.y,selStart.m,selStart.d):null;
          if(msS&&ms<=msS){
            // Clicked on or before start — treat as new start, stay on end
            selStart={y:calYear,m:calMonth,d};
            selEnd=null;
            setPicking('end');
          } else {
            selEnd={y:calYear,m:calMonth,d};
            // Stay on end so user can keep adjusting
          }
        }
        updateLabels();
        updateHint();
        renderCal();
      });
    });
  }

  setPicking('start');
  updateLabels();
  updateHint();
  renderCal();
  inp.focus();
  inp.addEventListener('input', updateHint);

  document.getElementById('pickStartBtn').addEventListener('click',()=>{ setPicking('start'); renderCal(); });
  document.getElementById('pickEndBtn').addEventListener('click',()=>{ setPicking('end'); renderCal(); });

  document.getElementById('calPrev').addEventListener('click',()=>{
    calMonth--; if(calMonth<0){calMonth=11;calYear--;}
    updateLabels(); renderCal();
  });
  document.getElementById('calNext').addEventListener('click',()=>{
    calMonth++; if(calMonth>11){calMonth=0;calYear++;}
    updateLabels(); renderCal();
  });

  // ── Category calendar (mirrors general calendar logic) ──
  let catCalYear=y, catCalMonth=m;
  let catSelStart={y:savedSY,m:savedSM,d:savedStart};
  let catSelEnd={y:savedEY,m:savedEM,d:Math.min(savedEnd,daysInMonth(savedEY,savedEM))};
  let catPicking='start';

  function catFmtSel(s){ return s?`${MONTHS_S[s.m]} ${s.d}, ${s.y}`:'—'; }
  function setCatPicking(mode){
    catPicking=mode;
    document.getElementById('pickStartBtnCat').classList.toggle('bc-range-pill-active',mode==='start');
    document.getElementById('pickEndBtnCat').classList.toggle('bc-range-pill-active',mode==='end');
  }
  function updateCatLabels(){
    document.getElementById('startLabelCat').textContent=catFmtSel(catSelStart);
    document.getElementById('endLabelCat').textContent=catFmtSel(catSelEnd);
    document.getElementById('calMonthLabelCat').textContent=`${MONTHS[catCalMonth]} ${catCalYear}`;
  }
  function updateCatHint(){
    if(!catSelStart||!catSelEnd) return;
    const ms1=dMs(catSelStart.y,catSelStart.m,catSelStart.d);
    const ms2=dMs(catSelEnd.y,catSelEnd.m,catSelEnd.d);
    if(ms2<ms1){ document.getElementById('catDateHint').textContent='End date must be after start date'; return; }
    const days=Math.round((ms2-ms1)/86400000)+1;
    document.getElementById('catDateHint').textContent=`${days} day${days!==1?'s':''} · ${catFmtSel(catSelStart)} – ${catFmtSel(catSelEnd)}`;
  }
  function renderCatCal(){
    const cal=document.getElementById('budgetCalCat');
    if(!cal) return;
    const totalD=daysInMonth(catCalYear,catCalMonth);
    const firstDow=new Date(catCalYear,catCalMonth,1).getDay();
    const todayISO=today();
    const msS=catSelStart?dMs(catSelStart.y,catSelStart.m,catSelStart.d):null;
    const msE=catSelEnd?dMs(catSelEnd.y,catSelEnd.m,catSelEnd.d):null;
    let html=`<div class="budget-cal-head">`;
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d=>{ html+=`<span>${d}</span>`; });
    html+=`</div><div class="budget-cal-grid">`;
    for(let i=0;i<firstDow;i++) html+=`<div class="bc-day bc-empty"></div>`;
    for(let d=1;d<=totalD;d++){
      const ms=dMs(catCalYear,catCalMonth,d);
      const isStart=msS&&ms===msS; const isEnd=msE&&ms===msE;
      const inRange=msS&&msE&&ms>msS&&ms<msE;
      const isToday=`${catCalYear}-${String(catCalMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`===todayISO;
      let cls='bc-day';
      if(isStart) cls+=' bc-sel-start'; if(isEnd) cls+=' bc-sel-end';
      if(inRange) cls+=' bc-in-range'; if(isToday) cls+=' bc-today';
      html+=`<div class="${cls}" data-d="${d}">${d}</div>`;
    }
    html+=`</div>`;
    cal.innerHTML=html;
    cal.querySelectorAll('.bc-day[data-d]').forEach(el=>{
      el.addEventListener('click',()=>{
        const d=parseInt(el.dataset.d);
        const ms=dMs(catCalYear,catCalMonth,d);
        if(catPicking==='start'){
          catSelStart={y:catCalYear,m:catCalMonth,d};
          if(catSelEnd&&dMs(catSelEnd.y,catSelEnd.m,catSelEnd.d)<=ms) catSelEnd=null;
          setCatPicking('end');
        } else {
          const msS2=catSelStart?dMs(catSelStart.y,catSelStart.m,catSelStart.d):null;
          if(msS2&&ms<=msS2){ catSelStart={y:catCalYear,m:catCalMonth,d}; catSelEnd=null; setCatPicking('end'); }
          else { catSelEnd={y:catCalYear,m:catCalMonth,d}; }
        }
        updateCatLabels(); updateCatHint(); renderCatCal();
      });
    });
  }
  setCatPicking('start'); updateCatLabels(); updateCatHint(); renderCatCal();
  document.getElementById('pickStartBtnCat').addEventListener('click',()=>{ setCatPicking('start'); renderCatCal(); });
  document.getElementById('pickEndBtnCat').addEventListener('click',()=>{ setCatPicking('end'); renderCatCal(); });
  document.getElementById('calPrevCat').addEventListener('click',()=>{ catCalMonth--; if(catCalMonth<0){catCalMonth=11;catCalYear--;} updateCatLabels(); renderCatCal(); });
  document.getElementById('calNextCat').addEventListener('click',()=>{ catCalMonth++; if(catCalMonth>11){catCalMonth=0;catCalYear++;} updateCatLabels(); renderCatCal(); });

  // Reset all category budgets
  document.getElementById('resetCatBudgetsBtn').addEventListener('click',()=>{
    // Clear draft
    Object.keys(catBudgetDraft).forEach(k=>delete catBudgetDraft[k]);
    // Clear all inputs visually
    document.querySelectorAll('.cat-budget-inp').forEach(el=>{ el.value=''; });
    // Clear saved data immediately
    sbData.catBudgets={};
    sbData.readAlerts=[];
    saveSbData();
    // Sync sidebar + nav in real time
    if(typeof renderCatBudgets==='function'&&document.getElementById('catBudgetList')) renderCatBudgets();
    document.getElementById('navArea').innerHTML=buildNav();
    bindEvents();
    showToast('Category budgets reset ✓');
  });

  // Tab switching
  window.switchBudgetTab=function(tab){
    budgetTab=tab;
    document.getElementById('panelGeneral').style.display=tab==='general'?'block':'none';
    document.getElementById('panelCategory').style.display=tab==='category'?'block':'none';
    document.getElementById('tabGeneral').style.background=tab==='general'?'var(--text)':'transparent';
    document.getElementById('tabGeneral').style.color=tab==='general'?'var(--surface)':'var(--muted)';
    document.getElementById('tabCategory').style.background=tab==='category'?'var(--text)':'transparent';
    document.getElementById('tabCategory').style.color=tab==='category'?'var(--surface)':'var(--muted)';
  };

  document.getElementById('saveBudgetBtn').addEventListener('click',()=>{
    if(budgetTab==='general'){
      const v=parseFloat(inp.value);
      if(!v||v<100){inp.focus();showToast('Enter a budget of at least ₹100');return;}
      if(!selStart||!selEnd){showToast('Select a date range');return;}
      const ms1=dMs(selStart.y,selStart.m,selStart.d);
      const ms2=dMs(selEnd.y,selEnd.m,selEnd.d);
      if(ms2<ms1){showToast('End date must be after start date');return;}
      const days=Math.round((ms2-ms1)/86400000)+1;
      budgets[monthKey(y,m)]={amount:v,daysConsidered:days,startDay:selStart.d,startMonth:selStart.m,startYear:selStart.y,endDay:selEnd.d,endMonth:selEnd.m,endYear:selEnd.y};
      saveData();closeModal();render();showToast('Overall budget saved ✓');
    } else {
      // Save category-wise budgets
      // catBudgetDraft was pre-populated from sbData.catBudgets at modal open
      // and updated via input listeners — use it directly, no DOM reading needed
      sbData.catBudgets = Object.assign({}, catBudgetDraft);
      // Remove zero/empty entries
      Object.keys(sbData.catBudgets).forEach(k=>{
        if(!(sbData.catBudgets[k]>0)) delete sbData.catBudgets[k];
      });
      // Store date range for category budgets
      if(catSelStart&&catSelEnd){
        const ms1=dMs(catSelStart.y,catSelStart.m,catSelStart.d);
        const ms2=dMs(catSelEnd.y,catSelEnd.m,catSelEnd.d);
        if(ms2>=ms1){
          const days=Math.round((ms2-ms1)/86400000)+1;
          sbData.catBudgetRange={days,selStart:catSelStart,selEnd:catSelEnd};
        }
      }
      localStorage.setItem('sb_data',JSON.stringify(sbData));
      if(typeof renderCatBudgets==='function'&&document.getElementById('catBudgetList')) renderCatBudgets();
      closeModal();showToast('Category budgets saved ✓');
    }
  });
  document.getElementById('cancelModalBtn').addEventListener('click',closeModal);
  document.getElementById('modalOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
  const rb=document.getElementById('removeBudgetBtn');
  if(rb) rb.addEventListener('click',()=>{
    customConfirm(`Remove budget for ${MONTHS[m]} ${y}?`,()=>{
      delete budgets[monthKey(y,m)];saveData();render();showToast('Budget removed');
    },null);
  });
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('saveBudgetBtn').click();});
}

/* ── CUSTOM CONFIRM ──────────────────────────────── */
function customConfirm(message,onConfirm,onCancel){
  document.getElementById('modalArea').innerHTML=`
    <div class="modal-overlay" id="modalOverlay"><div class="modal" style="max-width:320px">
      <h3>Confirm</h3>
      <p>${message}</p>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="cfmCancelBtn">Cancel</button>
        <button class="btn btn-primary" id="cfmOkBtn">Confirm</button>
      </div>
    </div></div>`;
  document.getElementById('cfmOkBtn').addEventListener('click',()=>{closeModal();onConfirm();});
  document.getElementById('cfmCancelBtn').addEventListener('click',()=>{closeModal();if(onCancel)onCancel();});
  document.getElementById('modalOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget){closeModal();if(onCancel)onCancel();}});
}

/* ── MANAGE CATEGORIES MODAL ─────────────────────── */
function openCategoryModal(){
  let editingKey=null, editingColor=Object.values(customCats)[0]?.color||PRESET_COLORS[0];
  function render_(){
    document.getElementById('modalArea').innerHTML=`
      <div class="modal-overlay" id="modalOverlay"><div class="modal" style="max-width:440px">
        <h3>Manage Categories</h3>
        <div class="cat-mgmt-list" id="catList">
          ${Object.entries(customCats).map(([k,c])=>`<div class="cat-mgmt-item">
            <div class="cat-color-dot" style="background:${c.color}"></div>
            <span class="cat-mgmt-label">${c.label}</span>
            <span class="cat-mgmt-key">(${k})</span>
            <div class="entry-actions">
              <button class="icon-btn edit-cat-btn" data-catkey="${k}">Edit</button>
              <button class="icon-btn del del-cat-btn" data-catkey="${k}">✕</button>
            </div>
          </div>`).join('')}
        </div>
        <div class="add-cat-form">
          <div class="section-title" style="margin-bottom:8px">${editingKey?`Edit: ${customCats[editingKey]?.label||editingKey}`:'Add new category'}</div>
          <div class="add-cat-row">
            <input type="text" id="newCatLabel" placeholder="Category name" value="${editingKey?customCats[editingKey].label:''}">
            <button class="btn btn-primary btn-sm" id="saveCatBtn">${editingKey?'Update':'Add'}</button>
          </div>
          <div class="color-swatches" id="colorSwatches">
            ${PRESET_COLORS.map(c=>`<div class="swatch${editingColor===c?' active':''}" style="background:${c}" data-color="${c}"></div>`).join('')}
          </div>
        </div>
        <div class="modal-footer" style="margin-top:8px">
          <button class="btn btn-ghost" id="cancelCatBtn">Done</button>
        </div>
      </div></div>`;
    bindCatModalEvents();
  }
  function bindCatModalEvents(){
    document.getElementById('cancelCatBtn').addEventListener('click',()=>{closeModal();saveData();render();});
    document.getElementById('modalOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget){closeModal();saveData();render();}});
    document.querySelectorAll('.swatch').forEach(el=>{
      el.addEventListener('click',()=>{
        editingColor=el.dataset.color;
        document.querySelectorAll('.swatch').forEach(s=>s.classList.toggle('active',s.dataset.color===editingColor));
      });
    });
    document.getElementById('saveCatBtn').addEventListener('click',()=>{
      const label=document.getElementById('newCatLabel').value.trim();
      if(!label){showToast('Enter a category name');return;}
      if(editingKey){
        customCats[editingKey]={label,color:editingColor};
        editingKey=null;showToast('Category updated ✓');
      } else {
        const key='cat_'+uid();
        customCats[key]={label,color:editingColor};
        showToast('Category added ✓');
      }
      render_();
    });
    document.querySelectorAll('.edit-cat-btn').forEach(el=>{
      el.addEventListener('click',e=>{
        e.stopPropagation();
        editingKey=el.dataset.catkey;
        editingColor=customCats[editingKey].color;
        render_();
      });
    });
    document.querySelectorAll('.del-cat-btn').forEach(el=>{
      el.addEventListener('click',e=>{
        e.stopPropagation();
        const k=el.dataset.catkey;
        if(Object.keys(customCats).length<=1){showToast('Need at least one category');return;}
        customConfirm(`Delete category "${customCats[k].label}"? Existing entries with this category won't be deleted.`,()=>{
          delete customCats[k];render_();
        },null);
      });
    });
  }
  render_();
}

/* ── EXPORT / IMPORT MODAL ───────────────────────── */
function openExportImportModal(){
  document.getElementById('modalArea').innerHTML=`
    <div class="modal-overlay" id="modalOverlay"><div class="modal" style="max-width:440px">
      <h3>Export &amp; Import</h3>
      <p>Back up your data or restore from a previous export.</p>

      <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:8px">Local backup</div>
      <div class="exp-option" id="exportJsonBtn">
        <div class="exp-icon">📦</div>
        <div><div class="exp-label">Export JSON</div><div class="exp-sub">Full backup — all entries, budgets &amp; categories</div></div>
      </div>
      <div class="exp-option" id="exportCsvBtn">
        <div class="exp-icon">📊</div>
        <div><div class="exp-label">Export CSV</div><div class="exp-sub">Spreadsheet-friendly — all entries with dates &amp; notes</div></div>
      </div>
      <div class="exp-option" id="importJsonTrigger">
        <div class="exp-icon">📥</div>
        <div><div class="exp-label">Import JSON</div><div class="exp-sub">Restore from a previously exported JSON backup</div></div>
      </div>
      <input type="file" id="importJsonFile" accept=".json" style="display:none">

      <div style="font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin:14px 0 8px">GitHub Gist sync</div>
      <div class="exp-option" id="gistSaveBtn">
        <div class="exp-icon">☁️</div>
        <div><div class="exp-label">Save to Gist</div><div class="exp-sub">Upload backup to a private GitHub Gist</div></div>
      </div>
      <div class="exp-option" id="gistLoadBtn">
        <div class="exp-icon">🔄</div>
        <div><div class="exp-label">Load from Gist</div><div class="exp-sub">Restore data from a GitHub Gist URL</div></div>
      </div>

      <div id="gistTokenWrap" style="display:none;margin-top:10px">
        <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">GitHub Personal Access Token</label>
        <input type="password" id="gistTokenInput" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          style="width:100%;border:1px solid var(--border);border-radius:var(--radius-sm);padding:9px 12px;font-family:inherit;font-size:13px;color:var(--text);background:var(--surface-2);outline:none;margin-bottom:6px">
        <div style="font-size:11px;color:var(--muted);line-height:1.5;margin-bottom:10px">
          Create a token at <strong>github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)</strong> with <strong>gist</strong> scope. Token is stored locally only.
        </div>
        <div id="gistIdWrap" style="display:none;margin-bottom:10px">
          <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">Gist ID (for loading)</label>
          <input type="text" id="gistIdInput" placeholder="e.g. a1b2c3d4e5f6..."
            style="width:100%;border:1px solid var(--border);border-radius:var(--radius-sm);padding:9px 12px;font-family:inherit;font-size:13px;color:var(--text);background:var(--surface-2);outline:none">
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" id="gistActionBtn" style="flex:1">Save to Gist</button>
          <button class="btn btn-ghost" id="gistCancelBtn">Cancel</button>
        </div>
        <div id="gistStatus" style="font-size:12px;color:var(--muted);margin-top:8px;text-align:center"></div>
      </div>

      <div class="modal-footer" style="margin-top:12px">
        <button class="btn btn-ghost" id="cancelExpBtn">Close</button>
      </div>
    </div></div>`;

  // ── Restore saved token ──
  const savedToken=localStorage.getItem('exp_gist_token')||'';
  const savedGistId=localStorage.getItem('exp_gist_id')||'';

  document.getElementById('cancelExpBtn').addEventListener('click',closeModal);
  document.getElementById('modalOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});

  // ── Export JSON ──
  document.getElementById('exportJsonBtn').addEventListener('click',()=>{
    const data=JSON.stringify({entries,budgets,customCats,recurring,noExpenseDays},null,2);
    downloadFile(data,'expense-tracker-backup-'+today()+'.json','application/json');
    showToast('JSON exported ✓');
  });

  // ── Export CSV ──
  document.getElementById('exportCsvBtn').addEventListener('click',()=>{
    const rows=[['Date','Category','Amount','Notes']];
    Object.entries(entries).sort().forEach(([date,items])=>{
      (items||[]).forEach(e=>{
        const cat=customCats[e.cat]?.label||e.cat;
        rows.push([date,cat,e.amount,e.notes||'']);
      });
    });
    const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
    downloadFile(csv,'expense-tracker-'+today()+'.csv','text/csv');
    showToast('CSV exported ✓');
  });

  // ── Import JSON ──
  document.getElementById('importJsonTrigger').addEventListener('click',()=>{
    document.getElementById('importJsonFile').click();
  });
  document.getElementById('importJsonFile').addEventListener('change',e=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        if(!d.entries) throw new Error('Invalid file');
        customConfirm('This will replace all current data. Continue?',()=>{
          entries=d.entries||{};
          noExpenseDays=d.noExpenseDays||{};
          budgets=d.budgets||{};
          if(d.customCats) customCats=d.customCats;
          if(d.recurring) recurring=d.recurring;
          saveData();closeModal();render();showToast('Import successful ✓');
        },null);
      }catch(err){showToast('Invalid backup file');}
    };
    reader.readAsText(file);
  });

  // ── Gist: Save ──
  let gistMode='save';
  function showGistPanel(mode){
    gistMode=mode;
    const wrap=document.getElementById('gistTokenWrap');
    const idWrap=document.getElementById('gistIdWrap');
    const btn=document.getElementById('gistActionBtn');
    wrap.style.display='block';
    document.getElementById('gistTokenInput').value=savedToken;
    if(mode==='load'){
      idWrap.style.display='block';
      document.getElementById('gistIdInput').value=savedGistId;
      btn.textContent='Load from Gist';
    } else {
      idWrap.style.display='none';
      btn.textContent='Save to Gist';
    }
  }

  document.getElementById('gistSaveBtn').addEventListener('click',()=>showGistPanel('save'));
  document.getElementById('gistLoadBtn').addEventListener('click',()=>showGistPanel('load'));
  document.getElementById('gistCancelBtn').addEventListener('click',()=>{
    document.getElementById('gistTokenWrap').style.display='none';
  });

  document.getElementById('gistActionBtn').addEventListener('click',async()=>{
    const token=document.getElementById('gistTokenInput').value.trim();
    const status=document.getElementById('gistStatus');
    if(!token){showToast('Enter your GitHub token');return;}
    localStorage.setItem('exp_gist_token',token);
    const btn=document.getElementById('gistActionBtn');
    btn.disabled=true; btn.textContent='Working…';
    status.textContent='';

    try{
      if(gistMode==='save'){
        const payload={
          description:'Expense Tracker Backup — '+today(),
          public:false,
          files:{'expense-tracker.json':{content:JSON.stringify({entries,budgets,customCats,recurring,noExpenseDays},null,2)}}
        };
        const existingId=localStorage.getItem('exp_gist_id');
        const url=existingId?`https://api.github.com/gists/${existingId}`:'https://api.github.com/gists';
        const method=existingId?'PATCH':'POST';
        const res=await fetch(url,{method,headers:{'Authorization':`token ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
        if(!res.ok) throw new Error('GitHub API error: '+res.status);
        const json=await res.json();
        localStorage.setItem('exp_gist_id',json.id);
        status.innerHTML=`✓ Saved! Gist ID: <strong>${json.id}</strong><br><a href="${json.html_url}" target="_blank" style="color:var(--blue)">View on GitHub ↗</a>`;
        showToast('Saved to Gist ✓');
      } else {
        const gistId=document.getElementById('gistIdInput').value.trim();
        if(!gistId){showToast('Enter a Gist ID');btn.disabled=false;btn.textContent='Load from Gist';return;}
        const res=await fetch(`https://api.github.com/gists/${gistId}`,{headers:{'Authorization':`token ${token}`}});
        if(!res.ok) throw new Error('Gist not found');
        const json=await res.json();
        const fileContent=json.files['expense-tracker.json']?.content;
        if(!fileContent) throw new Error('No expense-tracker.json in this Gist');
        const d=JSON.parse(fileContent);
        if(!d.entries) throw new Error('Invalid data');
        customConfirm('This will replace all current data. Continue?',()=>{
          entries=d.entries||{};noExpenseDays=d.noExpenseDays||{};budgets=d.budgets||{};
          if(d.customCats) customCats=d.customCats;
          if(d.recurring) recurring=d.recurring;
          localStorage.setItem('exp_gist_id',gistId);
          saveData();closeModal();render();showToast('Loaded from Gist ✓');
        },null);
      }
    }catch(err){
      status.textContent='Error: '+err.message;
      showToast('Failed: '+err.message);
    }
    btn.disabled=false;
    btn.textContent=gistMode==='save'?'Save to Gist':'Load from Gist';
  });
}
function downloadFile(content,filename,type){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type}));
  a.download=filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function closeModal(){ document.getElementById('modalArea').innerHTML=''; }

/* ── EVENTS ──────────────────────────────────────── */
function resetNav(){ formDate=''; formRows=[{cat:Object.keys(customCats)[0]||'lunch',amount:'',notes:'',rec:false,payMethod:defaultPaymentMethod()}]; }

function bindEvents(){
  const g=id=>document.getElementById(id);

  // Budget nudge punchlines rotation
  const NUDGE_LINES=[
    "A budget is just a plan for your money.",
    "What gets measured, gets managed.",
    "Set a budget. Own your month.",
    "Small limits, big savings.",
    "Know where every rupee goes.",
    "Budgeting is a financial superpower.",
    "Plan today. Thank yourself later.",
    "Your future self wants a budget.",
    "Track it. Tame it. Save it.",
    "Don't guess — budget it.",
  ];
  let _nudgeIdx=0, _nudgeTimer=null;
  function startNudge(){
    const el=g('budgetNudgeText');
    if(!el) return;
    el.textContent=NUDGE_LINES[_nudgeIdx];
    _nudgeTimer=setInterval(()=>{
      const e=g('budgetNudgeText');
      if(!e){ clearInterval(_nudgeTimer); return; }
      e.classList.add('fade');
      setTimeout(()=>{
        _nudgeIdx=(_nudgeIdx+1)%NUDGE_LINES.length;
        const e2=g('budgetNudgeText');
        if(e2){ e2.textContent=NUDGE_LINES[_nudgeIdx]; e2.classList.remove('fade'); }
      },400);
    },3000);
  }
  if(g('budgetNudgeCard')){
    startNudge();
    g('budgetNudgeBtn')&&g('budgetNudgeBtn').addEventListener('click',()=>g('setBudgetBtn')&&g('setBudgetBtn').click());
  }

  if(g('catInsightBox')){
    // Build insights from current month data
    const t=monthCatTotals(viewYear,viewMonth);
    const total=Object.values(t).reduce((a,b)=>a+b,0);
    if(total>0){
      const entries=Object.entries(customCats).map(([k,c])=>({k,c,amt:t[k]||0})).filter(x=>x.amt>0).sort((a,b)=>b.amt-a.amt);
      const top=entries[0];
      const topPct=top?Math.round(top.amt/total*100):0;
      const catCount=entries.length;
      const insights=[
        `<strong>${top?top.c.label:'—'}</strong> is your top spend, making up <strong>${topPct}%</strong> of the total.`,
        `You've logged expenses across <strong>${catCount}</strong> categor${catCount===1?'y':'ies'} so far this month.`,
        entries.length>1?`<strong>${entries[entries.length-1].c.label}</strong> has the lowest spend among all your categories.`:`Only <strong>${top?top.c.label:'—'}</strong> has been logged so far this month.`,
      ];
      const box=g('catInsightBox');
      const textEl=g('catInsightText');
      const dotsEl=g('catInsightDots');
      box.style.display='block';
      textEl.innerHTML=insights[0];
      dotsEl.innerHTML=insights.map((txt,i)=>`<span class="cat-dot${i===0?' active':''}" data-i="${i}" data-txt="${txt.replace(/"/g,'&quot;')}"></span>`).join('');
      const allDots=dotsEl.querySelectorAll('.cat-dot');
      let ciIdx=0;
      function setCatInsight(i,animate){
        const el=g('catInsightText');
        if(!el) return;
        if(animate){ el.style.opacity='0'; setTimeout(()=>{ ciIdx=i; allDots.forEach((d,j)=>d.classList.toggle('active',j===i)); el.innerHTML=allDots[i]?.dataset.txt||''; el.style.opacity=''; },300); }
        else { ciIdx=i; allDots.forEach((d,j)=>d.classList.toggle('active',j===i)); el.innerHTML=allDots[i]?.dataset.txt||''; }
      }
      allDots.forEach((d,i)=>{ d.addEventListener('click',()=>setCatInsight(i,true)); });
      const ciTimer=setInterval(()=>{ if(!g('catInsightText')){ clearInterval(ciTimer); return; } setCatInsight((ciIdx+1)%allDots.length,true); },3500);
    }
  }
  g('themeToggleBtn')&&g('themeToggleBtn').addEventListener('click', toggleTheme);

  // Sync comparison card height with cat-insight-row (desktop only)
  if(window.innerWidth>=900){
    const syncHeights=()=>{
      const catRow=document.querySelector('.cat-insight-row');
      const cmpCard=document.querySelector('.dashboard-reference-secondary .cat-chart, .dashboard-secondary .cat-chart');
      const insightBox=document.getElementById('catInsightBox');
      if(!catRow||!cmpCard) return;
      const rowH=catRow.getBoundingClientRect().height;
      if(rowH>0){
        cmpCard.style.minHeight=rowH+'px';
        if(insightBox&&insightBox.style.display!=='none') insightBox.style.minHeight=rowH+'px';
      }
    };
    // Run once and observe changes
    syncHeights();
    if(window.ResizeObserver){
      const ro=new ResizeObserver(syncHeights);
      const catRow=document.querySelector('.cat-insight-row');
      if(catRow) ro.observe(catRow);
    }
  }

  // Bell notification button
  g('notifBtn')&&g('notifBtn').addEventListener('click',e=>{
    e.stopPropagation();
    const existing=document.getElementById('notifDropdown');
    if(existing){existing.remove();return;}
    const wrap=g('notifBtn').parentElement;
    const unread=getAlerts();       // unread only
    const all=getAlerts(true);      // all including read
    const readSet=new Set(sbData.readAlerts||[]);
    const dropdown=document.createElement('div');
    dropdown.className='notif-dropdown';dropdown.id='notifDropdown';
    const items=all.length?all.map(a=>{
      const isRead=readSet.has(a.id);
      return `<div class="notif-item" style="${isRead?'opacity:.5':''}">
        <span class="notif-icon">${a.type==='over'?'🚨':'⚠️'}</span>
        <div>
          <div class="notif-text"><strong>${a.label}</strong> — ${a.type==='over'?`Over budget! ${fmt(a.spent)} of ${fmt(a.limit)}`:
            `${a.pct}% used (${fmt(a.spent)} / ${fmt(a.limit)})`}</div>
          <div class="notif-sub">${isRead?'Read · ':''} ${a.type==='over'?'Exceeded limit':'Approaching limit'}</div>
        </div>
      </div>`;
    }).join(''):`<div class="notif-empty">All categories within budget ✓</div>`;
    dropdown.innerHTML=`
      <div class="notif-header">
        <span>Budget Alerts</span>
        <span style="color:${unread.length?'var(--red)':'var(--muted)'}">${unread.length} unread</span>
      </div>
      ${items}
      <div style="padding:8px 14px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px">
        ${unread.length?`<button onclick="markAllAlertsRead();document.getElementById('notifDropdown')?.remove()" style="background:var(--primary);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">Mark all as read</button>`:'<span style="font-size:11px;color:var(--muted)">All caught up</span>'}
        <button onclick="sbOpen();sbToggleSection('sbBudgetSection');document.getElementById('notifDropdown')?.remove()" style="background:none;border:none;font-size:11px;color:var(--primary);cursor:pointer;font-family:inherit;font-weight:600">Finance Tools →</button>
      </div>`;
    wrap.appendChild(dropdown);
    setTimeout(()=>{
      document.addEventListener('click',function h(ev){
        if(!dropdown.contains(ev.target)){dropdown.remove();document.removeEventListener('click',h);}
      });
    },0);
  });

  g('prevMonthBtn')&&g('prevMonthBtn').addEventListener('click',()=>navigateWithCheck(()=>{viewMonth--;if(viewMonth<0){viewMonth=11;viewYear--;}resetNav();render();}));
  g('nextMonthBtn')&&g('nextMonthBtn').addEventListener('click',()=>navigateWithCheck(()=>{viewMonth++;if(viewMonth>11){viewMonth=0;viewYear++;}resetNav();render();}));
  g('prevYearBtn')&&g('prevYearBtn').addEventListener('click',()=>navigateWithCheck(()=>{viewYear--;resetNav();render();}));
  g('nextYearBtn')&&g('nextYearBtn').addEventListener('click',()=>navigateWithCheck(()=>{viewYear++;resetNav();render();}));
  g('prevWeekBtn')&&g('prevWeekBtn').addEventListener('click',()=>{
    const d=new Date(viewWeekStart+'T00:00:00');d.setDate(d.getDate()-7);
    viewWeekStart=d.toISOString().slice(0,10);render();
  });
  g('nextWeekBtn')&&g('nextWeekBtn').addEventListener('click',()=>{
    const d=new Date(viewWeekStart+'T00:00:00');d.setDate(d.getDate()+7);
    viewWeekStart=d.toISOString().slice(0,10);render();
  });
  g('todayBtn')&&g('todayBtn').addEventListener('click',()=>{
    viewYear=nowYear();viewMonth=nowMonth();viewWeekStart=getWeekStart(today());resetNav();render();
  });

  g('weekPicker')&&g('weekPicker').addEventListener('change',()=>{
    viewWeekStart=g('weekPicker').value;
    render();
  });

  g('tabMonth')&&g('tabMonth').addEventListener('click',()=>navigateWithCheck(()=>{activeTab='month';render();}));
  g('tabWeek')&&g('tabWeek').addEventListener('click',()=>navigateWithCheck(()=>{activeTab='week';render();}));
  g('tabYear')&&g('tabYear').addEventListener('click',()=>navigateWithCheck(()=>{activeTab='year';render();}));
  g('tabInsights')&&g('tabInsights').addEventListener('click',()=>navigateWithCheck(()=>{activeTab='insights';render();}));

  g('setBudgetBtn')&&g('setBudgetBtn').addEventListener('click',()=>openBudgetModal(viewYear,viewMonth));
  g('editBudgetBtn')&&g('editBudgetBtn').addEventListener('click',()=>openBudgetModal(viewYear,viewMonth));

  document.querySelectorAll('.month-card[data-month]').forEach(el=>{
    el.addEventListener('click',()=>navigateWithCheck(()=>{viewMonth=parseInt(el.dataset.month);activeTab='month';resetNav();render();}));
  });

  g('heatmapYearSelect')&&g('heatmapYearSelect').addEventListener('change',()=>{
    heatmapYear=parseInt(g('heatmapYearSelect').value,10);
    render();
  });
  g('compareMonthSelect')&&g('compareMonthSelect').addEventListener('change',()=>{
    compareMonthKey=g('compareMonthSelect').value;
    render();
  });

  // ── HEATMAP INTERACTIONS ──────────────────────────
  const heatmapGrid = g('heatmapGrid');
  if(heatmapGrid){
    // Create/reuse tooltip element on body
    let tip = document.getElementById('hm-tooltip-el');
    if(!tip){
      tip = document.createElement('div');
      tip.id = 'hm-tooltip-el';
      tip.className = 'hm-tooltip';
      document.body.appendChild(tip);
    }

    // Click: open day modal
    heatmapGrid.addEventListener('click', e => {
      const cell = e.target.closest('.hm-cell[data-iso]');
      if(!cell) return;
      tip.classList.remove('visible');
      openHeatmapDayModal(cell.dataset.iso);
    });

    // Hover: show tooltip
    heatmapGrid.addEventListener('mouseover', e => {
      const cell = e.target.closest('.hm-cell[data-tip]');
      if(!cell) { tip.classList.remove('visible'); return; }
      tip.textContent = decodeURIComponent(cell.dataset.tip);
      tip.classList.add('visible');
    });

    heatmapGrid.addEventListener('mousemove', e => {
      if(!tip.classList.contains('visible')) return;
      const TW = tip.offsetWidth, TH = tip.offsetHeight;
      const x = e.clientX, y = e.clientY;
      tip.style.left = (x + 16 + TW > window.innerWidth ? x - TW - 10 : x + 16) + 'px';
      tip.style.top  = (y - 8 + TH > window.innerHeight ? y - TH - 8 : y - 8) + 'px';
    });

    heatmapGrid.addEventListener('mouseout', e => {
      if(!e.target.closest('.hm-cell[data-tip]')) return;
      tip.classList.remove('visible');
    });

    // Touch: tap shows modal directly (no tooltip)
    heatmapGrid.addEventListener('touchend', e => {
      const cell = e.target.closest('.hm-cell[data-iso]');
      if(!cell) return;
      e.preventDefault();
      openHeatmapDayModal(cell.dataset.iso);
    }, { passive: false });
  }

  g('userMenuBtn')&&g('userMenuBtn').addEventListener('click',e=>{
    e.stopPropagation();
    const existing=document.getElementById('userDropdown');
    if(existing){existing.remove();return;}
    const wrap=g('userMenuBtn').parentElement;
    const user=JSON.parse(localStorage.getItem('exp_user')||'null');
    const dropdown=document.createElement('div');
    dropdown.className='menu-dropdown';dropdown.id='userDropdown';
    dropdown.innerHTML=`
      <div style="padding:10px 12px 8px;border-bottom:1px solid var(--border);margin-bottom:4px">
        <div style="font-size:13px;font-weight:600">${user?user.name:''}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:1px">${user?user.email:''}</div>
      </div>
      <button class="menu-item" id="miSignOut" style="color:var(--red)"><span class="mi-icon">🚪</span> Sign Out</button>`;
    wrap.appendChild(dropdown);
    document.getElementById('miSignOut').addEventListener('click',async()=>{
      dropdown.remove();
      localStorage.removeItem('exp_user');
      sessionStorage.setItem('exp_signed_out','1');
      // Sign out from Firebase so session is fully cleared
      try{
        const { logout } = await import('../services/auth-service.js');
        await logout();
      }catch(e){}
      // replace() prevents back button from returning to dashboard after logout
      window.location.replace(authPath());
    });
    setTimeout(()=>{
      document.addEventListener('click',function handler(ev){
        if(!dropdown.contains(ev.target)){dropdown.remove();document.removeEventListener('click',handler);}
      });
    },0);
  });

  g('menuBtn')&&g('menuBtn').addEventListener('click',e=>{
    e.stopPropagation();
    const existing=document.getElementById('menuDropdown');
    if(existing){existing.remove();return;}
    const wrap=g('menuBtn').parentElement;
    const dropdown=document.createElement('div');
    dropdown.className='menu-dropdown';dropdown.id='menuDropdown';
    dropdown.innerHTML=`
      <button class="menu-item" id="miCats"><span class="mi-icon">🏷️</span> Manage Categories</button>
      <button class="menu-item" id="miExport"><span class="mi-icon">💾</span> Export / Import</button>
      <div class="menu-sep"></div>
      <button class="menu-item" id="miClearAll" style="color:var(--red)"><span class="mi-icon">🗑️</span> Clear all data</button>`;
    wrap.appendChild(dropdown);
    document.getElementById('miCats').addEventListener('click',()=>{dropdown.remove();openCategoryModal();});
    document.getElementById('miExport').addEventListener('click',()=>{dropdown.remove();openExportImportModal();});
    document.getElementById('miClearAll').addEventListener('click',()=>{
      dropdown.remove();
      customConfirm('Delete ALL data? This cannot be undone.',()=>{
        entries={};budgets={};recurring=[];noExpenseDays={};
        customCats={...DEFAULT_CATS};saveData();render();showToast('All data cleared');
      },null);
    });
    setTimeout(()=>{
      document.addEventListener('click',function handler(ev){
        if(!dropdown.contains(ev.target)){dropdown.remove();document.removeEventListener('click',handler);}
      });
    },0);
  });

  g('entryDate')&&g('entryDate').addEventListener('change',()=>{
    let val = g('entryDate').value;
    const normalized = normalizeEntryDate(val);
    if(val !== normalized){
      showToast(`Select a date in ${MONTHS[viewMonth]} ${viewYear}`);
      val = normalized;
      g('entryDate').value = val;
    }
    formDate = val;
    g('formDateDisp').textContent = fmtDate(formDate);
  });

  const entryDateControl = g('entryDateControl');
  const entryDatePopover = g('entryDatePopover');
  const entryDateInput = g('entryDate');
  function showEntryDatePopover(){
    if(entryDatePopover) entryDatePopover.hidden = false;
  }
  function hideEntryDatePopover(){
    if(entryDatePopover) entryDatePopover.hidden = true;
  }
  if(entryDateInput && entryDatePopover){
    entryDateInput.addEventListener('click', showEntryDatePopover);
    entryDateInput.addEventListener('focus', showEntryDatePopover);
    entryDateInput.addEventListener('keydown', ev => {
      if(ev.key === 'ArrowDown' || ev.key === 'Enter'){
        ev.preventDefault();
        showEntryDatePopover();
      }
      if(ev.key === 'Escape') hideEntryDatePopover();
    });
    entryDatePopover.querySelectorAll('.entry-date-day:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => {
        formDate = btn.dataset.date;
        entryDateInput.value = formDate;
        g('formDateDisp').textContent = fmtDate(formDate);
        entryDatePopover.querySelectorAll('.entry-date-day').forEach(day => day.classList.toggle('active', day.dataset.date === formDate));
        hideEntryDatePopover();
        updateLive();
      });
    });
    document.addEventListener('click', ev => {
      if(entryDateControl && !entryDateControl.contains(ev.target)) hideEntryDatePopover();
    });
  }

  function syncRows(){
    document.querySelectorAll('.entry-block[data-idx]').forEach(block=>{
      const i=+block.dataset.idx;
      if(!formRows[i]) return;
      const cat=block.querySelector('.row-cat'); if(cat) formRows[i].cat=cat.value;
      const amt=block.querySelector('.row-amt'); if(amt) formRows[i].amount=amt.value;
      const note=block.querySelector('.row-note'); if(note) formRows[i].notes=note.value;
      const rec=block.querySelector('.row-rec-chk'); if(rec) formRows[i].rec=rec.checked;
      const pm=block.querySelector('.pay-method-btn.active'); if(pm) formRows[i].payMethod=pm.dataset.method;
    });
    if(g('entryDate')) formDate=g('entryDate').value;
    updateLive();
  }
  document.querySelectorAll('.row-cat').forEach(el=>el.addEventListener('change',syncRows));
  document.querySelectorAll('.row-amt').forEach(el=>el.addEventListener('input',syncRows));
  document.querySelectorAll('.row-note').forEach(el=>el.addEventListener('input',syncRows));
  document.querySelectorAll('.pay-method-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const i=+btn.dataset.idx;
    document.querySelectorAll(`.pay-method-btn[data-idx="${i}"]`).forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    formRows[i].payMethod=btn.dataset.method;
  }));

  document.querySelectorAll('.qa-btn').forEach(el=>{
    el.addEventListener('click',()=>{
      const i=+el.dataset.idx;
      const v=parseFloat(el.dataset.val)||0;
      const block=document.querySelector(`.entry-block[data-idx="${i}"]`);
      if(!block) return;
      const amtInput=block.querySelector('.row-amt');
      if(!amtInput) return;
      const curr=parseFloat(amtInput.value)||0;
      amtInput.value=curr+v;
      formRows[i].amount=String(curr+v);
      updateLive();
    });
  });

  g('addRowBtn')&&g('addRowBtn').addEventListener('click',()=>{
    syncRows();
    formRows.push({cat:Object.keys(customCats)[0]||'lunch',amount:'',notes:'',rec:false,payMethod:defaultPaymentMethod()});
    rebuildFormRows();
  });

  document.querySelectorAll('.remove-row-btn').forEach(el=>{
    el.addEventListener('click',()=>{
      syncRows();formRows.splice(+el.dataset.idx,1);rebuildFormRows();
    });
  });

  g('saveBtn')&&g('saveBtn').addEventListener('click',()=>{
    syncRows();
    const iso=formDate||today();

    if(!validateEntryDate(iso)) return;

    const valid=formRows.filter(r=>parseFloat(r.amount)>0);
    if(!valid.length){showToast('Enter at least one amount');return;}
    clearNoExpenseDay(iso);
    if(!entries[iso]) entries[iso]=[];
    valid.forEach(r=>{
      const entry={id:uid(),cat:r.cat,amount:parseFloat(r.amount),payMethod:r.payMethod||'upi'};
      if(r.notes&&r.notes.trim()) entry.notes=r.notes.trim();
      entries[iso].push(entry);
      if(r.rec){
        const exists=recurring.some(re=>re.cat===r.cat&&re.amount===parseFloat(r.amount));
        if(!exists) recurring.push({id:uid(),cat:r.cat,amount:parseFloat(r.amount),notes:r.notes||'',payMethod:r.payMethod||defaultPaymentMethod()});
      }
    });
    saveData();
    formRows=[{cat:Object.keys(customCats)[0]||'lunch',amount:'',notes:'',rec:false,payMethod:defaultPaymentMethod()}];
    // Clear read alerts so new overspends show as unread
    sbData.readAlerts=[];
    saveSbData();
    render();showToast(`${valid.length} item${valid.length!==1?'s':''} saved ✓`);
    renderPaySplit();
  });

  g('clearFormBtn')&&g('clearFormBtn').addEventListener('click',()=>{
    formRows=[{cat:Object.keys(customCats)[0]||'lunch',amount:'',notes:'',rec:false,payMethod:defaultPaymentMethod()}];
    rebuildFormRows();
  });

  g('noExpenseBtn')&&g('noExpenseBtn').addEventListener('click',()=>{
    const iso=formDate||today();
    if(!validateEntryDate(iso)) return;
    markNoExpenseDay(iso);
    saveData();
    render();
    showToast(`${fmtDate(iso)} marked as no expense ✓`);
  });

  g('clearAllBtn')&&g('clearAllBtn').addEventListener('click',()=>{
    customConfirm(`Clear all entries for ${MONTHS[viewMonth]} ${viewYear}?`,()=>{
      monthDates(viewYear,viewMonth).forEach(k=>{ delete entries[k]; clearNoExpenseDay(k); });
      saveData();render();showToast('Month cleared');
    },null);
  });

  document.querySelectorAll('[id^="logRec-"]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const rid=btn.dataset.rid;
      const r=recurring.find(x=>x.id===rid);
      if(!r) return;
      const iso=formDate||today();
      if(!validateEntryDate(iso)) return;
      clearNoExpenseDay(iso);
      if(!entries[iso]) entries[iso]=[];
      entries[iso].push({id:uid(),cat:r.cat,amount:r.amount,notes:r.notes||'',payMethod:r.payMethod||defaultPaymentMethod()});
      saveData();render();showToast(`${customCats[r.cat]?.label||r.cat} logged ✓`);
    });
  });
  document.querySelectorAll('.del-rec').forEach(btn=>{
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const rid=btn.dataset.rid;
      customConfirm('Remove this recurring template?',()=>{
        recurring=recurring.filter(r=>r.id!==rid);saveData();render();
      },null);
    });
  });

  document.querySelectorAll('.day-header[data-iso]').forEach(el=>{
    el.addEventListener('click',()=>{
      const iso=el.dataset.iso;
      const card=g('dc-'+iso);const list=g('el-'+iso);
      const open=list.style.display!=='none';
      list.style.display=open?'none':'block';
      card.classList.toggle('expanded',!open);
    });
  });

  document.querySelectorAll('.icon-btn.del:not(.del-rec):not(.del-cat-btn)').forEach(el=>{
    el.addEventListener('click',e=>{
      e.stopPropagation();
      const{iso,eid}=el.dataset;
      customConfirm('Delete this item?',()=>{
        entries[iso]=(entries[iso]||[]).filter(e=>e.id!==eid);
        if(!(entries[iso]||[]).length) delete entries[iso];
        saveData();render();showToast('Item deleted');
      },null);
    });
  });

  document.querySelectorAll('.icon-btn.edit-btn').forEach(el=>{
    el.addEventListener('click',e=>{
      e.stopPropagation();
      const{iso,eid}=el.dataset;
      const entry=(entries[iso]||[]).find(e=>e.id===eid);
      if(!entry) return;
      const item=g('ei-'+eid);
      if(!item) return;
      item.insertAdjacentHTML('afterend',`<div class="entry-edit-form" id="ef-${eid}">
        <div class="edit-grid">
          <select id="ec-${eid}">${catOptions(entry.cat)}</select>
          <input type="number" id="ea-${eid}" value="${entry.amount}" min="0" step="0.01" placeholder="0">
        </div>
        <input type="text" id="en-${eid}" value="${entry.notes||''}" placeholder="Note (optional)..." style="margin-bottom:8px">
        <div class="edit-actions">
          <button class="btn btn-primary btn-sm" id="esave-${eid}">Update</button>
          <button class="btn btn-ghost btn-sm" id="ecancel-${eid}">Cancel</button>
        </div>
      </div>`);
      item.style.display='none';
      g('esave-'+eid).addEventListener('click',ev=>{
        ev.stopPropagation();
        const newCat=g('ec-'+eid).value;
        const newAmt=parseFloat(g('ea-'+eid).value)||0;
        const newNote=g('en-'+eid)?.value||'';
        if(!newAmt){showToast('Enter a valid amount');return;}
        const idx=(entries[iso]||[]).findIndex(e=>e.id===eid);
        if(idx>=0) entries[iso][idx]={...entries[iso][idx],id:eid,cat:newCat,amount:newAmt,notes:newNote};
        saveData();render();
        requestAnimationFrame(()=>{
          const card=g('dc-'+iso);const list=g('el-'+iso);
          if(card&&list){list.style.display='block';card.classList.add('expanded');}
        });
        showToast('Item updated ✓');
      });
      g('ecancel-'+eid).addEventListener('click',ev=>{
        ev.stopPropagation();
        g('ef-'+eid).remove();
        item.style.display='';
      });
    });
  });

  bindSwipeToDelete();
}

/* ── SWIPE TO DELETE ─────────────────────────────── */
function bindSwipeToDelete(){
  document.querySelectorAll('.entry-item').forEach(el=>{
    let startX=0,currentX=0,swiping=false;
    const delBg=el.querySelector('.swipe-del-bg');
    el.addEventListener('touchstart',e=>{
      startX=e.touches[0].clientX;swiping=true;currentX=0;
    },{passive:true});
    el.addEventListener('touchmove',e=>{
      if(!swiping) return;
      currentX=e.touches[0].clientX-startX;
      if(currentX<0){
        const offset=Math.max(currentX,-100);
        el.style.transform=`translateX(${offset}px)`;
        if(delBg) delBg.style.opacity=Math.min(1,Math.abs(offset)/60)+'';
        if(Math.abs(currentX)>10) e.preventDefault();
      }
    },{passive:false});
    el.addEventListener('touchend',()=>{
      swiping=false;
      if(currentX<-70){
        const iso=el.dataset.iso,eid=el.dataset.eid;
        el.style.transform='translateX(-100%)';
        el.style.opacity='0';
        setTimeout(()=>{
          customConfirm('Delete this item?',()=>{
            entries[iso]=(entries[iso]||[]).filter(e=>e.id!==eid);
            if(!(entries[iso]||[]).length) delete entries[iso];
            saveData();render();showToast('Item deleted');
          },()=>{el.style.transform='';el.style.opacity='';if(delBg)delBg.style.opacity='0';});
        },200);
      } else {
        el.style.transform='';if(delBg) delBg.style.opacity='0';
      }
    });
  });
}

/* ── REBUILD FORM ROWS ───────────────────────────── */
function rebuildFormRows(){
  const card=document.getElementById('formCard');
  if(!card){render();return;}
  card.querySelectorAll('.entry-block,.add-row-btn').forEach(el=>el.remove());
  const footer=card.querySelector('.form-footer');
  const tmp=document.createElement('div');
  tmp.innerHTML=formRows.map((r,i)=>buildFormBlock(r,i,i===0)).join('')+
    `<button class="add-row-btn" id="addRowBtn">＋ Add another item</button>`;
  while(tmp.firstChild) footer.before(tmp.firstChild);

  function syncRows(){
    document.querySelectorAll('.entry-block[data-idx]').forEach(block=>{
      const i=+block.dataset.idx;
      if(!formRows[i]) return;
      const cat=block.querySelector('.row-cat'); if(cat) formRows[i].cat=cat.value;
      const amt=block.querySelector('.row-amt'); if(amt) formRows[i].amount=amt.value;
      const note=block.querySelector('.row-note'); if(note) formRows[i].notes=note.value;
      const rec=block.querySelector('.row-rec-chk'); if(rec) formRows[i].rec=rec.checked;
      const pm=block.querySelector('.pay-method-btn.active'); if(pm) formRows[i].payMethod=pm.dataset.method;
    });
    if(document.getElementById('entryDate')) formDate=document.getElementById('entryDate').value;
    updateLive();
  }
  card.querySelectorAll('.row-cat').forEach(el=>el.addEventListener('change',syncRows));
  card.querySelectorAll('.row-amt').forEach(el=>el.addEventListener('input',syncRows));
  card.querySelectorAll('.row-note').forEach(el=>el.addEventListener('input',syncRows));
  card.querySelectorAll('.pay-method-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const i=+btn.dataset.idx;
    card.querySelectorAll(`.pay-method-btn[data-idx="${i}"]`).forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    formRows[i].payMethod=btn.dataset.method;
  }));
  card.querySelectorAll('.qa-btn').forEach(el=>{
    el.addEventListener('click',()=>{
      const i=+el.dataset.idx;const v=parseFloat(el.dataset.val)||0;
      const block=document.querySelector(`.entry-block[data-idx="${i}"]`);
      const amtInput=block?.querySelector('.row-amt');if(!amtInput)return;
      const curr=parseFloat(amtInput.value)||0;amtInput.value=curr+v;
      formRows[i].amount=String(curr+v);updateLive();
    });
  });
  document.getElementById('addRowBtn').addEventListener('click',()=>{
    syncRows();formRows.push({cat:Object.keys(customCats)[0]||'lunch',amount:'',notes:'',rec:false,payMethod:defaultPaymentMethod()});rebuildFormRows();
  });
  card.querySelectorAll('.remove-row-btn').forEach(el=>{
    el.addEventListener('click',()=>{syncRows();formRows.splice(+el.dataset.idx,1);rebuildFormRows();});
  });
  updateLive();
}

/* ── ANIMATED COUNTERS ───────────────────────────── */
function animateCounters(){
  document.querySelectorAll('.stat-val,.ins-val').forEach(el=>{
    const text=el.textContent.trim();
    if(text==='—'||!text) return;
    const match=text.match(/^([+\-]?)(₹?)([\d,]+)$/);
    if(!match) return;
    const sign=match[1],prefix=match[2];
    const target=parseInt(match[3].replace(/,/g,''));
    if(isNaN(target)||target<200) return;
    const original=text;
    let startTime=null;
    const duration=500;
    const step=ts=>{
      if(!startTime) startTime=ts;
      const p=Math.min((ts-startTime)/duration,1);
      const eased=1-Math.pow(1-p,3);
      const curr=Math.round(eased*target);
      if(p<1){
        el.textContent=sign+prefix+curr.toLocaleString('en-IN');
        requestAnimationFrame(step);
      } else {
        el.textContent=original;
      }
    };
    requestAnimationFrame(step);
  });
}

function updateLive(){
  const t=formRows.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const el=document.getElementById('liveTotal');
  if(el) el.textContent=t>0?fmt(t):'₹0';
}
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2200);
}

/* ── BOOT ────────────────────────────────────────── */
const hasSessionUser = (function authGuard(){
  const user=JSON.parse(localStorage.getItem('exp_user')||'null');
  // Use replace() so auth redirect doesn't add to history
  // Back button won't loop back to a protected page
  if(!user||!user.loggedIn){
    window.location.replace(authPath());
    return false;
  }
  return true;
})();
if(hasSessionUser){
  loadData();   // load from localStorage instantly
  initTheme();
  render();
  // Then init Firebase and sync from Firestore in background
  initFirebase().then(()=>loadFromFirestore());
  setInterval(()=>{
    const n=new Date();
    if(n.getHours()===0&&n.getMinutes()===0){viewYear=nowYear();viewMonth=nowMonth();viewWeekStart=getWeekStart(today());render();}
  },60000);

/* ══════════════════════════════════════════════════
   SIDEBAR — Indian Features
══════════════════════════════════════════════════ */
// ── State ──
// sbData already initialized at top of script
// sbData: { fest, emis, payMethod, upiApp, payTags, catBudgets, alertSettings, savingsGoals, hh }
if(!sbData.fest) sbData.fest={active:false,festival:'diwali',budget:0,start:'',end:'',spends:{}};
if(!sbData.emis) sbData.emis=[];
if(!sbData.payMethod) sbData.payMethod='upi';
if(!sbData.upiApp) sbData.upiApp='gpay';
if(!sbData.payTags) sbData.payTags={};

function saveSbData(){ localStorage.setItem('sb_data',JSON.stringify(sbData)); }

// ── Toggle sidebar ──
function sbOpen(){
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sbToggle').classList.add('open');
  // Arrow points LEFT when open (← = collapse)
  document.getElementById('sbToggle').querySelector('svg').style.transform='rotate(180deg)';
  document.getElementById('appWrap').classList.add('sb-open');
  if(window.innerWidth<768) document.getElementById('sbOverlay').classList.add('show');
}
function sbClose(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sbOverlay').classList.remove('show');
  document.getElementById('sbToggle').classList.remove('open');
  // Arrow points RIGHT when closed (→ = expand)
  document.getElementById('sbToggle').querySelector('svg').style.transform='rotate(0deg)';
  document.getElementById('appWrap').classList.remove('sb-open');
}
document.getElementById('sbToggle').addEventListener('click',()=>{ document.getElementById('sidebar').classList.contains('open')?sbClose():sbOpen(); });
document.getElementById('sbClose').addEventListener('click',sbClose);
document.getElementById('sbOverlay').addEventListener('click',sbClose);
// Open by default on desktop
if(window.innerWidth>=768){ sbOpen(); document.getElementById('sbToggle').querySelector('svg').style.transform='rotate(180deg)'; }
// ── Accordion ──
function sbToggleSection(id){
  const s=document.getElementById(id);
  s.classList.toggle('open');
  if(id==='sbPaySection'&&s.classList.contains('open')) renderPaySplit();
  if(id==='sbBudgetSection'&&s.classList.contains('open')) renderCatBudgets();
}

// ── FESTIVAL MODE ──
const festToggle=document.getElementById('festModeToggle');
festToggle.checked=sbData.fest.active;
document.getElementById('festModeBody').style.display=sbData.fest.active?'block':'none';
festToggle.addEventListener('change',()=>{ sbData.fest.active=festToggle.checked; saveSbData(); document.getElementById('festModeBody').style.display=festToggle.checked?'block':'none'; updateFestUI(); });
document.getElementById('festSelect').value=sbData.fest.festival||'diwali';
document.getElementById('festBudget').value=sbData.fest.budget||'';
document.getElementById('festStart').value=sbData.fest.start||'';
document.getElementById('festEnd').value=sbData.fest.end||'';
['festSelect','festBudget','festStart','festEnd'].forEach(id=>{ document.getElementById(id).addEventListener('change',()=>{ sbData.fest.festival=document.getElementById('festSelect').value; sbData.fest.budget=parseFloat(document.getElementById('festBudget').value)||0; sbData.fest.start=document.getElementById('festStart').value; sbData.fest.end=document.getElementById('festEnd').value; saveSbData(); updateFestUI(); }); });

// Festival chips
document.querySelectorAll('#festChips .sb-chip').forEach(chip=>{
  const cat=chip.dataset.cat;
  if(sbData.fest.spends[cat]) chip.classList.add('active');
  chip.addEventListener('click',()=>{
    chip.classList.toggle('active');
    const inputWrap=document.getElementById('festInput_'+cat);
    if(chip.classList.contains('active')){
      if(!inputWrap){
        const d=document.createElement('div');
        d.className='sb-chip-amt show'; d.id='festInput_'+cat;
        d.innerHTML=`<span>${chip.textContent}</span><span style="color:#475569">₹</span><input type="number" placeholder="0" value="${sbData.fest.spends[cat]||''}" min="0" oninput="sbData.fest.spends['${cat}']=parseFloat(this.value)||0;saveSbData();updateFestUI()">`;
        document.getElementById('festChipInputs').appendChild(d);
      } else { inputWrap.classList.add('show'); }
    } else {
      delete sbData.fest.spends[cat];
      if(inputWrap) inputWrap.classList.remove('show');
      saveSbData(); updateFestUI();
    }
  });
});

function updateFestUI(){
  const budget=sbData.fest.budget||0;
  const spent=Object.values(sbData.fest.spends||{}).reduce((a,b)=>a+b,0);
  const pct=budget>0?Math.min(100,(spent/budget)*100):0;
  const prog=document.getElementById('festBudgetProgress');
  if(budget>0){ prog.style.display='block'; document.getElementById('festProgFill').style.width=pct+'%'; document.getElementById('festSpentLabel').textContent='₹'+Math.round(spent).toLocaleString('en-IN')+' spent'; document.getElementById('festRemainingLabel').textContent='₹'+Math.round(Math.max(0,budget-spent)).toLocaleString('en-IN')+' remaining'; }
  else { prog.style.display='none'; }
  document.getElementById('festTotalSpend').textContent='₹'+Math.round(spent).toLocaleString('en-IN');
  document.getElementById('festBudgetLeft').textContent='₹'+Math.round(Math.max(0,budget-spent)).toLocaleString('en-IN');
}
function saveFestData(){ saveSbData(); showToast('Festival data saved ✓'); updateFestUI(); }
updateFestUI();

// ── PAYMENT SPLIT ──
function renderPaySplit(){
  const allTime=document.getElementById('payAllTime')?.checked||false;
  const prefix=monthKey(viewYear,viewMonth); // always use current month unless all-time toggled
  const counts={cash:0,upi:0,card:0,nb:0};
  const amounts={cash:0,upi:0,card:0,nb:0};
  const upiApps={gpay:0,phonepe:0,paytm:0,other:0};

  Object.entries(entries).forEach(([date,items])=>{
    if(!allTime&&!date.startsWith(prefix)) return;
    (items||[]).forEach(entry=>{
      const m=entry.payMethod||'upi';
      counts[m]=(counts[m]||0)+1;
      amounts[m]=(amounts[m]||0)+entry.amount;
      // UPI app from sbData.payTags (legacy) or default
      if(m==='upi'){
        const tag=sbData.payTags?.[date];
        const app=tag?.upiApp||'other';
        upiApps[app]=(upiApps[app]||0)+entry.amount;
      }
    });
  });
  const total=Object.values(counts).reduce((a,b)=>a+b,0)||1;
  const totalAmt=Object.values(amounts).reduce((a,b)=>a+b,0)||1;
  const digital=counts.upi+counts.card+counts.nb;
  const digitalPct=Math.round((digital/total)*100);
  // Donut
  const canvas=document.getElementById('payDonut');
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,80,80);
  const colors={cash:'#F97316',upi:'#3B82F6',card:'#8B5CF6',nb:'#10B981'};
  let start=0;
  Object.entries(counts).forEach(([k,v])=>{ const slice=(v/total)*Math.PI*2; ctx.beginPath(); ctx.moveTo(40,40); ctx.arc(40,40,36,start,start+slice); ctx.closePath(); ctx.fillStyle=colors[k]; ctx.fill(); start+=slice; });
  ctx.beginPath(); ctx.arc(40,40,22,0,Math.PI*2); ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()||'#fff'; ctx.fill();
  ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--text').trim()||'#000'; ctx.font='bold 11px Inter,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(digitalPct+'%',40,40);
  // Legend
  const labels={cash:'Cash',upi:'UPI',card:'Card',nb:'Net Banking'};
  document.getElementById('payLegend').innerHTML=Object.entries(counts).map(([k,v])=>`<div class="sb-legend-item"><div class="sb-legend-dot" style="background:${colors[k]}"></div>${labels[k]}: <strong style="color:#E2E8F0;margin-left:2px">${Math.round((v/total)*100)}%</strong></div>`).join('');
  // Stats
  document.getElementById('payStats').innerHTML=`<div class="sb-stat-row"><span class="sb-stat-lbl">Cash spent</span><span class="sb-stat-val orange">₹${Math.round(amounts.cash).toLocaleString('en-IN')}</span></div><div class="sb-stat-row"><span class="sb-stat-lbl">Digital spent</span><span class="sb-stat-val blue">₹${Math.round(amounts.upi+amounts.card+amounts.nb).toLocaleString('en-IN')}</span></div>`;
  document.getElementById('payInsight').textContent=`You prefer digital — ${digitalPct}% of transactions`;
}
// Payment method chips
document.querySelectorAll('#payMethodChips .sb-chip').forEach(c=>{ c.addEventListener('click',()=>{ document.querySelectorAll('#payMethodChips .sb-chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); sbData.payMethod=c.dataset.method; saveSbData(); document.getElementById('upiAppRow').style.display=c.dataset.method==='upi'?'flex':'none'; }); });
document.querySelectorAll('#upiAppRow .sb-chip').forEach(c=>{ c.addEventListener('click',()=>{ document.querySelectorAll('#upiAppRow .sb-chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); sbData.upiApp=c.dataset.upi; saveSbData(); }); });
// Set active chips from saved state
document.querySelectorAll('#payMethodChips .sb-chip').forEach(c=>c.classList.toggle('active',c.dataset.method===sbData.payMethod));
document.querySelectorAll('#upiAppRow .sb-chip').forEach(c=>c.classList.toggle('active',c.dataset.upi===sbData.upiApp));
document.getElementById('upiAppRow').style.display=sbData.payMethod==='upi'?'flex':'none';
// Tag payment on save — now handled per-entry in formRows
renderPaySplit();

// ── EMI TRACKER ──
function sbShowEmiForm(){ document.getElementById('emiForm').style.display='block'; document.getElementById('emiName').focus(); }
function saveEmi(){
  const name=document.getElementById('emiName').value.trim();
  const total=parseFloat(document.getElementById('emiTotal').value)||0;
  const monthly=parseFloat(document.getElementById('emiMonthly').value)||0;
  const start=document.getElementById('emiStart').value;
  const duration=parseInt(document.getElementById('emiDuration').value)||0;
  const lender=document.getElementById('emiLender').value.trim();
  if(!name||!total||!monthly||!start||!duration){ showToast('Fill all EMI fields'); return; }
  sbData.emis.push({id:Math.random().toString(36).slice(2),name,total,monthly,start,duration,lender,paid:[]});
  saveSbData(); renderEmis();
  document.getElementById('emiForm').style.display='none';
  ['emiName','emiTotal','emiMonthly','emiStart','emiDuration','emiLender'].forEach(id=>document.getElementById(id).value='');
  showToast('EMI added ✓');
}
function renderEmis(){
  const todayISO=today();
  const active=sbData.emis.filter(e=>{ const paid=e.paid?.length||0; return paid<e.duration; });
  const closed=sbData.emis.filter(e=>{ const paid=e.paid?.length||0; return paid>=e.duration; });
  let html='';
  active.forEach(emi=>{
    const paid=emi.paid?.length||0;
    const pct=Math.round((paid/emi.duration)*100);
    const outstanding=Math.max(0,emi.total-(paid*emi.monthly));
    // Next due date
    const startD=new Date(emi.start+'T00:00:00');
    startD.setMonth(startD.getMonth()+paid);
    const dueISO=`${startD.getFullYear()}-${String(startD.getMonth()+1).padStart(2,'0')}-${String(startD.getDate()).padStart(2,'0')}`;
    const daysUntil=Math.round((new Date(dueISO)-new Date(todayISO))/(86400000));
    const dueClass=daysUntil<=0?'urgent':daysUntil<=3?'soon':'';
    html+=`<div class="sb-emi-item">
      <div class="sb-emi-header">
        <div><div class="sb-emi-name">${emi.name}</div><div class="sb-emi-lender">${emi.lender||'—'}</div></div>
        <div style="text-align:right"><div class="sb-emi-amt">₹${emi.monthly.toLocaleString('en-IN')}/mo</div><button onclick="deleteEmi('${emi.id}')" style="background:none;border:none;color:#475569;cursor:pointer;font-size:11px;margin-top:2px">✕ Remove</button></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748B;margin-bottom:4px"><span>${paid} of ${emi.duration} months paid</span><span>₹${Math.round(outstanding).toLocaleString('en-IN')} left</span></div>
      <div class="sb-prog-bg"><div class="sb-prog-fill green" style="width:${pct}%"></div></div>
      <div class="sb-emi-due ${dueClass}" style="margin-top:6px">Next due: ${dueISO}${daysUntil<=0?' (Overdue!)':daysUntil<=3?' (Due soon!)':''}</div>
      <label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:#94A3B8;cursor:pointer">
        <input type="checkbox" onchange="markEmiPaid('${emi.id}',this.checked)" style="accent-color:#F97316"> Mark this month as paid
      </label>
    </div>`;
  });
  if(!active.length) html='<div class="sb-info">No active EMIs. Add one below.</div>';
  if(closed.length) html+=`<div style="font-size:11px;font-weight:600;color:#475569;margin:8px 0 4px;text-transform:uppercase;letter-spacing:.06em">✓ Closed (${closed.length})</div>`+closed.map(e=>`<div style="background:#1E293B;border-radius:8px;padding:8px 10px;margin-bottom:6px;font-size:12px;color:#475569">${e.name} — Completed</div>`).join('');
  document.getElementById('emiList').innerHTML=html;
  const totalBurden=active.reduce((s,e)=>s+e.monthly,0);
  document.getElementById('emiSummary').innerHTML=`Total EMI burden: <strong>₹${totalBurden.toLocaleString('en-IN')}</strong>/month`;
}
function markEmiPaid(id,checked){
  const emi=sbData.emis.find(e=>e.id===id);
  if(!emi) return;
  const mo=monthKey(viewYear,viewMonth);
  if(checked){ if(!emi.paid.includes(mo)) emi.paid.push(mo); }
  else { emi.paid=emi.paid.filter(m=>m!==mo); }
  saveSbData(); renderEmis();
}
function deleteEmi(id){ customConfirm('Remove this EMI?',()=>{ sbData.emis=sbData.emis.filter(e=>e.id!==id); saveSbData(); renderEmis(); },null); }
renderEmis();

// ── HOUSEHOLD & FAMILY ──
if(!sbData.hh) sbData.hh={grocBudget:0,grocItems:[],utilities:[],vehicles:[],eduFunds:[]};
document.getElementById('grocBudget').value=sbData.hh.grocBudget||'';
function saveHhData(){ sbData.hh.grocBudget=parseFloat(document.getElementById('grocBudget').value)||0; saveSbData(); renderGrocery(); }
function addGrocItem(){ const name=prompt('Item name (e.g. Rice, Milk):'); if(!name) return; const est=parseFloat(prompt('Estimated cost (₹):'))||0; sbData.hh.grocItems.push({id:uid(),name,est,actual:0}); saveSbData(); renderGrocery(); }
function deleteGrocItem(id){ sbData.hh.grocItems=sbData.hh.grocItems.filter(i=>i.id!==id); saveSbData(); renderGrocery(); }
function renderGrocery(){
  const items=sbData.hh.grocItems||[];
  const totalEst=items.reduce((s,i)=>s+i.est,0);
  const totalAct=items.reduce((s,i)=>s+i.actual,0);
  let html=items.map(i=>`<div style="background:var(--surface-2);border-radius:8px;padding:8px 10px;margin-bottom:6px;border:1px solid var(--border)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span style="font-size:12px;font-weight:600;color:var(--text)">${i.name}</span><button onclick="deleteGrocItem('${i.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px">✕</button></div><div style="display:flex;gap:8px;font-size:11px;align-items:center"><span style="color:var(--muted)">Est: ₹${i.est}</span><input type="number" placeholder="Actual" value="${i.actual||''}" onchange="sbData.hh.grocItems.find(x=>x.id==='${i.id}').actual=parseFloat(this.value)||0;saveSbData();renderGrocery()" style="width:70px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:2px 6px;font-size:11px;color:var(--text)"></div></div>`).join('');
  if(!items.length) html='<div class="sb-info">No items yet.</div>';
  document.getElementById('grocList').innerHTML=html;
  const budget=sbData.hh.grocBudget||0;
  const pct=budget>0?Math.min(100,(totalAct/budget)*100):0;
  document.getElementById('grocSummary').innerHTML=budget>0?`<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px"><span>Est: ₹${totalEst}</span><span>Actual: ₹${totalAct}</span></div><div class="sb-prog-bg"><div class="sb-prog-fill" style="width:${pct}%"></div></div>`:'';
}
renderGrocery();

function addUtility(){ const name=prompt('Utility name (e.g. Electricity, Internet):'); if(!name) return; sbData.hh.utilities.push({id:uid(),name,history:[]}); saveSbData(); renderUtilities(); }
function deleteUtility(id){ sbData.hh.utilities=sbData.hh.utilities.filter(u=>u.id!==id); saveSbData(); renderUtilities(); }
function logUtility(id){ const inp=document.getElementById('util_'+id); const amt=parseFloat(inp.value); if(!amt||amt<=0){showToast('Enter an amount');return;} const u=sbData.hh.utilities.find(x=>x.id===id); if(!u) return; u.history.push({amt,month:`${MONTHS_S[viewMonth]} ${viewYear}`,date:today()}); inp.value=''; saveSbData(); renderUtilities(); showToast('Utility logged ✓'); }
function renderUtilities(){
  const utils=sbData.hh.utilities||[];
  let html=utils.map(u=>`<div style="background:var(--surface-2);border-radius:8px;padding:10px;margin-bottom:6px;border:1px solid var(--border)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:12px;font-weight:600;color:var(--text)">${u.name}</span><button onclick="deleteUtility('${u.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px">✕</button></div><div style="display:flex;gap:6px;margin-bottom:4px"><input type="number" placeholder="₹ amount" id="util_${u.id}" style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px;color:var(--text)"><button onclick="logUtility('${u.id}')" class="sb-ghost-btn" style="padding:5px 10px;font-size:11px">Log</button></div>${u.history.length?`<div style="font-size:10px;color:var(--muted)">Last 3: ${u.history.slice(-3).map(h=>`₹${h.amt} (${h.month})`).join(', ')}</div>`:''}</div>`).join('');
  if(!utils.length) html='<div class="sb-info">No utilities tracked yet.</div>';
  document.getElementById('utilityList').innerHTML=html;
}
renderUtilities();

function addVehicle(){ const name=prompt('Vehicle name (e.g. Honda City):'); if(!name) return; sbData.hh.vehicles.push({id:uid(),name,expenses:[]}); saveSbData(); renderVehicles(); }
function deleteVehicle(id){ sbData.hh.vehicles=sbData.hh.vehicles.filter(v=>v.id!==id); saveSbData(); renderVehicles(); }
function logVehExp(id,type){ const amt=parseFloat(prompt(`${type} amount (₹):`)); if(!amt||amt<=0) return; const v=sbData.hh.vehicles.find(x=>x.id===id); if(!v) return; v.expenses.push({type,amt,date:today()}); saveSbData(); renderVehicles(); showToast('Vehicle expense logged ✓'); }
function renderVehicles(){
  const vehs=sbData.hh.vehicles||[];
  let html=vehs.map(v=>`<div style="background:var(--surface-2);border-radius:8px;padding:10px;margin-bottom:6px;border:1px solid var(--border)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:12px;font-weight:600;color:var(--text)">${v.name}</span><button onclick="deleteVehicle('${v.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px">✕</button></div><div style="display:flex;gap:4px;margin-bottom:6px;flex-wrap:wrap">${['⛽ Fuel','🔧 Service','📄 Insurance','🛣️ Toll'].map(t=>`<button onclick="logVehExp('${v.id}','${t}')" class="sb-chip" style="font-size:10px;padding:3px 8px">${t}</button>`).join('')}</div><div style="font-size:11px;color:var(--muted)">Total: <strong style="color:var(--text)">₹${Math.round(v.expenses.reduce((s,e)=>s+e.amt,0)).toLocaleString('en-IN')}</strong></div></div>`).join('');
  if(!vehs.length) html='<div class="sb-info">No vehicles added yet.</div>';
  document.getElementById('vehicleList').innerHTML=html;
}
renderVehicles();

function addEduFund(){ const name=prompt('Child name:'); if(!name) return; const target=parseFloat(prompt('College fund target (₹):'))||0; const year=parseInt(prompt('Target year (e.g. 2035):'))||new Date().getFullYear()+10; sbData.hh.eduFunds.push({id:uid(),name,target,year,saved:0}); saveSbData(); renderEduFunds(); }
function deleteEduFund(id){ sbData.hh.eduFunds=sbData.hh.eduFunds.filter(f=>f.id!==id); saveSbData(); renderEduFunds(); }
function addToEduFund(id){ const inp=document.getElementById('edu_'+id); const amt=parseFloat(inp.value); if(!amt||amt<=0){showToast('Enter an amount');return;} const f=sbData.hh.eduFunds.find(x=>x.id===id); if(!f) return; f.saved+=amt; inp.value=''; saveSbData(); renderEduFunds(); showToast('Added to education fund ✓'); }
function renderEduFunds(){
  const funds=sbData.hh.eduFunds||[];
  let html=funds.map(f=>{
    const pct=f.target>0?Math.min(100,(f.saved/f.target)*100):0;
    const yearsLeft=f.year-new Date().getFullYear();
    return `<div style="background:var(--surface-2);border-radius:8px;padding:10px;margin-bottom:6px;border:1px solid var(--border)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div><div style="font-size:12px;font-weight:600;color:var(--text)">${f.name}</div><div style="font-size:10px;color:var(--muted)">Target: ₹${Math.round(f.target).toLocaleString('en-IN')} by ${f.year}</div></div><button onclick="deleteEduFund('${f.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px">✕</button></div><div style="display:flex;gap:6px;margin-bottom:4px"><input type="number" placeholder="Add ₹" id="edu_${f.id}" style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px;color:var(--text)"><button onclick="addToEduFund('${f.id}')" class="sb-ghost-btn" style="padding:5px 10px;font-size:11px">Add</button></div><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:3px"><span>₹${Math.round(f.saved).toLocaleString('en-IN')} saved</span><span>${yearsLeft>0?yearsLeft+' yrs left':'Target reached!'}</span></div><div class="sb-prog-bg"><div class="sb-prog-fill green" style="width:${pct}%"></div></div></div>`;
  }).join('');
  if(!funds.length) html='<div class="sb-info">No education funds set up yet.</div>';
  document.getElementById('eduList').innerHTML=html;
}
renderEduFunds();

// ── CATEGORY BUDGET LIMITS, ALERTS & SAVINGS GOALS ──
if(!sbData.savingsGoals) sbData.savingsGoals=[];

// Init alert settings UI
document.getElementById('alertsEnabled').checked=sbData.alertSettings.enabled;
document.getElementById('alertThreshold').value=sbData.alertSettings.threshold;
function saveBudgetAlertSettings(){
  sbData.alertSettings={
    enabled: document.getElementById('alertsEnabled').checked === true,
    threshold: parseInt(document.getElementById('alertThreshold').value)||80
  };
  saveSbData();
  renderCatBudgets();
  // Re-render nav in real-time so bell icon appears/disappears immediately
  document.getElementById('navArea').innerHTML = buildNav();
  bindEvents();
}

function renderCatBudgets(){
  const cats=Object.entries(customCats);
  const spent=monthCatTotals(viewYear,viewMonth);
  const threshold=sbData.alertSettings?.threshold||80;
  const enabled=sbData.alertSettings?.enabled===true; // strict: only true if explicitly true

  // Always sync toggle UI to saved state
  const toggleEl=document.getElementById('alertsEnabled');
  const thresholdEl=document.getElementById('alertThreshold');
  if(toggleEl) toggleEl.checked=enabled;
  if(thresholdEl) thresholdEl.value=threshold;
  let alertsHtml='';

  // Only show categories that have a budget set
  const budgetedCats=cats.filter(([k])=>sbData.catBudgets[k]>0);

  if(!budgetedCats.length){
    document.getElementById('catBudgetList').innerHTML=`<div class="sb-info">No category budgets set yet.<br>Click <strong>Set budget</strong> → <em>Category-wise</em> to add limits.</div>`;
    document.getElementById('alertsList').innerHTML=`<div style="font-size:11px;color:var(--muted);text-align:center;padding:4px 0">${enabled?'No alerts — no category budgets set':'Alerts disabled'}</div>`;
    return;
  }

  const html=budgetedCats.map(([k,c])=>{
    const limit=sbData.catBudgets[k];
    const s=spent[k]||0;
    const pct=Math.min(100,(s/limit)*100);
    const over=s>=limit;
    const nearLimit=pct>=threshold&&!over;
    if(enabled&&pct>=threshold){
      const msg=over
        ?`Over budget on <strong>${c.label}</strong>! Spent ₹${Math.round(s).toLocaleString('en-IN')} of ₹${Math.round(limit).toLocaleString('en-IN')}`
        :`<strong>${c.label}</strong>: ${Math.round(pct)}% used (₹${Math.round(s).toLocaleString('en-IN')} / ₹${Math.round(limit).toLocaleString('en-IN')})`;
      alertsHtml+=`<div style="background:${over?'var(--red-bg)':'var(--orange-bg)'};border:1px solid ${over?'var(--red-bd)':'var(--orange-bd)'};border-radius:8px;padding:8px 10px;margin-bottom:6px;font-size:12px;color:${over?'var(--red)':'var(--orange)'}">
        ${over?'🚨':'⚠️'} ${msg}
      </div>`;
    }
    return `<div style="margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="width:10px;height:10px;border-radius:50%;background:${c.color};display:inline-block;flex-shrink:0"></span>
          <span style="font-size:12px;font-weight:600;color:var(--text)">${c.label}</span>
        </div>
        <span style="font-size:12px;font-weight:700;color:${over?'var(--red)':nearLimit?'var(--orange)':'var(--primary)'}">₹${Math.round(s).toLocaleString('en-IN')} / ₹${Math.round(limit).toLocaleString('en-IN')}</span>
      </div>
      <div class="sb-prog-bg"><div class="sb-prog-fill" style="width:${pct}%;background:${over?'var(--red)':nearLimit?'var(--orange)':'var(--primary)'}"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:2px">
        <span>${Math.round(pct)}% used</span>
        <span style="color:${over?'var(--red)':'var(--muted)'}">₹${Math.round(Math.max(0,limit-s)).toLocaleString('en-IN')} left</span>
      </div>
    </div>`;
  }).join('');

  document.getElementById('catBudgetList').innerHTML=html;
  document.getElementById('alertsList').innerHTML=alertsHtml||`<div style="font-size:11px;color:var(--muted);text-align:center;padding:4px 0">${enabled?'No alerts — all within limits ✓':'Alerts disabled'}</div>`;
}
renderCatBudgets();

// Savings Goals
function addSavingsGoal(){
  const name=prompt('Goal name (e.g. Emergency Fund, Vacation):');
  if(!name) return;
  const target=parseFloat(prompt('Target amount (₹):'))||0;
  const monthly=parseFloat(prompt('Monthly savings target (₹):'))||0;
  sbData.savingsGoals.push({id:uid(),name,target,monthly,saved:0,createdMonth:monthKey(viewYear,viewMonth)});
  saveSbData(); renderSavingsGoals();
}
function deleteSavingsGoal(id){ sbData.savingsGoals=sbData.savingsGoals.filter(g=>g.id!==id); saveSbData(); renderSavingsGoals(); }
function addToSavingsGoal(id){ const inp=document.getElementById('sav_'+id); const amt=parseFloat(inp.value); if(!amt||amt<=0){showToast('Enter an amount');return;} const g=sbData.savingsGoals.find(x=>x.id===id); if(!g) return; g.saved+=amt; inp.value=''; saveSbData(); renderSavingsGoals(); showToast('Savings updated ✓'); }
function renderSavingsGoals(){
  const goals=sbData.savingsGoals||[];
  let html=goals.map(g=>{
    const pct=g.target>0?Math.min(100,(g.saved/g.target)*100):0;
    const monthsNeeded=g.monthly>0?Math.ceil((g.target-g.saved)/g.monthly):null;
    return `<div style="background:var(--surface-2);border-radius:10px;padding:12px;margin-bottom:8px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${g.name}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:1px">Target: ₹${Math.round(g.target).toLocaleString('en-IN')} · ₹${Math.round(g.monthly).toLocaleString('en-IN')}/mo</div>
        </div>
        <button onclick="deleteSavingsGoal('${g.id}')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:11px">✕</button>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px">
        <span style="color:var(--green);font-weight:600">₹${Math.round(g.saved).toLocaleString('en-IN')} saved</span>
        <span>${monthsNeeded&&monthsNeeded>0?monthsNeeded+' months to go':'🎉 Goal reached!'}</span>
      </div>
      <div class="sb-prog-bg"><div class="sb-prog-fill green" style="width:${pct}%"></div></div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <input type="number" placeholder="Add ₹" id="sav_${g.id}" style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-size:12px;color:var(--text)">
        <button onclick="addToSavingsGoal('${g.id}')" class="sb-ghost-btn" style="padding:6px 12px;font-size:12px">Add</button>
      </div>
    </div>`;
  }).join('');
  if(!goals.length) html='<div class="sb-info">No savings goals yet. Add one below.</div>';
  document.getElementById('savingsGoalList').innerHTML=html;
}
renderSavingsGoals();

// renderCatBudgets is now called inside render() directly
Object.assign(window, {
  sbOpen,
  sbClose,
  sbToggleSection,
  saveFestData,
  renderPaySplit,
  sbShowEmiForm,
  saveEmi,
  renderEmis,
  markEmiPaid,
  deleteEmi,
  saveHhData,
  addGrocItem,
  deleteGrocItem,
  renderGrocery,
  addUtility,
  deleteUtility,
  logUtility,
  renderUtilities,
  addVehicle,
  deleteVehicle,
  logVehExp,
  renderVehicles,
  addEduFund,
  deleteEduFund,
  addToEduFund,
  renderEduFunds,
  saveBudgetAlertSettings,
  renderCatBudgets,
  addSavingsGoal,
  deleteSavingsGoal,
  addToSavingsGoal,
  renderSavingsGoals,
  saveSbData,
  updateFestUI
});
}
