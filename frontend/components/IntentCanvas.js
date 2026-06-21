import { useState, useRef, useEffect } from "react";
import { KapriAvatar } from "./AgentPersona";
import Icon3D from "./Icon3D";
import { getSeason, buildPickedForYou } from "../utils/personalize";
import { getBookmarks } from "../utils/bookmarks";
import { getQuickSuggestions, getMcpStatusPresentation } from "./localization";
import { DEMO_PROMPT } from "../constants/demo";

// Ambient floating particles config (12 dots)
const AMBIENT_PARTICLES = [
  { size: 6,  color: "rgba(246,195,67,0.45)", top: "18%", left: "8%",  ad: "7.2s", ax: "22px", ay: "-18px", ao: 0.45 },
  { size: 4,  color: "rgba(216,0,0,0.25)",    top: "32%", left: "92%", ad: "9.1s", ax: "-16px", ay: "12px",  ao: 0.25 },
  { size: 8,  color: "rgba(246,195,67,0.3)",  top: "72%", left: "5%",  ad: "8.4s", ax: "18px",  ay: "-24px", ao: 0.30 },
  { size: 5,  color: "rgba(216,0,0,0.2)",     top: "15%", left: "78%", ad: "6.8s", ax: "-20px", ay: "15px",  ao: 0.20 },
  { size: 7,  color: "rgba(246,195,67,0.35)", top: "55%", left: "88%", ad: "10s",  ax: "-14px", ay: "-20px", ao: 0.35 },
  { size: 3,  color: "rgba(255,255,255,0.2)", top: "80%", left: "22%", ad: "7.8s", ax: "12px",  ay: "8px",   ao: 0.20 },
  { size: 6,  color: "rgba(246,195,67,0.25)", top: "42%", left: "3%",  ad: "11s",  ax: "20px",  ay: "-10px", ao: 0.25 },
  { size: 4,  color: "rgba(216,0,0,0.15)",    top: "8%",  left: "55%", ad: "8.9s", ax: "-8px",  ay: "20px",  ao: 0.15 },
  { size: 5,  color: "rgba(246,195,67,0.4)",  top: "88%", left: "68%", ad: "9.5s", ax: "16px",  ay: "-12px", ao: 0.40 },
  { size: 3,  color: "rgba(255,255,255,0.15)",top: "60%", left: "45%", ad: "12s",  ax: "-18px", ay: "16px",  ao: 0.15 },
  { size: 9,  color: "rgba(246,195,67,0.2)",  top: "25%", left: "35%", ad: "14s",  ax: "10px",  ay: "-8px",  ao: 0.20 },
  { size: 4,  color: "rgba(216,0,0,0.12)",    top: "68%", left: "82%", ad: "10.5s",ax: "-12px", ay: "18px",  ao: 0.12 },
];

// Locale-aware cycling placeholder examples
function getPlaceholders(language) {
  if (language === "si-LK") return [
    "අම්මාට 60 වන誕生日 ගිෆ්ට් Rs 5000 යටතේ...",
    "ආදරණීය කෑකේ සහ සරුංගල් Rs 3000ට...",
    "බෞද්ධ ශාලාවට ෆ්ලවර් හැම්පර් Rs 8000...",
    "ළමයින්ට Birthday Cake Rs 4000 ඇතුළතින...",
  ];
  if (language === "en-LK") return [
    "Amma's birthday cake + flowers under Rs 5000...",
    "Anniversary gift for akki, something romantic...",
    "Office farewell hamper Rs 3000ṭa...",
    "Baby shower gifts under Rs 6000...",
  ];
  return [
    "Amma's 60th birthday gifts under Rs 5,000…",
    "Valentine's surprise flowers + chocolates…",
    "Anniversary hamper for two, Rs 8,000 budget…",
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
  const suggestions = getQuickSuggestions(language);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const recogRef = useRef(null);
  const typingTimerRef = useRef(null);
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
      }, 400);
    }, 3200);
    return () => clearInterval(cycle);
  }, [placeholders.length]);

  const mcpBadge = getMcpStatusPresentation(mcpStatus, strings);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsVoiceSupported(!!SpeechRecognition);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      clearTimeout(t);
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, []);

  function handleSubmit(e) {
    if (e) e.preventDefault();
    if (!text.trim()) return;
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    onStartBuild(text, language);
  }

  function handleRunDemo() {
    onDemoStart?.();
    setText(DEMO_PROMPT);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    initialTextRef.current = text.trim();
    const r = new SpeechRecognition();
    r.lang = language === "en-LK" ? "si-LK" : language;
    r.interimResults = true;
    r.continuous = true;
    let finalTranscript = "";
    r.onstart = () => setListening(true);
    r.onresult = (ev) => {
      let interimTranscript = "";
      for (let i = ev.resultIndex; i < ev.results.length; ++i) {
        if (ev.results[i].isFinal) finalTranscript += ev.results[i][0].transcript;
        else interimTranscript += ev.results[i][0].transcript;
      }
      const combinedSpeech = (finalTranscript + interimTranscript).trim();
      if (combinedSpeech) {
        setText(initialTextRef.current ? initialTextRef.current + " " + combinedSpeech : combinedSpeech);
      }
    };
    r.onend = () => setListening(false);
    r.onerror = (ev) => { console.error("Speech recognition error:", ev.error); setListening(false); };
    recogRef.current = r;
    r.start();
  }

  function stopVoice() {
    try { recogRef.current?.stop(); } catch (e) {}
    setListening(false);
    recogRef.current = null;
  }

  const s = strings || {};
  const userName = user ? (user.name || user.email).split("@")[0] : null;

  return (
    <div className="flow-hero-zone w-full relative overflow-hidden">

      {/* ── Ambient floating particles ── */}
      {AMBIENT_PARTICLES.map((p, i) => (
        <span
          key={i}
          className="ambient-particle"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            top: p.top,
            left: p.left,
            "--ad": p.ad,
            "--ax": p.ax,
            "--ay": p.ay,
            "--ao": p.ao,
            animationDelay: `${i * 0.6}s`,
          }}
        />
      ))}

      <div className="w-full max-w-xl mx-auto px-4 sm:px-0 py-6 md:py-10 animate-fadeIn relative z-10">
        {/* Compact header */}
        <div className="text-center mb-6">
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            <span className="trust-badge trust-badge-sm" title={mcpBadge.hint || undefined}>
              <span className={`trust-badge-dot ${mcpBadge.dotClass}`} />
              {mcpBadge.label}
            </span>
            <span className="trust-badge trust-badge-sm">
              <Icon3D name="sparkle" size={15} float /> {s.intelligent_ai_curation || "AI Curation"}
            </span>
          </div>
          <h1 className="text-hero hero-title">
            <span className="block">{s.what_do_you_want || "Tell me what you need."}</span>
            <span className="block text-kapruka-gold mt-0.5 text-[0.92em]">
              {s.what_do_you_want_line2 || "I'll build the cart."}
            </span>
          </h1>
          <p className="text-sm md:text-base hero-subtitle mt-2 max-w-md mx-auto">
            {s.intent_desc || "Describe your shopping goal. We'll compose the perfect cart."}
          </p>
        </div>

        {savedCartCount > 0 && (
          <button
            type="button"
            onClick={onContinueCart}
            className="mb-4 w-full flow-chip flow-chip-gold gap-2 text-sm font-semibold justify-center animate-pop-in"
          >
            <Icon3D name="cart" size={18} tilt />
            {s.continue_cart || "Continue your cart"} — {savedCartCount}{" "}
            {savedCartCount === 1 ? (s.cart_item_singular || "item") : (s.cart_item_plural || "items")}
          </button>
        )}

        {/* Single compose card */}
        <form onSubmit={handleSubmit} className="hero-compose-card w-full">
          <div className="flex items-center gap-3 pb-3 border-b border-flow-border/80">
            {/* Avatar with flip-in entrance */}
            <KapriAvatar size={36} flipIn />
            <div className="min-w-0 text-left flex-1">
              <p className="text-sm font-semibold text-flow-text leading-tight">
                {s.agent_name || "Ruka"}
                {userName && (
                  <span className="font-normal text-flow-muted">
                    {" "}
                    · {s.welcome_back || "Welcome back"}, {userName}
                  </span>
                )}
              </p>
              <p className="text-xs text-flow-muted truncate">
                {s.agent_role || "Your Kapruka shopping buddy"}
              </p>
            </div>
          </div>

          <div className="pt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="flow-input px-3 py-2 min-h-[36px] rounded-lg text-sm cursor-pointer flex-1 min-w-[120px]"
              >
                <option value="en-US">{s.lang_english || "English"}</option>
                <option value="si-LK">{s.lang_sinhala || "සිංහල"}</option>
                <option value="en-LK">{s.lang_tanglish || "Tanglish"}</option>
              </select>
              {isVoiceSupported && (
                <button
                  type="button"
                  onClick={() => (listening ? stopVoice() : startVoice())}
                  className={`btn-tertiary min-h-[36px] text-sm gap-1.5 px-3 ${listening ? "bg-kapruka-gold/15 border border-kapruka-gold/30" : ""}`}
                >
                  <span>{listening ? "■" : "🎤"}</span>
                  {listening ? s.listening : s.voice_intent}
                </button>
              )}
            </div>

            {/* Input with cycling placeholder */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholderVisible ? placeholders[placeholderIdx] : ""}
                className="flow-input w-full text-flow-text text-sm min-h-[44px] px-4 rounded-xl transition-all"
                autoFocus
                style={{ transition: "placeholder-color 0.3s ease" }}
              />
            </div>

            <button
              type="submit"
              className="btn-primary btn-demo-build w-full min-h-[44px] text-sm font-semibold rounded-xl"
            >
              {s.build_my_cart || "Build My Cart"}
            </button>

            {listening && (
              <div className="flex flex-col items-center justify-center gap-3 py-4 animate-fadeIn">
                <div className="flex items-center gap-1.5 h-8">
                  <span className="w-1.5 h-3 bg-[#D80000] rounded-full animate-voice-bar-1" />
                  <span className="w-1.5 h-5 bg-[#D80000] rounded-full animate-voice-bar-2" />
                  <span className="w-1.5 h-6 bg-[#D80000] rounded-full animate-voice-bar-3" />
                  <span className="w-1.5 h-4 bg-[#D80000] rounded-full animate-voice-bar-4" />
                  <span className="w-1.5 h-2 bg-[#D80000] rounded-full animate-voice-bar-5" />
                </div>
                <div className="text-xs font-bold text-[#D80000] tracking-widest uppercase animate-pulse">
                  {s.listening || "Listening..."}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Demo + season */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
          <div className="flow-chip flow-chip-gold gap-2 text-sm justify-center py-2">
            <span>{season.emoji}</span>
            <span className="truncate">{season.text}</span>
          </div>
          <button
            type="button"
            onClick={handleRunDemo}
            title={s.demo_hint}
            className="btn-secondary min-h-[40px] text-sm font-semibold px-5"
          >
            {s.run_demo || "▶ Run Demo"}
          </button>
        </div>

        {pickedForYou.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-label text-flow-muted text-center inline-flex w-full items-center justify-center gap-1.5">
              <Icon3D name="sparkle" size={14} float /> {s.picked_for_you}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {pickedForYou.map((chip, idx) => (
                <button
                  key={`pfy-${idx}`}
                  type="button"
                  onClick={() => setText(chip.text)}
                  className="flow-chip flow-chip-gold text-sm py-2 px-3 min-h-[36px]"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 space-y-2">
          <p className="text-label text-flow-muted text-center">{s.quick_suggestions}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setText(chip.text)}
                className="flow-chip text-sm py-2 px-3 min-h-[36px]"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
