import { useState, useEffect } from "react";

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

  const CHECKOUT_GENERATING_MS = 700;

  // Optional guest account creation (only relevant when not signed in)
  const [guestEmail, setGuestEmail] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setGeneratingCheckout(false);
      setLoading(false);
    }
  }, [isOpen]);

  // Lock page scroll + Escape-to-close while open
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

  // Delivery City Autocomplete states
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

  // Set default date to tomorrow
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Update when defaults change
  useEffect(() => {
    if (defaultCity) setCity(defaultCity);
    if (defaultGiftMessage) setGiftMessage(defaultGiftMessage);
  }, [defaultCity, defaultGiftMessage]);

  // Judge demo — prefill so checkout feels instant
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
        if (onCheckoutSuccess) {
          onCheckoutSuccess(data);
        }
        if (data.payment_url) {
          window.open(data.payment_url, "_blank", "noopener,noreferrer");
        }
        // Optional: auto-create a Kapruka Flow account for guest checkout.
        if (!email && createAccount && guestEmail.trim() && accountPassword) {
          try {
            const reg = await fetch("/api/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: guestEmail.trim(),
                name: senderName || "Kapruka Customer",
                password: accountPassword,
              }),
            });
            const regData = await reg.json();
            if (reg.ok && regData.status === "ok" && onAccountCreated) {
              onAccountCreated(regData.user);
            }
          } catch (regErr) {
            console.error("Account auto-create failed:", regErr);
          }
        }
      } else if (response.ok && data.simulated) {
        setCheckoutError(activeStrings.checkout_failed_sub);
      } else {
        const detail = String(data.detail || data.error || "");
        const isStock =
          response.status === 503 ||
          /stock|out of stock|unavailable|not available/i.test(detail);
        setCheckoutError(
          isStock
            ? (activeStrings.checkout_stock_error || activeStrings.checkout_failed_sub)
            : detail || activeStrings.checkout_failed_sub
        );
      }
    } catch (err) {
      console.error(err);
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      setCheckoutError(
        offline
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm overflow-y-auto modal-fade">
      <div
        className="min-h-full flex items-center justify-center p-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
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
            <div className="w-12 h-12 bg-red-950/40 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-xl text-red-400 font-bold">
              !
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">{activeStrings.checkout_failed}</h2>
              <p className="text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">{checkoutError}</p>
            </div>
            <button
              type="button"
              onClick={() => setCheckoutError(null)}
              className="btn-premium px-8 py-3 text-sm font-bold"
            >
              {activeStrings.try_again}
            </button>
          </div>
        ) : !orderResult ? (
          <>
            {/* Header */}
            <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/10">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {activeStrings.review_checkout}
              </h2>
              <p className="text-base text-slate-400 mt-1">
                {activeStrings.checkout_sub}
              </p>
            </div>

            <form id="kapruka-checkout-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              
              {/* Sender Form Section */}
              <div className="p-4 rounded-lg bg-white/5 border border-white/5 space-y-3">
                <h3 className="text-sm font-bold text-kapruka-red font-semibold">
                  {activeStrings.sender_details}
                </h3>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{activeStrings.your_full_name}</label>
                  <input
                    type="text"
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="e.g. Thanuka Ellepola"
                    className="w-full p-3 text-sm input-premium"
                  />
                </div>

                {/* Guest: optional email + auto account creation */}
                {!email && (
                  <div className="space-y-2.5 pt-1">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">{activeStrings.email_optional || "Email (optional)"}</label>
                      <input
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="you@email.com"
                        className="w-full p-3 text-sm input-premium"
                      />
                    </div>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                      <input
                        type="checkbox"
                        checked={createAccount}
                        onChange={(e) => setCreateAccount(e.target.checked)}
                        className="w-4 h-4 accent-[#fae555] cursor-pointer"
                      />
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                        {activeStrings.create_account_opt || "Create my Kapruka Flow account so I can track this order (optional)"}
                      </span>
                    </label>
                    {createAccount && (
                      <input
                        type="password"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        placeholder={activeStrings.choose_password || "Choose a password"}
                        className="w-full p-3 text-sm input-premium animate-fadeIn"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Recipient Form Section */}
              <div className="p-4 rounded-lg bg-white/5 border border-white/5 space-y-3">
                <h3 className="text-sm font-bold text-kapruka-red font-semibold">
                  {activeStrings.recipient_details}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">{activeStrings.name}</label>
                    <input
                      type="text"
                      required
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g. Amma"
                      className="w-full p-3 text-sm input-premium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">{activeStrings.mobile_phone}</label>
                    <input
                      type="text"
                      required
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="e.g. 0771234567"
                      className="w-full p-3 text-sm input-premium"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Details Section */}
              <div className="p-4 rounded-lg bg-white/5 border border-white/5 space-y-3">
                <h3 className="text-sm font-bold text-kapruka-red font-semibold">
                  {activeStrings.delivery_gift_msg}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="relative">
                    <label className="block text-sm text-slate-400 mb-1">{activeStrings.delivery_city}</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => handleCityChange(e.target.value)}
                      onFocus={() => citySuggestions.length > 0 && setShowCitySuggestions(true)}
                      onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
                      placeholder="e.g. Colombo 01"
                      className="w-full p-3 text-sm input-premium"
                    />
                    {showCitySuggestions && citySuggestions.length > 0 && (
                      <div className="absolute left-0 top-full mt-1 w-full bg-[#1f173b] border border-white/10 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">
                        {citySuggestions.map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setCity(item);
                              setShowCitySuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2.5 text-sm text-slate-200 hover:bg-[#fae555]/10 hover:text-white transition-colors border-b border-white/5 last:border-none"
                          >
                            📍 {item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">{activeStrings.preferred_date}</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full p-3 text-sm input-premium bg-[#1f173b]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">{activeStrings.street_address}</label>
                  <textarea
                    required
                    rows="2"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter recipient's physical street address"
                    className="w-full p-3 text-sm input-premium"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">{activeStrings.instructions_opt}</label>
                  <input
                    type="text"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="e.g. Deliver before 5 PM"
                    className="w-full p-3 text-sm input-premium"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Preferred Time Slot</label>
                    <select
                      value={timeSlot}
                      onChange={(e) => setTimeSlot(e.target.value)}
                      className="w-full p-3 text-sm input-premium bg-[#1f173b] cursor-pointer"
                    >
                      <option value="Anytime (9 AM - 6 PM)">Anytime (9 AM - 6 PM)</option>
                      <option value="Morning (8 AM - 12 PM)">Morning (8 AM - 12 PM)</option>
                      <option value="Afternoon (12 PM - 4 PM)">Afternoon (12 PM - 4 PM)</option>
                      <option value="Evening (4 PM - 8 PM)">Evening (4 PM - 8 PM)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full p-3 text-sm input-premium bg-[#1f173b] cursor-pointer"
                    >
                      <option value="Credit or Debit Card">Credit or Debit Card</option>
                      <option value="Mobile Wallet (Genie/Frimi)">Mobile Wallet (Genie/Frimi)</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash on Delivery">Cash on Delivery</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">{activeStrings.gift_card_msg_opt}</label>
                  <textarea
                    rows="2"
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                    placeholder="Happy Birthday! Wish you all the best."
                    className="w-full p-3 text-sm input-premium"
                  />
                </div>
              </div>
            </form>

            {/* Pinned footer — Cost & Submit always visible */}
            <div className="shrink-0 px-6 py-4 border-t border-white/10 bg-[var(--color-surface)] flex flex-col sm:flex-row items-center sm:justify-between gap-3">
              <div className="text-center sm:text-left w-full sm:w-auto">
                <span className="text-sm text-slate-400 uppercase tracking-wider">{activeStrings.total_with_delivery}</span>
                <p className="text-2xl font-bold text-kapruka-red font-mono">{formattedTotal}</p>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial btn-secondary-premium px-4 py-3 text-sm font-semibold text-center"
                >
                  {activeStrings.cancel}
                </button>
                <button
                  type="submit"
                  form="kapruka-checkout-form"
                  disabled={loading}
                  className="flex-1 sm:flex-initial btn-primary btn-primary-lg sm:min-h-[72px] text-center disabled:opacity-60"
                >
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
          <div className="flex-1 overflow-y-auto text-center py-6 px-6 space-y-4">
            <div className="w-12 h-12 bg-green-950/40 border border-green-500/30 rounded-full flex items-center justify-center mx-auto text-xl text-green-400 font-bold">
              ✓
            </div>
            
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white tracking-tight">{activeStrings.order_success}</h2>
              <p className="text-sm text-slate-400">{activeStrings.order_success_sub}</p>
              <p className="text-sm text-kapruka-red font-mono uppercase tracking-wider">{activeStrings.powered_by_mcp}</p>
            </div>

            <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed italic">
              {activeStrings.order_ref_note}
            </p>

            {/* Structured Invoice Receipt Block */}
            <div className="border-y-2 border-dashed border-white/20 py-4 my-2 bg-white/5 p-4 rounded text-left font-mono text-sm text-slate-300 space-y-3">
              <div className="text-center font-bold text-sm uppercase tracking-wider text-white border-b border-white/10 pb-2">
                {activeStrings.invoice_title}
              </div>

              {/* Order Metadata */}
              <div className="grid grid-cols-2 gap-y-1 text-sm text-slate-400 border-b border-white/5 pb-2">
                <span>{activeStrings.order_ref}</span>
                <span className="font-bold text-slate-200 text-right">{orderResult.order_number}</span>
                <span>{activeStrings.date}</span>
                <span className="text-slate-200 text-right">{new Date().toLocaleDateString()}</span>
                <span>{activeStrings.sender}</span>
                <span className="text-slate-200 text-right truncate">{senderName || activeStrings.guest_user}</span>
                <span>{activeStrings.recipient}</span>
                <span className="text-slate-200 text-right truncate">{recipientName}</span>
                <span>{activeStrings.phone}</span>
                <span className="text-slate-200 text-right">{recipientPhone}</span>
                <span>{activeStrings.city}</span>
                <span className="text-slate-200 text-right">{city}</span>
                <span className="col-span-2 mt-1 pt-1 border-t border-white/5">{activeStrings.deliver_to}</span>
                <span className="col-span-2 text-slate-300 text-sm leading-tight break-words">{address}</span>
              </div>

              {/* Items Table */}
              <div className="space-y-1.5 py-1">
                <div className="flex justify-between font-bold text-white text-sm uppercase border-b border-white/10 pb-1">
                  <span>{activeStrings.item_description}</span>
                  <span className="shrink-0 w-12 text-center">{activeStrings.qty_header}</span>
                  <span className="shrink-0 w-20 text-right">{activeStrings.total_header}</span>
                </div>
                
                {products.map((item) => {
                  const unitPrice = item.price?.amount ?? item.price ?? 0;
                  const qty = item.quantity ?? 1;
                  const itemTotal = unitPrice * qty;
                  return (
                    <div key={item.id} className="flex justify-between gap-2 text-sm text-slate-300 leading-tight">
                      <span className="truncate flex-1">{item.name}</span>
                      <span className="shrink-0 w-12 text-center text-slate-400">{qty}</span>
                      <span className="shrink-0 w-20 text-right font-semibold font-mono">
                        {new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(itemTotal)} LKR
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Cost Summary Section */}
              <div className="border-t border-dashed border-white/20 pt-2 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>{activeStrings.items_subtotal}:</span>
                  <span className="font-mono">{new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(totalCost)} LKR</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>{activeStrings.delivery_fee}:</span>
                  <span className="font-mono">{new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(deliveryFee)} LKR</span>
                </div>
                <div className="flex justify-between font-bold text-white text-sm border-t border-white/10 pt-1.5">
                  <span>{activeStrings.final_total}</span>
                  <span className="font-mono text-kapruka-red">
                    {new Intl.NumberFormat("en-LK", { 
                      style: "currency", 
                      currency: orderResult.currency || "LKR",
                      maximumFractionDigits: 0
                    }).format(orderResult.total)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              <a
                href={orderResult.payment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full btn-premium py-3 text-sm text-center flex items-center justify-center gap-1.5"
              >
                {activeStrings.complete_payment}
              </a>
              <button
                type="button"
                onClick={onClose}
                className="w-full btn-secondary-premium py-2.5 text-sm"
              >
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
