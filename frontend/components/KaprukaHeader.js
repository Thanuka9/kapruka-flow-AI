import { useState, useRef, useEffect } from "react";
import Icon3D from "./Icon3D";

const CATEGORY_EMOJIS = {
  flowers: "🌸", cakes: "🎂", groceries: "🛒", grocery: "🛒",
  chocolates: "🍫", toys: "🧸", gifts: "🎁", hampers: "🧺",
  fruits: "🍎", electronics: "🔌", clothing: "👕", books: "📚",
  cosmetics: "💄", household: "🏠", liquor: "🍾", babyitems: "👶",
  default: "📦",
};

function categoryEmoji(name) {
  if (!name) return CATEGORY_EMOJIS.default;
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  return CATEGORY_EMOJIS[key] || CATEGORY_EMOJIS.default;
}

function SearchIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
    </svg>
  );
}

function CartIcon({ className = "w-6 h-6" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13L5.4 5M7 13l-1.5 6M17 13l1.5 6M9 19.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm10 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}

export default function KaprukaHeader({
  strings,
  currentLanguage,
  onLanguageChange,
  categories,
  onCategorySelect,
  onSearchSubmit,
  user,
  onLoginClick,
  onProfileClick,
  onLogoClick,
  onCartClick,
  cartCount,
  showNewFlow = false,
  onNewFlow,
}) {
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const catRef = useRef(null);

  const s = strings || {};
  const categoryLabel = (s.all_categories || "All Categories").replace(/^☰\s*/, "");

  useEffect(() => {
    function onDocClick(e) {
      if (catRef.current && !catRef.current.contains(e.target)) {
        setCategoriesOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    const q = searchText.trim();
    if (!q) return;
    onSearchSubmit(q);
    setSearchText("");
  }

  return (
    <header className="kapruka-site-header sticky top-0 z-50 w-full">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 lg:gap-3 min-h-[56px] py-1.5">
          {/* Logo */}
          <button
            type="button"
            onClick={onLogoClick}
            className="flex items-center gap-2 shrink-0 min-w-0"
          >
            <span className="font-black text-xl tracking-tight text-[#D80000] leading-none">
              KAPRUKA
            </span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-white bg-[#D80000] px-2 py-0.5 rounded-md">
              Flow
            </span>
          </button>

          {/* Categories drawer — menu icon only */}
          <div className="relative shrink-0" ref={catRef}>
            <button
              type="button"
              onClick={() => setCategoriesOpen((o) => !o)}
              className={`kapruka-cat-btn flex items-center justify-center w-11 h-11 rounded-xl transition-all ${
                categoriesOpen ? "bg-[#D80000] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              aria-label={categoryLabel}
              title={categoryLabel}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {categoriesOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/30"
                  onClick={() => setCategoriesOpen(false)}
                  aria-hidden
                />
                <div className="fixed left-0 top-0 bottom-0 z-50 w-[min(92vw,380px)] overflow-y-auto bg-white border-r border-gray-200 shadow-2xl sm:top-[68px] sm:bottom-auto sm:max-h-[min(80vh,560px)] sm:rounded-r-2xl">
                  <div className="sticky top-0 px-5 py-4 bg-white border-b border-gray-100 flex items-center justify-between">
                    <span className="text-base font-bold text-gray-800">
                      {s.browse_categories || "Categories"}
                    </span>
                    <button type="button" onClick={() => setCategoriesOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold px-2">✕</button>
                  </div>
                  <div className="p-3 grid grid-cols-1 gap-0.5">
                    {(categories || []).length === 0 ? (
                      <p className="py-8 text-center text-base text-gray-400">{s.loading || "Loading…"}</p>
                    ) : (
                      categories.map((cat, idx) => (
                        <button
                          key={cat.url || cat.name || idx}
                          type="button"
                          className="text-left px-4 py-3 text-base text-gray-800 hover:bg-red-50 hover:text-[#D80000] rounded-xl flex items-center gap-3 transition-colors"
                          onClick={() => {
                            setCategoriesOpen(false);
                            onCategorySelect(cat.name);
                          }}
                        >
                          <span>{categoryEmoji(cat.name)}</span>
                          <span className="font-medium">{cat.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Search */}
          <form
            onSubmit={handleSearch}
            className={`kapruka-search flex flex-1 min-w-0 max-w-2xl mx-auto h-11 items-stretch rounded-full border transition-all duration-200 ${
              searchFocused
                ? "border-[#D80000] bg-white shadow-[0_0_0_3px_rgba(199,1,1,0.12)]"
                : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-white"
            }`}
          >
            <div className="flex items-center pl-4 text-gray-400 pointer-events-none">
              <SearchIcon className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={s.search_placeholder}
              className="flex-1 min-w-0 px-3 bg-transparent text-base text-gray-900 placeholder:text-gray-500 placeholder:font-medium focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 px-5 sm:px-7 m-1 rounded-full bg-[#D80000] hover:bg-[#B50000] text-white text-base font-bold transition-colors flex items-center gap-2"
            >
              <SearchIcon className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">{s.search_btn || "Search"}</span>
            </button>
          </form>

          {/* Right actions — Amazon-style stacked labels */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {showNewFlow && (
              <button
                type="button"
                onClick={onNewFlow}
                className="new-flow-btn kapruka-nav-btn flex items-center justify-center h-11 px-3 sm:px-4 bg-gray-50 border border-gray-200 hover:border-[#D80000]/30 hover:bg-red-50 text-[#D80000] rounded-xl transition-all font-bold text-sm sm:text-base gap-1.5"
                title={s.new_flow || "Start New Flow"}
              >
                <span>🔄</span>
                <span className="hidden sm:inline">{s.new_flow || "New Flow"}</span>
              </button>
            )}

            <select
              value={currentLanguage}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="kapruka-nav-btn hidden md:block h-11 px-3 text-base font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#D80000]/25"
              aria-label="Language"
            >
              <option value="en-US">EN</option>
              <option value="si-LK">සිං</option>
              <option value="en-LK">Tanglish</option>
            </select>

            {user ? (
              <button
                type="button"
                onClick={onProfileClick}
                className="kapruka-nav-btn hidden sm:flex flex-col items-start px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors max-w-[160px] lg:max-w-[200px]"
              >
                <span className="text-sm text-gray-500 leading-none">{s.account_label || "Account"}</span>
                <span className="text-base font-bold text-gray-900 leading-tight truncate w-full text-left">
                  {user.name || user.email}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onLoginClick}
                className="kapruka-nav-btn hidden sm:flex flex-col items-start px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm text-gray-500 leading-none">{s.hello_label || "Hello"}</span>
                <span className="text-base font-bold text-gray-900 leading-tight">{s.login}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onCartClick}
              className="kapruka-nav-btn relative flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              title={s.active_crate}
            >
              <div className="relative text-gray-800">
                <Icon3D name="cart" size={30} tilt />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-[#D80000] text-white text-sm font-bold px-1 animate-pop-in">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </div>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm text-gray-500 leading-none">{s.active_crate}</span>
                <span className="text-base font-bold text-gray-900 leading-tight">
                  {cartCount} {cartCount === 1 ? (s.cart_item_singular || "item") : (s.cart_item_plural || "items")}
                </span>
              </div>
            </button>

          </div>
        </div>
      </div>
    </header>
  );
}
