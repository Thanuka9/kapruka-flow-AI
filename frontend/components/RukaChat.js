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
  if (speed === "today") return strings.insight_delivery_today || "Tomorrow";
  if (speed === "fast") return strings.insight_delivery_fast || "Fast";
  return strings.insight_delivery_standard || "Standard";
}

/**
 * Build a contextual opening greeting from intent metadata — Ruka speaks first.
 */
function buildGreeting(metadata, strings, prompt) {
  const intent = metadata?.intent_parsed || {};
  const recipient = intent.recipient
    ? ` for ${intent.recipient}`
    : "";
  const occasion = intent.occasion
    ? ` — ${String(intent.occasion).replace(/_/g, " ")}`
    : "";
  const budget = metadata?.budget_limit
    ? ` within Rs ${new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(metadata.budget_limit)}`
    : "";
  const cats = (intent.matched_categories || []).slice(0, 2).join(" & ") || "gifts";

  if (intent.occasion || intent.recipient) {
    return `I curated the perfect ${cats}${recipient}${occasion}${budget}. 🎁 Switch plans or chat with me to refine!`;
  }
  if (prompt) {
    return `Here's your curated cart for "${prompt.slice(0, 48)}${prompt.length > 48 ? "…" : ""}"${budget}. Anything you'd like to tweak?`;
  }
  return strings.agent_reply_intro || "Done! Here's what I pulled together. Switch plans or ask me anything. 🛒";
}

/**
 * Ruka AI chat panel — insights, typing bubble, greeting, chip wiggle.
 */
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
}) {
  const [text, setText] = useState("");
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

  const categoriesInCart = new Set(
    (metadata.intent_parsed?.matched_categories || [])
      .map((c) => String(c).toLowerCase().trim())
  );

  const showChoc = !categoriesInCart.has("chocolate");
  const showFlowers = !categoriesInCart.has("flowers");
  const showCake = !categoriesInCart.has("cake");

  let dynamicAddLabel = strings.qr_add_choc || "Add chocolates";
  let dynamicAddText = "add chocolates";

  if (!showChoc) {
    if (showFlowers) {
      dynamicAddLabel = strings.qr_add_flowers || "Add flowers";
      dynamicAddText = "add flowers";
    } else if (showCake) {
      dynamicAddLabel = strings.qr_add_cake || "Add cake";
      dynamicAddText = "add cake";
    } else {
      dynamicAddLabel = strings.qr_add_groceries || "Add groceries";
      dynamicAddText = "add groceries";
    }
  }

  const quickReplies = [
    ...profileReplies,
    { label: strings.make_cheaper || "Make cheaper", text: "make it cheaper" },
    { label: strings.upgrade_premium || "Go premium", text: "upgrade to premium" },
    { label: strings.today_delivery || "Deliver today", text: "deliver today" },
    { label: dynamicAddLabel, text: dynamicAddText },
  ].slice(0, 6);

  const pills = [];
  if (intent.gift_mode) {
    pills.push({ icon: "gift", label: strings.gift_mode || "Gift Mode" });
  }
  if (metadata.delivery_city) {
    pills.push({ icon: "pin", label: metadata.delivery_city });
  }
  const budgetVal = metadata.budget_limit ?? intent.budget;
  if (budgetVal != null) {
    pills.push({
      icon: "coin",
      label: `${strings.insight_budget || "Budget"} ${formatBudgetShort(budgetVal)}`,
    });
  }
  if (intent.delivery_speed) {
    pills.push({
      icon: "truck",
      label: deliveryPillLabel(intent.delivery_speed, strings),
    });
  }
  if (profile?.order_count > 0) {
    pills.push({
      icon: "box",
      label: (strings.insight_orders || "{count} orders").replace("{count}", String(profile.order_count)),
    });
  }
  if (profile?.saved_count > 0) {
    pills.push({
      icon: "star",
      label: (strings.insight_saved || "{count} saved").replace("{count}", String(profile.saved_count)),
    });
  }
  if (profile?.preferred_city && !pills.some((p) => p.label === profile.preferred_city)) {
    pills.push({
      icon: "home",
      label: (strings.insight_usual_city || "Usually {city}").replace("{city}", profile.preferred_city),
    });
  }

  // Contextual Ruka greeting — shown once at top of chat
  const greeting = useMemo(
    () => buildGreeting(metadata, strings, prompt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Non-greeting agent messages
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
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/10">
        <KapriAvatar size={40} pulse={busy} />
        <div>
          <div className="text-lg font-bold text-white leading-tight">
            {strings.ai_insights_title || "AI Insights"}
          </div>
          <div className="text-sm text-slate-400 mt-0.5">
            {busy ? strings.agent_thinking : strings.agent_role}
          </div>
        </div>
      </div>

      {/* Scroll area */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto py-3 space-y-3 ${
          insightsOnly ? "max-h-[120px] min-h-0" : "max-h-[240px] min-h-[80px]"
        }`}
      >
        {/* AI insight pills */}
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pills.map((p, i) => (
              <span key={i} className="insight-pill">
                <Icon3D name={p.icon} size={15} tilt />
                {p.label}
              </span>
            ))}
          </div>
        )}

        {/* Ruka greeting bubble — always first */}
        {!insightsOnly && (
          <div className="ruka-greeting-bubble">
            {greeting}
          </div>
        )}

        {/* Subsequent agent messages */}
        {lastAgent && !insightsOnly && (
          <p className="text-sm text-slate-400 leading-relaxed border-t border-white/10 pt-3">
            {lastAgent.text}
          </p>
        )}

        {/* Typing indicator bubble */}
        {busy && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8 w-fit">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
      </div>

      {/* Quick replies + input */}
      {!insightsOnly && (
        <>
          <div className="flex flex-wrap gap-2 pt-3 pb-3 border-t border-white/10">
            {quickReplies.map((q) => (
              <button
                key={q.text}
                type="button"
                disabled={busy}
                onClick={() => submit(q.text)}
                className="insight-pill quick-reply-chip cursor-pointer disabled:opacity-50"
              >
                {q.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
              placeholder={strings.chat_placeholder || "Tell Ruka what to change…"}
              className="flex-1 flow-input px-4 py-3 min-h-[48px] disabled:opacity-60 bg-white/5 border-white/15 text-white placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="btn-primary min-h-[48px] px-5 disabled:opacity-50 shrink-0"
              aria-label="Send"
            >
              →
            </button>
          </form>
        </>
      )}
    </div>
  );
}
