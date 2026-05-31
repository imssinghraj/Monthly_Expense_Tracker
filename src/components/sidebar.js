window.BudgetraSidebarTemplate = `
<!-- Sidebar toggle button -->
<button class="sb-toggle" id="sbToggle" type="button" title="Toggle sidebar" aria-label="Toggle finance tools sidebar">
  <svg width="10" height="14" viewBox="0 0 10 14" fill="none"><path d="M2 2L8 7L2 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
</button>

<!-- Overlay -->
<div class="sb-overlay" id="sbOverlay"></div>

<!-- Sidebar -->
<aside class="sidebar" id="sidebar">
  <div class="sb-header">
    <div class="sb-header-brand">
      <div class="sb-header-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/>
          <path d="M16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill="white" stroke="none"/>
          <path d="M2 10h20M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>
        </svg>
      </div>
      <div>
        <div class="sb-header-title">Finance Tools</div>
        <div class="sb-header-sub">Festival &middot; Payments &middot; EMI</div>
      </div>
    </div>
    <button class="sb-close" id="sbClose" type="button" aria-label="Close finance tools sidebar">«</button>
  </div>

  <div class="sb-body">
    <div class="sb-section" id="sbFestSection">
      <div class="sb-section-header" role="button" tabindex="0" onclick="sbToggleSection('sbFestSection')">
        <div class="sb-section-title"><span class="sb-section-icon">Festival</span> Festival Budget Mode</div>
        <span class="sb-chevron">></span>
      </div>
      <div class="sb-section-body">
        <div class="sb-toggle-row">
          <span class="sb-toggle-label">Activate Festival Mode</span>
          <label class="sw-wrap"><input type="checkbox" id="festModeToggle"><span class="sw-slider"></span></label>
        </div>
        <div id="festModeBody" style="display:none">
          <div class="sb-row">
            <span class="sb-label">Festival</span>
            <select class="sb-select" id="festSelect">
              <option value="diwali">Diwali</option>
              <option value="holi">Holi</option>
              <option value="dussehra">Dussehra</option>
              <option value="navratri">Navratri</option>
              <option value="eid">Eid</option>
              <option value="christmas">Christmas</option>
              <option value="wedding_self">Wedding (Self)</option>
              <option value="wedding_attend">Wedding (Attending)</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="sb-row">
            <span class="sb-label">Extra Festival Budget (Rs)</span>
            <input type="number" class="sb-input" id="festBudget" placeholder="e.g. 15000" min="0">
          </div>
          <div class="sb-2col sb-row">
            <div><span class="sb-label">Start Date</span><input type="date" class="sb-input" id="festStart"></div>
            <div><span class="sb-label">End Date</span><input type="date" class="sb-input" id="festEnd"></div>
          </div>
          <div id="festBudgetProgress" style="display:none">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#94A3B8;margin-bottom:4px">
              <span id="festSpentLabel">Rs0 spent</span>
              <span id="festRemainingLabel">Rs0 remaining</span>
            </div>
            <div class="sb-prog-bg"><div class="sb-prog-fill" id="festProgFill" style="width:0%"></div></div>
          </div>
          <span class="sb-label">Sub-categories</span>
          <div class="sb-chips" id="festChips">
            <span class="sb-chip" data-cat="gifts">Gifts</span>
            <span class="sb-chip" data-cat="sweets">Sweets</span>
            <span class="sb-chip" data-cat="clothes">Clothes</span>
            <span class="sb-chip" data-cat="puja">Puja Items</span>
            <span class="sb-chip" data-cat="travel">Travel</span>
            <span class="sb-chip" data-cat="decor">Decoration</span>
            <span class="sb-chip" data-cat="venue">Venue</span>
            <span class="sb-chip" data-cat="catering">Catering</span>
          </div>
          <div id="festChipInputs"></div>
          <div class="sb-divider"></div>
          <div class="sb-stat-row"><span class="sb-stat-lbl">Total Festival Spend</span><span class="sb-stat-val orange" id="festTotalSpend">Rs0</span></div>
          <div class="sb-stat-row"><span class="sb-stat-lbl">Budget Remaining</span><span class="sb-stat-val green" id="festBudgetLeft">Rs0</span></div>
          <button class="sb-solid-btn" style="width:100%;margin-top:10px" onclick="saveFestData()">Save Festival Data</button>
        </div>
      </div>
    </div>

    <div class="sb-section" id="sbPaySection">
      <div class="sb-section-header" role="button" tabindex="0" onclick="sbToggleSection('sbPaySection')">
        <div class="sb-section-title"><span class="sb-section-icon">Pay</span> Cash vs Digital Split</div>
        <span class="sb-chevron">></span>
      </div>
      <div class="sb-section-body">
        <div class="sb-toggle-row" style="margin-bottom:10px">
          <span class="sb-toggle-label" style="font-size:12px">Show all time</span>
          <label class="sw-wrap"><input type="checkbox" id="payAllTime" onchange="renderPaySplit()"><span class="sw-slider"></span></label>
        </div>
        <div class="sb-donut-wrap">
          <canvas id="payDonut" width="80" height="80"></canvas>
          <div class="sb-legend" id="payLegend"></div>
        </div>
        <div id="payStats"></div>
        <div class="sb-divider"></div>
        <div id="upiBreakdown"></div>
        <div class="sb-divider"></div>
        <div id="payInsight" style="font-size:12px;color:#94A3B8;text-align:center;padding:4px 0"></div>
        <div class="sb-divider"></div>
        <span class="sb-label" style="margin-top:0">Tag payment method on new expenses</span>
        <div class="sb-chips" id="payMethodChips">
          <span class="sb-chip active" data-method="upi">UPI</span>
          <span class="sb-chip" data-method="cash">Cash</span>
          <span class="sb-chip" data-method="card">Card</span>
          <span class="sb-chip" data-method="nb">Net Banking</span>
        </div>
        <div class="sb-chips" id="upiAppRow" style="display:flex;margin-top:8px">
          <span class="sb-chip active" data-upi="gpay">GPay</span>
          <span class="sb-chip" data-upi="phonepe">PhonePe</span>
          <span class="sb-chip" data-upi="paytm">Paytm</span>
          <span class="sb-chip" data-upi="other">Other</span>
        </div>
      </div>
    </div>

    <div class="sb-section" id="sbEmiSection">
      <div class="sb-section-header" role="button" tabindex="0" onclick="sbToggleSection('sbEmiSection')">
        <div class="sb-section-title"><span class="sb-section-icon">EMI</span> EMI Tracker</div>
        <span class="sb-chevron">></span>
      </div>
      <div class="sb-section-body">
        <div id="emiList"></div>
        <button class="sb-add-btn" onclick="sbShowEmiForm()">+ Add New EMI</button>
        <div id="emiForm" style="display:none;background:#1E293B;border-radius:10px;padding:12px;margin-top:10px;border:1px solid #334155">
          <div class="sb-row"><span class="sb-label">EMI Name</span><input type="text" class="sb-input" id="emiName" placeholder="e.g. Phone EMI"></div>
          <div class="sb-2col sb-row">
            <div><span class="sb-label">Total Amount (Rs)</span><input type="number" class="sb-input" id="emiTotal" placeholder="50000"></div>
            <div><span class="sb-label">EMI / Month (Rs)</span><input type="number" class="sb-input" id="emiMonthly" placeholder="2500"></div>
          </div>
          <div class="sb-2col sb-row">
            <div><span class="sb-label">Start Date</span><input type="date" class="sb-input" id="emiStart"></div>
            <div><span class="sb-label">Duration (months)</span><input type="number" class="sb-input" id="emiDuration" placeholder="24"></div>
          </div>
          <div class="sb-row"><span class="sb-label">Bank / Lender</span><input type="text" class="sb-input" id="emiLender" placeholder="HDFC Bank"></div>
          <div style="display:flex;gap:8px;margin-top:4px">
            <button class="sb-solid-btn" style="flex:1" onclick="saveEmi()">Save EMI</button>
            <button class="sb-ghost-btn" onclick="document.getElementById('emiForm').style.display='none'">Cancel</button>
          </div>
        </div>
        <div class="sb-divider"></div>
        <div class="sb-footer-text" id="emiSummary">Total EMI burden: <strong>Rs0</strong>/month</div>
      </div>
    </div>

    <div class="sb-section" id="sbHouseholdSection">
      <div class="sb-section-header" role="button" tabindex="0" onclick="sbToggleSection('sbHouseholdSection')">
        <div class="sb-section-title"><span class="sb-section-icon">Home</span> Household &amp; Family</div>
        <span class="sb-chevron">></span>
      </div>
      <div class="sb-section-body">
        <div class="sb-row">
          <span class="sb-label">Monthly grocery budget (Rs)</span>
          <input type="number" class="sb-input" id="grocBudget" placeholder="e.g. 12000" onchange="saveHhData()">
        </div>
        <div id="grocSummary"></div>
        <div id="grocList"></div>
        <button class="sb-add-btn" onclick="addGrocItem()">+ Add grocery item</button>
        <div class="sb-divider"></div>
        <div id="utilityList"></div>
        <button class="sb-add-btn" onclick="addUtility()">+ Add utility</button>
        <div class="sb-divider"></div>
        <div id="vehicleList"></div>
        <button class="sb-add-btn" onclick="addVehicle()">+ Add vehicle</button>
        <div class="sb-divider"></div>
        <div id="eduList"></div>
        <button class="sb-add-btn" onclick="addEduFund()">+ Add education fund</button>
      </div>
    </div>

    <div class="sb-section" id="sbBudgetSection">
      <div class="sb-section-header" role="button" tabindex="0" onclick="sbToggleSection('sbBudgetSection')">
        <div class="sb-section-title"><span class="sb-section-icon">Budget</span> Budgets &amp; Savings</div>
        <span class="sb-chevron">></span>
      </div>
      <div class="sb-section-body">
        <div style="font-size:11px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Category Budget Limits</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Set monthly spend limits per category. Get alerted when you're close.</div>
        <div id="catBudgetList"></div>
        <div class="sb-divider"></div>
        <div style="font-size:11px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Budget Alerts</div>
        <div class="sb-toggle-row">
          <span class="sb-toggle-label" style="font-size:12px">Enable alerts</span>
          <label class="sw-wrap"><input type="checkbox" id="alertsEnabled" onchange="saveBudgetAlertSettings()"><span class="sw-slider"></span></label>
        </div>
        <div class="sb-row">
          <span class="sb-label">Alert threshold</span>
          <select class="sb-select" id="alertThreshold" onchange="saveBudgetAlertSettings()">
            <option value="70">70% spent</option>
            <option value="80" selected>80% spent</option>
            <option value="90">90% spent</option>
            <option value="100">100% spent (over budget)</option>
          </select>
        </div>
        <div id="alertsList" style="margin-top:4px"></div>
        <div class="sb-divider"></div>
        <div style="font-size:11px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Savings Goals</div>
        <div id="savingsGoalList"></div>
        <button class="sb-add-btn" onclick="addSavingsGoal()">+ Add savings goal</button>
      </div>
    </div>
    <div class="sb-promo">
      <div class="sb-promo-icon">☆</div>
      <div>
        <div class="sb-promo-title">Plan smart, save more</div>
        <div class="sb-promo-sub">Track budgets and achieve your financial goals easily.</div>
      </div>
      <div class="sb-promo-arrow">›</div>
    </div>
  </div>
</aside>`;
