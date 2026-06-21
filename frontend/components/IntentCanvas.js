import { useState, useRef, useEffect } from "react";
import { KapriAvatar } from "./AgentPersona";
import Icon3D from "./Icon3D";
import { getSeason, buildPickedForYou, getDynamicSuggestions } from "../utils/personalize";
import { getBookmarks } from "../utils/bookmarks";
import { getMcpStatusPresentation } from "./localization";

// ── Decorative orbs (pure CSS, no canvas) ───────────────────────────
const HERO_ORBS = [
  { w: 340, h: 340, color: "rgba(216,0,0,0.13)",    top: "-80px",  left: "-60px",  duration: "14s",  delay: "0s"   },
  { w: 280, h: 280, color: "rgba(246,195,67,0.1)",  top: "20%",    left: "75%",   duration: "18s",  delay: "3s"   },
  { w: 200, h: 200, color: "rgba(99,102,241,0.08)", top: "55%",    left: "15%",   duration: "22s",  delay: "6s"   },
  { w: 160, h: 160, color: "rgba(246,195,67,0.12)", top: "-30px",  left: "60%",   duration: "16s",  delay: "9s"   },
];

// ── Ambient floating particles (12) ─────────────────────────────────
const AMBIENT_PARTICLES = [
  { size: 5,  color: "rgba(246,195,67,0.5)",  top: "14%",  left: "7%",   ad: "7.2s", ax: "22px",  ay: "-18px", ao: 0.5  },
  { size: 3,  color: "rgba(216,0,0,0.3)",     top: "30%",  left: "91%",  ad: "9.1s", ax: "-16px", ay: "12px",  ao: 0.3  },
  { size: 7,  color: "rgba(246,195,67,0.25)", top: "70%",  left: "5%",   ad: "8.4s", ax: "18px",  ay: "-24px", ao: 0.25 },
  { size: 4,  color: "rgba(216,0,0,0.2)",     top: "12%",  left: "77%",  ad: "6.8s", ax: "-20px", ay: "15px",  ao: 0.2  },
  { size: 6,  color: "rgba(246,195,67,0.3)",  top: "52%",  left: "87%",  ad: "10s",  ax: "-14px", ay: "-20px", ao: 0.3  },
  { size: 3,  color: "rgba(255,255,255,0.2)", top: "78%",  left: "20%",  ad: "7.8s", ax: "12px",  ay: "8px",   ao: 0.2  },
  { size: 5,  color: "rgba(246,195,67,0.22)", top: "40%",  left: "3%",   ad: "11s",  ax: "20px",  ay: "-10px", ao: 0.22 },
  { size: 3,  color: "rgba(216,0,0,0.15)",    top: "6%",   left: "52%",  ad: "8.9s", ax: "-8px",  ay: "20px",  ao: 0.15 },
  { size: 4,  color: "rgba(246,195,67,0.4)",  top: "86%",  left: "66%",  ad: "9.5s", ax: "16px",  ay: "-12px", ao: 0.4  },
  { size: 2,  color: "rgba(255,255,255,0.15)",top: "58%",  left: "43%",  ad: "12s",  ax: "-18px", ay: "16px",  ao: 0.15 },
  { size: 8,  color: "rgba(246,195,67,0.15)", top: "22%",  left: "33%",  ad: "14s",  ax: "10px",  ay: "-8px",  ao: 0.15 },
  { size: 3,  color: "rgba(216,0,0,0.12)",    top: "66%",  left: "80%",  ad: "10.5s",ax: "-12px", ay: "18px",  ao: 0.12 },
];

// Suggestions are loaded dynamically via getDynamicSuggestions from personalization utilities

// ── Cycling placeholder text ─────────────────────────────────────────
function getPlaceholders(language) {
  if (language === "si-LK") return [
    "අම්මාට Birthday Cake Rs 5,000 යටතේ...",
    "Valentine's Flowers & Chocolates Rs 6,000...",
    "Birthday Hamper Premium Rs 10,000...",
    "Family Groceries Weekly Rs 15,000...",
  ];
  if (language === "en-LK") return [
    "Amma's birthday cake + flowers Rs 5000 ata...",
    "Anniversary gift for akki, Rs 8000ṭa...",
    "Office farewell hamper Rs 3000...",
    "Baby shower gifts Rs 5000ṭa...",
  ];
  return [
    "Birthday gifts for Amma under Rs 5,000…",
    "Valentine's surprise — flowers & chocolates…",
    "Anniversary hamper, Rs 8,000 budget…",
    "Office farewell gift, something memorable…",
  ];
}

export default function IntentCanvas({
  onStartBuild,
  language,
  setLanguage,
  strings,
  user,
  userOrders = [],
  mcpStatus = "ready",
  onDemoStart,
  savedCartCount = 0,
  onContinueCart,
}) {
  const season = getSeason(new Date(), language);
  const bookmarks = typeof window !== "undefined" ? getBookmarks() : [];
  const pickedForYou = buildPickedForYou(userOrders, language, bookmarks);
  const suggCards = getDynamicSuggestions(new Date(), language);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const recogRef = useRef(null);
  const inputRef = useRef(null);
  const initialTextRef = useRef("");

  // Cycling placeholder
  const placeholders = getPlaceholders(language);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);

  useEffect(() => {
    const cycle = setInterval(() => {
      setPlaceholderVisible(false);
      setTimeout(() => {
        setPlaceholderIdx((i) => (i + 1) % placeholders.length);
        setPlaceholderVisible(true);
      }, 380);
    }, 3400);
    return () => clearInterval(cycle);
  }, [placeholders.length]);

  const mcpBadge = getMcpStatusPresentation(mcpStatus, strings);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsVoiceSupported(!!SR);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  function handleSubmit(e) {
    if (e) e.preventDefault();
    if (!text.trim()) return;
    onStartBuild(text, language);
  }

  function handleSuggClick(suggText) {
    setText(suggText);
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    initialTextRef.current = text.trim();
    const r = new SR();
    r.lang = language === "en-LK" ? "si-LK" : language;
    r.interimResults = true;
    r.continuous = true;
    let finalTranscript = "";
    r.onstart = () => setListening(true);
    r.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; ++i) {
        if (ev.results[i].isFinal) finalTranscript += ev.results[i][0].transcript;
        else interim += ev.results[i][0].transcript;
      }
      const combined = (finalTranscript + interim).trim();
      if (combined) setText(initialTextRef.current ? `${initialTextRef.current} ${combined}` : combined);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recogRef.current = r;
    r.start();
  }

  function stopVoice() {
    try { recogRef.current?.stop(); } catch (_) {}
    setListening(false);
    recogRef.current = null;
  }

  const s = strings || {};
  const userName = user ? (user.name || user.email).split("@")[0] : null;

  return (
    <div className="flow-hero-zone w-full">

      {/* ── Decorative animated orbs ── */}
      {HERO_ORBS.map((o, i) => (
        <div
          key={i}
          className="hero-orb"
          style={{
            width: o.w,
            height: o.h,
            background: o.color,
            top: o.top,
            left: o.left,
            "--orb-duration": o.duration,
            animationDelay: o.delay,
          }}
        />
      ))}

      {/* ── Ambient particles ── */}
      {AMBIENT_PARTICLES.map((p, i) => (
        <span
          key={i}
          className="ambient-particle"
          style={{
            width: p.size, height: p.size,
            background: p.color,
            top: p.top, left: p.left,
            "--ad": p.ad, "--ax": p.ax, "--ay": p.ay, "--ao": p.ao,
            animationDelay: `${i * 0.55}s`,
          }}
        />
      ))}

      {/* ── Main content ── */}
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12 animate-fadeIn relative z-10">

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          <span className="trust-badge trust-badge-sm" title={mcpBadge.hint || undefined}>
            <span className={`trust-badge-dot ${mcpBadge.dotClass}`} />
            {mcpBadge.label}
          </span>
          <span className="trust-badge trust-badge-sm">
            <Icon3D name="sparkle" size={14} float />
            {s.intelligent_ai_curation || "AI Curation"}
          </span>
          <span className="trust-badge trust-badge-sm">
            🌸 {s.agent_name || "Ruka"} — {s.agent_role || "Kapruka Shopping AI"}
          </span>
        </div>

        {/* Hero headline */}
        <div className="text-center mb-8">
          <h1 className="font-black tracking-tight hero-title" style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", lineHeight: 1.1 }}>
            <span className="block">{s.what_do_you_want || "Tell me what you need."}</span>
            <span
              className="block mt-1"
              style={{
                fontSize: "0.88em",
                backgroundImage: "linear-gradient(135deg, #f6c343 0%, #ff8c00 50%, #f6c343 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundSize: "200% 100%",
                animation: "aiBadgeShimmer 3s ease-in-out infinite",
              }}
            >
              {s.what_do_you_want_line2 || "I'll build the perfect cart."}
            </span>
          </h1>
          <p className="hero-subtitle text-sm md:text-base mt-3 max-w-lg mx-auto">
            {s.intent_desc || "Describe your shopping goal in any language. Ruka composes the perfect cart — instantly."}
          </p>
        </div>

        {/* Continue cart banner */}
        {savedCartCount > 0 && (
          <button
            type="button"
            onClick={onContinueCart}
            className="mb-5 w-full flow-chip flow-chip-gold gap-2 text-sm font-semibold justify-center animate-pop-in py-3"
          >
            <Icon3D name="cart" size={18} tilt />
            {s.continue_cart || "Continue your cart"} — {savedCartCount}{" "}
            {savedCartCount === 1 ? (s.cart_item_singular || "item") : (s.cart_item_plural || "items")}
          </button>
        )}

        {/* ── Compose card (glassmorphism) ── */}
        <form onSubmit={handleSubmit} className="hero-compose-card w-full mb-6">

          {/* Ruka identity bar */}
          <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-4">
            <KapriAvatar size={38} flipIn />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">
                {s.agent_name || "Ruka"}
                {userName && (
                  <span className="font-normal text-slate-400 ml-1">
                    · {s.welcome_back || "Welcome back"}, {userName}
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">{s.agent_role || "Your Kapruka Shopping AI"}</p>
            </div>
            {/* Language pill selector */}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="flow-input text-xs px-2.5 py-1.5 rounded-lg cursor-pointer shrink-0"
              style={{ minHeight: "auto", width: "auto" }}
            >
              <option value="en-US">🇬🇧 English</option>
              <option value="si-LK">🇱🇰 සිංහල</option>
              <option value="en-LK">🌴 Tanglish</option>
            </select>
          </div>

          {/* Search input */}
          <div className="relative mb-3">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholderVisible ? placeholders[placeholderIdx] : ""}
              className="flow-input w-full pr-12 text-sm min-h-[52px] px-4 rounded-xl"
              style={{ fontSize: "0.9375rem" }}
              autoFocus
            />
            {isVoiceSupported && (
              <button
                type="button"
                onClick={() => (listening ? stopVoice() : startVoice())}
                className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  listening
                    ? "bg-kapruka-red text-white animate-pulse"
                    : "text-slate-400 hover:text-white hover:bg-white/10"
                }`}
                title={listening ? "Stop listening" : "Voice input"}
              >
                {listening ? "■" : "🎤"}
              </button>
            )}
          </div>

          {/* Voice bars */}
          {listening && (
            <div className="flex items-center justify-center gap-1.5 h-7 mb-3 animate-fadeIn">
              <span className="w-1.5 h-3 bg-kapruka-red rounded-full animate-voice-bar-1" />
              <span className="w-1.5 h-5 bg-kapruka-red rounded-full animate-voice-bar-2" />
              <span className="w-1.5 h-6 bg-kapruka-red rounded-full animate-voice-bar-3" />
              <span className="w-1.5 h-4 bg-kapruka-red rounded-full animate-voice-bar-4" />
              <span className="w-1.5 h-2 bg-kapruka-red rounded-full animate-voice-bar-5" />
              <span className="ml-2 text-xs text-kapruka-red font-bold tracking-widest uppercase animate-pulse">
                {s.listening || "Listening…"}
              </span>
            </div>
          )}

          {/* Submit + season chip */}
          <div className="flex gap-2 items-stretch">
            <button
              type="submit"
              className="btn-primary flex-1 min-h-[48px] text-sm font-bold rounded-xl"
            >
              {s.build_my_cart || "Build My Cart"} →
            </button>
            <button
              type="button"
              onClick={() => handleSuggClick(season.query || season.text)}
              className="flow-chip gap-1.5 text-xs px-3 shrink-0 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
              title={season.text}
            >
              <span>{season.emoji}</span>
              <span className="hidden sm:inline truncate max-w-[120px]">{season.text}</span>
            </button>
          </div>
        </form>

        {/* ── ChatGPT-style suggestion cards ── */}
        <div className="mb-4">
          <p className="text-xs text-slate-500 text-center uppercase tracking-widest mb-3 font-semibold">
            {s.quick_suggestions || "✦ Popular requests"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {suggCards.map((card, i) => (
              <button
                key={i}
                type="button"
                className="sugg-card"
                onClick={() => handleSuggClick(card.text)}
              >
                <span className="sugg-card-icon">{card.icon}</span>
                <span className="sugg-card-title">{card.title}</span>
                <span className="sugg-card-subtitle">{card.subtitle}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Personalised picks (if any orders) */}
        {pickedForYou.length > 0 && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-slate-500 text-center uppercase tracking-widest font-semibold">
              <Icon3D name="sparkle" size={13} float /> {s.picked_for_you || "✦ Picked for you"}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {pickedForYou.map((chip, idx) => (
                <button
                  key={`pfy-${idx}`}
                  type="button"
                  onClick={() => handleSuggClick(chip.text)}
                  className="flow-chip flow-chip-gold text-xs py-2 px-3"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scroll indicator (fades into white section below) */}
        <div className="flex justify-center mt-8 hero-scroll-indicator">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4v12M5 11l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
