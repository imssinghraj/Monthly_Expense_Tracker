export function formatINR(value = 0) {
  return `Rs ${Math.round(Number(value) || 0).toLocaleString("en-IN")}`;
}

export function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
