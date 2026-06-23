import { useState, useRef, useEffect, useMemo } from "react";
import { KapriAvatar } from "./AgentPersona";
import Icon3D from "./Icon3D";
import { buildProfileQuickReplies } from "../utils/userContext";

function formatBudgetShort(n) {
  const v = Number(n) || 0;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}

function deliveryPillLabel(speed, strings) {
  if (speed === "today") return strings.insight_delivery_today || "Today";
  if (speed === "fast") return strings.insight_delivery_fast || "Fast";
  return strings.insight_delivery_standard || "Standard";
}

/** Build contextual opening greeting from intent metadata */
function buildGreeting(metadata, strings, prompt) {
  const intent = metadata?.intent_parsed || {};
  const s = strings || {};
  const tone = intent.tone || "standard";

  if (tone === "empathetic_comfort") {
    return s.greeting_comfort || "I'm so sorry to hear about this difficult situation. I want to help make things a little easier, so I have curated comforting options. ❤️";
  }
  if (tone === "joyful_celebration") {
    return s.greeting_celebration || "Wow, that is wonderful news! Congratulations! 🎉 I've put together some celebratory options to mark this special milestone.";
  }

  const cleanKey = (k) =>
    String(k || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

  // Localize occasion
  let occasionStr = "";
  if (intent.occasion) {
    const occClean = String(intent.occasion).replace(/_/g, " ");
    const occKey = `dna_occasion_${cleanKey(intent.occasion)}`;
    const occLabel = s[occKey] || occClean;
    occasionStr = ` — ${occLabel}`;
  }

  // Localize recipient
  let recipientStr = "";
  if (intent.recipient) {
    const recKey = `dna_recipient_${cleanKey(intent.recipient)}`;
    const recLabel = s[recKey] || String(intent.recipient);
    recipientStr = (s.for_recipient || " for {recipient}").replace("{recipient}", recLabel);
  }

  // Localize budget
  let budgetStr = "";
  if (metadata?.budget_limit) {
    const formattedBudget = new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(metadata.budget_limit);
    budgetStr = (s.within_budget || " within LKR {budget}").replace("{budget}", formattedBudget);
  }

  // Localize categories
  const matchedCats = intent.matched_categories || [];
  const localizedCats = matchedCats.map(cat => {
    const catKey = `category_${cleanKey(cat)}`;
    return s[catKey] || cat;
  });
  const catsStr = localizedCats.slice(0, 2).join(" & ") || s.category_gifts || "gifts";

  if (intent.occasion || intent.recipient) {
    const template = s.ruka_greeting_curated || "I curated the perfect {categories}{recipient}{occasion}{budget}. 🎁 Switch plans or ask me anything!";
    return template
      .replace("{categories}", catsStr)
      .replace("{recipient}", recipientStr)
      .replace("{occasion}", occasionStr)
      .replace("{budget}", budgetStr);
  }

  if (prompt) {
    const template = s.ruka_greeting_prompt || "Here's your curated cart for \"{prompt}\"{budget}. Anything to tweak?";
    const truncatedPrompt = prompt.slice(0, 52) + (prompt.length > 52 ? "…" : "");
    return template
      .replace("{prompt}", truncatedPrompt)
      .replace("{budget}", budgetStr);
  }

  return s.agent_reply_intro || "Done! Here's what I built. Switch plans or chat with me to refine. 🛒";
}

/**
 * Build structured suggestion objects.
 * Each suggestion has an action ID + payload — NOT a text string for parsing.
 * The label is localized; the action is language-independent.
 */
function buildChatSuggestions(metadata, strings, cartVersions, activeVersion) {
  const intent = metadata?.intent_parsed || {};
  const cats = (intent.matched_categories || []).map((c) => String(c).toLowerCase());
  const budget = metadata?.budget_limit ?? 25000;
  const cheaper = Math.round(budget * 0.7);
  const premium = Math.round(budget * 1.4);
  const tone = intent.tone || "standard";

  const primary = [];
  const secondary = [];

  // 1. Context-aware occasion prompt suggestions
  if (!intent.occasion) {
    primary.push({
      id: "OCC_BIRTHDAY",
      icon: "🎂",
      iconName: "gift",
      label: strings.suggest_birthday || "Is this for a Birthday? 🎂",
      action: "rebuild_prompt",
      payload: { query: "birthday gift hamper" },
    });
    primary.push({
      id: "OCC_ANNIVERSARY",
      icon: "💑",
      iconName: "gift",
      label: strings.suggest_anniversary || "Is this for an Anniversary? 💑",
      action: "rebuild_prompt",
      payload: { query: "anniversary flowers cake" },
    });
  }

  // 2. Budget prompt suggestions
  if (budget === 25000) {
    primary.push({
      id: "BUDGET_15K",
      icon: "💸",
      iconName: "coin",
      label: strings.suggest_budget_15k || "Set budget to 15k 💸",
      action: "budget",
      payload: { value: 15000 },
    });
    secondary.push({
      id: "BUDGET_35K",
      icon: "✨",
      iconName: "star",
      label: strings.suggest_budget_35k || "Set budget to 35k ✨",
      action: "budget",
      payload: { value: 35000 },
    });
  }

  // 3. Delivery day options
  if (intent.delivery_speed !== "fast") {
    const target = primary.length < 3 ? primary : secondary;
    target.push({
      id: "DELIV_TODAY",
      icon: "⚡",
      iconName: "bolt",
      label: strings.suggest_deliv_today || "Need it today? ⚡",
      action: "delivery_date",
      payload: { option: "same_day" },
    });
  }

  // 4. Tone/Sentiment specific recommendations
  if (tone === "empathetic_comfort") {
    if (!cats.includes("tea")) {
      const target = primary.length < 3 ? primary : secondary;
      target.push({
        id: "ADD_TEA_COMFORT",
        icon: "🍵",
        iconName: "gift",
        label: strings.suggest_comfort_tea || "Add comfort Ceylon Tea 🍵",
        action: "add_category",
        payload: { category: "tea" },
      });
    }
    if (!cats.includes("fruits")) {
      const target = primary.length < 3 ? primary : secondary;
      target.push({
        id: "ADD_FRUIT_COMFORT",
        icon: "🍎",
        iconName: "gift",
        label: strings.suggest_fruits || "Add fresh fruit basket 🍎",
        action: "add_category",
        payload: { category: "fruits" },
      });
    }
  }

  // 5. Standard giftwrap / category suggestions
  if (intent.occasion) {
    const occ = String(intent.occasion).replace(/_/g, " ");
    secondary.push({
      id: "GIFT_WRAP",
      icon: "🎀",
      iconName: "gift",
      label: (strings.suggestion_gift_wrap || "Gift wrap for {occasion}").replace("{occasion}", occ),
      action: "gift",
      payload: {},
    });
  }

  if (!cats.includes("chocolate")) {
    secondary.push({
      id: "ADD_CHOCOLATES",
      icon: "🍫",
      iconName: "gift",
      label: strings.suggestion_add_chocolates || "Add chocolates 🍫",
      action: "add_category",
      payload: { category: "chocolates" },
    });
  }
  if (!cats.includes("flowers")) {
    secondary.push({
      id: "ADD_FLOWERS",
      icon: "🌹",
      iconName: "flower",
      label: strings.suggestion_add_flowers || "Add flowers 🌹",
      action: "add_category",
      payload: { category: "flowers" },
    });
  }
  if (!cats.includes("cake")) {
    secondary.push({
      id: "ADD_CAKE",
      icon: "🎂",
      iconName: "gift",
      label: strings.suggestion_add_cake || "Add a cake 🎂",
      action: "add_category",
      payload: { category: "cake" },
    });
  }

  secondary.push({
    id: "CUT_BUDGET",
    icon: "💸",
    iconName: "coin",
    label: (strings.suggestion_cut_budget || "Cut to Rs {amount}").replace("{amount}", `${formatBudgetShort(cheaper)}`),
    action: "budget",
    payload: { value: cheaper },
  });
  secondary.push({
    id: "UPGRADE_PREMIUM",
    icon: "✨",
    iconName: "star",
    label: (strings.suggestion_upgrade_premium || "Go premium Rs {amount}").replace("{amount}", `${formatBudgetShort(premium)}`),
    action: "plan",
    payload: { value: "premium" },
  });

  const currentCity = metadata?.delivery_city || "Colombo 01";
  const nextCity = currentCity.toLowerCase().includes("galle") ? "Colombo" : "Galle";
  secondary.push({
    id: "CHANGE_CITY",
    icon: "🏙",
    iconName: "pin",
    label: (strings.suggestion_change_city || "Ship to {city}").replace("{city}", nextCity),
    action: "city",
    payload: { value: nextCity },
  });

  secondary.push({
    id: "REBUILD_CART",
    icon: "🔁",
    iconName: "cart",
    label: strings.suggestion_rebuild || "Rebuild cart",
    action: "rebuild",
    payload: {},
  });

  // Rebalance if primary is sparse
  while (primary.length < 3 && secondary.length > 0) {
    primary.push(secondary.shift());
  }

  return { primary, secondary };
}

export default function RukaChat({
  messages = [],
  onSend,
  onSuggestionAction,
  busy = false,
  strings = {},
  metadata = {},
  prompt = "",
  insightsOnly = false,
  clientProfile = null,
  language = "en-US",
  cartVersions = {},
  activeVersion = "initial",
}) {
  const [text, setText] = useState("");
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const scrollRef = useRef(null);
  const intent = metadata.intent_parsed || {};

  // Fix: defer scroll so React commits DOM update first
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollTop = el.scrollHeight;
    }, 50);
    return () => clearTimeout(t);
  }, [messages, busy]);

  const profile = metadata.user_profile || clientProfile;
  const profileReplies = useMemo(
    () => (profile ? buildProfileQuickReplies(profile, language, strings) : []),
    [profile, language, strings]
  );

  // Structured suggestion cards — action-based, not text-parsed
  const chatSuggestions = useMemo(
    () => buildChatSuggestions(metadata, strings, cartVersions, activeVersion),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metadata?.budget_limit, metadata?.intent_parsed?.matched_categories, activeVersion, strings]
  );

  // Partitioned suggestions based on toggle
  const visibleSuggestions = useMemo(() => {
    if (showAllSuggestions) {
      return [...chatSuggestions.primary, ...chatSuggestions.secondary];
    }
    return chatSuggestions.primary;
  }, [chatSuggestions, showAllSuggestions]);

  // Insight pills
  const pills = [];
  if (intent.gift_mode)       pills.push({ icon: "gift",  label: strings.gift_mode || "Gift Mode" });
  if (metadata.delivery_city) pills.push({ icon: "pin",   label: metadata.delivery_city });
  const budgetVal = metadata.budget_limit ?? intent.budget;
  if (budgetVal != null)      pills.push({ icon: "coin",  label: `${strings.insight_budget || "Budget"} ${formatBudgetShort(budgetVal)}` });
  if (intent.delivery_speed)  pills.push({ icon: "truck", label: deliveryPillLabel(intent.delivery_speed, strings) });
  if (profile?.order_count > 0) pills.push({ icon: "box",  label: (strings.insight_orders || "{count} orders").replace("{count}", String(profile.order_count)) });
  if (profile?.saved_count  > 0) pills.push({ icon: "star", label: (strings.insight_saved  || "{count} saved").replace("{count}",  String(profile.saved_count)) });
  if (profile?.preferred_city && !pills.some((p) => p.label === profile.preferred_city)) {
    pills.push({ icon: "home", label: (strings.insight_usual_city || "Usually {city}").replace("{city}", profile.preferred_city) });
  }

  // Ruka greeting (computed once on mount)
  const greeting = useMemo(
    () => buildGreeting(metadata, strings, prompt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const agentMessages = messages.filter((m) => m.role === "agent");
  const lastAgent = agentMessages.slice(-1)[0];

  function submitText() {
    const v = text.trim();
    if (!v || busy) return;
    if (onSend) onSend(v);
    setText("");
  }

  /** Dispatch a structured suggestion action — no text parsing */
  function handleSuggClick(sugg) {
    if (busy) return;
    if (onSuggestionAction) {
      onSuggestionAction(sugg.action, sugg.payload);
    } else if (onSend) {
      // Fallback: build a safe English text that the parser can handle
      onSend(`${sugg.action} ${JSON.stringify(sugg.payload)}`);
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 pb-3 border-b border-white/10 mb-1">
        <KapriAvatar size={38} pulse={busy} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white leading-tight truncate">
            {strings.ai_insights_title || "Ruka AI"}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {busy ? (strings.agent_thinking || "Thinking…") : (strings.agent_role || "Kapruka Shopping AI")}
          </div>
        </div>
        {/* Live indicator */}
        <span className="flex items-center gap-1 text-xs text-emerald-400 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {strings.mcp_status_live || "Live"}
        </span>
      </div>

      {/* ── Messages + pills ── */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto py-2 space-y-2.5 ${
          insightsOnly ? "max-h-[110px] min-h-0" : "max-h-[200px] min-h-[60px]"
        }`}
      >
        {/* Insight pills */}
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pills.map((p, i) => (
              <span key={i} className="insight-pill text-xs py-1 px-2.5">
                <Icon3D name={p.icon} size={13} tilt />
                {p.label}
              </span>
            ))}
          </div>
        )}

        {/* Ruka greeting bubble */}
        {!insightsOnly && (
          <div className="ruka-greeting-bubble text-sm">
            {greeting}
          </div>
        )}

        {/* Chat messages */}
        {!insightsOnly && messages.filter(m => m.role !== "user" || true).map((msg, i) => (
          <div
            key={i}
            className={`text-xs leading-relaxed ${
              msg.role === "user"
                ? "text-right text-slate-300 bg-white/5 rounded-lg px-2.5 py-1.5 ml-6"
                : "text-slate-400 border-t border-white/8 pt-2"
            }`}
          >
            {msg.text}
          </div>
        ))}

        {/* Typing indicator */}
        {busy && (
          <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white/5 border border-white/8 w-fit">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
      </div>

      {/* ── Structured suggestion cards ── */}
      {!insightsOnly && chatSuggestions.primary.length > 0 && (
        <div className="border-t border-white/8 pt-3 space-y-1.5 animate-fadeIn">
          <div className="flex items-center justify-between mb-2 px-0.5">
            <p className="text-xs text-slate-600 uppercase tracking-widest font-semibold">
              {strings.chat_suggested || "Suggested"}
            </p>
            {chatSuggestions.secondary.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAllSuggestions(!showAllSuggestions)}
                className="text-xs text-[#fae555] hover:text-[#fae555]/85 font-medium transition-colors focus:outline-none"
              >
                {showAllSuggestions ? "Less options ▲" : "More options ▼"}
              </button>
            )}
          </div>
          {visibleSuggestions.map((sugg) => (
            <button
              key={sugg.id}
              type="button"
              disabled={busy}
              onClick={() => handleSuggClick(sugg)}
              className="chat-sugg-card disabled:opacity-40"
            >
              <Icon3D name={sugg.iconName} size={15} tilt className="chat-sugg-icon shrink-0 mr-1.5" />
              <span className="flex-1 truncate text-left">{sugg.label}</span>
              <span className="text-slate-600 text-xs shrink-0">→</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Text input ── */}
      {!insightsOnly && (
        <form
          onSubmit={(e) => { e.preventDefault(); submitText(); }}
          className="flex items-center gap-2 mt-3 pt-3 border-t border-white/8"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            placeholder={strings.chat_placeholder || "Ask Ruka anything…"}
            className="flex-1 flow-input px-3 py-2.5 text-sm min-h-[44px] disabled:opacity-60 bg-white/5 border-white/12 text-white placeholder:text-slate-600"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="btn-primary min-h-[44px] px-4 disabled:opacity-40 shrink-0 text-sm"
            aria-label="Send"
          >
            ↑
          </button>
        </form>
      )}
    </div>
  );
}
