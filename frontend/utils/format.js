/**
 * Centralized formatting utilities for currency, item counts, and dates.
 * Import from here instead of using inline formatters across components.
 */

/**
 * Format a LKR currency amount consistently across all languages.
 * All Sri Lankan locales display LKR with comma-grouped digits.
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  })
    .format(num)
    .replace(/\s+/g, " ");
}

/**
 * Format item count with correct singular/plural from strings.
 * @param {number} n
 * @param {object} strings — localized strings object
 */
export function formatItemCount(n, strings = {}) {
  const num = Number(n) || 0;
  if (num === 1) {
    return (strings.cart_item_count_one || "{n} item").replace("{n}", num);
  }
  return (strings.cart_item_count_many || "{n} items").replace("{n}", num);
}

/**
 * Interpolate a template string with variables.
 * e.g. fmt("Hello {name}", { name: "Ruka" }) => "Hello Ruka"
 */
export function fmt(template, vars = {}) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.split(`{${k}}`).join(String(v)),
    template || ""
  );
}

/**
 * Format a cart total with budget info.
 */
export function formatBudgetSpent(amount, strings) {
  const formatted = formatCurrency(amount);
  return (strings.budget_spent || "{amount} spent").replace("{amount}", formatted);
}

export function formatBudgetLimit(amount, strings) {
  const formatted = formatCurrency(amount);
  return (strings.budget_limit_label || "Limit {amount}").replace("{amount}", formatted);
}
