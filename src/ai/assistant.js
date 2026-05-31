import { generateSpendingInsights, suggestCategory, buildMonthlySummary } from "./spending-insights.js";

export function answerFinanceQuestion(message, context = {}) {
  const text = message.toLowerCase();

  if (text.includes("categor")) {
    return `Suggested category: ${suggestCategory(message)}.`;
  }

  if (text.includes("summary") || text.includes("month")) {
    return buildMonthlySummary(context.entries, context.categories);
  }

  if (text.includes("insight") || text.includes("spend")) {
    return generateSpendingInsights(context.entries, context.categories).join("\n");
  }

  return "I can help with spending insights, category suggestions, and monthly summaries. This local AI mode is free and does not send your data to external APIs.";
}
