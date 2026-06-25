/** Curated Kapruka-style showcase products — used when MCP search is slow or unavailable. */
export const SHOWCASE_PRODUCTS = [
  {
    id: "SHOWCASE-CHOC",
    name: "Premium Assorted Chocolates Gift Box",
    price: { amount: 2850, currency: "LKR" },
    image_url: "https://www.kapruka.com/images/chocolates/choc_box.jpg",
    category: "Chocolates",
    category_emoji: "🍫",
    in_stock: true,
    delivery_speed: "Standard",
  },
  {
    id: "SHOWCASE-FLOWERS",
    name: "Fresh Red Roses Elegant Bouquet",
    price: { amount: 3500, currency: "LKR" },
    image_url: "https://www.kapruka.com/images/flowers/roses.jpg",
    category: "Flowers",
    category_emoji: "🌹",
    in_stock: true,
    delivery_speed: "Same-day",
  },
  {
    id: "SHOWCASE-CAKE",
    name: "Classic Ribbon Celebration Cake (1kg)",
    price: { amount: 4200, currency: "LKR" },
    image_url: "https://www.kapruka.com/images/cakes/ribbon_cake.jpg",
    category: "Cakes",
    category_emoji: "🎂",
    in_stock: true,
    delivery_speed: "Standard",
  },
  {
    id: "SHOWCASE-HAMPER",
    name: "Deluxe Gift Hamper with Treats",
    price: { amount: 8900, currency: "LKR" },
    image_url: "https://www.kapruka.com/images/gifts/hamper.jpg",
    category: "Gift Hampers",
    category_emoji: "🎁",
    in_stock: true,
    delivery_speed: "Standard",
  },
  {
    id: "SHOWCASE-FRUIT",
    name: "Seasonal Fresh Fruit Basket",
    price: { amount: 5200, currency: "LKR" },
    image_url: "https://www.kapruka.com/images/groceries/fruit_basket.jpg",
    category: "Groceries",
    category_emoji: "🍎",
    in_stock: true,
    delivery_speed: "Standard",
  },
  {
    id: "SHOWCASE-TEA",
    name: "Ceylon Tea & Snacks Gift Pack",
    price: { amount: 3100, currency: "LKR" },
    image_url: "https://www.kapruka.com/images/groceries/tea_pack.jpg",
    category: "Groceries",
    category_emoji: "🍵",
    in_stock: true,
    delivery_speed: "Standard",
  },
];

export async function fetchTrendingProductsFromBackend(backendUrl, timeoutMs = 12000) {
  const queries = ["gift hamper", "chocolates", "flowers", "cakes"];
  const merged = [];
  const seen = new Set();

  await Promise.all(
    queries.map(async (q) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const r = await fetch(
          `${backendUrl}/api/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        clearTimeout(timer);
        if (!r.ok) return;
        const data = await r.json();
        for (const p of data.results || []) {
          if (p?.id && !seen.has(p.id)) {
            seen.add(p.id);
            merged.push(p);
          }
        }
      } catch {
        clearTimeout(timer);
      }
    })
  );

  return merged.slice(0, 6);
}
