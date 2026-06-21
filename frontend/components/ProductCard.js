import { useState, useMemo } from "react";
import { isBookmarked, toggleBookmark } from "../utils/bookmarks";
import Icon3D from "./Icon3D";

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
  "birthday": { label: "Birthday", emoji: "🎂", type: "occasion" },
  "birth day": { label: "Birthday", emoji: "🎂", type: "occasion" },
  "anniversary": { label: "Anniversary", emoji: "💍", type: "occasion" },
  "wedding": { label: "Wedding", emoji: "💒", type: "occasion" },
  "valentine": { label: "Valentine's", emoji: "💝", type: "occasion" },
  "mother's day": { label: "Mother's Day", emoji: "🌹", type: "occasion" },
  "fathers day": { label: "Father's Day", emoji: "👔", type: "occasion" },
  "christmas": { label: "Christmas", emoji: "🎄", type: "occasion" },
  "new year": { label: "New Year", emoji: "🎆", type: "occasion" },
  "graduation": { label: "Graduation", emoji: "🎓", type: "occasion" },
  "farewell": { label: "Farewell", emoji: "✈️", type: "occasion" },
  "get well": { label: "Get Well", emoji: "🌻", type: "occasion" },
  "thank you": { label: "Thank You", emoji: "🙏", type: "occasion" },
};

const RECIPIENT_KEYWORDS = {
  "amma": { label: "For Amma", emoji: "👩", type: "recipient" },
  "mother": { label: "For Mum", emoji: "👩", type: "recipient" },
  "mom": { label: "For Mum", emoji: "👩", type: "recipient" },
  "father": { label: "For Dad", emoji: "👨", type: "recipient" },
  "thaththa": { label: "For Thaththa", emoji: "👨", type: "recipient" },
  "dad": { label: "For Dad", emoji: "👨", type: "recipient" },
  "sister": { label: "For Sister", emoji: "👧", type: "recipient" },
  "brother": { label: "For Brother", emoji: "👦", type: "recipient" },
  "friend": { label: "For Friend", emoji: "🤝", type: "recipient" },
  "colleague": { label: "For Colleague", emoji: "💼", type: "recipient" },
  "teacher": { label: "For Teacher", emoji: "📚", type: "recipient" },
  "girlfriend": { label: "For Her", emoji: "💕", type: "recipient" },
  "boyfriend": { label: "For Him", emoji: "💙", type: "recipient" },
  "partner": { label: "For Partner", emoji: "💑", type: "recipient" },
  "baby": { label: "For Baby", emoji: "👶", type: "recipient" },
  "kids": { label: "For Kids", emoji: "🧒", type: "recipient" },
  "grandma": { label: "For Grandma", emoji: "👵", type: "recipient" },
  "grandfather": { label: "For Grandpa", emoji: "👴", type: "recipient" },
};

const SENTIMENT_KEYWORDS = {
  "heartfelt": { label: "Heartfelt", emoji: "💝", type: "sentiment" },
  "premium": { label: "Premium", emoji: "✨", type: "sentiment" },
  "luxur": { label: "Luxury", emoji: "👑", type: "sentiment" },
  "budget": { label: "Value Pick", emoji: "💸", type: "sentiment" },
  "popular": { label: "Popular", emoji: "⭐", type: "sentiment" },
  "fresh": { label: "Fresh", emoji: "🌿", type: "sentiment" },
  "classic": { label: "Classic", emoji: "🏛️", type: "sentiment" },
  "surprise": { label: "Surprise", emoji: "🎉", type: "sentiment" },
  "romantic": { label: "Romantic", emoji: "🌹", type: "sentiment" },
  "healthy": { label: "Healthy", emoji: "🥗", type: "sentiment" },
  "traditional": { label: "Traditional", emoji: "🏺", type: "sentiment" },
  "best seller": { label: "Best Seller", emoji: "🔥", type: "sentiment" },
  "handpicked": { label: "Handpicked", emoji: "🤌", type: "sentiment" },
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
  const formattedPrice = new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: product.price?.currency || "LKR",
    maximumFractionDigits: 0,
  }).format(priceAmount);

  const categoryEmoji = getCategoryEmoji(product.category, product.category_emoji);
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

  const deliveryLabel =
    product.delivery_speed === "Today"
      ? "⚡ Today"
      : product.delivery_speed === "Fast"
        ? "🚀 Fast delivery"
        : "📦 Standard";

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
            <div className="flex flex-col items-center justify-center text-center p-6 h-full w-full bg-gradient-to-br from-flow-bg-secondary to-white">
              <span className="text-5xl mb-3">{categoryEmoji}</span>
              <span className="text-label">{categoryLabel}</span>
            </div>
          )}

          {/* ✨ AI Pick badge top-left */}
          {product.reason && !compact && (
            <span className="absolute top-2 left-2 ai-pick-badge">
              ✨ AI Pick
            </span>
          )}

          {/* Delivery badge bottom-left */}
          <span className="absolute bottom-2 left-2 px-2 py-1 rounded-pill text-xs font-medium bg-white/95 border border-flow-border text-flow-secondary shadow-sm">
            {deliveryLabel}
          </span>

          {product.in_stock === false && (
            <span className="absolute top-2 right-2 px-2 py-1 rounded-pill text-xs font-semibold bg-amber-100 border border-amber-300 text-amber-900">
              {activeStrings.out_of_stock}
            </span>
          )}
        </div>

        <span className="text-label flex items-center gap-1.5 mb-2">
          <span>{categoryEmoji}</span> {categoryLabel}
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
            {dnaChips.map((chip, i) => (
              <span key={i} className={DNA_CHIP_CLASS[chip.type] || "dna-chip dna-chip-sentiment"}>
                {chip.emoji} {chip.label}
              </span>
            ))}
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
            <button type="button" onClick={onRemove} className="btn-secondary text-semantic-error border-red-100 hover:border-red-200 min-h-[40px] text-sm px-3">
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
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            onReplace(c);
                            setShowReplaceMenu(false);
                            setSearchQuery("");
                            setSearchResults([]);
                          }}
                          className="w-full text-left p-3 hover:bg-flow-bg-secondary rounded-xl text-base transition-colors flex justify-between gap-2 text-flow-text"
                        >
                          <span className="truncate">{c.name}</span>
                          <span className="font-bold text-kapruka-red shrink-0">
                            {new Intl.NumberFormat("en-LK", {
                              style: "currency",
                              currency: c.price?.currency || "LKR",
                              maximumFractionDigits: 0,
                            }).format(c.price?.amount || c.price || 0)}
                          </span>
                        </button>
                      ))
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
