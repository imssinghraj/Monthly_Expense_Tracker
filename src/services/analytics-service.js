export function summarizeEntries(entries = {}) {
  const summary = {
    total: 0,
    count: 0,
    byCategory: {},
    byPaymentMethod: {},
    byDate: {}
  };

  Object.entries(entries).forEach(([date, items]) => {
    (items || []).forEach(item => {
      const amount = Number(item.amount) || 0;
      const category = item.cat || item.category || "other";
      const paymentMethod = item.payMethod || "upi";

      summary.total += amount;
      summary.count += 1;
      summary.byDate[date] = (summary.byDate[date] || 0) + amount;
      summary.byCategory[category] = (summary.byCategory[category] || 0) + amount;
      summary.byPaymentMethod[paymentMethod] = (summary.byPaymentMethod[paymentMethod] || 0) + amount;
    });
  });

  return summary;
}

export function budgetProgress(categoryTotals = {}, budgets = {}) {
  return Object.entries(budgets)
    .filter(([, limit]) => Number(limit) > 0)
    .map(([category, limit]) => {
      const spent = Number(categoryTotals[category]) || 0;
      const budget = Number(limit) || 0;
      return {
        category,
        spent,
        budget,
        percent: budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0,
        remaining: Math.max(0, budget - spent)
      };
    });
}

export function topCategory(categoryTotals = {}) {
  return Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0] || null;
}
