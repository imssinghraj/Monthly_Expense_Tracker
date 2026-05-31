import { createDashboardCard } from "./ui.js";
import { formatINR } from "../utils/currency.js";

export function createDashboardCards({ total = 0, count = 0, topCategory = "None", budgetUsed = 0 } = {}) {
  return `
    <section class="saas-card-grid">
      ${createDashboardCard({ label: "Monthly spend", value: formatINR(total), meta: `${count} expenses`, tone: "blue" })}
      ${createDashboardCard({ label: "Top category", value: topCategory, meta: "Highest spend area", tone: "purple" })}
      ${createDashboardCard({ label: "Budget used", value: `${budgetUsed}%`, meta: "Across active budgets", tone: "green" })}
    </section>`;
}
