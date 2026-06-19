import { motion } from "framer-motion";

const LKR = (n) =>
  new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(Number(n) || 0);

/** Small circular Kapri avatar used across the chat surface — 3D glossy orb. */
export function KapriAvatar({ size = 40, pulse = false }) {
  return (
    <span
      className="ruka-orb relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {pulse && (
        <span className="absolute inset-0 rounded-full bg-[#fae555]/40 animate-ping" />
      )}
      <span className="relative" style={{ fontSize: size * 0.48 }} aria-hidden>
        🌸
      </span>
    </span>
  );
}

/** Hero greeting bubble shown on the input screen. */
export function KapriGreeting({ strings = {}, user }) {
  const greeting = user
    ? `${strings.agent_greeting || "Hi, I'm Ruka 🌸"} ${
        (strings.welcome_back || strings.for_you || "Welcome back") + ", " + (user.name || user.email).split("@")[0]
      }!`
    : strings.agent_greeting || "Hi, I'm Ruka 🌸 your personal Kapruka shopper.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-start gap-4 max-w-xl mx-auto mb-6 text-left"
    >
      <KapriAvatar size={48} />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-bold text-flow-text">{strings.agent_name || "Ruka"}</span>
          <span className="text-base text-flow-muted">
            {strings.agent_role || "Kapruka shopping buddy"}
          </span>
        </div>
        <div className="rounded-2xl bg-flow-bg-secondary border border-flow-border px-5 py-4 text-base text-flow-secondary leading-relaxed shadow-card">
          {greeting}
        </div>
      </div>
    </motion.div>
  );
}

function Bubble({ children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl rounded-tl-sm bg-white/[0.06] border border-white/10 px-4 py-2.5 text-[13px] text-slate-200 leading-relaxed shadow"
    >
      {children}
    </motion.div>
  );
}

/**
 * Conversational reply thread shown above the carts. Builds Kapri's "voice"
 * from the factual story plus the parsed intent (budget guess, gift, occasion).
 */
export function KapriChat({ prompt, story = [], metadata = {}, strings = {} }) {
  const intent = metadata.intent_parsed || {};
  const bubbles = [];

  bubbles.push(strings.agent_reply_intro || "Done! Here's what I pulled together 👇");

  // Factual narration from the backend (already localized server-side).
  story.forEach((line) => line && bubbles.push(line));

  // Personality reactions / clarifying nudge.
  if (intent.occasion) {
    const occ = String(intent.occasion).replace(/_/g, " ");
    bubbles.push((strings.agent_occasion_note || "Happy {occasion}! 🎉").replace("{occasion}", occ));
  }
  if (intent.gift_mode) {
    const recipient = intent.recipient ? ` for your ${intent.recipient}` : "";
    bubbles.push((strings.agent_gift_note || "Looks like a gift{recipient}. 🎁").replace("{recipient}", recipient));
  }
  if (intent.budget_inferred) {
    const budget = LKR(intent.budget || metadata.budget_limit || 25000);
    bubbles.push((strings.agent_budget_inferred || "I assumed LKR {budget}.").replace("{budget}", budget));
  }

  bubbles.push(strings.agent_pick_one || "Pick a plan and I'll take you to checkout. 🛒");

  return (
    <div className="space-y-3">
      {prompt && (
        <div className="flex justify-end">
          <div className="rounded-2xl rounded-tr-sm bg-[#fae555] text-[#1a1205] px-4 py-2.5 text-[13px] font-semibold max-w-[85%] shadow">
            {prompt}
          </div>
        </div>
      )}
      <div className="flex items-start gap-3">
        <KapriAvatar size={36} />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">{strings.agent_name || "Ruka"}</span>
            <span className="text-[8px] uppercase tracking-widest font-mono text-[#fae555]/70">
              {strings.agent_role || "Kapruka shopping buddy"}
            </span>
          </div>
          {bubbles.map((b, i) => (
            <Bubble key={i} delay={Math.min(i * 0.08, 0.6)}>
              {b}
            </Bubble>
          ))}
        </div>
      </div>
    </div>
  );
}

export default KapriChat;
