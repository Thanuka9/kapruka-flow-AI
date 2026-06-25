import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProductCard from "./ProductCard";
import PlanDiff, { computePlanDiff } from "./PlanDiff";
import ShareFlowButton from "./ShareFlowButton";
import CurationReport from "./CurationReport";
import RukaChat from "./RukaChat";
import Icon3D from "./Icon3D";
import { getMcpToolLabel } from "./localization";
import AnimatedTotal from "./AnimatedTotal";
import { formatCurrency } from "../utils/format";

export default function CartPanel({
  cartVersions = {},
  activeVersion = "initial",
  onVersionChange,
  story = [],
  metadata = {},
  prompt = "",
  chatMessages = [],
  chatBusy = false,
  onChatSend,
  onSuggestionAction,   // structured action handler (language-independent)
  onUpdateCartItems,
  onCheckout,
  onControlBarAction,
  onBudgetChange,
  evolution = [],
  onRollback,
  sessionId,
  strings,
  onReset,
  catalogProducts = [],
  clientProfile = null,
  language = "en-US",
  onCompareClick,
  giftMessage = "",
  onGiftMessageChange,
}) {
  const demoCompact = false;
  const items = cartVersions[activeVersion] ?? [];
  const budgetLimit = metadata.budget_limit ?? 25000.0;
  const deliveryFee = metadata.delivery_fee ?? 300.0;
  const deliveryCity = metadata.delivery_city ?? "Colombo 01";

  const activeStrings = strings || {
    ideal_plan: "Ideal Plan",
    cheaper: "Cheaper",
    premium: "Premium",
    fast_delivery: "Fast Delivery",
    empty_crate: "Your Crate is Empty",
    empty_crate_sub: "No products in this shopping flow version.",
    alternative_discoveries: "Alternative Discoveries",
    curation_crate_story: "Curation Crate Story",
    crate_evolution_timeline: "Cart History",
    out_of_stock_cart_hint: "Remove out-of-stock items before checkout.",
    out_of_stock: "Out of stock",
    rollback_note: "* Click any past step to rollback selections and settings to that snapshot.",
    budget_meter: "Budget Meter",
    over_budget: "Over Budget",
    healthy: "Healthy",
    drag_to_adjust: "Drag to Adjust Budget Limit",
    items_subtotal: "Items Subtotal",
    delivery_fee: "Delivery Fee",
    total_price: "Total Price",
    proceed_to_checkout: "Proceed to Checkout",
    control_center: "Control Center",
    curation_actions: "Curation Actions",
    personalization_delivery: "Personalization & Delivery",
    language_context: "Language Context",
    make_cheaper: "Make Cheaper",
    upgrade_premium: "Upgrade Premium",
    today_delivery: "Today Delivery",
    gift_mode: "Gift Mode",
    sinhala: "Sinhala",
    tanglish: "Tanglish",
    optimize: "Optimize",
    surprise_me: "Surprise Me",
    mcp_tools_title: "Kapruka MCP tools used",
    mcp_calls: "calls",
    general_category: "General",
    suggested_addons: "Suggested add-ons",
    suggested_addons_hint: "Swap or add items from Kapruka's catalog.",
    similar_from_plans: "Similar from other plans",
    lower_price: "Lower price",
    higher_price: "Higher price",
  };

  const [fetchedAlternatives, setFetchedAlternatives] = useState([]);
  const [altLoading, setAltLoading] = useState(false);
  const [showDeliveryEdit, setShowDeliveryEdit] = useState(false);
  const [editCity, setEditCity] = useState(deliveryCity);
  const [editDate, setEditDate] = useState("");
  const [showGiftEdit, setShowGiftEdit] = useState(false);
  const giftDraft = giftMessage;
  const setGiftDraft = onGiftMessageChange || (() => {});

  // Slider budget state
  const [sliderBudget, setSliderBudget] = useState(budgetLimit);
  const [planDiff, setPlanDiff] = useState(null);
  const previousVersionRef = useRef(activeVersion);
  const previousItemsRef = useRef(cartVersions[activeVersion] ?? []);

  // Sync state if prop changes
  useEffect(() => {
    setSliderBudget(budgetLimit);
  }, [budgetLimit]);

  useEffect(() => {
    setEditCity(deliveryCity);
  }, [deliveryCity]);

  useEffect(() => {
    const prevItems = previousItemsRef.current;
    const nextItems = cartVersions[activeVersion] ?? [];
    if (previousVersionRef.current !== activeVersion) {
      setPlanDiff(computePlanDiff(prevItems, nextItems));
      const timer = setTimeout(() => setPlanDiff(null), 8000);
      previousVersionRef.current = activeVersion;
      previousItemsRef.current = nextItems;
      return () => clearTimeout(timer);
    }
    previousItemsRef.current = nextItems;
  }, [activeVersion, cartVersions]);

  function handleVersionSwitch(version) {
    previousItemsRef.current = cartVersions[activeVersion] ?? [];
    previousVersionRef.current = activeVersion;
    onVersionChange(version);
  }

  // Calculate totals
  const subtotal = items.reduce((sum, item) => {
    const priceAmount = item.price?.amount ?? item.price ?? 0;
    const qty = item.quantity ?? 1;
    return sum + (priceAmount * qty);
  }, 0);
  
  const total = subtotal > 0 ? subtotal + deliveryFee : 0;
  const budgetRatio = budgetLimit > 0 ? (total / budgetLimit) * 100 : 0;
  const isOverBudget = total > budgetLimit;

  // Formatting helpers

  const priceOf = (p) => p?.price?.amount ?? p?.price ?? 0;
  const inCartIds = new Set(items.map((it) => it.id));

  const dedupeProducts = (list) => {
    const seen = new Set();
    return list.filter((p) => {
      if (!p?.id || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  };

  // All products across plans + catalog for replace/suggest pools
  const getAllCandidates = () => {
    const pools = [];
    Object.values(cartVersions).forEach((verItems) => {
      verItems.forEach((it) => pools.push(it));
    });
    const catalog =
      catalogProducts.length > 0
        ? catalogProducts
        : metadata.catalog_products || [];
    catalog.forEach((p) => pools.push(p));
    fetchedAlternatives.forEach((p) => pools.push(p));
    return dedupeProducts(pools);
  };

  const candidates = getAllCandidates();

  const getCrossPlanItems = () => {
    const cross = [];
    Object.entries(cartVersions).forEach(([ver, verItems]) => {
      if (ver === activeVersion) return;
      verItems.forEach((it) => {
        if (!inCartIds.has(it.id)) cross.push({ ...it, _plan: ver });
      });
    });
    return dedupeProducts(cross);
  };

  const getReplaceCandidates = (productId) => {
    const pool = [];
    items.forEach((it) => {
      if (it.id !== productId) pool.push(it);
    });
    Object.entries(cartVersions).forEach(([ver, verItems]) => {
      if (ver === activeVersion) return;
      verItems.forEach((it) => {
        if (it.id !== productId) pool.push(it);
      });
    });
    const catalog = catalogProducts.length > 0 ? catalogProducts : metadata.catalog_products || [];
    catalog.forEach((p) => {
      if (p.id !== productId && !inCartIds.has(p.id)) pool.push(p);
    });
    fetchedAlternatives.forEach((p) => {
      if (p.id !== productId) pool.push(p);
    });
    return dedupeProducts(pool).slice(0, 12);
  };

  const getSuggestions = () => {
    const inCart = inCartIds;
    const crossPlan = getCrossPlanItems();
    const catalog =
      catalogProducts.length > 0
        ? catalogProducts
        : metadata.catalog_products || [];
    const avail = dedupeProducts([
      ...crossPlan,
      ...catalog,
      ...fetchedAlternatives,
    ]).filter(
      (p) => p?.id && !inCart.has(p.id) && priceOf(p) > 0 && p.in_stock !== false
    );
    if (avail.length === 0) return [];

    const COMPLEMENTARY_MAP = {
      cake: ["candle", "balloon", "card", "party", "hat"],
      flower: ["card", "chocolate", "teddy", "rose", "bouquet"],
      roses: ["card", "chocolate", "teddy", "rose", "bouquet"],
      bouquet: ["card", "chocolate", "teddy", "rose", "bouquet"],
      tea: ["cookie", "biscuit", "sugar", "mug", "honey"],
      coffee: ["cookie", "biscuit", "sugar", "mug", "maker"],
      groceries: ["oil", "milk", "spice", "dhal", "noodle"],
      rice: ["oil", "milk", "spice", "dhal", "noodle"],
      chocolate: ["card", "flower", "teddy"],
      toy: ["card", "chocolate", "wrap"],
      teddy: ["card", "chocolate", "wrap"],
      phone: ["charger", "cable", "battery", "adapter"],
      headphone: ["charger", "cable", "battery", "adapter"],
      electronics: ["charger", "cable", "battery", "adapter"],
      household: ["towel", "spice", "soap", "cleaner"],
      cookware: ["towel", "spice", "soap", "cleaner"],
      baby: ["wipe", "soap", "toy", "diaper"],
      perfume: ["card", "flower"],
      jewellery: ["flower", "card", "chocolate"],
      clothing: ["cologne", "watch", "sunglass"],
      books: ["bookmark", "notebook", "tea"]
    };

    const targetKeywords = [];
    const hasElectronics = items.some(it => {
      const c = String(it.category || "").toLowerCase();
      const n = String(it.name || "").toLowerCase();
      return c.includes("electronics") || c.includes("electronic") || n.includes("phone") || n.includes("headphone") || n.includes("speaker");
    });

    items.forEach(it => {
      const cat = String(it.category || "").toLowerCase();
      const name = String(it.name || "").toLowerCase();
      
      Object.keys(COMPLEMENTARY_MAP).forEach(key => {
        if (cat.includes(key) || name.includes(key)) {
          COMPLEMENTARY_MAP[key].forEach(w => targetKeywords.push(w));
        }
      });
    });

    const averageItemPrice = items.length > 0 ? subtotal / items.length : budgetLimit / 4;
    // Suggestion price cap ensures we don't suggest items that are disproportionately expensive
    const priceLimit = Math.max(averageItemPrice * 1.5, 4500);

    const scoredAvail = avail.map(p => {
      const pName = String(p.name || "").toLowerCase();
      const pCat = String(p.category || "").toLowerCase();
      const pPrice = priceOf(p);

      if (pPrice > priceLimit) {
        return { ...p, _score: 0 };
      }

      let isComplementary = false;
      let isAccessory = false;

      targetKeywords.forEach(kw => {
        if (pName.includes(kw) || pCat.includes(kw)) {
          isComplementary = true;
          if (hasElectronics && ["charger", "cable", "battery", "adapter"].some(w => pName.includes(w) || pCat.includes(w))) {
            isAccessory = true;
          }
        }
      });

      return {
        ...p,
        _isComplementary: isComplementary,
        _isAccessory: isAccessory,
        _score: isComplementary ? 100 - (pPrice / 1000) : 0
      };
    });

    const sorted = [...scoredAvail].sort((a, b) => {
      if (a._score !== b._score) {
        return b._score - a._score;
      }
      return priceOf(a) - priceOf(b);
    });

    const headroom = budgetLimit - total;
    const picks = [];
    const push = (p) => {
      if (p && !picks.some((x) => x.id === p.id)) picks.push(p);
    };

    // Prioritize complementary matches first, then fallbacks
    const complementaryMatches = sorted.filter(x => x._isComplementary);
    const regularMatches = sorted.filter(x => !x._isComplementary);

    complementaryMatches.slice(0, 3).forEach(push);
    crossPlan.slice(0, 2).forEach(push);

    if (headroom <= 0) {
      regularMatches.slice(0, 4).forEach(push);
    } else {
      const fits = regularMatches.filter((p) => priceOf(p) <= headroom);
      const overs = regularMatches.filter((p) => priceOf(p) > headroom);
      if (fits.length) {
        push(fits[0]);
        push(fits[Math.floor(fits.length / 2)]);
        push(fits[fits.length - 1]);
      }
      if (overs.length) push(overs[0]);
      for (const p of regularMatches) {
        if (picks.length >= 6) break;
        push(p);
      }
    }
    return picks.slice(0, 6);
  };

  const suggestions = getSuggestions();
  const crossPlanSuggestions = getCrossPlanItems().slice(0, 4);

  useEffect(() => {
    const inCart = new Set(items.map((it) => it.id));
    const q =
      prompt ||
      metadata.intent_parsed?.query ||
      metadata.intent_parsed?.category ||
      "gift";
    const searchQ = String(q).split(/[,.]/)[0].trim().slice(0, 60);
    if (searchQ.length < 3) return undefined;

    let cancelled = false;
    setAltLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(searchQ)}`)
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((data) => {
        if (cancelled) return;
        const results = (data.results || []).filter(
          (p) => p?.id && !inCart.has(p.id) && p.in_stock !== false
        );
        setFetchedAlternatives(results.slice(0, 12));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAltLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [prompt, activeVersion, items, metadata.intent_parsed?.query, metadata.intent_parsed?.category]);
  const avgItemPrice = items.length > 0 ? subtotal / items.length : budgetLimit / 4;

  // Handle item actions
  const handleRemoveItem = (itemId) => {
    const updated = items.filter(it => String(it.id) !== String(itemId));
    onUpdateCartItems(activeVersion, updated);
  };

  const handleReplaceItem = (oldItemId, newProduct) => {
    const oldItem = items.find(it => String(it.id) === String(oldItemId));
    const qty = oldItem ? (oldItem.quantity ?? 1) : 1;
    
    const updated = items.map(it => {
      if (String(it.id) === String(oldItemId)) {
        return {
          ...newProduct,
          quantity: qty,
          reason: `Replaced by user with ${newProduct.name}`
        };
      }
      return it;
    });
    onUpdateCartItems(activeVersion, updated);
  };

  const handleAddItem = (newProduct) => {
    if (items.some(it => String(it.id) === String(newProduct.id))) return;
    const updated = [...items, { ...newProduct, quantity: 1, reason: "Added by user" }];
    onUpdateCartItems(activeVersion, updated);
  };

  const handleClearCart = () => {
    onUpdateCartItems(activeVersion, []);
  };

  const handleQuantityChange = (itemId, delta) => {
    const updated = items.map((it) => {
      if (String(it.id) !== String(itemId)) return it;
      const nextQty = Math.max(1, Math.min(20, (it.quantity ?? 1) + delta));
      return { ...it, quantity: nextQty };
    });
    onUpdateCartItems(activeVersion, updated);
  };

  const applyDeliveryEdit = () => {
    if (onChatSend && editCity.trim()) {
      onChatSend(`deliver to ${editCity.trim()}`);
    }
    setShowDeliveryEdit(false);
  };

  const formatTotal = formatCurrency(total);
  const outOfStockItems = items.filter((item) => item.in_stock === false);

  return (
    <div className={`w-full grid grid-cols-1 xl:grid-cols-[1fr_min(340px,32vw)] gap-4 xl:gap-6 relative z-10 animate-fadeIn page-enter ${demoCompact ? "demo-cart-compact" : ""}`}>
      
      {/* Product area */}
      <div className="space-y-5 min-w-0">
        
        <CurationReport
          items={items}
          budgetLimit={budgetLimit}
          metadata={metadata}
          language={language}
        />

        <AnimatePresence>
          {planDiff && <PlanDiff diff={planDiff} strings={activeStrings} activeVersion={activeVersion} />}
        </AnimatePresence>

        <div className="flex justify-between items-center gap-2">
          <p className="text-xs text-flow-secondary uppercase tracking-widest font-semibold">
            {activeStrings.cart_variations || "Plan variations"}
          </p>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                className="text-xs font-semibold text-red-500 hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-50"
              >
                {activeStrings.clear_cart || "Clear cart"}
              </button>
            )}
            <button
              type="button"
              onClick={onCompareClick}
              className="text-xs font-bold text-kapruka-gold hover:text-kapruka-gold/80 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8 hover:bg-white/8"
            >
              <Icon3D name="sparkle" size={14} tilt />
              {activeStrings.compare_versions || "Compare Versions"}
            </button>
          </div>
        </div>

        {/* Tab Switcher for Cart Versions */}
        <div className="flow-card p-1.5 flex overflow-x-auto scrollbar-none gap-1.5 relative">
          {["initial", "cheaper", "premium", "fast"].map((ver) => {
            const isActive = activeVersion === ver;
            return (
              <button
                key={ver}
                type="button"
                onClick={() => handleVersionSwitch(ver)}
                className={`plan-tab-indicator flex-1 shrink-0 min-w-[84px] py-2 px-2 text-sm font-semibold rounded-xl ${
                  isActive
                    ? "bg-kapruka-red text-white shadow-card"
                    : "text-flow-secondary hover:text-kapruka-red hover:bg-flow-bg-secondary"
                }`}
              >
                {ver === "initial" 
                  ? activeStrings.ideal_plan 
                  : ver === "cheaper" 
                    ? activeStrings.cheaper 
                    : ver === "premium" 
                      ? activeStrings.premium 
                      : activeStrings.fast_delivery}
              </button>
            );
          })}
        </div>

        {/* Product Cards Grid */}
        <div className="cart-products-zone relative">
          <AnimatePresence mode="sync">
            {items.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="flow-card p-16 text-center space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-flow-bg-secondary flex items-center justify-center mx-auto border border-flow-border text-3xl">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <h3 className="text-section text-flow-text">{activeStrings.empty_crate}</h3>
                <p className="text-base text-flow-muted">{activeStrings.empty_crate_sub}</p>
              </motion.div>
            ) : (
              <motion.div
                key={activeVersion}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start cart-stagger"
              >
                {items.map((item, idx) => (
                  <ProductCard
                    key={item.id}
                    product={item}
                    candidates={getReplaceCandidates(item.id)}
                    isInCart={true}
                    onRemove={() => handleRemoveItem(item.id)}
                    onReplace={(newProduct) => handleReplaceItem(item.id, newProduct)}
                    onQuantityChange={(delta) => handleQuantityChange(item.id, delta)}
                    strings={activeStrings}
                    compact={demoCompact}
                    cardIndex={idx}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Suggested add-ons & swaps */}
        {!demoCompact && (suggestions.length > 0 || crossPlanSuggestions.length > 0 || altLoading) && (
          <div className="space-y-3 pt-1 cart-suggestions-zone">
            <div>
              <h3 className="text-base font-bold text-flow-text inline-flex items-center gap-2">
                <Icon3D name="sparkle" size={17} float /> {activeStrings.suggested_addons}
              </h3>
              <p className="text-sm text-flow-muted mt-1 leading-relaxed">
                {activeStrings.suggested_addons_hint}
              </p>
            </div>
            {altLoading && suggestions.length === 0 && (
              <p className="text-sm text-flow-muted animate-progress-pulse">
                {activeStrings.searching_catalog || "Searching Kapruka catalog…"}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              {[...crossPlanSuggestions, ...suggestions]
                .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
                .slice(0, 6)
                .map((candidate) => {
                  const cheaper = priceOf(candidate) <= avgItemPrice;
                  return (
                    <div key={candidate.id} className="relative">
                      <span
                        className={`absolute -top-1.5 left-3 z-10 px-2 py-0.5 rounded-pill text-xs font-medium border shadow-sm ${
                          candidate._isAccessory
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : candidate._isComplementary
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : candidate._plan
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : cheaper
                                  ? "bg-green-50 text-semantic-success border-green-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {candidate._isAccessory
                          ? `🔌 ${activeStrings.accessory || "Accessory"}`
                          : candidate._isComplementary
                            ? `✨ ${activeStrings.complementary || "Concierge Pick"}`
                            : candidate._plan
                              ? `${candidate._plan.charAt(0).toUpperCase()}${candidate._plan.slice(1)} plan`
                              : cheaper
                                ? `▼ ${activeStrings.lower_price}`
                                : `▲ ${activeStrings.higher_price}`}
                      </span>
                      <ProductCard
                        product={candidate}
                        isInCart={false}
                        onAdd={() => handleAddItem(candidate)}
                        strings={activeStrings}
                        compact
                        cardIndex={0}
                      />
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar — AI, budget, checkout */}
      <div className={`flow-sidebar space-y-4 xl:max-w-[340px] ${demoCompact ? "demo-sidebar-compact" : ""}`}>

        {!demoCompact && metadata.mcp_product_count > 0 && (
          <div className="flow-card p-5 flex items-center justify-between bg-green-50 border-green-100">
            <span className="text-base font-medium text-semantic-success">
              {activeStrings.mcp_catalog_count || "Live MCP Catalog"}
            </span>
            <span className="text-lg font-bold text-flow-text">
              {metadata.mcp_product_count} {activeStrings.products_live || "products"}
            </span>
          </div>
        )}

        {!demoCompact && Array.isArray(metadata.mcp_tools_used) && metadata.mcp_tools_used.length > 0 && (
          <div className="flow-card p-6 space-y-4">
            <h3 className="text-lg font-bold text-flow-text">
              {activeStrings.mcp_live || "Live MCP"}
            </h3>
            <div className="space-y-1">
              {metadata.mcp_tools_used.map((t) => {
                const label = getMcpToolLabel(t.name, activeStrings);
                return (
                  <div key={t.name} className="mcp-check-item justify-between">
                    <span className="flex items-center gap-3">
                      <span className="mcp-check-icon">✓</span>
                      <span>{label}</span>
                    </span>
                    <span className="text-label text-flow-muted shrink-0">
                      {t.count}×
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={`flow-ai-dark ${demoCompact ? "p-4" : "p-6"}`}>
          <RukaChat
            messages={chatMessages}
            busy={chatBusy}
            onSend={onChatSend}
            onSuggestionAction={onSuggestionAction}
            strings={activeStrings}
            metadata={metadata}
            prompt={prompt}
            insightsOnly={demoCompact}
            clientProfile={clientProfile}
            language={language}
            cartVersions={cartVersions}
            activeVersion={activeVersion}
          />
        </div>

        {/* Crate Evolution Timeline */}
        {!demoCompact && evolution.length > 0 && (
          <div className="flow-card p-6 space-y-3 border-l-4 border-[#F6C343]">
            <div>
              <h3 className="text-base font-bold text-flow-text whitespace-nowrap inline-flex items-center gap-2">
                <Icon3D name="bolt" size={16} tilt />
                {activeStrings.crate_evolution_timeline}
              </h3>
              <p className="text-xs text-flow-muted mt-1 leading-relaxed">
                {activeStrings.rollback_note || "* Click any past step to rollback selections and settings to that snapshot."}
              </p>
            </div>
            <div className="space-y-4 relative pl-6 border-l-2 border-white/10 max-h-[340px] overflow-y-auto mt-2">
              {evolution.map((step, idx) => {
                const isActiveStep = idx === evolution.length - 1;
                const stepActive = (step && step.active_version) || "initial";
                const stepItems = (step && step.cart_versions?.[stepActive]) || [];
                const stepBudget = (step && step.budget_limit) ?? 25000.0;
                
                const stepTotal = stepItems.reduce((sum, item) => {
                  const amt = typeof item.price === "number" ? item.price : item.price?.amount || 0;
                  return sum + (amt * (item.quantity || 1));
                }, 0);
                
                const stepLang = step && step.current_language === "si-LK"
                  ? (activeStrings.lang_sinhala || "සිංහල")
                  : step && step.current_language === "en-LK"
                    ? (activeStrings.lang_tanglish || "Tanglish")
                    : (activeStrings.lang_english || "English");

                const stepPlanLabel = stepActive === "initial" 
                  ? activeStrings.ideal_plan || "Ideal"
                  : stepActive === "cheaper"
                    ? activeStrings.cheaper || "Cheaper"
                    : stepActive === "premium"
                      ? activeStrings.premium || "Premium"
                      : activeStrings.fast_delivery || "Fast";

                return (
                  <div 
                    key={idx} 
                    onClick={() => onRollback && onRollback(idx)}
                    className={`relative group cursor-pointer p-3 rounded-xl transition-all border ${
                      isActiveStep 
                        ? "bg-white/5 border-white/12 shadow-[0_4px_16px_rgba(0,0,0,0.3)]" 
                        : "border-transparent hover:bg-white/3 hover:border-white/5"
                    }`}
                    title="Click to rollback to this snapshot"
                  >
                    {/* Stepper Dot */}
                    <div className={`absolute top-5 rounded-full border-2 transition-all ${
                      isActiveStep 
                        ? "-left-[33px] w-4 h-4 bg-[#F6C343] border-[#0f172a] shadow-[0_0_10px_#F6C343] scale-110" 
                        : "-left-[31px] w-3 h-3 bg-[#090d16] border-slate-600 group-hover:border-red-500 group-hover:bg-[#D80000]"
                    }`}></div>
                    
                    <div className="flex items-center justify-between">
                      <div className={`text-label ${isActiveStep ? "text-[#F6C343] font-bold" : "group-hover:text-red-400 text-slate-500"}`}>
                        {(activeStrings.step_label || "Step {n}").replace("{n}", idx + 1)}{isActiveStep && ` ${activeStrings.step_current || "(Current)"}`}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {stepPlanLabel} · LKR {stepBudget.toLocaleString()} · {stepLang}
                      </div>
                    </div>
                    
                    <div className={`text-sm leading-snug mt-1 ${isActiveStep ? "text-white font-bold" : "text-slate-300"}`}>
                      {(step && step.label) || "Crate Curation Updated"}
                    </div>

                    <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                      <span>{(activeStrings.cart_history_spent || "Spent: Rs {amount}").replace("{amount}", stepTotal.toLocaleString())}</span>
                      <span>{(activeStrings.cart_history_items || "{n} items").replace("{n}", stepItems.length)}</span>
                    </div>

                    {stepItems.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-white/5">
                        {stepItems.map((item, i) => (
                          <div 
                            key={item.id || i} 
                            className="relative group/thumb flex items-center justify-center w-7 h-7 rounded bg-white/5 border border-white/8 overflow-hidden" 
                            title={`${item.name} (${item.quantity || 1}×)`}
                          >
                            {item.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px]">{item.category_emoji || "📦"}</span>
                            )}
                            {(item.quantity || 1) > 1 && (
                              <span className="absolute bottom-0 right-0 bg-red-600 text-white text-[8px] px-1 rounded-tl font-bold leading-none scale-90">
                                {item.quantity}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Budget Meter */}
        {outOfStockItems.length > 0 && (
          <div className="flow-card p-4 bg-red-50 border-2 border-red-300 space-y-2 shadow-sm">
            <p className="text-sm font-bold text-red-900 flex items-center gap-2">
              <span className="text-lg">⛔</span>
              {outOfStockItems.length} {activeStrings.out_of_stock || "Out of stock"}
            </p>
            <p className="text-sm text-amber-800 leading-relaxed">
              {activeStrings.out_of_stock_cart_hint}
            </p>
            <ul className="text-sm text-amber-900 list-disc pl-4 space-y-0.5">
              {outOfStockItems.map((item) => (
                <li key={item.id} className="truncate">{item.name}</li>
              ))}
            </ul>
          </div>
        )}

        <div className={`flow-card p-4 space-y-4 ${demoCompact ? "checkout-sticky-mobile" : ""}`}>
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-flow-text inline-flex items-center gap-2">
              <Icon3D name="coin" size={17} tilt />
              {activeStrings.budget_meter}
            </h3>
            <span className={`text-base px-4 py-1.5 rounded-pill font-semibold ${
              isOverBudget
                ? "bg-red-50 text-semantic-error border border-red-200"
                : "bg-green-50 text-semantic-success border border-green-200"
            }`}>
              {isOverBudget ? activeStrings.over_budget : activeStrings.healthy}
            </span>
          </div>

          <div className="space-y-2">
            <div className="w-full h-4 bg-flow-bg-secondary rounded-pill overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ease-out rounded-pill ${
                  isOverBudget ? "bg-semantic-error" : "bg-semantic-success"
                }`}
                style={{ width: `${Math.min(budgetRatio, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-base text-flow-muted">
              <span>{(activeStrings.budget_spent || "{amount} spent").replace("{amount}", formatCurrency(total))}</span>
              <span>{(activeStrings.budget_limit_label || "Limit {amount}").replace("{amount}", formatCurrency(sliderBudget))}</span>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-flow-border">
            <label className="text-label block">
              {activeStrings.drag_to_adjust}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="5000"
                max="100000"
                step="5000"
                value={sliderBudget}
                onChange={(e) => setSliderBudget(Number(e.target.value))}
                onMouseUp={() => onBudgetChange && onBudgetChange(sliderBudget)}
                onTouchEnd={() => onBudgetChange && onBudgetChange(sliderBudget)}
                className="w-full"
              />
              <span className="text-price text-flow-text shrink-0 text-xl font-bold">
                {formatCurrency(sliderBudget)}
              </span>
            </div>
          </div>

          <div className="space-y-3 border-t border-flow-border pt-5">
            <div className="flex justify-between items-baseline gap-4">
              <span className="text-lg font-bold text-flow-text">{activeStrings.total_price}</span>
              <AnimatedTotal
                value={formatTotal}
                className={`budget-total-hero inline-block ${isOverBudget ? "text-semantic-error" : "text-flow-text"}`}
              />
            </div>
            <div className="flex justify-between text-base text-flow-muted pt-2">
              <span>{activeStrings.items_subtotal}</span>
              <span className="font-medium text-flow-secondary">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-base text-flow-muted">
              <span>{activeStrings.delivery_fee} ({deliveryCity})</span>
              <span className="font-medium text-flow-secondary">{formatCurrency(deliveryFee)}</span>
            </div>
            {!isOverBudget && (
              <div className="flex justify-between text-base text-semantic-success font-medium pt-1">
                <span>{activeStrings.insight_remaining || "Remaining"}</span>
                <span>{formatCurrency(Math.max(0, budgetLimit - total))}</span>
              </div>
            )}
          </div>

          {isOverBudget && (
            <div className="flex items-start gap-3 text-base text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-4 leading-relaxed">
              <span>💡</span>
              <span>{activeStrings.over_budget_hint}</span>
            </div>
          )}

          {/* Delivery + gift preview before checkout */}
          {items.length > 0 && (
            <div className="rounded-2xl border border-flow-border bg-flow-bg-secondary/60 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-flow-muted">
                    {activeStrings.personalization_delivery}
                  </p>
                  <p className="text-sm font-semibold text-flow-text mt-1">
                    📍 {editCity || deliveryCity}
                    {editDate ? ` · ${editDate}` : ""}
                  </p>
                  <p className="text-sm text-flow-muted mt-1">
                    {(activeStrings.delivery_to_fee || "Delivery to {city}: LKR {fee}")
                      .replace("{city}", editCity || deliveryCity)
                      .replace("{fee}", String(deliveryFee))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeliveryEdit((v) => !v)}
                  className="text-xs font-bold text-kapruka-red hover:underline shrink-0"
                >
                  {activeStrings.edit_delivery || "Edit delivery"}
                </button>
              </div>
              {showDeliveryEdit && (
                <div className="space-y-2 pt-2 border-t border-flow-border animate-fadeIn">
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="flow-input w-full text-sm"
                    placeholder={activeStrings.delivery_city || "Delivery city"}
                  />
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="flow-input w-full text-sm"
                  />
                  <button type="button" onClick={applyDeliveryEdit} className="btn-secondary w-full min-h-[40px] text-sm">
                    {activeStrings.optimize || "Apply"}
                  </button>
                </div>
              )}
              <div className="pt-2 border-t border-flow-border">
                {!showGiftEdit ? (
                  <button
                    type="button"
                    onClick={() => setShowGiftEdit(true)}
                    className="text-sm text-flow-secondary hover:text-flow-text text-left"
                  >
                    ✉️ {giftDraft ? giftDraft.slice(0, 80) : (activeStrings.add_gift_message || "Add a gift message")}
                  </button>
                ) : (
                  <textarea
                    rows={2}
                    value={giftDraft}
                    onChange={(e) => onGiftMessageChange?.(e.target.value)}
                    className="flow-input w-full text-sm"
                    placeholder={activeStrings.gift_card_msg_opt || "Gift message"}
                  />
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-kapruka-red/5 border border-kapruka-red/15 p-3 text-center">
            <p className="text-[10px] uppercase tracking-widest font-bold text-kapruka-red mb-1">
              {activeStrings.checkout_steps_label || "Checkout steps"}
            </p>
            <p className="text-xs text-flow-secondary leading-relaxed">
              {activeStrings.checkout_steps_preview || "Sender → Recipient → Delivery & Gift → Review → Pay"}
            </p>
          </div>

          <button
            type="button"
            onClick={onCheckout}
            disabled={items.length === 0 || outOfStockItems.length > 0}
            className="btn-primary btn-primary-lg w-full checkout-cta-glow disabled:opacity-50 disabled:cursor-not-allowed text-base py-4"
          >
            {activeStrings.proceed_to_checkout}
          </button>

          {!demoCompact && <ShareFlowButton sessionId={sessionId} strings={activeStrings} />}
        </div>

        {onReset && (
          <button type="button" onClick={onReset} className="btn-tertiary w-full min-h-[44px] text-flow-muted">
            {activeStrings.reset_label || "Reset"}
          </button>
        )}

        {!demoCompact && (
        <div className="flow-card p-6 space-y-5">
          <h3 className="text-xl font-bold text-flow-text pb-3 border-b border-flow-border">
            {activeStrings.control_center}
          </h3>
          
          <div className="space-y-3">
            <h4 className="text-label font-semibold text-flow-text">
              {activeStrings.curation_actions}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onControlBarAction("make_cheaper")}
                className="btn-secondary min-h-[48px]"
              >
                {activeStrings.make_cheaper}
              </button>
              <button
                type="button"
                onClick={() => onControlBarAction("make_premium")}
                className="btn-secondary min-h-[48px]"
              >
                {activeStrings.upgrade_premium}
              </button>
              <button
                type="button"
                onClick={() => onControlBarAction("optimize")}
                className="btn-secondary min-h-[48px]"
              >
                {activeStrings.optimize}
              </button>
              <button
                type="button"
                onClick={() => onControlBarAction("surprise")}
                className="btn-secondary min-h-[48px]"
              >
                {activeStrings.surprise_me}
              </button>
            </div>
          </div>

          {/* Personalization & Delivery */}
          <div className="space-y-3 pt-4 border-t border-flow-border">
            <h4 className="text-label font-semibold text-flow-text">
              {activeStrings.personalization_delivery}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onControlBarAction("today_delivery")}
                className="btn-secondary min-h-[48px]"
              >
                {activeStrings.today_delivery}
              </button>
              <button
                type="button"
                onClick={() => onControlBarAction("gift_mode")}
                className="btn-secondary min-h-[48px]"
              >
                {activeStrings.gift_mode}
              </button>
            </div>
          </div>

          {/* Language Context */}
          <div className="space-y-3 pt-4 border-t border-flow-border">
            <h4 className="text-label font-semibold text-flow-text">
              {activeStrings.language_context}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onControlBarAction("sinhala")}
                className="btn-tertiary min-h-[48px]"
              >
                {activeStrings.sinhala}
              </button>
              <button
                type="button"
                onClick={() => onControlBarAction("tanglish")}
                className="btn-tertiary min-h-[48px]"
              >
                {activeStrings.tanglish}
              </button>
            </div>
          </div>
        </div>
        )}

      </div>

      {items.length > 0 && !demoCompact && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-3 bg-[#0f172a]/95 backdrop-blur-md border-t border-white/10 shadow-2xl xl:hidden">
          <button
            type="button"
            onClick={onCheckout}
            disabled={outOfStockItems.length > 0}
            className="btn-primary w-full min-h-[52px] checkout-cta-glow disabled:opacity-50"
          >
            {activeStrings.floating_checkout || "Checkout now"} · {formatTotal}
          </button>
        </div>
      )}
    </div>
  );
}
