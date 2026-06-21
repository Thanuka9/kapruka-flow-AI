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

  const make = (emoji, en, si, tg, terms, qEn, qSi, qTg) => ({
    emoji,
    text: pick(L, en, si, tg),
    terms,
    query: pick(L, qEn, qSi, qTg)
  });

  if (m === 4)
    return make("🌸", "Avurudu is near — sweets, kavum & gift hampers are trending.",
      "අවුරුදු ළඟයි — රසකැවිලි සහ තෑගි කලඹ ජනප්‍රියයි.",
      "Avurudu lagai — sweets saha gift hampers trending.",
      "avurudu sweets hamper",
      "Avurudu sweets and gift hamper",
      "අවුරුදු රසකැවිලි සහ තෑගි",
      "Avurudu sweets and gift hamper");
  if (m === 12)
    return make("🎄", "Christmas season — cakes, gifts & hampers are popular now.",
      "නත්තල් සමය — කේක්, තෑගි සහ කලඹ ජනප්‍රියයි.",
      "Christmas season — cakes, gifts, hampers popular.",
      "christmas cake gift hamper",
      "Christmas cake and gift hamper",
      "නත්තල් කේක් සහ තෑගි",
      "Christmas cake and gift hamper");
  if (m === 5)
    return make("🪔", "Vesak & Mother's Day season — flowers and thoughtful gifts shine.",
      "වෙසක් සහ මව්වරුන්ගේ දිනය — මල් සහ තෑගි.",
      "Vesak & Mother's Day — flowers saha gifts.",
      "flowers gift cake",
      "Mother's Day flowers and gifts",
      "මව්වරුන්ගේ දින මල් සහ තෑගි",
      "Mother's Day flowers and gifts");
  if (m === 2)
    return make("❤️", "Valentine's season — flowers, chocolates & romantic gifts.",
      "වැලන්ටයින් සමය — මල්, චොකලට් සහ තෑගි.",
      "Valentine's season — flowers, chocolates, gifts.",
      "flowers chocolates gift",
      "Valentine's flowers and chocolates",
      "වැලන්ටයින් මල් සහ චොකලට්",
      "Valentine's flowers and chocolates");
  if (m === 6)
    return make("👔", "Father's Day season — gifts for him are trending.",
      "පියවරුන්ගේ දිනය — තාත්තාට තෑගි.",
      "Father's Day — gifts for him trending.",
      "gift for father watch",
      "Father's Day gifts for dad",
      "තාත්තාට පියවරුන්ගේ දින තෑගි",
      "Father's Day gifts for dad");
  if (m === 1)
    return make("🎆", "New Year — start it with a thoughtful gift or fresh groceries.",
      "අලුත් අවුරුද්ද — තෑගි හෝ බඩු.",
      "New Year — gift ekak naththan groceries.",
      "gift hamper groceries",
      "New Year gift hamper",
      "අලුත් අවුරුදු තෑගි",
      "New Year gift hamper");
  return make("🎁", "Gifting season — surprise someone with a curated hamper.",
    "තෑගි සමය — කලඹකින් පුදුම කරන්න.",
    "Gifting season — hamper ekakin surprise karanna.",
    "gift hamper flowers",
    "Gift hamper for family",
    "පවුලේ අයට තෑගි",
    "Gift hamper for family");
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

// Generates dynamic upcoming holiday / seasonal and evergreen suggestions based on month
export function getDynamicSuggestions(date = new Date(), lang = "en") {
  const m = date.getMonth() + 1; // 1-12
  const L = lang === "si-LK" ? "si" : lang === "en-LK" ? "tanglish" : "en";
  
  // Helper to pick localization
  const pickVal = (en, si, tg) => {
    return { si, tanglish: tg }[L] || en;
  };

  // 1. Generate holiday cards (2)
  let holidayCards = [];
  if (m === 1) {
    holidayCards = [
      {
        icon: "🌾",
        title: pickVal("Thai Pongal Feast", "තෛපොංගල් උත්සවය", "Thai Pongal Feast"),
        subtitle: pickVal("Sweet Pongal rice & pots", "පොංගල් සහ සාම්ප්‍රදායික තෑගි", "Pongal sweets saha traditional gifts"),
        text: "Thai Pongal sweet rice ingredients and traditional gifts under Rs 6000"
      },
      {
        icon: "🌸",
        title: pickVal("Duruthu Poya Offerings", "දුරුතු පෝය පූජා", "Duruthu Poya Offerings"),
        subtitle: pickVal("Lotus flowers & oil lamps", "නැවුම් නෙළුම් මල් සහ පූජා භාණ්ඩ", "Lotus mal saha oil lamps under Rs 3000"),
        text: "Duruthu Poya fresh lotus flowers and coconut oil under Rs 3000"
      }
    ];
  } else if (m === 2) {
    holidayCards = [
      {
        icon: "💝",
        title: pickVal("Valentine's Surprise", "වැලන්ටයින් සප්‍රයිස්", "Valentine's Surprise"),
        subtitle: pickVal("Flowers, choc & teddy bear", "රතු රෝස, චොකලට් සහ ටෙඩි බෙයර්", "Flowers, choc + teddy bear Rs 8000 ata"),
        text: "Valentine's flowers chocolates and teddy bear under Rs 8000"
      },
      {
        icon: "🦁",
        title: pickVal("National Day Hampers", "නිදහස් දින සැමරුම", "National Day Hampers"),
        subtitle: pickVal("Sri Lankan traditional food", "දේශීය රසකැවිලි සහ ආහාර කලඹ", "Sri Lankan kema hamper Rs 7000 ata"),
        text: "Independence Day traditional Sri Lankan food hamper under Rs 7000"
      }
    ];
  } else if (m === 3) {
    holidayCards = [
      {
        icon: "🌙",
        title: pickVal("Ramazan Feast Prep", "රමලාන් සූදානම", "Ramazan Feast Prep"),
        subtitle: pickVal("Dates, biryani & sweets", "රටඉඳි, බුරියානි සහ රසකැවිලි", "Dates, biryani saha sweets Rs 10000 ata"),
        text: "Ramazan dates and family feast hamper under Rs 10000"
      },
      {
        icon: "🪔",
        title: pickVal("Medin Poya Offerings", "මැදින් පෝය පූජා", "Medin Poya Offerings"),
        subtitle: pickVal("White flowers & incense", "පිච්ච මල් සහ පූජා වට්ටි", "Pichcha mal saha incense under Rs 3000"),
        text: "Medin Poya fresh jasmine flowers and incense sticks under Rs 3000"
      }
    ];
  } else if (m === 4) {
    holidayCards = [
      {
        icon: "🌸",
        title: pickVal("Avurudu Kevum & Kokis", "අවුරුදු කැවුම් කොකිස්", "Avurudu Kevum & Kokis"),
        subtitle: pickVal("Sweets & traditional hampers", "රසකැවිලි සහ තෑගි කලඹ", "Sweets saha traditional hampers under Rs 8000"),
        text: "Avurudu sweets kavum kokis and gift hampers under Rs 8000"
      },
      {
        icon: "✝️",
        title: pickVal("Easter Sunday Cakes", "පාස්කු දින සංග්‍රහ", "Easter Sunday Cakes"),
        subtitle: pickVal("Chocolate eggs & bunnies", "චොකලට් බිත්තර සහ කේක්", "Easter chocolate eggs and bunny cakes Rs 5000 ata"),
        text: "Easter chocolate eggs and bunny treats under Rs 5000"
      }
    ];
  } else if (m === 5) {
    holidayCards = [
      {
        icon: "🪔",
        title: pickVal("Vesak Lanterns & Lamps", "වෙසක් පහන් සහ සැරසිලි", "Vesak Lanterns & Lamps"),
        subtitle: pickVal("Clay lamps & oil bundles", "මැටි පහන් සහ පොල්තෙල් පැක්", "Clay lamps and oil bundles Rs 4000 ata"),
        text: "Vesak lanterns clay lamps and coconut oil for lighting under Rs 4000"
      },
      {
        icon: "👩",
        title: pickVal("Mother's Day Gift", "මව්වරුන්ගේ දින තෑගි", "Mother's Day Gift"),
        subtitle: pickVal("Mum cake & flower bouquet", "Best Mum කේක් සහ මල් කලඹ", "Mum cake and flower bouquet Rs 6000 ata"),
        text: "Mothers Day cake and fresh flower bouquet under Rs 6000"
      }
    ];
  } else if (m === 6) {
    holidayCards = [
      {
        icon: "👔",
        title: pickVal("Father's Day Special", "පියවරුන්ගේ දින තෑගි", "Father's Day Special"),
        subtitle: pickVal("Hampers & watches for Dad", "තාත්තාට අගනා තෑගි කලඹ", "Dadṭa gift hamper Rs 7000 ata"),
        text: "Fathers Day gift hamper and shaving kit under Rs 7000"
      },
      {
        icon: "🪔",
        title: pickVal("Poson Poya Jasmine", "පොසොන් පෝය පූජා", "Poson Poya Jasmine"),
        subtitle: pickVal("Flowers & Poya essentials", "පිච්ච මල් සහ සුදු වත්කම්", "Pichcha mal saha white clothing under Rs 4000"),
        text: "Poson Poya fresh jasmine flowers and white attire under Rs 4000"
      }
    ];
  } else if (m === 7) {
    holidayCards = [
      {
        icon: "🐘",
        title: pickVal("Esala Perahera Feast", "ඇසළ පෙරහැර මංගල්‍යය", "Esala Perahera Feast"),
        subtitle: pickVal("Traditional foods & sweets", "සාම්ප්‍රදායික කෑම සහ පැණි රස", "Kema and sweets hamper Rs 8000 ata"),
        text: "Esala Perahera season traditional food hamper under Rs 8000"
      },
      {
        icon: "🌧️",
        title: pickVal("Rainy Day Comfort", "වැසි දින තේ සහ සුප්", "Rainy Day Comfort"),
        subtitle: pickVal("Ginger tea & biscuit pack", "රට තේ සහ ඉඟුරු බිස්කට්", "Hot tea and ginger biscuits Rs 4000 ata"),
        text: "rainy day tea ginger biscuits and soup pack under Rs 4000"
      }
    ];
  } else if (m === 8) {
    holidayCards = [
      {
        icon: "🪔",
        title: pickVal("Nikini Poya Lotus", "නිකිණි පෝය පූජා", "Nikini Poya Lotus"),
        subtitle: pickVal("Lotus flowers & offerings", "නෙළුම් මල් සහ පූජා වට්ටි", "Nelum mal and poya items under Rs 3000"),
        text: "Nikini Poya lotus flowers and incense sticks under Rs 3000"
      },
      {
        icon: "🧺",
        title: pickVal("August Holiday Picnic", "අගෝස්තු නිවාඩු පික්නික්", "August Holiday Picnic"),
        subtitle: pickVal("Snacks, juices & chocolates", "කෑම, බීම සහ චොකලට් කලඹ", "Snacks and fruit juices Rs 5000 ata"),
        text: "August holidays picnic snacks and juice hamper under Rs 5000"
      }
    ];
  } else if (m === 9) {
    holidayCards = [
      {
        icon: "🎓",
        title: pickVal("Teachers' Day Gifts", "ගුරු දින උපහාර තෑගි", "Teachers' Day Gifts"),
        subtitle: pickVal("Flowers & pen gift sets", "මල් කලඹ සහ පෑන් සහිත තෑගි", "Flower bouquet and pen Rs 4000 ata"),
        text: "Teachers Day flower bouquet and pen gift set under Rs 4000"
      },
      {
        icon: "🪔",
        title: pickVal("Binara Poya Cushion", "බිනර පෝය උපහාර", "Binara Poya Cushion"),
        subtitle: pickVal("Meditation cushion & oils", "භාවනා ආසන සහ සුවඳ තෙල්", "Meditation cushion and oils under Rs 6000"),
        text: "Binara Poya meditation cushion and incense oil under Rs 6000"
      }
    ];
  } else if (m === 10) {
    holidayCards = [
      {
        icon: "🪔",
        title: pickVal("Deepavali Sweet Box", "දීපවාලි රසකැවිලි", "Deepavali Sweet Box"),
        subtitle: pickVal("Premium laddus & murukku", "ලඩ්ඩු සහ මුරුක්කු තෑගි පැක්", "Laddus and murukku gifts Rs 8000 ata"),
        text: "Deepavali sweet boxes and family feast hamper under Rs 8000"
      },
      {
        icon: "🧘",
        title: pickVal("Vap Poya Katina Robe", "වප් පෝය කඨින පූජා", "Vap Poya Katina Robe"),
        subtitle: pickVal("Chivara robe offerings", "චීවරය සහ පූජා භාණ්ඩ", "Cheevara robe and poya sets under Rs 10000"),
        text: "Katina cheevara robe and poya offerings package under Rs 10000"
      }
    ];
  } else if (m === 11) {
    holidayCards = [
      {
        icon: "🎂",
        title: pickVal("Christmas Cake Prep", "නත්තල් කේක් සූදානම", "Christmas Cake Prep"),
        subtitle: pickVal("Plums, cherries & spices", "ප්ලම්ස්, චෙරි සහ කේක් බඩු", "Plums and cherries pack Rs 8000 ata"),
        text: "Christmas cake ingredients plums cherries and spices under Rs 8000"
      },
      {
        icon: "🪔",
        title: pickVal("Il Poya Offerings", "ඉල් පෝය පූජා", "Il Poya Offerings"),
        subtitle: pickVal("Garlands & white flags", "පිච්ච මල් මාලා සහ සුදු කොඩි", "Jasmine mal and white flags Rs 3000"),
        text: "Il Poya fresh flower garlands and white flags under Rs 3000"
      }
    ];
  } else { // December
    holidayCards = [
      {
        icon: "🎄",
        title: pickVal("Christmas Hampers", "නත්තල් තෑගි කලඹ", "Christmas Hampers"),
        subtitle: pickVal("Cakes, treats & gift sets", "නත්තල් කේක් සහ චොකලට් කලඹ", "Xmas cake + chocolate hamper Rs 12000"),
        text: "Christmas cake and premium holiday chocolate hamper under Rs 12000"
      },
      {
        icon: "⛰️",
        title: pickVal("Sri Pada Season Gear", "ශ්‍රී පාද වන්දනා", "Sri Pada Season Gear"),
        subtitle: pickVal("Warm hoodies & flashlights", "සීතලට ඇඳුම් සහ කෑම බීම", "Warm clothes and trail snacks Rs 6000"),
        text: "Sri Pada season warm hoodie flashlight and snacks under Rs 6000"
      }
    ];
  }

  // 2. Evergreen Cards
  const evergreenCards = [
    {
      icon: "🎂",
      title: pickVal("Birthday Celebrations", "උපන් දින සැමරුම්", "Birthday Celebrations"),
      subtitle: pickVal("Cakes, balloons & card", "කේක්, බැලූන් සහ තෑගි පත", "Cake, balloons and cards under Rs 5000"),
      text: "Birthday cake and flowers under Rs 5000"
    },
    {
      icon: "💍",
      title: pickVal("Anniversary Surprise", "සංවත්සර සප්‍රයිස්", "Anniversary Surprise"),
      subtitle: pickVal("Chocolates & fresh flowers", "චොකලට් සහ මල් කලඹ", "Chocolates and flower bouquet Rs 10000"),
      text: "anniversary hamper romantic gift Rs 10000"
    },
    {
      icon: "🛒",
      title: pickVal("Weekly Groceries", "සතිපතා බඩු ලිස්ට්", "Weekly Groceries"),
      subtitle: pickVal("Essentials & fresh veggies", "අත්‍යවශ්‍ය ද්‍රව්‍ය සහ එළවළු", "Weekly groceries pack Rs 15000"),
      text: "family groceries weekly Rs 15000"
    },
    {
      icon: "🧺",
      title: pickVal("Fresh Fruit Basket", "නැවුම් පළතුරු වට්ටිය", "Fresh Fruit Basket"),
      subtitle: pickVal("Curated healthy selection", "නැවුම් පළතුරු තේරීමක්", "Fresh health fruits hamper Rs 4000"),
      text: "fresh healthy fruit basket under Rs 4000"
    }
  ];

  return [...holidayCards, ...evergreenCards];
}

