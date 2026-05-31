import { createDashboardCards } from "../components/dashboard-cards.js";
import { summarizeEntries, topCategory } from "../services/analytics-service.js";

export function renderDashboardPage({ entries = {}, categories = {}, budgetUsed = 0 } = {}) {
  const summary = summarizeEntries(entries);
  const top = topCategory(summary.byCategory);
  const topLabel = top ? categories[top[0]]?.label || top[0] : "None";

  return `
    <section class="saas-page-head">
      <div>
        <h1>Financial dashboard</h1>
        <p>Spending, budget health, and AI-assisted insights in one place.</p>
      </div>
    </section>
    ${createDashboardCards({
      total: summary.total,
      count: summary.count,
      topCategory: topLabel,
      budgetUsed
    })}
    <section class="saas-panel" id="aiInsightsPanel"></section>`;
}
