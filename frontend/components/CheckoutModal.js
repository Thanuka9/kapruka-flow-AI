import { useState, useEffect, useRef } from "react";
import LiveDeliveryMap from "./LiveDeliveryMap";

// Confetti emoji pool
const CONFETTI_EMOJIS = ["🎁","🎂","🌸","🍫","✨","💝","🎉","🌺","🧁","🎊","💐","🥂"];

// Confetti particle data (angle in degrees, distance)
function makeConfetti() {
  return CONFETTI_EMOJIS.map((emoji, i) => {
    const angle = (i / CONFETTI_EMOJIS.length) * 360;
    const dist = 80 + Math.random() * 60;
    const rad = (angle * Math.PI) / 180;
    const cx = Math.round(Math.cos(rad) * dist);
    const cy = Math.round(Math.sin(rad) * dist);
    const cr = Math.round((Math.random() - 0.5) * 360);
    return { emoji, cx: `${cx}px`, cy: `${cy}px`, cr: `${cr}deg`, delay: `${i * 0.05}s` };
  });
}

// Delivery tracker steps
function makeTrackerSteps(deliveryDate) {
  const dateLabel = deliveryDate
    ? new Date(deliveryDate).toLocaleDateString("en-LK", { weekday: "short", month: "short", day: "numeric" })
    : "Your chosen date";
  return [
    { icon: "✅", label: "Order Confirmed",         time: "Just now",       key: "confirmed" },
    { icon: "🏪", label: "Kapruka is Preparing",    time: "Est. +30 min",   key: "preparing" },
    { icon: "🚚", label: "Out for Delivery",         time: "Est. 2–3 hrs",   key: "transit", isLive: true },
    { icon: "📦", label: "Arriving Soon",            time: dateLabel,        key: "arriving" },
    { icon: "🎁", label: "Delivered with Love",      time: dateLabel,        key: "delivered" },
  ];
}

function DeliveryTracker({ deliveryDate }) {
  const steps = makeTrackerSteps(deliveryDate);
  const [activeStep, setActiveStep] = useState(0);

  // Auto-advance to step 2 then pause (simulate "live" tracking)
  useEffect(() => {
    const timers = [
      setTimeout(() => setActiveStep(1), 1800),
      setTimeout(() => setActiveStep(2), 3600),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="tracker-timeline py-2">
      {steps.map((step, idx) => {
        const done = idx < activeStep;
        const live = idx === activeStep;
        const future = idx > activeStep;
        return (
          <div key={step.key} className={`tracker-step tracker-step-enter`} style={{ animationDelay: `${idx * 0.12}s` }}>
            <div
              className={`tracker-dot ${
                done ? "tracker-dot-done" : live ? `tracker-dot-active ${step.isLive ? "tracker-dot-live" : ""}` : ""
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className={`tracker-step-label ${done ? "tracker-step-label-done" : live ? "tracker-step-label-active" : ""} ${future ? "opacity-40" : ""}`}>
                {step.icon} {step.label}
                {live && step.isLive && (
                  <span className="ml-2 text-xs text-kapruka-gold/80 font-normal animate-pulse">● Tracking…</span>
                )}
              </div>
              <div className={`tracker-step-time ${live ? "tracker-step-time-active" : ""} ${future ? "opacity-30" : ""}`}>
                {step.time}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GiftCardPreview({ message }) {
  if (!message || message.trim().length < 3) return null;
  return (
    <div className="gift-card-preview mt-2">
      <div className="text-xs uppercase tracking-widest text-kapruka-gold/60 mb-1.5 font-sans">
        ✉ Gift Card Preview
      </div>
      <p className="italic">{message}</p>
      <div className="text-right text-xs text-kapruka-gold/40 mt-2 font-sans tracking-wide">— Kapruka</div>
    </div>
  );
}

function DeliveryEtaPill({ date }) {
  if (!date) return null;
  const chosen = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayDiff = Math.round((chosen - today) / 86400000);

  if (dayDiff <= 0) {
    return <span className="delivery-eta-pill delivery-eta-same">⚡ Same-day delivery available</span>;
  } else if (dayDiff === 1) {
    return <span className="delivery-eta-pill delivery-eta-next">🚀 Next-day delivery</span>;
  }
  return <span className="delivery-eta-pill delivery-eta-scheduled">📦 Scheduled delivery</span>;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  session_id,
  cart_version,
  defaultCity,
  defaultGiftMessage,
  totalCost,
  deliveryFee = 300,
  onCheckoutSuccess,
  onAccountCreated,
  products = [],
  email,
  strings,
  demoMode = false,
}) {
  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState(defaultCity || "Colombo 01");
  const [date, setDate] = useState("");
  const [instructions, setInstructions] = useState("");
  const [giftMessage, setGiftMessage] = useState(defaultGiftMessage || "");
  const [paymentMethod, setPaymentMethod] = useState("Credit or Debit Card");
  const [timeSlot, setTimeSlot] = useState("Anytime (9 AM - 6 PM)");
  const [loading, setLoading] = useState(false);
  const [generatingCheckout, setGeneratingCheckout] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copied, setCopied] = useState(false);
  const confettiData = useRef(makeConfetti());

  const CHECKOUT_GENERATING_MS = 700;

  // Optional guest account creation
  const [guestEmail, setGuestEmail] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setGeneratingCheckout(false);
      setLoading(false);
    }
  }, [isOpen]);

  // Confetti burst on order success
  useEffect(() => {
    if (orderResult) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 1300);
      return () => clearTimeout(t);
    }
  }, [orderResult]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  const [citySuggestions, setCitySuggestions] = useState([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  const activeStrings = strings || {
    review_checkout: "Review & Checkout",
    checkout_sub: "Establish your Kapruka guest order. No account registration is required.",
    sender_details: "1. Sender Details",
    your_full_name: "Your Full Name",
    recipient_details: "2. Recipient Details",
    name: "Name",
    mobile_phone: "Mobile Phone",
    delivery_gift_msg: "3. Delivery & Gift Message",
    delivery_city: "Delivery City",
    preferred_date: "Preferred Date",
    street_address: "Street Address",
    instructions_opt: "Instructions (Optional)",
    gift_card_msg_opt: "Gift Card Message (Optional)",
    total_with_delivery: "Total (with delivery)",
    cancel: "Cancel",
    proceed_to_payment: "Continue to Payment",
    generating_secure_checkout: "Generating Secure Checkout…",
    preparing_order: "Preparing Order...",
    order_success: "Order Created Successfully!",
    order_success_sub: "Your guest-checkout order has been established on Kapruka.",
    invoice_title: "Kapruka Flow Invoice",
    order_ref: "Order Ref:",
    date: "Date:",
    sender: "Sender:",
    recipient: "Recipient:",
    phone: "Phone:",
    city: "City:",
    deliver_to: "Deliver To:",
    item_description: "Item Description",
    qty_header: "Qty",
    total_header: "Total",
    final_total: "Final Total:",
    simulated_checkout_note: "Simulated Checkout Link generated for development.",
    complete_payment: "Pay on Kapruka",
    close_return: "Close & Return",
    guest_user: "Guest User",
    checkout_failed: "Order creation failed",
    checkout_failed_sub: "Kapruka could not create this order. Check delivery city, date, and product availability.",
    checkout_stock_error: "A product in your cart is out of stock on Kapruka. Remove it and try again.",
    try_again: "Try Again",
    order_ref_note: "This is your Kapruka checkout reference. Complete payment in the browser to receive your final order number by email.",
    powered_by_mcp: "Order created via Kapruka MCP",
  };

  const handleCityChange = async (val) => {
    setCity(val);
    if (val.trim().length < 2) {
      setCitySuggestions([]);
      return;
    }
    try {
      const response = await fetch(`/api/cities?q=${encodeURIComponent(val)}`);
      if (response.ok) {
        const data = await response.json();
        setCitySuggestions(data.cities || []);
        setShowCitySuggestions(true);
      }
    } catch (err) {
      console.error("Failed to autocomplete cities:", err);
    }
  };

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  useEffect(() => {
    if (defaultCity) setCity(defaultCity);
    if (defaultGiftMessage) setGiftMessage(defaultGiftMessage);
  }, [defaultCity, defaultGiftMessage]);

  useEffect(() => {
    if (!isOpen || !demoMode) return;
    setSenderName((prev) => prev || "Kapruka Flow");
    setRecipientName((prev) => prev || "Amma");
    setRecipientPhone((prev) => prev || "0771234567");
    setAddress((prev) => prev || "12 Temple Street, Kandy");
    if (defaultCity) setCity(defaultCity);
    setGiftMessage((prev) => prev || defaultGiftMessage || "Happy Birthday Amma! With love.");
  }, [isOpen, demoMode, defaultCity, defaultGiftMessage]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setGeneratingCheckout(true);
    setLoading(true);
    setOrderResult(null);
    setCheckoutError(null);

    const started = Date.now();
    const effectiveEmail = email || (guestEmail.trim() || undefined);

    const combinedInstructions = [
      instructions ? `Instructions: ${instructions}` : "",
      `Payment Method: ${paymentMethod}`,
      `Delivery Slot: ${timeSlot}`
    ].filter(Boolean).join(" | ");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id,
          cart_version,
          sender_name: senderName || activeStrings.guest_user,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          delivery_address: address,
          delivery_city: city,
          delivery_date: date,
          delivery_instructions: combinedInstructions,
          gift_message: giftMessage,
          email: effectiveEmail
        })
      });

      const data = await response.json();
      const elapsed = Date.now() - started;
      if (elapsed < CHECKOUT_GENERATING_MS) {
        await new Promise((resolve) => setTimeout(resolve, CHECKOUT_GENERATING_MS - elapsed));
      }

      if (response.ok && data.success && !data.simulated) {
        setOrderResult(data);
        if (onCheckoutSuccess) onCheckoutSuccess(data);
        if (data.payment_url) window.open(data.payment_url, "_blank", "noopener,noreferrer");
        if (!email && createAccount && guestEmail.trim() && accountPassword) {
          try {
            const reg = await fetch("/api/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: guestEmail.trim(), name: senderName || "Kapruka Customer", password: accountPassword }),
            });
            const regData = await reg.json();
            if (reg.ok && regData.status === "ok" && onAccountCreated) onAccountCreated(regData.user);
          } catch (regErr) {
            console.error("Account auto-create failed:", regErr);
          }
        }
      } else if (response.ok && data.simulated) {
        setCheckoutError(activeStrings.checkout_failed_sub);
      } else {
        const detail = String(data.detail || data.error || "");
        const isStock = response.status === 503 || /stock|out of stock|unavailable|not available/i.test(detail);
        setCheckoutError(isStock
          ? (activeStrings.checkout_stock_error || activeStrings.checkout_failed_sub)
          : detail || activeStrings.checkout_failed_sub
        );
      }
    } catch (err) {
      console.error(err);
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      setCheckoutError(offline
        ? (activeStrings.network_fail || "Network error — check your connection and try again.")
        : (activeStrings.checkout_failed_sub || String(err))
      );
    } finally {
      setGeneratingCheckout(false);
      setLoading(false);
    }
  }

  const formattedTotal = new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0
  }).format((totalCost || 0) + deliveryFee);

  function handleShare() {
    const text = `🎁 Kapruka Order #${orderResult?.order_number || "—"} placed!\nTotal: ${formattedTotal}\nTracking via Kapruka Flow AI → https://kapruka-flow-ai.vercel.app`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm overflow-y-auto modal-fade">
      <div
        className="min-h-full flex items-center justify-center p-4"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="checkout-dark max-w-xl w-full relative flex flex-col max-h-[90vh] modal-pop">

          {generatingCheckout && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/92 rounded-[inherit]">
              <div className="w-11 h-11 border-2 border-kapruka-gold border-t-transparent rounded-full animate-spin mb-5" aria-hidden />
              <p className="text-lg font-semibold text-white tracking-tight px-6 text-center">
                {activeStrings.generating_secure_checkout || "Generating Secure Checkout…"}
              </p>
            </div>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            disabled={generatingCheckout}
            className="absolute top-4 right-4 z-10 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none font-bold disabled:opacity-40"
            aria-label="Close"
          >
            ✕
          </button>

          {checkoutError ? (
            <div className="flex-1 overflow-y-auto text-center py-12 px-6 space-y-4">
              <div className="w-12 h-12 bg-red-950/40 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-xl text-red-400 font-bold">!</div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">{activeStrings.checkout_failed}</h2>
                <p className="text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">{checkoutError}</p>
              </div>
              <button type="button" onClick={() => setCheckoutError(null)} className="btn-premium px-8 py-3 text-sm font-bold">
                {activeStrings.try_again}
              </button>
            </div>

          ) : !orderResult ? (
            <>
              {/* Header */}
              <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/10">
                <h2 className="text-2xl font-bold text-white tracking-tight">{activeStrings.review_checkout}</h2>
                <p className="text-base text-slate-400 mt-1">{activeStrings.checkout_sub}</p>
              </div>

              <form id="kapruka-checkout-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                {/* ── Sender ── */}
                <div className="checkout-section-1 p-4 rounded-lg bg-white/5 border border-white/5 space-y-4">
                  <h3 className="text-sm font-bold text-kapruka-red">{activeStrings.sender_details}</h3>
                  <div className="float-label-group">
                    <input
                      type="text" required value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder=" "
                      className="w-full p-3 text-sm input-premium"
                    />
                    <label>{activeStrings.your_full_name}</label>
                  </div>
                  {!email && (
                    <div className="space-y-2.5 pt-1">
                      <div className="float-label-group">
                        <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder=" " className="w-full p-3 text-sm input-premium" />
                        <label>{activeStrings.email_optional || "Email (optional)"}</label>
                      </div>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                        <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} className="w-4 h-4 accent-[#fae555] cursor-pointer" />
                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                          {activeStrings.create_account_opt || "Create my Kapruka Flow account so I can track this order (optional)"}
                        </span>
                      </label>
                      {createAccount && (
                        <div className="float-label-group">
                          <input type="password" value={accountPassword} onChange={(e) => setAccountPassword(e.target.value)} placeholder=" " className="w-full p-3 text-sm input-premium animate-fadeIn" />
                          <label>{activeStrings.choose_password || "Choose a password"}</label>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Recipient ── */}
                <div className="checkout-section-2 p-4 rounded-lg bg-white/5 border border-white/5 space-y-4">
                  <h3 className="text-sm font-bold text-kapruka-red">{activeStrings.recipient_details}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="float-label-group">
                      <input type="text" required value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder=" " className="w-full p-3 text-sm input-premium" />
                      <label>{activeStrings.name}</label>
                    </div>
                    <div className="float-label-group">
                      <input type="text" required value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder=" " className="w-full p-3 text-sm input-premium" />
                      <label>{activeStrings.mobile_phone}</label>
                    </div>
                  </div>
                </div>

                {/* ── Delivery & Gift ── */}
                <div className="checkout-section-3 p-4 rounded-lg bg-white/5 border border-white/5 space-y-4">
                  <h3 className="text-sm font-bold text-kapruka-red">{activeStrings.delivery_gift_msg}</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <div className="float-label-group">
                        <input
                          type="text" required value={city}
                          onChange={(e) => handleCityChange(e.target.value)}
                          onFocus={() => citySuggestions.length > 0 && setShowCitySuggestions(true)}
                          onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
                          placeholder=" "
                          className="w-full p-3 text-sm input-premium"
                        />
                        <label>{activeStrings.delivery_city}</label>
                      </div>
                      {showCitySuggestions && citySuggestions.length > 0 && (
                        <div className="absolute left-0 top-full mt-1 w-full bg-[#1f173b] border border-white/10 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">
                          {citySuggestions.map((item, idx) => (
                            <button key={idx} type="button" onClick={() => { setCity(item); setShowCitySuggestions(false); }}
                              className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-[#fae555]/10 hover:text-white transition-colors border-b border-white/5 last:border-none">
                              📍 {item}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="float-label-group">
                      <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} placeholder=" " className="w-full p-3 text-sm input-premium bg-[#1f173b]" />
                      <label>{activeStrings.preferred_date}</label>
                    </div>
                  </div>

                  {/* Smart ETA pill */}
                  <DeliveryEtaPill date={date} />

                  <div className="float-label-group">
                    <textarea required rows="2" value={address} onChange={(e) => setAddress(e.target.value)} placeholder=" " className="w-full p-3 text-sm input-premium" />
                    <label>{activeStrings.street_address}</label>
                  </div>

                  <div className="float-label-group">
                    <input type="text" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder=" " className="w-full p-3 text-sm input-premium" />
                    <label>{activeStrings.instructions_opt}</label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Preferred Time Slot</label>
                      <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} className="w-full p-3 text-sm input-premium bg-[#1f173b] cursor-pointer">
                        <option value="Anytime (9 AM - 6 PM)">Anytime (9 AM - 6 PM)</option>
                        <option value="Morning (8 AM - 12 PM)">Morning (8 AM - 12 PM)</option>
                        <option value="Afternoon (12 PM - 4 PM)">Afternoon (12 PM - 4 PM)</option>
                        <option value="Evening (4 PM - 8 PM)">Evening (4 PM - 8 PM)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Payment Method</label>
                      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full p-3 text-sm input-premium bg-[#1f173b] cursor-pointer">
                        <option value="Credit or Debit Card">Credit or Debit Card</option>
                        <option value="Mobile Wallet (Genie/Frimi)">Mobile Wallet (Genie/Frimi)</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cash on Delivery">Cash on Delivery</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="float-label-group">
                      <textarea rows="2" value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} placeholder=" " className="w-full p-3 text-sm input-premium" />
                      <label>{activeStrings.gift_card_msg_opt}</label>
                    </div>
                    {/* Live gift card preview */}
                    <GiftCardPreview message={giftMessage} />
                  </div>
                </div>
              </form>

              {/* Pinned footer */}
              <div className="shrink-0 px-6 py-4 border-t border-white/10 bg-[var(--color-surface)] flex flex-col sm:flex-row items-center sm:justify-between gap-3">
                <div className="text-center sm:text-left w-full sm:w-auto">
                  <span className="text-sm text-slate-400 uppercase tracking-wider">{activeStrings.total_with_delivery}</span>
                  <p className="text-2xl font-bold text-kapruka-red font-mono">{formattedTotal}</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button type="button" onClick={onClose} className="flex-1 sm:flex-initial btn-secondary-premium px-4 py-3 text-sm font-semibold text-center">
                    {activeStrings.cancel}
                  </button>
                  <button type="submit" form="kapruka-checkout-form" disabled={loading} className="flex-1 sm:flex-initial btn-primary btn-primary-lg sm:min-h-[72px] text-center disabled:opacity-60">
                    {generatingCheckout
                      ? activeStrings.generating_secure_checkout
                      : loading
                        ? activeStrings.preparing_order
                        : activeStrings.proceed_to_payment}
                  </button>
                </div>
              </div>
            </>

          ) : (
            /* ─── SUCCESS SCREEN ─── */
            <div className="flex-1 overflow-y-auto text-center py-6 px-6 space-y-5 relative">

              {/* Confetti burst */}
              {showConfetti && (
                <div className="pointer-events-none" aria-hidden>
                  {confettiData.current.map((c, i) => (
                    <span
                      key={i}
                      className="confetti-particle"
                      style={{
                        "--cx": c.cx,
                        "--cy": c.cy,
                        "--cr": c.cr,
                        animationDelay: c.delay,
                        marginLeft: "-0.7rem",
                        marginTop: "-0.7rem",
                      }}
                    >
                      {c.emoji}
                    </span>
                  ))}
                </div>
              )}

              {/* Animated SVG checkmark */}
              <div className="relative flex items-center justify-center mx-auto" style={{ width: 56, height: 56 }}>
                <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="absolute">
                  <circle cx="28" cy="28" r="26" stroke="rgba(34,197,94,0.25)" strokeWidth="3" />
                  <circle cx="28" cy="28" r="26" stroke="#22c55e" strokeWidth="3" strokeDasharray="163" strokeDashoffset="0" />
                </svg>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <polyline
                    className="check-draw"
                    points="5,14 12,21 23,8"
                    stroke="#22c55e"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white tracking-tight">{activeStrings.order_success}</h2>
                <p className="text-sm text-slate-400">{activeStrings.order_success_sub}</p>
                {/* Order ref typewriter */}
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-xs text-slate-500 uppercase tracking-widest">{activeStrings.order_ref}</span>
                  <span className="order-typewriter text-sm font-mono font-bold text-kapruka-gold">
                    {orderResult.order_number}
                  </span>
                </div>
                <p className="text-sm text-kapruka-red font-mono uppercase tracking-wider">{activeStrings.powered_by_mcp}</p>
              </div>

              {/* ── Live Delivery Tracker ── */}
              <div className="border border-white/10 rounded-xl p-4 bg-white/3 text-left space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">🗺 Your Gift is on its Way</span>
                  <span className="text-xs text-kapruka-gold/70 animate-pulse">● Live</span>
                </div>
                <DeliveryTracker deliveryDate={orderResult.delivery_date} />
                <LiveDeliveryMap city={orderResult.delivery_city || city} />
              </div>

              {/* Order ref note */}
              <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed italic">
                {activeStrings.order_ref_note}
              </p>

              {/* Invoice receipt */}
              <div className="border-y-2 border-dashed border-white/20 py-4 my-2 bg-white/5 p-4 rounded text-left font-mono text-sm text-slate-300 space-y-3">
                <div className="text-center font-bold text-sm uppercase tracking-wider text-white border-b border-white/10 pb-2">
                  {activeStrings.invoice_title}
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-sm text-slate-400 border-b border-white/5 pb-2">
                  <span>{activeStrings.order_ref}</span>
                  <span className="font-bold text-slate-200 text-right">{orderResult.order_number}</span>
                  <span>{activeStrings.date}</span>
                  <span className="text-slate-200 text-right">{new Date().toLocaleDateString()}</span>
                  <span>{activeStrings.sender}</span>
                  <span className="text-slate-200 text-right truncate">{senderName || activeStrings.guest_user}</span>
                  <span>{activeStrings.recipient}</span>
                  <span className="text-slate-200 text-right truncate">{recipientName}</span>
                  <span>{activeStrings.city}</span>
                  <span className="text-slate-200 text-right">{city}</span>
                </div>
                <div className="space-y-1.5 py-1">
                  <div className="flex justify-between font-bold text-white text-sm uppercase border-b border-white/10 pb-1">
                    <span>{activeStrings.item_description}</span>
                    <span className="shrink-0 w-20 text-right">{activeStrings.total_header}</span>
                  </div>
                  {products.map((item) => {
                    const unitPrice = item.price?.amount ?? item.price ?? 0;
                    const qty = item.quantity ?? 1;
                    return (
                      <div key={item.id} className="flex justify-between gap-2 text-sm text-slate-300 leading-tight">
                        <span className="truncate flex-1">{item.name}</span>
                        <span className="shrink-0 w-20 text-right font-semibold font-mono">
                          {new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(unitPrice * qty)} LKR
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-dashed border-white/20 pt-2 space-y-1.5 text-sm">
                  <div className="flex justify-between font-bold text-white text-sm border-t border-white/10 pt-1.5">
                    <span>{activeStrings.final_total}</span>
                    <span className="font-mono text-kapruka-red">
                      {new Intl.NumberFormat("en-LK", { style: "currency", currency: orderResult.currency || "LKR", maximumFractionDigits: 0 }).format(orderResult.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Share card */}
              <div className="share-card">
                <p className="text-xs text-slate-400 mb-2">Share your order with friends</p>
                <button
                  type="button"
                  onClick={handleShare}
                  className="btn-secondary-premium w-full py-2 text-sm font-semibold"
                >
                  {copied ? "✓ Copied to clipboard!" : "📋 Share this order"}
                </button>
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col gap-2 max-w-xs mx-auto">
                <a href={orderResult.payment_url} target="_blank" rel="noopener noreferrer"
                  className="w-full btn-premium py-3 text-sm text-center flex items-center justify-center gap-1.5">
                  {activeStrings.complete_payment}
                </a>
                <button type="button" onClick={onClose} className="w-full btn-secondary-premium py-2.5 text-sm">
                  {activeStrings.close_return}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
