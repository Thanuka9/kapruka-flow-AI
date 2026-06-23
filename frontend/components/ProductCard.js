import { useState, useMemo } from "react";
import { isBookmarked, toggleBookmark } from "../utils/bookmarks";
import Icon3D from "./Icon3D";
import { formatCurrency } from "../utils/format";

const CATEGORY_EMOJI_MAP = {
  flowers: "🌸", cakes: "🎂", groceries: "🛒", chocolates: "🍫",
  toys: "🧸", gifts: "🎁", hampers: "🧺", books: "📚",
  electronics: "🔌", clothing: "👕", cosmetics: "💄", general: "📦",
};

function getCategoryEmoji(category, precomputed) {
  if (precomputed) return precomputed;
  if (!category) return "📦";
  const lower = category.toLowerCase().trim();
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJI_MAP)) {
    if (lower.includes(key)) return emoji;
  }
  return "📦";
}

// ── Curation DNA chip parser ─────────────────────────────────────────
const OCCASION_KEYWORDS = {
  "birthday": { key: "birthday", label: "Birthday", emoji: "🎂", type: "occasion" },
  "birth day": { key: "birthday", label: "Birthday", emoji: "🎂", type: "occasion" },
  "anniversary": { key: "anniversary", label: "Anniversary", emoji: "💍", type: "occasion" },
  "wedding": { key: "wedding", label: "Wedding", emoji: "💒", type: "occasion" },
  "valentine": { key: "valentine", label: "Valentine's", emoji: "💝", type: "occasion" },
  "mother's day": { key: "mothers_day", label: "Mother's Day", emoji: "🌹", type: "occasion" },
  "fathers day": { key: "fathers_day", label: "Father's Day", emoji: "👔", type: "occasion" },
  "christmas": { key: "christmas", label: "Christmas", emoji: "🎄", type: "occasion" },
  "new year": { key: "new_year", label: "New Year", emoji: "🎆", type: "occasion" },
  "graduation": { key: "graduation", label: "Graduation", emoji: "🎓", type: "occasion" },
  "farewell": { key: "farewell", label: "Farewell", emoji: "✈️", type: "occasion" },
  "get well": { key: "get_well", label: "Get Well", emoji: "🌻", type: "occasion" },
  "thank you": { key: "thank_you", label: "Thank You", emoji: "🙏", type: "occasion" },
};

const RECIPIENT_KEYWORDS = {
  "amma": { key: "amma", label: "For Amma", emoji: "👩", type: "recipient" },
  "mother": { key: "mother", label: "For Mum", emoji: "👩", type: "recipient" },
  "mom": { key: "mother", label: "For Mum", emoji: "👩", type: "recipient" },
  "father": { key: "father", label: "For Dad", emoji: "👨", type: "recipient" },
  "thaththa": { key: "thaththa", label: "For Thaththa", emoji: "👨", type: "recipient" },
  "dad": { key: "father", label: "For Dad", emoji: "👨", type: "recipient" },
  "sister": { key: "sister", label: "For Sister", emoji: "👧", type: "recipient" },
  "brother": { key: "brother", label: "For Brother", emoji: "👦", type: "recipient" },
  "friend": { key: "friend", label: "For Friend", emoji: "🤝", type: "recipient" },
  "colleague": { key: "colleague", label: "For Colleague", emoji: "💼", type: "recipient" },
  "teacher": { key: "teacher", label: "For Teacher", emoji: "📚", type: "recipient" },
  "girlfriend": { key: "girlfriend", label: "For Her", emoji: "💕", type: "recipient" },
  "boyfriend": { key: "boyfriend", label: "For Him", emoji: "💙", type: "recipient" },
  "partner": { key: "partner", label: "For Partner", emoji: "💑", type: "recipient" },
  "baby": { key: "baby", label: "For Baby", emoji: "👶", type: "recipient" },
  "kids": { key: "kids", label: "For Kids", emoji: "🧒", type: "recipient" },
  "grandma": { key: "grandma", label: "For Grandma", emoji: "👵", type: "recipient" },
  "grandfather": { key: "grandfather", label: "For Grandpa", emoji: "👴", type: "recipient" },
};

const SENTIMENT_KEYWORDS = {
  "heartfelt": { key: "heartfelt", label: "Heartfelt", emoji: "💝", type: "sentiment" },
  "premium": { key: "premium", label: "Premium", emoji: "✨", type: "sentiment" },
  "luxur": { key: "luxury", label: "Luxury", emoji: "👑", type: "sentiment" },
  "budget": { key: "budget", label: "Value Pick", emoji: "💸", type: "sentiment" },
  "popular": { key: "popular", label: "Popular", emoji: "⭐", type: "sentiment" },
  "fresh": { key: "fresh", label: "Fresh", emoji: "🌿", type: "sentiment" },
  "classic": { key: "classic", label: "Classic", emoji: "🏛️", type: "sentiment" },
  "surprise": { key: "surprise", label: "Surprise", emoji: "🎉", type: "sentiment" },
  "romantic": { key: "romantic", label: "Romantic", emoji: "🌹", type: "sentiment" },
  "healthy": { key: "healthy", label: "Healthy", emoji: "🥗", type: "sentiment" },
  "traditional": { key: "traditional", label: "Traditional", emoji: "🏺", type: "sentiment" },
  "best seller": { key: "best_seller", label: "Best Seller", emoji: "🔥", type: "sentiment" },
  "handpicked": { key: "handpicked", label: "Handpicked", emoji: "🤌", type: "sentiment" },
};

function parseDnaChips(reason) {
  if (!reason) return [];
  const lower = reason.toLowerCase();
  const chips = [];

  for (const [kw, data] of Object.entries(OCCASION_KEYWORDS)) {
    if (lower.includes(kw)) { chips.push(data); break; }
  }
  for (const [kw, data] of Object.entries(RECIPIENT_KEYWORDS)) {
    if (lower.includes(kw)) { chips.push(data); break; }
  }
  for (const [kw, data] of Object.entries(SENTIMENT_KEYWORDS)) {
    if (lower.includes(kw)) { chips.push(data); break; }
  }
  return chips.slice(0, 3);
}

const DNA_CHIP_CLASS = {
  occasion: "dna-chip dna-chip-occasion",
  recipient: "dna-chip dna-chip-recipient",
  sentiment: "dna-chip dna-chip-sentiment",
};

export default function ProductCard({
  product,
  onRemove,
  onAdd,
  onReplace,
  isInCart = true,
  candidates = [],
  strings,
  compact = false,
  cardIndex = 0,
}) {
  const activeStrings = strings || {
    remove: "Remove",
    replace: "Replace",
    qty: "Qty",
    curation_note: "Why we picked this",
    add_to_crate: "Add to cart",
    view_on_kapruka: "View on Kapruka",
    search_catalog: "Search catalog...",
    alternative_items: "Alternative items",
    searching_catalog: "Searching...",
    no_items_found: "No items found",
    general_category: "General",
    out_of_stock: "Out of stock",
  };

  const [isSaved, setIsSaved] = useState(() =>
    typeof window !== "undefined" ? isBookmarked(product.id) : false
  );

  const [imgError, setImgError] = useState(false);
  const [showReplaceMenu, setShowReplaceMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const dnaChips = useMemo(() => parseDnaChips(product.reason), [product.reason]);

  const handleToggleSave = () => {
    const added = toggleBookmark(product);
    setIsSaved(added);
  };

  const priceAmount = product.price?.amount ?? product.price ?? 0;
  const formattedPrice = formatCurrency(priceAmount);

  const categoryLabel = product.category || activeStrings.general_category || "General";
  const hasValidImage = product.image_url && !imgError;
  const displayProducts = searchQuery.trim().length >= 3 ? searchResults : candidates;

  const handleSearchCatalog = async (q) => {
    setSearchQuery(q);
    if (q.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error("Failed to search catalog:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const categoryIcon = useMemo(() => {
    const category = product.category;
    if (!category) return "box";
    const lower = category.toLowerCase().trim();
    if (lower.includes("flower")) return "flower";
    if (lower.includes("cake")) return "gift";
    if (lower.includes("grocery") || lower.includes("shopping") || lower.includes("fruit")) return "cart";
    if (lower.includes("electronic") || lower.includes("appliance")) return "bolt";
    if (lower.includes("gift")) return "gift";
    if (lower.includes("hamper")) return "box";
    if (lower.includes("clothing") || lower.includes("dress") || lower.includes("cosmetic") || lower.includes("fashion") || lower.includes("bag")) return "bag";
    if (lower.includes("toy")) return "gift";
    if (lower.includes("star") || lower.includes("popular")) return "star";
    return "box";
  }, [product.category]);

  const deliveryIcon = useMemo(() => {
    const speed = String(product.delivery_speed || "").toLowerCase();
    if (speed === "today") return "bolt";
    if (speed === "fast") return "truck";
    return "box";
  }, [product.delivery_speed]);

  const deliveryLabelText = useMemo(() => {
    const speed = String(product.delivery_speed || "").toLowerCase();
    if (speed === "today") return activeStrings.insight_delivery_today || "Today";
    if (speed === "fast") return activeStrings.insight_delivery_fast || "Fast";
    return activeStrings.insight_delivery_standard || "Standard";
  }, [product.delivery_speed, activeStrings]);

  return (
    <div
      className={`flow-card product-card-premium card-waterfall ${compact ? "p-3 product-demo-compact" : "p-4"} flex flex-col relative ${
        isInCart ? "flow-card-selected" : "opacity-95"
      } ${product.in_stock === false ? "border-amber-300 bg-amber-50/30" : ""} ${showReplaceMenu ? "z-50" : ""}`}
      style={{ animationDelay: `${cardIndex * 0.07}s` }}
    >
      {/* Bookmark / save */}
      <button
        type="button"
        onClick={handleToggleSave}
        className="absolute top-5 right-5 hover:scale-110 transition-transform focus:outline-none z-10"
        aria-label="Save"
      >
        {isSaved ? (
          <Icon3D name="star" size={22} tilt className="animate-pop-in" />
        ) : (
          <span className="text-xl text-slate-300 hover:text-kapruka-gold transition-colors">☆</span>
        )}
      </button>

      <div>
        {/* Image area */}
        <div className={`w-full ${compact ? "h-32" : "h-44"} rounded-xl bg-flow-bg-secondary flex items-center justify-center mb-3 border border-flow-border overflow-hidden relative group`}>
          {hasValidImage ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="object-cover w-full h-full card-img-zoom"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 h-full w-full bg-gradient-to-br from-flow-bg-secondary to-flow-bg">
              <Icon3D name={categoryIcon} size={44} float className="mb-3" />
              <span className="text-label text-slate-400">{categoryLabel}</span>
            </div>
          )}

          {/* ✨ AI Pick badge top-left */}
          {product.reason && !compact && (
            <span className="absolute top-2 left-2 ai-pick-badge">
              {activeStrings.ai_pick || "✨ AI Pick"}
            </span>
          )}

          {/* Delivery badge bottom-left */}
          <span className="absolute bottom-2 left-2 px-2.5 py-1.5 rounded-pill text-xs font-semibold bg-[#090d16]/80 border border-white/10 text-slate-200 backdrop-blur-md shadow-sm flex items-center gap-1.5">
            <Icon3D name={deliveryIcon} size={13} tilt />
            {deliveryLabelText}
          </span>

          {product.in_stock === false && (
            <span className="absolute top-2 right-2 px-2 py-1 rounded-pill text-xs font-semibold bg-amber-950/40 border border-amber-900/30 text-amber-400">
              {activeStrings.out_of_stock}
            </span>
          )}
        </div>

        <span className="text-label flex items-center gap-2 mb-2 text-slate-400">
          <Icon3D name={categoryIcon} size={14} tilt />
          <span>{categoryLabel}</span>
        </span>

        <h3 className="text-product-title line-clamp-2 text-flow-text mb-2 pr-8" title={product.name}>
          {product.url ? (
            <a href={product.url} target="_blank" rel="noopener noreferrer" className="hover:text-kapruka-red transition-colors">
              {product.name}
            </a>
          ) : (
            product.name
          )}
        </h3>

        <div className="flex items-center gap-3 mb-3">
          <p className="text-price text-kapruka-red">{formattedPrice}</p>
          {isInCart && product.quantity && (
            <span className="text-label bg-flow-bg-secondary px-3 py-1 rounded-pill">
              {activeStrings.qty}: {product.quantity}
            </span>
          )}
        </div>

        {/* ── Curation DNA chips ── */}
        {dnaChips.length > 0 && !compact && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {dnaChips.map((chip, i) => {
              const key = `dna_${chip.type}_${chip.key}`;
              const label = activeStrings[key] || chip.label;
              return (
                <span key={i} className={DNA_CHIP_CLASS[chip.type] || "dna-chip dna-chip-sentiment"}>
                  {chip.emoji} {label}
                </span>
              );
            })}
          </div>
        )}

        {/* ── Upgraded curation note ── */}
        {product.reason && !compact && (
          <div className="curation-note-block mb-3">
            <span className="text-label block mb-1 text-kapruka-gold/80">
              {activeStrings.curation_note}
            </span>
            <p className="text-sm text-flow-secondary leading-relaxed">{product.reason}</p>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-flow-border flex gap-2 items-center justify-between relative">
        {isInCart ? (
          <>
            <button type="button" onClick={onRemove} className="flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-red-900/30 bg-red-950/20 text-red-400 hover:bg-red-900/40 hover:text-red-300 transition-all text-sm font-semibold cursor-pointer">
              {activeStrings.remove}
            </button>
            <div className="relative">
              <button type="button" onClick={() => setShowReplaceMenu(!showReplaceMenu)} className="btn-tertiary min-h-[40px] font-semibold text-sm px-3">
                {activeStrings.replace}
              </button>
              {showReplaceMenu && (
                <div className="absolute left-0 right-0 top-full mt-2 w-full min-w-[240px] flow-card p-3 z-[60] max-h-64 overflow-y-auto shadow-card-hover">
                  <input
                    type="text"
                    placeholder={activeStrings.search_catalog}
                    value={searchQuery}
                    onChange={(e) => handleSearchCatalog(e.target.value)}
                    className="w-full flow-input px-3 py-2 mb-3 text-base"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="text-label mb-2">{activeStrings.alternative_items}</div>
                  {isSearching ? (
                    <div className="text-base text-flow-muted p-2">{activeStrings.searching_catalog}</div>
                  ) : displayProducts.length === 0 ? (
                    <div className="text-base text-flow-muted p-2">{activeStrings.no_items_found}</div>
                  ) : (
                    displayProducts
                      .filter((c) => c.id !== product.id)
                      .map((c) => {
                        const altPrice = c.price?.amount ?? c.price ?? 0;
                        const priceDiff = altPrice - priceAmount;
                        const diffText = priceDiff === 0 
                          ? "" 
                          : priceDiff > 0 
                            ? `(+${new Intl.NumberFormat("en-LK").format(priceDiff)} LKR)`
                            : `(-${new Intl.NumberFormat("en-LK").format(Math.abs(priceDiff))} LKR)`;
                        const diffColor = priceDiff > 0 ? "text-amber-500 font-bold" : "text-emerald-500 font-bold";
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              onReplace(c);
                              setShowReplaceMenu(false);
                              setSearchQuery("");
                              setSearchResults([]);
                            }}
                            className="w-full text-left p-2.5 hover:bg-flow-bg-secondary rounded-xl text-xs transition-colors flex flex-col gap-1 text-flow-text border border-transparent hover:border-flow-border/50"
                          >
                            <span className="truncate font-semibold text-flow-text w-full">{c.name}</span>
                            <div className="flex justify-between items-center w-full text-[11px] mt-0.5">
                              <span className="font-bold text-kapruka-red font-mono">
                                {new Intl.NumberFormat("en-LK", {
                                  style: "currency",
                                  currency: c.price?.currency || "LKR",
                                  maximumFractionDigits: 0,
                                }).format(altPrice).replace(/\s+/g, " ")}
                              </span>
                              {diffText && (
                                <span className={`font-mono text-[10px] ${diffColor}`}>
                                  {diffText}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <button type="button" onClick={onAdd} className="w-full btn-primary min-h-[56px]">
            {activeStrings.add_to_crate}
          </button>
        )}
      </div>
    </div>
  );
}
