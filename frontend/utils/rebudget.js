function getPrice(product) {
  const p = product.price;
  if (typeof p === "object" && p !== null) return p.amount || 0;
  return Number(p) || 0;
}

function withReason(product, reason) {
  return { ...product, quantity: product.quantity || 1, reason };
}

function pickWithinBudget(products, budget, mode) {
  // `budget` is already the items budget (order budget minus delivery fee).
  // It is a HARD CAP: the items subtotal must never exceed it.
  const limit = Math.max(budget, 0);
  let sorted = [...products];

  if (mode === "cheaper") {
    sorted.sort((a, b) => getPrice(a) - getPrice(b));
  } else if (mode === "premium") {
    sorted.sort((a, b) => getPrice(b) - getPrice(a));
  } else if (mode === "fast") {
    sorted = sorted.filter(
      (p) => p.delivery_speed === "Today" || p.delivery_speed === "Fast"
    );
    sorted.sort((a, b) => getPrice(a) - getPrice(b));
  } else {
    sorted.sort((a, b) => getPrice(a) - getPrice(b));
  }

  const picked = [];
  let total = 0;
  // Soft target only controls how aggressively we fill; the hard cap is `limit`.
  const target = mode === "cheaper" ? limit * 0.85 : limit;

  for (const product of sorted) {
    if (picked.length >= 8) break;
    const price = getPrice(product);
    if (price <= 0) continue;
    // Hard cap — skip anything that would push the subtotal over the limit.
    if (total + price > limit) continue;
    // Once we're near the soft target and have at least one item, stop filling.
    if (total >= target && picked.length >= 1) break;
    picked.push(withReason(product, reasonFor(mode, product)));
    total += price;
  }

  // Fallback: nothing fit (every item pricier than the limit). Surface the
  // single cheapest item so the plan is never empty, but still the lowest spend.
  if (picked.length === 0 && sorted.length > 0) {
    const priced = sorted.filter((p) => getPrice(p) > 0);
    const pool = priced.length ? priced : sorted;
    const cheapest = pool.reduce((a, b) => (getPrice(a) <= getPrice(b) ? a : b));
    picked.push(withReason(cheapest, reasonFor(mode, cheapest)));
  }

  return picked;
}

function reasonFor(mode, product) {
  const name = product.name || "item";
  if (mode === "cheaper") return `Budget pick — ${name} offers strong value within your limit.`;
  if (mode === "premium") return `Premium upgrade — ${name} elevates the overall plan.`;
  if (mode === "fast") return `Fast delivery — ${name} ships quickly to your city.`;
  return `Best match — ${name} fits your shopping intent and budget.`;
}

export function instantRebudget(catalogProducts, budget, deliveryFee, language = "en") {
  const unique = [];
  const seen = new Set();
  for (const p of catalogProducts || []) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    unique.push(p);
  }

  if (!unique.length) return null;

  const storyLine =
    language === "si"
      ? `අයවැය LKR ${budget.toLocaleString()} දිගට ක්ෂණිකව නැවත සකස් කරන ලදී.`
      : language === "tanglish"
        ? `Budget eka LKR ${budget.toLocaleString()} ta instant optimize kala.`
        : `Instantly re-optimized all plans for LKR ${budget.toLocaleString()} budget.`;

  return {
    cart_versions: {
      initial: pickWithinBudget(unique, budget - deliveryFee, "initial"),
      cheaper: pickWithinBudget(unique, budget - deliveryFee, "cheaper"),
      premium: pickWithinBudget(unique, budget - deliveryFee, "premium"),
      fast: pickWithinBudget(unique, budget - deliveryFee, "fast"),
    },
    story: [storyLine, `Delivery fee LKR ${deliveryFee.toLocaleString()} reserved from Kapruka MCP.`],
    metadata_patch: { budget_limit: budget },
  };
}

export function gatherCatalogFromVersions(cartVersions) {
  const list = [];
  const seen = new Set();
  Object.values(cartVersions || {}).forEach((items) => {
    (items || []).forEach((item) => {
      if (item?.id && !seen.has(item.id)) {
        seen.add(item.id);
        list.push(item);
      }
    });
  });
  return list;
}
