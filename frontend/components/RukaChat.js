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
  const recipient = intent.recipient ? ` for ${intent.recipient}` : "";
  const occasion  = intent.occasion  ? ` — ${String(intent.occasion).replace(/_/g, " ")}` : "";
  const budget    = metadata?.budget_limit
    ? ` within Rs ${new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(metadata.budget_limit)}`
    : "";
  const cats = (intent.matched_categories || []).slice(0, 2).join(" & ") || "gifts";

  if (intent.occasion || intent.recipient) {
    return `I curated the perfect ${cats}${recipient}${occasion}${budget}. 🎁 Switch plans or ask me anything!`;
  }
  if (prompt) {
    return `Here's your curated cart for "${prompt.slice(0, 52)}${prompt.length > 52 ? "…" : ""}"${budget}. Anything to tweak?`;
  }
  return strings.agent_reply_intro || "Done! Here's what I built. Switch plans or chat with me to refine. 🛒";
}

/**
 * Build ChatGPT-style contextual chat suggestions based on the current cart state.
 * Returns up to 4 smart suggestions.
 */
function buildChatSuggestions(metadata, strings, cartVersions, activeVersion) {
  const intent = metadata?.intent_parsed || {};
  const cats = (intent.matched_categories || []).map((c) => String(c).toLowerCase());
  const budget = metadata?.budget_limit ?? 25000;
  const cheaper = Math.round(budget * 0.7);
  const premium = Math.round(budget * 1.4);

  const suggestions = [];

  // Context-aware first suggestions
  if (intent.occasion) {
    const occ = String(intent.occasion).replace(/_/g, " ");
    suggestions.push({
      icon: "🎀",
      text: "make it a gift",
      label: `Gift wrap for ${occ}`,
    });
  }

  if (!cats.includes("chocolate")) {
    suggestions.push({ icon: "🍫", text: "add chocolates", label: "Add chocolates" });
  }
  if (!cats.includes("flowers")) {
    suggestions.push({ icon: "🌹", text: "add flowers", label: "Add flowers" });
  }
  if (!cats.includes("cake")) {
    suggestions.push({ icon: "🎂", text: "add cake", label: "Add a cake" });
  }

  // Budget suggestions
  suggestions.push({
    icon: "💸",
    text: `Reduce budget to Rs ${new Intl.NumberFormat("en-LK").format(cheaper)}`,
    label: `Cut to Rs ${formatBudgetShort(cheaper)}`,
  });
  suggestions.push({
    icon: "✨",
    text: `Upgrade to premium plan Rs ${new Intl.NumberFormat("en-LK").format(premium)}`,
    label: `Go premium Rs ${formatBudgetShort(premium)}`,
  });

  // Delivery
  suggestions.push({ icon: "⚡", text: "Switch to same-day delivery", label: "Same-day delivery" });
  
  const currentCity = metadata?.delivery_city || "Colombo 01";
  const nextCity = currentCity.toLowerCase().includes("galle") ? "Colombo" : "Galle";
  suggestions.push({ icon: "🏙", text: `deliver to ${nextCity}`, label: `Ship to ${nextCity}` });

  // Always available
  suggestions.push({ icon: "🔁", text: "rebuild this cart", label: "Rebuild cart" });

  return suggestions.slice(0, 4);
}

export default function RukaChat({
  messages = [],
  onSend,
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
  const [showAllSugg, setShowAllSugg] = useState(false);
  const scrollRef = useRef(null);
  const intent = metadata.intent_parsed || {};

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const profile = metadata.user_profile || clientProfile;
  const profileReplies = useMemo(
    () => (profile ? buildProfileQuickReplies(profile, language, strings) : []),
    [profile, language, strings]
  );

  // ChatGPT-style contextual suggestions
  const chatSuggestions = useMemo(
    () => buildChatSuggestions(metadata, strings, cartVersions, activeVersion),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metadata?.budget_limit, metadata?.intent_parsed?.matched_categories, activeVersion]
  );

  // Legacy quick-reply chips (keep as secondary)
  const categoriesInCart = new Set(
    (metadata.intent_parsed?.matched_categories || []).map((c) => String(c).toLowerCase().trim())
  );
  const showChoc    = !categoriesInCart.has("chocolate");
  const showFlowers = !categoriesInCart.has("flowers");
  const showCake    = !categoriesInCart.has("cake");
  let dynamicAddLabel = strings.qr_add_choc    || "Add chocolates";
  let dynamicAddText  = "add chocolates";
  if (!showChoc) {
    if (showFlowers)     { dynamicAddLabel = strings.qr_add_flowers   || "Add flowers";   dynamicAddText = "add flowers"; }
    else if (showCake)   { dynamicAddLabel = strings.qr_add_cake      || "Add cake";      dynamicAddText = "add cake"; }
    else                 { dynamicAddLabel = strings.qr_add_groceries || "Add groceries"; dynamicAddText = "add groceries"; }
  }

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

  function submit(value) {
    const v = (value ?? text).trim();
    if (!v || busy) return;
    onSend(v);
    setText("");
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
          Live
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

        {/* Latest agent message */}
        {lastAgent && !insightsOnly && (
          <p className="text-xs text-slate-400 leading-relaxed border-t border-white/8 pt-2">
            {lastAgent.text}
          </p>
        )}

        {/* Typing indicator */}
        {busy && (
          <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white/5 border border-white/8 w-fit">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
      </div>

      {/* ── ChatGPT-style suggestion cards ── */}
      {!insightsOnly && (
        <div className="border-t border-white/8 pt-3 space-y-1.5">
          <p className="text-xs text-slate-600 uppercase tracking-widest font-semibold px-0.5 mb-2">
            Suggested
          </p>
          {chatSuggestions.map((sugg, i) => (
            <button
              key={i}
              type="button"
              disabled={busy}
              onClick={() => submit(sugg.text)}
              className="chat-sugg-card disabled:opacity-40"
            >
              <span className="chat-sugg-icon">{sugg.icon}</span>
              <span className="flex-1 truncate">{sugg.label}</span>
              <span className="text-slate-600 text-xs shrink-0">→</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Text input ── */}
      {!insightsOnly && (
        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
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
