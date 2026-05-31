export function monthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function isSameMonth(isoDate, key = monthKey()) {
  return typeof isoDate === "string" && isoDate.startsWith(key);
}
