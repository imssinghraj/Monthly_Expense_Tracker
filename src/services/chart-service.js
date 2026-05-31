export function chartAdapterNotice() {
  return "The current vanilla app keeps its existing charts. Recharts is a React chart library, so this adapter is the future swap point when the dashboard shell moves to React or Next.js.";
}

export function toCategoryChartData(categoryTotals = {}, categories = {}) {
  return Object.entries(categoryTotals).map(([key, value]) => ({
    name: categories[key]?.label || key,
    value
  }));
}

export function toMonthlyChartData(dateTotals = {}) {
  return Object.entries(dateTotals).map(([date, value]) => ({
    date,
    value
  }));
}
