import { summarizeEntries, topCategory } from "../services/analytics-service.js";
import { formatINR } from "../utils/currency.js";

export function generateSpendingInsights(entries = {}, categories = {}) {
  const summary = summarizeEntries(entries);
  const top = topCategory(summary.byCategory);
  const insights = [];

  if (!summary.count) {
    return ["Add a few expenses and I will summarize your spending patterns."];
  }

  insights.push(`You logged ${summary.count} expenses totaling ${formatINR(summary.total)}.`);

  if (top) {
    const [categoryKey, amount] = top;
    const label = categories[categoryKey]?.label || categoryKey;
    const share = summary.total > 0 ? Math.round((amount / summary.total) * 100) : 0;
    insights.push(`${label} is your largest category at ${formatINR(amount)} (${share}% of tracked spending).`);
  }

  const digital = (summary.byPaymentMethod.upi || 0) + (summary.byPaymentMethod.card || 0) + (summary.byPaymentMethod.nb || 0);
  if (digital > 0) {
    const digitalShare = Math.round((digital / summary.total) * 100);
    insights.push(`Digital payments account for about ${digitalShare}% of your tracked spend.`);
  }

  return insights;
}

export function suggestCategory(description = "") {
  const text = description.toLowerCase();
  const rules = [
    ["travel", ["uber", "ola", "metro", "train", "bus", "fuel", "flight", "cab"]],
    ["shopping", ["amazon", "flipkart", "myntra", "clothes", "shoes"]],
    ["lunch", ["lunch", "dinner", "restaurant", "swiggy", "zomato", "food"]],
    ["snacks", ["coffee", "tea", "snack", "chips", "juice"]],
    ["cig", ["cigarette", "smoke", "tobacco"]]
  ];

  const match = rules.find(([, words]) => words.some(word => text.includes(word)));
  return match ? match[0] : "other";
}

export function buildMonthlySummary(entries = {}, categories = {}) {
  return generateSpendingInsights(entries, categories).join(" ");
}
