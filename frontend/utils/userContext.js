// Merges order history + saved bookmarks into one profile object the UI and
// intent API can share — mirrors backend `build_user_profile_from_history`.

import { getBookmarks } from "./bookmarks";

function pick(lang, en, si, tg) {
  const L = lang === "si-LK" ? "si" : lang === "en-LK" ? "tanglish" : "en";
  return { si, tanglish: tg }[L] || en;
}

function countCategories(orders) {
  const counts = {};
  (orders || []).forEach((o) => {
    const csv = o.categories || "";
    csv
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean)
      .forEach((c) => {
        counts[c] = (counts[c] || 0) + 1;
      });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);
}

export function buildClientAiProfile(orders = [], bookmarks = []) {
  const cities = (orders || []).map((o) => o.delivery_city).filter(Boolean);
  const preferredCity = cities.length
    ? cities.sort((a, b) => cities.filter((c) => c === b).length - cities.filter((c) => c === a).length)[0]
    : null;

  const totals = (orders || [])
    .map((o) => Number(o.total_price) || 0)
    .filter((t) => t > 0);
  const suggestedBudget = totals.length
    ? Math.round(totals.reduce((s, t) => s + t, 0) / totals.length / 100) * 100
    : null;

  const orderCats = countCategories(orders);
  const savedCats = [...new Set((bookmarks || []).map((b) => (b.category || "").toLowerCase().trim()).filter(Boolean))];
  const preferredCategories = [...new Set([...orderCats, ...savedCats])].slice(0, 5);

  return {
    preferred_city: preferredCity,
    suggested_budget: suggestedBudget,
    order_count: (orders || []).length,
    preferred_categories: preferredCategories,
    saved_count: (bookmarks || []).length,
    saved_product_ids: (bookmarks || []).map((b) => b.id).filter(Boolean),
    saved_products: (bookmarks || []).slice(0, 10),
  };
}

/** Slim payload for POST /api/intent — only fields the backend needs. */
export function getSavedProductsPayload() {
  if (typeof window === "undefined") return [];
  return getBookmarks().map((b) => ({
    id: b.id,
    name: b.name,
    category: b.category || "",
    price: b.price,
    image_url: b.image_url || "",
    url: b.url || "",
  }));
}

export function buildReorderPrompt(order, lang = "en-US") {
  const cats = (order?.categories || "").split(",")[0]?.trim();
  const city = order?.delivery_city;
  if (cats && city) {
    return pick(
      lang,
      `Reorder ${cats} like last time, deliver to ${city}`,
      `පෙර වගේ ${cats} නැවත ඇණවුම් කරන්න, ${city} වෙත බෙදාහරින්න`,
      `Issellawa wage ${cats} reorder karanna, ${city} ekata deliver karanna`
    );
  }
  if (cats) {
    return pick(
      lang,
      `Reorder ${cats} like last time`,
      `පෙර වගේ ${cats} නැවත ඇණවුම් කරන්න`,
      `Issellawa wage ${cats} reorder karanna`
    );
  }
  return pick(
    lang,
    "Reorder my favourites like last time",
    "මගේ ප්‍රියතම නැවත ඇණවුම් කරන්න",
    "Mage favourites issellawa wage reorder karanna"
  );
}

export function buildProfileInsightLines(profile = {}, strings = {}, lang = "en-US") {
  const lines = [];
  if (!profile || (profile.order_count === 0 && profile.saved_count === 0)) {
    return [strings.profile_ruka_empty || "Sign in and shop once — Ruka will remember your city, budget, and saved items."];
  }
  if (profile.order_count > 0) {
    lines.push(
      (strings.profile_ruka_orders || "Uses {count} past order(s) for category and budget hints.").replace(
        "{count}",
        String(profile.order_count)
      )
    );
  }
  if (profile.preferred_city) {
    lines.push(
      (strings.profile_ruka_city || "Usually delivers to {city}.").replace("{city}", profile.preferred_city)
    );
  }
  if (profile.suggested_budget) {
    lines.push(
      (strings.profile_ruka_budget || "Typical spend around LKR {budget}.").replace(
        "{budget}",
        profile.suggested_budget.toLocaleString()
      )
    );
  }
  if (profile.preferred_categories?.length) {
    lines.push(
      (strings.profile_ruka_categories || "Favourite categories: {cats}.").replace(
        "{cats}",
        profile.preferred_categories.slice(0, 3).join(", ")
      )
    );
  }
  if (profile.saved_count > 0) {
    lines.push(
      (strings.profile_ruka_saved || "Boosts {count} saved product(s) in cart picks.").replace(
        "{count}",
        String(profile.saved_count)
      )
    );
  }
  return lines;
}

export function buildProfileQuickReplies(profile = {}, lang = "en-US", strings = {}) {
  const replies = [];
  if (profile.order_count > 0) {
    replies.push({
      label: strings.qr_reorder || "Reorder favourites",
      text: pick(
        lang,
        "reorder my favourites like last time",
        "මගේ ප්‍රියතම නැවත ඇණවුම් කරන්න",
        "Mage favourites issellawa wage reorder karanna"
      ),
    });
  }
  if (profile.saved_count > 0) {
    replies.push({
      label: strings.qr_add_saved || "Add saved items",
      text: pick(
        lang,
        "add my saved bookmark items",
        "මගේ සුරකින ලද භාණ්ඩ එක් කරන්න",
        "Mage saved bookmark items add karanna"
      ),
    });
  }
  if (profile.preferred_city && !replies.some((r) => r.text.includes(profile.preferred_city))) {
    replies.push({
      label: (strings.qr_deliver_city || "Deliver to {city}").replace("{city}", profile.preferred_city),
      text: `deliver to ${profile.preferred_city}`,
    });
  }
  return replies.slice(0, 3);
}
