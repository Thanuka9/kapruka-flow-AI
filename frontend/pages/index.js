import { useState, useEffect } from "react";
import Head from "next/head";
import IntentCanvas from "../components/IntentCanvas";
import AIWorkspace from "../components/AIWorkspace";
import CartPanel from "../components/CartPanel";
import CheckoutModal from "../components/CheckoutModal";
import KaprukaHeader from "../components/KaprukaHeader";
import { LoginModal, ProfileModal } from "../components/AuthModals";
import { LOCALIZED_STRINGS } from "../components/localization";
import FlowError from "../components/FlowError";
import { instantRebudget, gatherCatalogFromVersions } from "../utils/rebudget";
import { interpretRefineMessage, buildAgentReplyBubbles } from "../utils/refine";
import { isDemoPrompt } from "../constants/demo";
import { getBookmarks } from "../utils/bookmarks";
import {
  buildClientAiProfile,
  getSavedProductsPayload,
  buildReorderPrompt,
} from "../utils/userContext";

const INTENT_TIMEOUT_MS = 120000;

export default function Home() {
  const [pageState, setPageState] = useState("input"); // "input" | "workspace" | "cart"
  const [sessionId, setSessionId] = useState(null);
  const [cartVersions, setCartVersions] = useState({});
  const [activeVersion, setActiveVersion] = useState("initial");
  const [story, setStory] = useState([]);
  const [metadata, setMetadata] = useState({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [currentLanguage, setCurrentLanguage] = useState("en-US");
  const [pipelineEvents, setPipelineEvents] = useState([]);
  const [apiComplete, setApiComplete] = useState(false);
  const [mcpStatus, setMcpStatus] = useState("ready");
  const [flowError, setFlowError] = useState(null);
  const [catalogCache, setCatalogCache] = useState([]);
  const [lastFailedPrompt, setLastFailedPrompt] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState(false);
  const [user, setUser] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [categoryHint, setCategoryHint] = useState(null);

  // Cart Evolution State (array of snapshot objects)
  const [evolution, setEvolution] = useState([]);
  const [animationDone, setAnimationDone] = useState(false);

  // Conversational refine state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [demoRan, setDemoRan] = useState(false);

  // Load the signed-in user's order history (powers "Picked for you").
  useEffect(() => {
    if (!user?.email) {
      setUserOrders([]);
      return;
    }
    fetch(`/api/orders?email=${encodeURIComponent(user.email)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.orders) setUserOrders(d.orders);
      })
      .catch(() => {});
  }, [user]);

  // Mount: ?demo=1 auto-run OR restore prior session (never both)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const savedUser = localStorage.getItem("kapruka_flow_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("kapruka_flow_user");
      }
    }

    const savedLang = localStorage.getItem("kapruka_flow_lang");
    if (savedLang) {
      setCurrentLanguage(savedLang);
    }

    if (params.get("demo") === "1") {
      [
        "kapruka_flow_session_id",
        "kapruka_flow_cart_versions",
        "kapruka_flow_story",
        "kapruka_flow_metadata",
        "kapruka_flow_evolution",
      ].forEach((k) => localStorage.removeItem(k));
    }

    const urlSession = params.get("session");
    if (urlSession) {
      restoreSession(urlSession, { goToCart: true });
    } else {
      const savedSession = localStorage.getItem("kapruka_flow_session_id");
      if (savedSession) {
        restoreSession(savedSession, { goToCart: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setMcpStatus("connecting");
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setMcpStatus(data?.mcp?.ok === true ? "live" : "unavailable"))
      .catch(() => setMcpStatus("unavailable"));

    loadCategories();
  }, []);

  async function loadCategories() {
    setCategoriesLoading(true);
    setCategoriesError(false);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const r = await fetch("/api/categories", { signal: controller.signal });
      clearTimeout(timer);
      const data = await r.json();
      setCategories(data?.categories || []);
    } catch {
      clearTimeout(timer);
      setCategoriesError(true);
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }

  function handleLoginSuccess(loggedInUser) {
    setUser(loggedInUser);
    localStorage.setItem("kapruka_flow_user", JSON.stringify(loggedInUser));
    setPageState("input");
  }

  function handleLogout() {
    setUser(null);
    localStorage.removeItem("kapruka_flow_user");
    setProfileOpen(false);
  }

  function handleCategorySelect(categoryName) {
    const prompt = `Shop ${categoryName} items for me`;
    setCategoryHint(categoryName);
    handleStartBuild(prompt, currentLanguage, null, categoryName);
  }

  function handleHeaderSearch(query) {
    setCategoryHint(null);
    handleStartBuild(query, currentLanguage);
  }

  function handleLanguageChange(lang) {
    setCurrentLanguage(lang);
    localStorage.setItem("kapruka_flow_lang", lang);
    if (sessionId) {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          event_type: "language_change",
          event_data: { language: lang }
        })
      }).catch(() => {});
    }
  }

  function applySessionPayload(data, { goToCart = false } = {}) {
    setSessionId(data.session_id);
    setCartVersions(data.cart_versions || {});
    setStory(data.story || []);
    setMetadata(data.metadata || {});
    if (data.metadata?.catalog_products) {
      setCatalogCache(data.metadata.catalog_products);
    }

    // Load saved language if available, otherwise fallback to backend inferred language
    const savedLang = localStorage.getItem("kapruka_flow_lang");
    let activeLang = currentLanguage;
    if (savedLang) {
      activeLang = savedLang;
      setCurrentLanguage(savedLang);
    } else if (data.metadata?.intent_parsed?.language) {
      const lang = data.metadata.intent_parsed.language;
      if (lang === "si") activeLang = "si-LK";
      else if (lang === "tanglish") activeLang = "en-LK";
      else activeLang = "en-US";
      setCurrentLanguage(activeLang);
    }

    const rStrings = LOCALIZED_STRINGS[activeLang] || LOCALIZED_STRINGS["en-US"];
    const rPrompt = data.metadata?.intent_parsed?.query || "";
    const rBubbles = buildAgentReplyBubbles(data.story || [], data.metadata || {}, rStrings);
    setChatMessages([
      ...(rPrompt ? [{ role: "user", text: rPrompt }] : []),
      ...rBubbles.map((t) => ({ role: "agent", text: t })),
    ]);
    if (goToCart) setPageState("cart");
    localStorage.setItem("kapruka_flow_session_id", data.session_id);
    localStorage.setItem("kapruka_flow_cart_versions", JSON.stringify(data.cart_versions));
    localStorage.setItem("kapruka_flow_story", JSON.stringify(data.story));
    localStorage.setItem("kapruka_flow_metadata", JSON.stringify(data.metadata));

    if (data.metadata?.intent_parsed?.query) {
      setLastPrompt(data.metadata.intent_parsed.query);
    }

    let validatedEvolution = [];
    if (data.evolution && data.evolution.length > 0) {
      validatedEvolution = data.evolution.filter((step) => step !== null).map((step) => {
        if (typeof step === "object") {
          // If cart_versions is empty/missing, fallback to data.cart_versions (especially for step 0)
          if (!step.cart_versions || Object.keys(step.cart_versions).length === 0) {
            return {
              ...step,
              cart_versions: data.cart_versions || {}
            };
          }
          return step;
        }
        return {
          label: String(step),
          cart_versions: data.cart_versions || {},
          active_version: "initial",
          budget_limit: data.metadata?.budget_limit ?? 25000.0,
          last_prompt: data.metadata?.intent_parsed?.query || "",
          current_language: data.metadata?.intent_parsed?.language || "en-US",
        };
      });
    } else if (data.cart_versions) {
      validatedEvolution = [
        {
          label: "AI composed initial shopping plan",
          cart_versions: data.cart_versions,
          active_version: "initial",
          budget_limit: data.metadata?.budget_limit ?? 25000.0,
          last_prompt: data.metadata?.intent_parsed?.query || "",
          current_language: data.metadata?.intent_parsed?.language || "en-US",
        },
      ];
    }
    setEvolution(validatedEvolution);
    localStorage.setItem("kapruka_flow_evolution", JSON.stringify(validatedEvolution));
  }

  async function restoreSession(sId, { goToCart = false } = {}) {
    try {
      const response = await fetch(`/api/session?session_id=${sId}`);
      if (response.ok) {
        const data = await response.json();
        applySessionPayload(data, { goToCart });
      } else {
        console.warn("Session not found in DB. Trying localStorage fallback.");
        restoreFromLocalStorageCache(sId, { goToCart });
      }
    } catch (err) {
      console.error("Failed to restore session, trying localStorage fallback:", err);
      restoreFromLocalStorageCache(sId, { goToCart });
    }
  }

  function restoreFromLocalStorageCache(sId, { goToCart = false } = {}) {
    try {
      const cachedCart = localStorage.getItem("kapruka_flow_cart_versions");
      const cachedStory = localStorage.getItem("kapruka_flow_story");
      const cachedMetadata = localStorage.getItem("kapruka_flow_metadata");
      const cachedEvolution = localStorage.getItem("kapruka_flow_evolution");

      if (cachedCart) {
        setSessionId(sId);
        setCartVersions(JSON.parse(cachedCart));
        setStory(cachedStory ? JSON.parse(cachedStory) : ["Restored cart from local workspace cache."]);
        setMetadata(cachedMetadata ? JSON.parse(cachedMetadata) : {});
        if (goToCart) setPageState("cart");
        if (cachedEvolution) {
          setEvolution(JSON.parse(cachedEvolution));
        }
      } else {
        localStorage.removeItem("kapruka_flow_session_id");
      }
    } catch (e) {
      console.error("Failed to restore from local storage cache:", e);
      localStorage.removeItem("kapruka_flow_session_id");
    }
  }

  async function handleStartBuild(promptText, language, overrideBudget = null, catHint = null) {
    setPageState("workspace");
    setPendingData(null);
    setAnimationDone(false);
    setApiComplete(false);
    setPipelineEvents([]);
    setFlowError(null);
    setLastPrompt(promptText);
    if (isDemoPrompt(promptText)) setDemoRan(true);
    setLastFailedPrompt({ promptText, language, overrideBudget, catHint: catHint ?? categoryHint });
    const activeCategoryHint = catHint ?? categoryHint;

    // Track analytics
    const sId = sessionId || "";
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sId,
        event_type: "start_build",
        event_data: { prompt: promptText, language, budget: overrideBudget }
      })
    }).catch(() => {});

    // Compute build step log label
    const buildLog = overrideBudget 
      ? `Adjusted budget limit to LKR ${overrideBudget.toLocaleString()}. AI optimized cart.`
      : lastPrompt && lastPrompt !== promptText
        ? `Rebuilt cart in ${language === "si-LK" ? "Sinhala" : language === "en-LK" ? "Tanglish" : "English"}.`
        : `AI composed initial shopping plan: '${promptText}'`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), INTENT_TIMEOUT_MS);

      const response = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: promptText,
          language,
          session_id: sessionId,
          budget: overrideBudget,
          user_email: user?.email || null,
          saved_products: getSavedProductsPayload(),
          category_hint: activeCategoryHint || null,
          evolution: evolution.filter(step => step !== null)
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.error || "Pipeline failed");
      }

      setPipelineEvents(data.pipeline_events || []);
      setCatalogCache(data.metadata?.catalog_products || []);
      setApiComplete(true);
      setPendingData({ ...data, buildLog });
      setSessionId(data.session_id);
      localStorage.setItem("kapruka_flow_session_id", data.session_id);
    } catch (err) {
      console.error(err);
      const errStrings = LOCALIZED_STRINGS[language] || LOCALIZED_STRINGS["en-US"];
      const msg =
        err.name === "AbortError"
          ? errStrings.pipeline_timeout
          : typeof navigator !== "undefined" && !navigator.onLine
            ? errStrings.network_fail || errStrings.pipeline_error
            : err.message || errStrings.pipeline_error;
      setFlowError(msg);
      setPageState("input");
      setApiComplete(false);
      setPipelineEvents([]);
    }
  }

  // Called when AIWorkspace progressive step animation is complete
  function handleWorkspaceComplete() {
    setAnimationDone(true);
  }

  // Transition to cart workspace once both API results and visual animations are complete
  useEffect(() => {
    if (pendingData && animationDone) {
      const currentVersions = pendingData.cart_versions || {};

      // Guard: if the MCP returned nothing (e.g. rate-limited), don't drop the
      // judge into four empty carts — surface a friendly, retryable message.
      const totalItems = Object.values(currentVersions).reduce(
        (sum, items) => sum + (Array.isArray(items) ? items.length : 0),
        0
      );
      if (totalItems === 0) {
        const errStrings = LOCALIZED_STRINGS[currentLanguage] || LOCALIZED_STRINGS["en-US"];
        setFlowError(errStrings.no_products || errStrings.pipeline_error);
        setPageState("input");
        setPendingData(null);
        setAnimationDone(false);
        setApiComplete(false);
        return;
      }

      setCartVersions(currentVersions);
      setStory(pendingData.story);
      setMetadata(pendingData.metadata);
      setCatalogCache(pendingData.metadata?.catalog_products || catalogCache);
      setPageState("cart");
      setActiveVersion("initial");

      // Seed Ruka's conversational thread with the opening reply.
      const seedStrings = LOCALIZED_STRINGS[currentLanguage] || LOCALIZED_STRINGS["en-US"];
      const seedBubbles = buildAgentReplyBubbles(pendingData.story, pendingData.metadata, seedStrings);
      setChatMessages([
        ...(lastPrompt ? [{ role: "user", text: lastPrompt }] : []),
        ...seedBubbles.map((text) => ({ role: "agent", text })),
      ]);
      
      const newStep = {
        label: pendingData.buildLog || "Cart versions updated by AI.",
        cart_versions: currentVersions,
        active_version: "initial",
        budget_limit: pendingData.metadata?.budget_limit ?? 25000.0,
        last_prompt: lastPrompt,
        current_language: currentLanguage
      };

      setEvolution(prev => {
        const updated = [...prev, newStep];
        saveEvolutionToDB(pendingData.session_id, updated, currentVersions);
        // Cache to localStorage
        localStorage.setItem("kapruka_flow_cart_versions", JSON.stringify(currentVersions));
        localStorage.setItem("kapruka_flow_story", JSON.stringify(pendingData.story));
        localStorage.setItem("kapruka_flow_metadata", JSON.stringify(pendingData.metadata));
        localStorage.setItem("kapruka_flow_evolution", JSON.stringify(updated));
        return updated;
      });

      setPendingData(null);
      setAnimationDone(false);
    }
  }, [pendingData, animationDone]);

  function saveEvolutionToDB(sId, updatedEvolution, currentVersions) {
    fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sId,
        cart_versions: currentVersions,
        evolution: updatedEvolution
      })
    }).catch((err) => {
      console.error("Failed to save evolution timeline to database:", err);
    });
  }

  // Handle local additions/removals/replacements within active version
  function handleUpdateCartItems(version, updatedItems) {
    let sId = sessionId;
    if (!sId) {
      sId = "SESS-FLOW-" + Math.random().toString(36).substring(2, 11).toUpperCase();
      setSessionId(sId);
      localStorage.setItem("kapruka_flow_session_id", sId);
    }

    const updatedVersions = {
      ...cartVersions,
      [version]: updatedItems
    };
    setCartVersions(updatedVersions);

    // Compute change log step description
    const oldItems = cartVersions[version] ?? [];
    let changeLog = "";
    if (updatedItems.length < oldItems.length) {
      const removed = oldItems.find(o => !updatedItems.some(u => String(u.id) === String(o.id)));
      changeLog = removed ? `Removed '${removed.name}' from ${version} plan.` : `Removed item from ${version} plan.`;
    } else if (updatedItems.length > oldItems.length) {
      const added = updatedItems.find(u => !oldItems.some(o => String(o.id) === String(u.id)));
      changeLog = added ? `Added '${added.name}' to ${version} plan.` : `Added item to ${version} plan.`;
    } else {
      const replacedOld = oldItems.find(o => updatedItems.some(u => String(u.id) !== String(o.id) && u.reason && u.reason.includes("Replaced")));
      const replacedNew = updatedItems.find(u => oldItems.some(o => String(o.id) !== String(u.id) && u.reason && u.reason.includes("Replaced")));
      if (replacedOld && replacedNew) {
        changeLog = `Replaced '${replacedOld.name}' with '${replacedNew.name}' in ${version} plan.`;
      } else {
        changeLog = `Modified items in ${version} plan.`;
      }
    }

    const newStep = {
      label: changeLog,
      cart_versions: updatedVersions,
      active_version: version,
      budget_limit: metadata.budget_limit ?? 25000.0,
      last_prompt: lastPrompt,
      current_language: currentLanguage
    };

    setEvolution(prev => {
      const updated = [...prev, newStep];
      saveEvolutionToDB(sId, updated, updatedVersions);
      // Cache to localStorage
      localStorage.setItem("kapruka_flow_cart_versions", JSON.stringify(updatedVersions));
      localStorage.setItem("kapruka_flow_evolution", JSON.stringify(updated));
      return updated;
    });

    if (sId) {
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sId,
          event_type: "update_cart",
          event_data: { version, item_count: updatedItems.length }
        })
      }).catch(() => {});
    }
  }

  const FRONTEND_FALLBACK_PRODUCTS = [
    {
      id: "FE-FALLBACK-CHOC",
      name: "Premium Assorted Chocolates Pack",
      price: { amount: 2850, currency: "LKR" },
      image_url: "https://www.kapruka.com/images/chocolates/choc_box.jpg",
      category: "Chocolates",
      category_emoji: "🍫",
      in_stock: true,
      delivery_speed: "Standard"
    },
    {
      id: "FE-FALLBACK-FLOWERS",
      name: "Fresh Red Roses Elegant Bouquet",
      price: { amount: 3500, currency: "LKR" },
      image_url: "https://www.kapruka.com/images/flowers/roses.jpg",
      category: "Flowers",
      category_emoji: "🌹",
      in_stock: true,
      delivery_speed: "Standard"
    },
    {
      id: "FE-FALLBACK-CAKE",
      name: "Classic Ribbon Celebration Cake (1kg)",
      price: { amount: 4200, currency: "LKR" },
      image_url: "https://www.kapruka.com/images/cakes/ribbon_cake.jpg",
      category: "Cakes",
      category_emoji: "🎂",
      in_stock: true,
      delivery_speed: "Standard"
    }
  ];

  // Conversational refine: interpret a free-text follow-up and dispatch it
  // against existing handlers / MCP endpoints, then have Ruka reply.
  async function handleRefine(text) {
    const s = LOCALIZED_STRINGS[currentLanguage] || LOCALIZED_STRINGS["en-US"];
    const pushAgent = (msg, kind) =>
      setChatMessages((prev) => [...prev, { role: "agent", text: msg, kind }]);
    const fmt = (tpl, vars) =>
      Object.entries(vars || {}).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(v), tpl || "");

    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatBusy(true);

    // Compose every cart mutation into one working copy to avoid React state
    // races, then commit once at the end (single evolution step + persistence).
    let workingVersions = { ...cartVersions };
    let workingActive = activeVersion;
    let workingBudget = metadata.budget_limit ?? 25000.0;
    let cartTouched = false;
    let metaPatch = {};

    const catalog =
      catalogCache.length > 0
        ? catalogCache
        : metadata.catalog_products || gatherCatalogFromVersions(cartVersions);
    const fee = metadata.delivery_fee ?? 300;
    const lang = metadata.intent_parsed?.language || "en";

    try {
      const { actions } = interpretRefineMessage(text);

      for (const action of actions) {
        if (action.type === "budget") {
          const result = instantRebudget(catalog, action.value, fee, lang);
          if (result) {
            workingVersions = result.cart_versions;
            workingBudget = action.value;
            cartTouched = true;
          }
          pushAgent(fmt(s.chat_reply_budget, { budget: action.value.toLocaleString() }));
        } else if (action.type === "plan") {
          if ((workingVersions[action.value] || []).length > 0) workingActive = action.value;
          pushAgent(
            action.value === "premium"
              ? s.chat_reply_premium
              : action.value === "fast"
                ? s.chat_reply_fast
                : s.chat_reply_cheaper
          );
        } else if (action.type === "city") {
          metaPatch.delivery_city = action.value;
          pushAgent(fmt(s.chat_reply_city, { city: action.value }));
        } else if (action.type === "gift") {
          metaPatch.intent_parsed = { ...(metadata.intent_parsed || {}), gift_mode: true };
          pushAgent(s.chat_reply_gift);
        } else if (action.type === "remove") {
          const current = workingVersions[workingActive] ?? [];
          const q = action.query.toLowerCase();
          const target = current.find(
            (it) =>
              (it.name || "").toLowerCase().includes(q) ||
              (it.category || "").toLowerCase().includes(q)
          );
          if (target) {
            workingVersions = {
              ...workingVersions,
              [workingActive]: current.filter((it) => it.id !== target.id),
            };
            cartTouched = true;
            pushAgent(fmt(s.chat_reply_removed, { name: target.name }));
          } else {
            pushAgent(fmt(s.chat_reply_remove_fail, { query: action.query }), "question");
          }
        } else if (action.type === "add") {
          let added = null;
          try {
            const current = workingVersions[workingActive] ?? [];
            const res = await fetch(`/api/search?q=${encodeURIComponent(action.query)}`);
            if (res.ok) {
              const data = await res.json();
              added = (data.results || []).find(
                (p) =>
                  p.in_stock !== false &&
                  (p.price?.amount ?? p.price ?? 0) > 0 &&
                  !current.some((it) => String(it.id) === String(p.id))
              );
            }

            // Local fallback 1: Search in local catalog cache
            if (!added) {
              const qLower = action.query.toLowerCase();
              added = catalog.find(
                (p) =>
                  p.in_stock !== false &&
                  (p.price?.amount ?? p.price ?? 0) > 0 &&
                  !current.some((it) => String(it.id) === String(p.id)) &&
                  ((p.name || "").toLowerCase().includes(qLower) ||
                   (p.category || "").toLowerCase().includes(qLower))
              );
            }

            // Local fallback 2: Check matching static frontend fallbacks
            if (!added) {
              const qLower = action.query.toLowerCase();
              added = FRONTEND_FALLBACK_PRODUCTS.find(
                (p) =>
                  !current.some((it) => String(it.id) === String(p.id)) &&
                  ((p.name || "").toLowerCase().includes(qLower) ||
                   (p.category || "").toLowerCase().includes(qLower))
              );
            }

            if (added) {
              workingVersions = {
                ...workingVersions,
                [workingActive]: [
                  ...current,
                  { ...added, quantity: 1, reason: `Added via chat: ${action.query}` },
                ],
              };
              cartTouched = true;
            } else {
              // Suffix / name match fallback to increment quantity of existing item
              const qLower = action.query.toLowerCase();
              const matchingIdx = current.findIndex(
                (it) =>
                  (it.name || "").toLowerCase().includes(qLower) ||
                  qLower.includes((it.name || "").toLowerCase()) ||
                  (it.category || "").toLowerCase().includes(qLower) ||
                  qLower.includes((it.category || "").toLowerCase())
              );
              if (matchingIdx !== -1) {
                const targetItem = current[matchingIdx];
                const newQty = (targetItem.quantity || 1) + 1;
                const updatedItems = [...current];
                updatedItems[matchingIdx] = {
                  ...targetItem,
                  quantity: newQty,
                  reason: `Increased quantity via chat: ${action.query}`
                };
                workingVersions = {
                  ...workingVersions,
                  [workingActive]: updatedItems
                };
                cartTouched = true;
                added = { name: `${targetItem.name} (qty: ${newQty})` };
              }
            }
          } catch (e) {
            console.error("Refine add search failed:", e);
          }
          pushAgent(
            added
              ? fmt(s.chat_reply_added, { name: added.name })
              : fmt(s.chat_reply_add_fail, { query: action.query }),
            added ? undefined : "question"
          );
        } else if (action.type === "add_saved") {
          const saved = getBookmarks();
          const current = workingVersions[workingActive] ?? [];
          const addedNames = [];
          let next = [...current];
          for (const b of saved) {
            if (next.some((it) => it.id === b.id)) continue;
            const amount = typeof b.price === "number" ? b.price : b.price?.amount;
            if (!b.id || !b.name) continue;
            next = [
              ...next,
              {
                id: b.id,
                name: b.name,
                category: b.category || "",
                image_url: b.image_url || "",
                url: b.url || "",
                price:
                  amount != null
                    ? { amount, currency: b.currency || "LKR" }
                    : { amount: 0, currency: "LKR" },
                quantity: 1,
                in_stock: true,
                reason: "Added from your saved items",
              },
            ];
            addedNames.push(b.name);
          }
          if (addedNames.length > 0) {
            workingVersions = { ...workingVersions, [workingActive]: next };
            cartTouched = true;
            pushAgent(fmt(s.chat_reply_saved_added, { names: addedNames.join(", ") }));
          } else {
            pushAgent(s.chat_reply_saved_none, "question");
          }
        } else if (action.type === "reorder") {
          const recent = userOrders[0];
          const q = recent
            ? buildReorderPrompt(recent, currentLanguage)
            : "reorder my favourites like last time";
          pushAgent(s.chat_reply_reorder || "Rebuilding from your order history…");
          setChatBusy(false);
          handleStartBuild(q, currentLanguage, metadata.budget_limit);
          return;
        } else if (action.type === "rebuild") {
          pushAgent(s.chat_reply_rebuild || "Rebuilding your curated cart...");
          setChatBusy(false);
          handleStartBuild(lastPrompt || "gifts", currentLanguage, metadata.budget_limit);
          return;
        } else if (action.type === "research") {
          pushAgent(s.chat_reply_researching);
          setChatBusy(false);
          handleStartBuild(action.query, currentLanguage, metadata.budget_limit);
          return; // pipeline takes over (workspace → cart)
        } else {
          pushAgent(s.chat_clarify, "question");
        }
      }

      // Single commit for all cart/metadata changes.
      const metadataChanged = Object.keys(metaPatch).length > 0 || workingBudget !== (metadata.budget_limit ?? 25000.0);
      const activeVersionChanged = workingActive !== activeVersion;

      if (cartTouched || metadataChanged || activeVersionChanged) {
        if (cartTouched) setCartVersions(workingVersions);
        if (activeVersionChanged) setActiveVersion(workingActive);
        setMetadata((prev) => ({ ...prev, ...metaPatch, budget_limit: workingBudget }));

        // Add to evolution timeline for any conversational change
        const newStep = {
          label: `Chat refine: ${text}`,
          cart_versions: workingVersions,
          active_version: workingActive,
          budget_limit: workingBudget,
          last_prompt: lastPrompt,
          current_language: currentLanguage,
        };
        setEvolution((prev) => {
          const updated = [...prev, newStep];
          if (sessionId) {
            saveEvolutionToDB(sessionId, updated, workingVersions);
            localStorage.setItem("kapruka_flow_cart_versions", JSON.stringify(workingVersions));
            localStorage.setItem("kapruka_flow_evolution", JSON.stringify(updated));
          }
          return updated;
        });
      }
    } finally {
      setChatBusy(false);
    }
  }

  // Handle clicking a timeline step to restore snapshots (Rollback)
  function handleRollback(stepIndex) {
    const targetStep = evolution[stepIndex];
    if (!targetStep || typeof targetStep !== "object") return;

    setCartVersions(targetStep.cart_versions || {});
    setActiveVersion(targetStep.active_version || "initial");
    setMetadata(prev => ({
      ...prev,
      budget_limit: targetStep.budget_limit ?? 25000.0
    }));
    setLastPrompt(targetStep.last_prompt || "");
    setCurrentLanguage(targetStep.current_language || "en-US");

    setEvolution(prev => {
      const updated = prev.slice(0, stepIndex + 1);
      saveEvolutionToDB(sessionId, updated, targetStep.cart_versions || {});
      // Cache to localStorage
      localStorage.setItem("kapruka_flow_cart_versions", JSON.stringify(targetStep.cart_versions || {}));
      localStorage.setItem("kapruka_flow_metadata", JSON.stringify({
        ...metadata,
        budget_limit: targetStep.budget_limit ?? 25000.0
      }));
      localStorage.setItem("kapruka_flow_evolution", JSON.stringify(updated));
      return updated;
    });
  }

  // Handle structured suggestion action clicks (language-independent)
  async function handleSuggestionAction(action, payload = {}) {
    const s = LOCALIZED_STRINGS[currentLanguage] || LOCALIZED_STRINGS["en-US"];
    const pushAgent = (msg) =>
      setChatMessages((prev) => [...prev, { role: "agent", text: msg }]);
    const fmt = (tpl, vars) =>
      Object.entries(vars || {}).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), tpl || "");

    setChatBusy(true);
    try {
      if (action === "add_category") {
        // Delegate to handleRefine with a safe English query
        setChatBusy(false);
        await handleRefine(`add ${payload.category}`);
        return;
      } else if (action === "plan") {
        const ver = payload.value;
        if (cartVersions[ver] && cartVersions[ver].length > 0) {
          setActiveVersion(ver);
        }
        pushAgent(
          ver === "premium" ? s.chat_reply_premium
          : ver === "fast"  ? s.chat_reply_fast
          : s.chat_reply_cheaper
        );
      } else if (action === "budget") {
        handleBudgetChange(payload.value);
        pushAgent(fmt(s.chat_reply_budget, { budget: payload.value.toLocaleString() }));
      } else if (action === "city") {
        setMetadata((prev) => ({ ...prev, delivery_city: payload.value }));
        pushAgent(fmt(s.chat_reply_city, { city: payload.value }));
      } else if (action === "gift") {
        setMetadata((prev) => ({
          ...prev,
          intent_parsed: { ...(prev.intent_parsed || {}), gift_mode: true },
        }));
        pushAgent(s.chat_reply_gift);
      } else if (action === "rebuild") {
        pushAgent(s.chat_reply_rebuild || "Rebuilding your curated cart...");
        setChatBusy(false);
        handleStartBuild(lastPrompt || "gifts", currentLanguage, metadata.budget_limit);
        return;
      } else {
        setChatBusy(false);
        await handleRefine(payload.query || payload.category || "");
        return;
      }
    } finally {
      setChatBusy(false);
    }
  }

  // Handle control bar action clicks
  async function handleControlBarAction(action) {
    if (!sessionId) return;
    
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        event_type: "control_action",
        event_data: { action }
      })
    }).catch(() => {});

    const s = LOCALIZED_STRINGS[currentLanguage] || LOCALIZED_STRINGS["en-US"];
    const pushAgent = (msg) =>
      setChatMessages((prev) => [...prev, { role: "agent", text: msg }]);

    if (action === "make_cheaper") {
      setActiveVersion("cheaper");
      pushAgent(s.chat_reply_cheaper);
    } else if (action === "make_premium") {
      setActiveVersion("premium");
      pushAgent(s.chat_reply_premium);
    } else if (action === "today_delivery") {
      setActiveVersion("fast");
      pushAgent(s.chat_reply_fast);
    } else if (action === "gift_mode") {
      setCheckoutOpen(true);
    } else if (action === "surprise") {
      handleStartBuild("Add a surprise Kapruka gift or chocolate hamper that fits current session.", currentLanguage, metadata.budget_limit);
    } else if (action === "sinhala") {
      handleStartBuild(lastPrompt || "groceries under 20000 LKR", "si-LK", metadata.budget_limit);
    } else if (action === "tanglish") {
      handleStartBuild(lastPrompt || "groceries under 20000 LKR", "en-LK", metadata.budget_limit);
    } else if (action === "optimize") {
      handleStartBuild(`Optimize budget strictly: ${lastPrompt || "groceries under 20000 LKR"}`, "en-US", metadata.budget_limit);
    }
  }

  function handleReset() {
    localStorage.removeItem("kapruka_flow_session_id");
    localStorage.removeItem("kapruka_flow_cart_versions");
    localStorage.removeItem("kapruka_flow_story");
    localStorage.removeItem("kapruka_flow_metadata");
    localStorage.removeItem("kapruka_flow_evolution");
    setSessionId(null);
    setCartVersions({});
    setStory([]);
    setMetadata({});
    setChatMessages([]);
    setPageState("input");
    setLastPrompt("");
    setCurrentLanguage("en-US");
    setEvolution([]);
    setPipelineEvents([]);
    setApiComplete(false);
    setDemoRan(false);
    setFlowError(null);
    setCheckoutOpen(false);
    setPendingData(null);
    setAnimationDone(false);
  }

  function handleBudgetChange(newBudget) {
    const catalog =
      catalogCache.length > 0
        ? catalogCache
        : metadata.catalog_products || gatherCatalogFromVersions(cartVersions);
    const lang = metadata.intent_parsed?.language || "en";
    const fee = metadata.delivery_fee ?? 300;
    const result = instantRebudget(catalog, newBudget, fee, lang);
    if (!result) {
      handleStartBuild(lastPrompt || "groceries under 20000 LKR", currentLanguage, newBudget);
      return;
    }

    setCartVersions(result.cart_versions);
    setStory(result.story);
    setMetadata((prev) => ({ ...prev, budget_limit: newBudget }));

    const newStep = {
      label: `Instant budget optimize → LKR ${newBudget.toLocaleString()}`,
      cart_versions: result.cart_versions,
      active_version: activeVersion,
      budget_limit: newBudget,
      last_prompt: lastPrompt,
      current_language: currentLanguage,
    };

    setEvolution((prev) => {
      const updated = [...prev, newStep];
      if (sessionId) {
        saveEvolutionToDB(sessionId, updated, result.cart_versions);
        localStorage.setItem("kapruka_flow_cart_versions", JSON.stringify(result.cart_versions));
        localStorage.setItem("kapruka_flow_evolution", JSON.stringify(updated));
      }
      return updated;
    });
  }

  function handleRetryFlow() {
    if (!lastFailedPrompt) return;
    setFlowError(null);
    handleStartBuild(
      lastFailedPrompt.promptText,
      lastFailedPrompt.language,
      lastFailedPrompt.overrideBudget,
      lastFailedPrompt.catHint
    );
  }

  const items = cartVersions[activeVersion] ?? [];
  const savedCartItemCount = Object.values(cartVersions).reduce(
    (max, ver) => Math.max(max, Array.isArray(ver) ? ver.length : 0),
    0
  );

  function handleCartClick() {
    const hasCart =
      Object.keys(cartVersions).length > 0 &&
      Object.values(cartVersions).some((v) => Array.isArray(v) && v.length > 0);
    if (hasCart) {
      setPageState("cart");
      return;
    }
    const savedSession = localStorage.getItem("kapruka_flow_session_id");
    if (savedSession) {
      restoreSession(savedSession, { goToCart: true });
    }
  }

  function handleGoHome() {
    setPageState("input");
  }

  const totalCost = items.reduce((sum, item) => {
    const priceAmount = item.price?.amount ?? item.price ?? 0;
    const qty = item.quantity ?? 1;
    return sum + (priceAmount * qty);
  }, 0);

  const strings = LOCALIZED_STRINGS[currentLanguage] || LOCALIZED_STRINGS["en-US"];

  return (
    <div className="min-h-screen text-flow-text bg-flow-bg flex flex-col justify-between relative animate-fadeInOpacity">
      <div className="app-bg" aria-hidden="true" />
      <Head>
        <title>Kapruka Flow — AI Shopping Experience</title>
        <meta name="description" content="State-of-the-art AI-first shopping assistant for Kapruka e-commerce catalog." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="https://www.kapruka.com/favicon.ico" />
      </Head>

      <KaprukaHeader
        strings={strings}
        currentLanguage={currentLanguage}
        onLanguageChange={handleLanguageChange}
        categories={categories}
        categoriesLoading={categoriesLoading}
        categoriesError={categoriesError}
        onCategoriesRetry={loadCategories}
        onCategorySelect={handleCategorySelect}
        onSearchSubmit={handleHeaderSearch}
        user={user}
        onLoginClick={() => setLoginOpen(true)}
        onProfileClick={() => setProfileOpen(true)}
        onLogout={handleLogout}
        onLogoClick={handleGoHome}
        onCartClick={handleCartClick}
        cartCount={items.length}
        showNewFlow={pageState === "cart" || pageState === "workspace" || items.length > 0}
        onNewFlow={handleReset}
      />

      {/* Main Content Area — dark premium workspace below Kapruka site header */}
      <main
        className={`flex-1 w-full relative z-10 ${
          pageState === "cart"
            ? "flow-container py-4 md:py-6 flex flex-col items-stretch"
            : pageState === "workspace"
            ? "flow-container py-6 md:py-10 flex flex-col items-center justify-center"
            : "w-full flex flex-col items-stretch justify-start"
        }`}
      >
        {pageState === "input" && (
          <IntentCanvas 
            onStartBuild={handleStartBuild} 
            language={currentLanguage}
            setLanguage={handleLanguageChange}
            strings={strings}
            user={user}
            userOrders={userOrders}
            mcpStatus={mcpStatus}
            onDemoStart={() => setDemoRan(true)}
            savedCartCount={savedCartItemCount}
            onContinueCart={handleCartClick}
          />
        )}
        
        {pageState === "workspace" && (
          <AIWorkspace
            active={true}
            apiComplete={apiComplete}
            pipelineEvents={pipelineEvents}
            onComplete={handleWorkspaceComplete}
            strings={strings}
            fastMode={demoRan}
          />
        )}

        {pageState === "cart" && Object.keys(cartVersions).length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fadeIn">
            <div className="w-24 h-24 rounded-full bg-flow-bg-secondary border border-flow-border flex items-center justify-center text-5xl shadow-card">
              🛒
            </div>
            <div className="space-y-3">
              <h2 className="text-section text-flow-text">{strings.empty_crate}</h2>
              <p className="text-lg text-flow-muted max-w-md mx-auto">{strings.alert_no_crate}</p>
            </div>
            <button
              type="button"
              onClick={() => setPageState("input")}
              className="btn-primary px-10"
            >
              {strings.profile_start_shopping || "Start shopping"}
            </button>
          </div>
        ) : pageState === "cart" && (
          <CartPanel
            cartVersions={cartVersions}
            activeVersion={activeVersion}
            onVersionChange={setActiveVersion}
            story={story}
            metadata={metadata}
            prompt={lastPrompt}
            chatMessages={chatMessages}
            chatBusy={chatBusy}
            onChatSend={handleRefine}
            onSuggestionAction={handleSuggestionAction}
            onUpdateCartItems={handleUpdateCartItems}
            onCheckout={() => setCheckoutOpen(true)}
            onControlBarAction={handleControlBarAction}
            onBudgetChange={handleBudgetChange}
            evolution={evolution}
            onRollback={handleRollback}
            sessionId={sessionId}
            strings={strings}
            onReset={handleReset}
            catalogProducts={
              catalogCache.length > 0
                ? catalogCache
                : metadata.catalog_products || []
            }
            clientProfile={buildClientAiProfile(userOrders, getBookmarks())}
            language={currentLanguage}
          />
        )}
      </main>

      {/* Checkout Modal with products list passed */}
      {checkoutOpen && (
        <CheckoutModal
          isOpen={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          session_id={sessionId}
          cart_version={activeVersion}
          defaultCity={metadata.delivery_city}
          defaultGiftMessage={metadata.intent_parsed?.gift_message}
          totalCost={totalCost}
          deliveryFee={metadata.delivery_fee ?? 300}
          products={items}
          email={user?.email}
          onAccountCreated={handleLoginSuccess}
          strings={strings}
          demoMode={demoRan}
        />
      )}

      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={user}
        onLogout={handleLogout}
        strings={strings}
        language={currentLanguage}
        onStartShopping={(prompt) => {
          setProfileOpen(false);
          handleGoHome();
          if (prompt) handleStartBuild(prompt, currentLanguage);
        }}
        onReorder={(prompt) => {
          setProfileOpen(false);
          handleGoHome();
          handleStartBuild(prompt, currentLanguage);
        }}
      />

      <FlowError
        message={flowError}
        onRetry={handleRetryFlow}
        onDismiss={() => setFlowError(null)}
        strings={strings}
      />

      {/* Branded Footer */}
      <footer className="w-full px-6 py-10 bg-flow-card border-t border-flow-border text-flow-secondary relative z-20 text-base">
        <div className="max-w-flow mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-flow-muted">
            © {new Date().getFullYear()} Kapruka Holdings PLC. Kapruka Agent Challenge 2026.
          </div>
          <div className="flex gap-8 text-flow-secondary font-medium">
            <a href="https://www.kapruka.com" target="_blank" rel="noopener noreferrer" className="hover:text-kapruka-red transition-colors">
              Kapruka.com
            </a>
            <a href="https://mcp.kapruka.com" target="_blank" rel="noopener noreferrer" className="hover:text-kapruka-red transition-colors">
              MCP Docs
            </a>
            <a href="https://www.kapruka.com/contactUs/agentChallenge.html" target="_blank" rel="noopener noreferrer" className="hover:text-kapruka-red transition-colors">
              Agent Challenge
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
