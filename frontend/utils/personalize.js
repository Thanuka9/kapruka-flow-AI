// Lightweight, deterministic personalization: a Sri Lanka-aware seasonal nudge
// plus "Picked for you" suggestions derived from the user's real order history.
// No external LLM — same MCP-native, rule-based approach as the rest of the app.

function pick(lang, en, si, tg) {
  return { si, tanglish: tg }[lang] || en;
}

const CATEGORY_LABELS = {
  general: { en: "general", si: "සාමාන්‍ය", tanglish: "general" },
  chocolates: { en: "chocolates", si: "චොකලට්", tanglish: "chocolates" },
  groceries: { en: "groceries", si: "බඩු", tanglish: "groceries" },
  flowers: { en: "flowers", si: "මල්", tanglish: "flowers" },
  cakes: { en: "cakes", si: "කේක්", tanglish: "cakes" },
  gifts: { en: "gifts", si: "තෑගි", tanglish: "gifts" },
};

function displayCategory(cat, lang) {
  const key = (cat || "").toLowerCase().trim();
  const L = lang === "si-LK" ? "si" : lang === "en-LK" ? "tanglish" : "en";
  return CATEGORY_LABELS[key]?.[L] || cat;
}

// Returns the active seasonal/occasion context for a given date.
export function getSeason(date = new Date(), lang = "en") {
  const m = date.getMonth() + 1; // 1-12
  const L = lang === "si-LK" ? "si" : lang === "en-LK" ? "tanglish" : "en";

  const make = (emoji, en, si, tg, terms) => ({ emoji, text: pick(L, en, si, tg), terms });

  if (m === 4)
    return make("🌸", "Avurudu is near — sweets, kavum & gift hampers are trending.",
      "අවුරුදු ළඟයි — රසකැවිලි සහ තෑගි කලඹ ජනප්‍රියයි.",
      "Avurudu lagai — sweets saha gift hampers trending.",
      "avurudu sweets hamper");
  if (m === 12)
    return make("🎄", "Christmas season — cakes, gifts & hampers are popular now.",
      "නත්තල් සමය — කේක්, තෑගි සහ කලඹ ජනප්‍රියයි.",
      "Christmas season — cakes, gifts, hampers popular.",
      "christmas cake gift hamper");
  if (m === 5)
    return make("🪔", "Vesak & Mother's Day season — flowers and thoughtful gifts shine.",
      "වෙසක් සහ මව්වරුන්ගේ දිනය — මල් සහ තෑගි.",
      "Vesak & Mother's Day — flowers saha gifts.",
      "flowers gift cake");
  if (m === 2)
    return make("❤️", "Valentine's season — flowers, chocolates & romantic gifts.",
      "වැලන්ටයින් සමය — මල්, චොකලට් සහ තෑගි.",
      "Valentine's season — flowers, chocolates, gifts.",
      "flowers chocolates gift");
  if (m === 6)
    return make("👔", "Father's Day season — gifts for him are trending.",
      "පියවරුන්ගේ දිනය — තාත්තාට තෑගි.",
      "Father's Day — gifts for him trending.",
      "gift for father watch");
  if (m === 1)
    return make("🎆", "New Year — start it with a thoughtful gift or fresh groceries.",
      "අලුත් අවුරුද්ද — තෑගි හෝ බඩු.",
      "New Year — gift ekak naththan groceries.",
      "gift hamper groceries");
  return make("🎁", "Gifting season — surprise someone with a curated hamper.",
    "තෑගි සමය — කලඹකින් පුදුම කරන්න.",
    "Gifting season — hamper ekakin surprise karanna.",
    "gift hamper flowers");
}

// Builds "Picked for you" suggestion chips from order history + saved bookmarks.
export function buildPickedForYou(orders = [], lang = "en", bookmarks = []) {
  const L = lang === "si-LK" ? "si" : lang === "en-LK" ? "tanglish" : "en";
  const counts = {};
  (orders || []).forEach((o) => {
    const cats = (o.categories || "")
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    cats.forEach((c) => {
      counts[c] = (counts[c] || 0) + 1;
    });
  });

  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  const chips = top.map((cat) => {
    const display = displayCategory(cat, lang);
    return {
      label: pick(L, `More ${display}`, `තවත් ${display}`, `Thawa ${display}`),
      text: pick(
        L,
        `Shop ${cat} for me`,
        `මට ${display} ඕනෑ`,
        `Mata ${display} ona`
      ),
    };
  });

  // Saved bookmark quick-add chip.
  if (bookmarks && bookmarks.length > 0) {
    const first = bookmarks[0];
    const name = first.name || "saved item";
    chips.unshift({
      label: pick(L, "Shop my saved", "මගේ සුරකින ලද", "Mage saved"),
      text: pick(
        L,
        `Build a cart with my saved items like ${name}`,
        `මගේ සුරකින ලද ${name} වගේ කරත්තයක් සාදන්න`,
        `Mage saved ${name} wage cart ekak hadanna`
      ),
    });
  }

  // If they have any orders, offer a quick reorder of the most recent set.
  if (orders && orders.length > 0 && orders[0].categories) {
    const recent = orders[0].categories.split(",")[0]?.trim();
    if (recent) {
      const recentDisplay = displayCategory(recent, lang);
      chips.unshift({
        label: pick(L, "Reorder favourites", "ප්‍රියතම නැවත ඇණවුම", "Reorder favourites"),
        text: pick(
          L,
          `Reorder ${recent} like last time`,
          `පෙර වගේ ${recentDisplay} නැවත ඇණවුම් කරන්න`,
          `Issellawa wage ${recentDisplay} reorder karanna`
        ),
      });
    }
  }

  return chips.slice(0, 4);
}
