import { useState, useRef, useEffect } from "react";
import { KapriAvatar } from "./AgentPersona";
import Icon3D from "./Icon3D";
import { getSeason, buildPickedForYou } from "../utils/personalize";
import { getBookmarks } from "../utils/bookmarks";
import { getQuickSuggestions, getMcpStatusPresentation } from "./localization";
import { DEMO_PROMPT } from "../constants/demo";

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
  const recogRef = useRef(null);
  const typingTimerRef = useRef(null);
  const inputRef = useRef(null);

  const mcpBadge = getMcpStatusPresentation(mcpStatus, strings);

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

  function startSimulatedVoice() {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    let sampleText = "I need a birthday cake and chocolates under 10000 LKR for tomorrow";
    if (language === "si-LK") {
      sampleText = "මට හෙටට රුපියල් 8000කට අඩුවෙන් ලස්සන මල් කළඹක් සහ චොකලට් ඕනෑ";
    } else if (language === "en-LK") {
      sampleText = "Mata cake ekakui chocolates tikakui Colombo deliver karanna heta udeta";
    }
    setListening(true);
    setText("");
    let currentIndex = 0;
    typingTimerRef.current = setInterval(() => {
      if (currentIndex < sampleText.length) {
        setText(sampleText.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
        setListening(false);
        setTimeout(() => onStartBuild(sampleText, language), 600);
      }
    }, 50);
  }

  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      startSimulatedVoice();
      return;
    }
    
    let receivedResult = false;
    const r = new SpeechRecognition();
    r.lang = language;
    r.interimResults = false;
    
    const timeoutId = setTimeout(() => {
      if (!receivedResult) {
        console.log("Speech recognition silence timeout, falling back to simulation.");
        try { r.abort(); } catch (e) {}
        setListening(false);
        startSimulatedVoice();
      }
    }, 6000);

    r.onstart = () => setListening(true);
    r.onresult = (ev) => {
      receivedResult = true;
      clearTimeout(timeoutId);
      const t = ev.results[0][0].transcript;
      setText((prev) => (prev ? prev + " " + t : t));
    };
    r.onend = () => {
      clearTimeout(timeoutId);
      setListening(false);
    };
    r.onerror = () => {
      clearTimeout(timeoutId);
      setListening(false);
      if (!receivedResult) {
        startSimulatedVoice();
      }
    };
    recogRef.current = r;
    r.start();
  }

  function stopVoice() {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    try { recogRef.current?.abort(); } catch (e) {}
    setListening(false);
    recogRef.current = null;
  }

  const s = strings || {};
  const userName = user ? (user.name || user.email).split("@")[0] : null;

  return (
    <div className="flow-hero-zone w-full">
      <div className="w-full max-w-xl mx-auto px-4 sm:px-0 py-6 md:py-10 animate-fadeIn">
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
            <KapriAvatar size={36} />
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
              <button
                type="button"
                onClick={() => (listening ? stopVoice() : startVoice())}
                className={`btn-tertiary min-h-[36px] text-sm gap-1.5 px-3 ${listening ? "bg-kapruka-gold/15 border border-kapruka-gold/30" : ""}`}
              >
                <span>{listening ? "■" : "🎤"}</span>
                {listening ? s.listening : s.voice_intent}
              </button>
            </div>

            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={s.input_placeholder}
              className="flow-input w-full text-flow-text text-sm min-h-[44px] px-4 rounded-xl"
              autoFocus
            />

            <button
              type="submit"
              className="btn-primary btn-demo-build w-full min-h-[44px] text-sm font-semibold rounded-xl"
            >
              {s.build_my_cart || "Build My Cart"}
            </button>

            {listening && (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-flow-muted">
                <span className="w-2 h-2 rounded-full bg-kapruka-red animate-pulse" />
                {s.listening}
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
