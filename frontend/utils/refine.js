// Lightweight, deterministic interpreter for conversational cart refinements.
// Turns a free-text follow-up ("make it cheaper and add chocolates under 3000",
// "deliver to Galle", "remove the cake") into a list of structured actions that
// the page dispatches against existing handlers/APIs. No external LLM needed —
// this is the same MCP-native, rule-based philosophy as the rest of the app.

const NUMBER_WORDS = {
  k: 1000,
  thousand: 1000,
  lakh: 100000,
  lac: 100000,
};

const STOP = new Set([
  "the", "a", "an", "some", "please", "pls", "my", "to", "for", "of", "and",
  "with", "without", "no", "me", "i", "want", "need", "it", "that", "this",
  "under", "below", "max", "budget", "around", "about", "lkr", "rs", "rupees",
  "deliver", "delivery", "send", "ship", "make", "more", "less", "instead",
  "also", "include", "add", "remove", "delete", "drop", "swap", "change", "keep",
]);

function extractAmount(text) {
  // e.g. "8000", "8,000", "8k", "1 lakh", "12000 lkr"
  const m = text.match(/(\d[\d,]*\.?\d*)\s*(k|thousand|lakh|lac)?/i);
  if (!m) return null;
  let val = parseFloat(m[1].replace(/,/g, ""));
  if (isNaN(val)) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit && NUMBER_WORDS[unit]) val *= NUMBER_WORDS[unit];
  // Ignore obvious non-budget numbers (years, tiny counts handled by caller).
  if (val < 100) return null;
  return Math.round(val);
}

function extractAfter(text, keywords) {
  // Pull the noun phrase following an add/remove keyword.
  for (const kw of keywords) {
    const re = new RegExp(`\\b${kw}\\b\\s+([a-z\\u0d80-\\u0dff][a-z\\s\\u0d80-\\u0dff]*)`, "i");
    const m = text.match(re);
    if (m) {
      const phrase = m[1]
        .split(/\s+/)
        .filter((w) => w && !STOP.has(w.toLowerCase()) && !/^\d/.test(w))
        .slice(0, 3)
        .join(" ")
        .trim();
      if (phrase) return phrase;
    }
  }
  return null;
}

function extractCity(text) {
  const m = text.match(/\b(?:deliver(?:y)?|send|ship)\s+(?:it\s+)?to\s+([a-z][a-z\s\d]*)/i);
  if (m) {
    return m[1]
      .split(/\s+/)
      .filter((w) => w && !STOP.has(w.toLowerCase()) && !["today", "tomorrow"].includes(w.toLowerCase()))
      .slice(0, 3)
      .join(" ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }
  return null;
}

export function interpretRefineMessage(rawText) {
  const text = (rawText || "").trim();
  const lower = text.toLowerCase();
  const actions = [];

  if (!text) return { actions: [{ type: "clarify" }] };

  const hasRemove = /\b(remove|delete|drop|take out|no more|without)\b/.test(lower);
  const hasAdd = /\b(add|include|also|with|throw in|put in)\b/.test(lower);

  // NOTE: budget/plan/city changes must be queued BEFORE add/remove, because a
  // budget rebuild regenerates the cart from the catalog and would otherwise
  // wipe an item we just added in the same message.

  // Budget change (only when a sensible amount is present and it's about money).
  if (/\b(under|below|budget|max|spend|keep it|within|rs|lkr|rupees|\d)\b/.test(lower)) {
    const amt = extractAmount(lower);
    if (amt) actions.push({ type: "budget", value: amt });
  }

  // Plan / tone intent.
  if (/\b(cheaper|cheap|save|budget friendly|lower price|reduce|economical)\b/.test(lower) && !hasAdd) {
    actions.push({ type: "plan", value: "cheaper" });
  } else if (/\b(premium|upgrade|luxury|fancy|better quality|high end|impressive|nicer)\b/.test(lower)) {
    actions.push({ type: "plan", value: "premium" });
  }
  if (/\b(fast|today|same day|asap|urgent|quick|express|hurry|now)\b/.test(lower)) {
    actions.push({ type: "plan", value: "fast" });
  }

  // Delivery city.
  const city = extractCity(lower);
  if (city) actions.push({ type: "city", value: city });

  // Gift framing.
  if (/\b(gift|present|wrap|surprise|birthday|anniversary|wedding)\b/.test(lower)) {
    actions.push({ type: "gift" });
  }

  // Reorder from order history.
  if (/\b(reorder|order again|like last time|same as before|favourites|favorites)\b/.test(lower)) {
    actions.push({ type: "reorder" });
  }

  // Rebuild / restart flow.
  if (/\b(rebuild|restart|start over|refresh)\b/.test(lower)) {
    actions.push({ type: "rebuild" });
  }

  // Item removal / addition last so they survive any budget rebuild above.
  if (hasRemove) {
    const q = extractAfter(lower, ["remove", "delete", "drop", "without"]);
    if (q) actions.push({ type: "remove", query: q });
  }
  const wantsSaved = /\b(saved|bookmark|bookmarked|starred|favourite item|favorite item)\b/.test(lower);
  if (hasAdd && wantsSaved) {
    actions.push({ type: "add_saved" });
  } else if (hasAdd) {
    const q = extractAfter(lower, ["add", "include", "also", "with", "in"]);
    if (q) actions.push({ type: "add", query: q });
  }

  if (actions.length === 0) {
    // Looks like a fresh shopping request rather than an edit? If it mentions
    // products/quantities, treat as a brand-new search; otherwise ask.
    if (lower.split(/\s+/).length >= 3) {
      actions.push({ type: "research", query: text });
    } else {
      actions.push({ type: "clarify" });
    }
  }

  return { actions };
}

/**
 * Builds Ruka's opening reply bubbles from the factual story + parsed intent.
 * Shared by the static seed and the live chat thread.
 */
export function buildAgentReplyBubbles(story = [], metadata = {}, strings = {}) {
  const intent = metadata.intent_parsed || {};
  const bubbles = [];
  bubbles.push(strings.agent_reply_intro || "All set! Here's what I pulled together 👇");
  story.forEach((line) => line && bubbles.push(line));

  if (intent.occasion) {
    const occ = String(intent.occasion).replace(/_/g, " ");
    bubbles.push((strings.agent_occasion_note || "Happy {occasion}! 🎉").replace("{occasion}", occ));
  }
  if (intent.gift_mode) {
    const recipient = intent.recipient ? ` for your ${intent.recipient}` : "";
    bubbles.push((strings.agent_gift_note || "Looks like a gift{recipient}. 🎁").replace("{recipient}", recipient));
  }
  if (intent.budget_inferred) {
    const budget = new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(
      intent.budget || metadata.budget_limit || 25000
    );
    bubbles.push((strings.agent_budget_inferred || "I assumed LKR {budget}.").replace("{budget}", budget));
  }

  const profile = metadata.user_profile;
  if (profile?.order_count > 0 || profile?.saved_count > 0) {
    const bits = [];
    if (profile.order_count > 0) {
      bits.push(
        (strings.agent_profile_orders || "{count} past orders").replace("{count}", String(profile.order_count))
      );
    }
    if (profile.saved_count > 0) {
      bits.push(
        (strings.agent_profile_saved || "{count} saved items").replace("{count}", String(profile.saved_count))
      );
    }
    if (profile.preferred_city) {
      bits.push(
        (strings.agent_profile_city || "usually {city}").replace("{city}", profile.preferred_city)
      );
    }
    const summary = bits.join(" · ");
    bubbles.push((strings.agent_profile_note || "Used your profile ({summary}) to personalize picks.").replace("{summary}", summary));
  }

  bubbles.push(strings.agent_pick_one || "Pick a plan and I'll take you to checkout. 🛒");
  return bubbles;
}
