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
        <div className="flex items-center gap-3 lg:gap-4 min-h-[64px] py-2">
          {/* Logo */}
          <button
            type="button"
            onClick={onLogoClick}
            className="flex items-center gap-2 shrink-0 min-w-0"
          >
            <span className="font-black text-xl tracking-tight text-[#D80000] leading-none">
              KAPRUKA
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-white bg-gradient-to-r from-red-600 to-red-800 px-2 py-0.5 rounded-md shadow-[0_2px_8px_rgba(216,0,0,0.3)]">
              Flow
            </span>
          </button>

          {/* Categories drawer — menu icon only */}
          <div className="relative shrink-0" ref={catRef}>
            <button
              type="button"
              onClick={() => setCategoriesOpen((o) => !o)}
              className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all border ${
                categoriesOpen
                  ? "bg-[#D80000] border-[#D80000] text-white shadow-[0_0_15px_rgba(216,0,0,0.4)]"
                  : "bg-white/5 border-white/8 text-slate-300 hover:bg-white/10 hover:text-white"
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
                <div className="fixed left-0 top-0 bottom-0 z-50 w-[min(92vw,380px)] overflow-y-auto bg-[#0f172a] border-r border-white/8 shadow-2xl sm:top-[68px] sm:bottom-auto sm:max-h-[min(80vh,560px)] sm:rounded-r-2xl">
                  <div className="sticky top-0 px-5 py-4 bg-[#0f172a] border-b border-white/8 flex items-center justify-between">
                    <span className="text-base font-bold text-white">
                      {s.browse_categories || "Categories"}
                    </span>
                    <button type="button" onClick={() => setCategoriesOpen(false)} className="text-slate-400 hover:text-white font-bold px-2">✕</button>
                  </div>
                  <div className="p-3 grid grid-cols-1 gap-0.5">
                    {(categories || []).length === 0 ? (
                      <p className="py-8 text-center text-base text-slate-500">{s.loading || "Loading…"}</p>
                    ) : (
                      categories.map((cat, idx) => (
                        <button
                          key={cat.url || cat.name || idx}
                          type="button"
                          className="text-left px-4 py-3 text-base text-slate-200 hover:bg-white/5 hover:text-[#D80000] rounded-xl flex items-center gap-3 transition-colors"
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
            className={`flex flex-1 min-w-0 max-w-2xl mx-auto h-11 items-stretch rounded-xl border transition-all duration-300 ${
              searchFocused
                ? "border-red-500/50 bg-white/10 shadow-[0_0_15px_rgba(239,68,68,0.15)] text-white"
                : "border-white/8 bg-white/4 hover:border-white/15 hover:bg-white/6"
            }`}
          >
            <div className="flex items-center pl-4 text-slate-400 pointer-events-none">
              <SearchIcon className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder={s.search_placeholder}
              className="flex-1 min-w-0 px-3 bg-transparent text-base text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 px-6 m-1 rounded-lg bg-[#D80000] hover:bg-[#F21A1A] text-white text-sm font-bold transition-all duration-200 flex items-center gap-2 shadow-[0_4px_12px_rgba(216,0,0,0.2)] hover:shadow-[0_4px_16px_rgba(216,0,0,0.3)] hover:-translate-y-[1px] active:translate-y-0"
            >
              <SearchIcon className="w-4 h-4 sm:hidden" />
              <span className="hidden sm:inline">{s.search_btn || "Search"}</span>
            </button>
          </form>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {showNewFlow && (
              <button
                type="button"
                onClick={onNewFlow}
                className="flex items-center justify-center h-11 px-4 bg-gradient-to-r from-red-600/10 to-red-600/5 hover:from-red-600/20 hover:to-red-600/10 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 rounded-xl transition-all font-bold text-sm sm:text-base gap-2 shadow-[0_0_12px_rgba(216,0,0,0.05)] hover:shadow-[0_0_16px_rgba(216,0,0,0.1)] group"
                title={s.new_flow || "Start New Flow"}
              >
                <svg className="w-4 h-4 transition-transform duration-500 group-hover:rotate-180 text-red-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                <span className="hidden sm:inline">{s.new_flow || "New Flow"}</span>
              </button>
            )}

            <div className="hidden md:flex items-center bg-white/5 border border-white/8 rounded-xl p-1 h-11">
              {[
                { code: "en-US", label: "EN" },
                { code: "si-LK", label: "සිං" },
                { code: "en-LK", label: "Tang" }
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => onLanguageChange(lang.code)}
                  className={`h-8 px-3.5 text-xs font-black rounded-lg transition-all flex items-center justify-center ${
                    currentLanguage === lang.code
                      ? "bg-gradient-to-r from-red-600 to-red-700 text-white shadow-[0_2px_8px_rgba(216,0,0,0.4)]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            {user ? (
              <button
                type="button"
                onClick={onProfileClick}
                className="hidden sm:flex flex-col items-start px-3 py-1.5 rounded-xl bg-white/0 hover:bg-white/5 border border-transparent hover:border-white/5 transition-all max-w-[160px] lg:max-w-[200px]"
              >
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold leading-none">{s.account_label || "Account"}</span>
                <span className="text-sm font-bold text-slate-200 leading-tight truncate w-full text-left mt-0.5">
                  {user.name || user.email}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onLoginClick}
                className="hidden sm:flex flex-col items-start px-4 py-1.5 rounded-xl bg-white/0 hover:bg-white/5 border border-transparent hover:border-white/5 transition-all"
              >
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold leading-none">{s.hello_label || "Hello"}</span>
                <span className="text-sm font-bold text-slate-200 leading-tight mt-0.5">{s.login}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onCartClick}
              className="relative flex items-center gap-3 pl-3 pr-4 h-11 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 hover:border-white/15 transition-all group"
              title={s.active_crate}
            >
              <div className="relative text-red-500 transition-transform group-hover:scale-105">
                <CartIcon className="w-5 h-5 text-red-500" />
                {cartCount > 0 && (
                  <span className="absolute -top-2.5 -right-2.5 min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-[#D80000] text-white text-[10px] font-black px-1 shadow-[0_0_8px_rgba(216,0,0,0.6)] animate-pop-in">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </div>
              <div className="hidden md:flex flex-col items-start text-left">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold leading-none">{s.active_crate}</span>
                <span className="text-sm font-bold text-slate-200 leading-none mt-0.5">
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
