import { useState, useEffect } from "react";
import { getBookmarks, removeBookmark } from "../utils/bookmarks";
import { buildClientAiProfile, buildProfileInsightLines, buildReorderPrompt } from "../utils/userContext";
import Icon3D from "./Icon3D";

/** Locks page scroll + enables Escape-to-close while a modal is open. */
function useModalChrome(isOpen, onClose) {
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
}

export function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  useModalChrome(isOpen, onClose);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: isRegistering ? name : undefined,
          password
        })
      });
      const data = await response.json();
      if (response.ok && data.status === "ok") {
        onLoginSuccess(data.user);
        onClose();
      } else {
        alert(data.detail || "Authentication failed.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred during login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm overflow-y-auto modal-fade">
      <div
        className="min-h-full flex items-center justify-center p-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="flow-card max-w-sm w-full relative flex flex-col max-h-[90vh] modal-pop">
          {/* Header */}
          <div className="shrink-0 px-6 pt-6 pb-4 border-b border-flow-border relative">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-flow-text hover:bg-white/10 transition-colors font-bold"
              aria-label="Close"
            >
              ✕
            </button>
            <div className="flex items-center gap-3">
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 shadow-lg"
                style={{ background: "linear-gradient(135deg, #F6C343 0%, #FFD86B 100%)" }}
              >
                {isRegistering ? "🎉" : "👋"}
              </span>
              <div>
                <h2 className="text-lg font-bold text-flow-text tracking-tight">
                  {isRegistering ? "Create your account" : "Welcome back"}
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">
                  {isRegistering ? "Register your Kapruka Flow account" : "Sign in to track orders & bookmarks"}
                </p>
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <form id="kapruka-login-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. user@kapruka.com"
                className="w-full p-2.5 text-xs input-premium"
              />
            </div>

            {isRegistering && (
              <div>
                <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Thanuka Ellepola"
                  className="w-full p-2.5 text-xs input-premium"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-2.5 text-xs input-premium"
              />
            </div>
          </form>

          {/* Pinned footer (always visible, no page scroll needed) */}
          <div className="shrink-0 px-6 pb-6 pt-3 border-t border-white/5 space-y-3 bg-[var(--color-surface)]">
            <button
              type="submit"
              form="kapruka-login-form"
              disabled={loading}
              className="w-full btn-premium py-2.5 text-xs uppercase tracking-wider font-bold disabled:opacity-60"
            >
              {loading ? "Authenticating..." : isRegistering ? "Sign Up" : "Log In"}
            </button>
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="w-full text-[11px] text-kapruka-red hover:underline bg-transparent border-none focus:outline-none"
            >
              {isRegistering ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function userInitials(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function formatLKR(amount) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

function formatOrderDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-LK", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function orderBadge(orderId, strings) {
  const id = String(orderId || "");
  if (id.startsWith("ORD-")) return { label: strings.profile_order_live || "Kapruka order", cls: "bg-green-50 text-green-700 border-green-200" };
  if (id.startsWith("FLOW-SIM")) return { label: strings.profile_order_sim || "Demo order", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return { label: strings.profile_order_guest || "Guest checkout", cls: "bg-blue-50 text-blue-700 border-blue-200" };
}

export function ProfileModal({
  isOpen,
  onClose,
  user,
  onLogout,
  strings,
  onStartShopping,
  onReorder,
  language = "en-US",
}) {
  const [orders, setOrders] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [tab, setTab] = useState("orders");

  const s = strings || {};

  useModalChrome(isOpen, onClose);

  useEffect(() => {
    if (!isOpen || !user) return;
    loadOrders();
    refreshBookmarks();
    setTab("orders");
  }, [isOpen, user]);

  async function loadOrders() {
    setLoadingOrders(true);
    try {
      const response = await fetch(`/api/orders?email=${encodeURIComponent(user.email)}`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Failed to load user orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  }

  function refreshBookmarks() {
    setBookmarks(getBookmarks());
  }

  function handleRemoveBookmark(id) {
    removeBookmark(id);
    setBookmarks(getBookmarks());
  }

  if (!isOpen || !user) return null;

  const aiProfile = buildClientAiProfile(orders, bookmarks);
  const rukaLines = buildProfileInsightLines(aiProfile, s, language);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm overflow-y-auto modal-fade">
      <div
        className="min-h-full flex items-center justify-center p-4"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="flow-card max-w-md w-full relative flex flex-col max-h-[min(90vh,720px)] modal-pop overflow-hidden">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-flow-muted hover:text-flow-text hover:bg-flow-bg-secondary transition-colors font-bold"
            aria-label="Close"
          >
            ✕
          </button>

          {/* Profile header */}
          <div className="shrink-0 px-5 pt-5 pb-4 border-b border-flow-border bg-gradient-to-br from-flow-bg-secondary to-flow-bg">
            <div className="flex items-center gap-3 pr-8">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-flow-text shrink-0 shadow-card"
                style={{ background: "linear-gradient(135deg, #F6C343 0%, #FFD86B 100%)" }}
              >
                {userInitials(user.name, user.email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-label text-flow-muted">{s.profile_title || "Your account"}</p>
                <h2 className="text-lg font-bold text-flow-text truncate">{user.name || "Kapruka customer"}</h2>
                <p className="text-sm text-flow-muted truncate">{user.email}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <div className="flex-1 rounded-xl bg-white/[0.04] border border-flow-border px-3 py-2 text-center">
                <p className="text-xl font-bold text-kapruka-red">{orders.length}</p>
                <p className="text-xs text-flow-muted">{s.profile_orders_count || "Orders"}</p>
              </div>
              <div className="flex-1 rounded-xl bg-white/[0.04] border border-flow-border px-3 py-2 text-center">
                <p className="text-xl font-bold text-flow-text">{bookmarks.length}</p>
                <p className="text-xs text-flow-muted">{s.profile_bookmarks_count || "Saved"}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="shrink-0 flex border-b border-flow-border px-2">
            {[
              { id: "orders", label: s.profile_orders || "Order history" },
              { id: "bookmarks", label: s.profile_bookmarks || "Saved products" },
              { id: "ruka", label: s.profile_ruka_tab || "For Ruka" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-kapruka-red text-kapruka-red"
                    : "border-transparent text-flow-muted hover:text-flow-text"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {tab === "orders" && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={loadOrders}
                    disabled={loadingOrders}
                    className="text-xs font-medium text-kapruka-red hover:underline disabled:opacity-50"
                  >
                    {s.profile_refresh || "Refresh"}
                  </button>
                </div>
                {loadingOrders ? (
                  <p className="text-sm text-flow-muted text-center py-8 animate-progress-pulse">Loading…</p>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8 px-4 rounded-xl bg-flow-bg-secondary border border-flow-border">
                    <div className="flex justify-center mb-2"><Icon3D name="box" size={40} float /></div>
                    <p className="text-sm text-flow-secondary leading-relaxed">{s.profile_no_orders}</p>
                    {onStartShopping && (
                      <button type="button" onClick={onStartShopping} className="btn-primary mt-4 min-h-[40px] text-sm px-6">
                        {s.profile_start_shopping || "Start shopping"}
                      </button>
                    )}
                  </div>
                ) : (
                  orders.map((o) => {
                    const badge = orderBadge(o.order_id, s);
                    return (
                      <div
                        key={o.order_id}
                        className="rounded-xl border border-flow-border bg-white/[0.04] p-4 shadow-sm hover:shadow-card transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="font-mono text-sm font-bold text-kapruka-red break-all">{o.order_id}</span>
                          <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-pill border ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                          <span className="text-flow-muted">Recipient</span>
                          <span className="text-flow-text font-medium truncate text-right">{o.recipient_name || "—"}</span>
                          <span className="text-flow-muted">City</span>
                          <span className="text-flow-text font-medium text-right">{o.delivery_city || "—"}</span>
                          {o.created_at && (
                            <>
                              <span className="text-flow-muted">Date</span>
                              <span className="text-flow-text text-right">{formatOrderDate(o.created_at)}</span>
                            </>
                          )}
                          <span className="text-flow-muted">Total</span>
                          <span className="text-flow-text font-bold text-right">{formatLKR(o.total_price)}</span>
                        </div>
                        {o.categories && (
                          <p className="text-xs text-flow-muted mt-2 pt-2 border-t border-flow-border truncate">
                            {o.categories}
                          </p>
                        )}
                        {onReorder && (
                          <button
                            type="button"
                            onClick={() => {
                              onReorder(buildReorderPrompt(o, language));
                              onClose();
                            }}
                            className="mt-3 w-full btn-secondary min-h-[36px] text-xs font-semibold"
                          >
                            {s.profile_reorder || "Reorder with Ruka"}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {tab === "ruka" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-kapruka-gold/30 bg-gradient-to-br from-kapruka-gold/10 to-white p-4">
                  <p className="text-sm font-bold text-flow-text flex items-center gap-2">
                    <Icon3D name="sparkle" size={18} float />
                    {s.profile_ruka_title || "What Ruka remembers"}
                  </p>
                  <p className="text-xs text-flow-muted mt-1 leading-relaxed">
                    {s.profile_ruka_desc || "This shapes city defaults, budget hints, and product ranking when you build a cart."}
                  </p>
                </div>
                <ul className="space-y-2">
                  {rukaLines.map((line, i) => (
                    <li
                      key={i}
                      className="text-sm text-flow-secondary leading-relaxed flex gap-2 rounded-lg bg-flow-bg-secondary border border-flow-border px-3 py-2"
                    >
                      <span className="text-kapruka-gold shrink-0">•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                {onStartShopping && (aiProfile.order_count > 0 || aiProfile.saved_count > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      onStartShopping(
                        aiProfile.saved_count > 0
                          ? "Build a cart using my saved items and order history"
                          : buildReorderPrompt(orders[0], language)
                      );
                      onClose();
                    }}
                    className="w-full btn-primary min-h-[44px] text-sm"
                  >
                    {s.profile_ruka_build || "Build cart with my profile"}
                  </button>
                )}
              </div>
            )}

            {tab === "bookmarks" && (
              <div className="space-y-3">
                {bookmarks.length === 0 ? (
                  <div className="text-center py-8 px-4 rounded-xl bg-flow-bg-secondary border border-flow-border">
                    <div className="flex justify-center mb-2"><Icon3D name="star" size={40} float /></div>
                    <p className="text-sm text-flow-secondary leading-relaxed">{s.profile_no_bookmarks}</p>
                    {onStartShopping && (
                      <button type="button" onClick={onStartShopping} className="btn-secondary mt-4 min-h-[40px] text-sm px-6">
                        {s.profile_start_shopping || "Start shopping"}
                      </button>
                    )}
                  </div>
                ) : (
                  bookmarks.map((b) => (
                    <div
                      key={b.id}
                      className="flex gap-3 rounded-xl border border-flow-border bg-white/[0.04] p-3 items-center"
                    >
                      <div className="w-14 h-14 rounded-lg bg-flow-bg-secondary border border-flow-border overflow-hidden shrink-0 flex items-center justify-center text-xl">
                        {b.image_url ? (
                          <img src={b.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          "📦"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-flow-text line-clamp-2 leading-snug">
                          {b.name || b.id}
                        </p>
                        {b.price != null && (
                          <p className="text-sm font-bold text-kapruka-red mt-0.5">{formatLKR(b.price)}</p>
                        )}
                        {b.category && <p className="text-xs text-flow-muted mt-0.5">{b.category}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBookmark(b.id)}
                        className="btn-tertiary text-xs min-h-[36px] px-2 shrink-0"
                        title={s.profile_remove_bookmark}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 px-4 py-3 border-t border-flow-border bg-flow-bg-secondary/50">
            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full btn-secondary min-h-[44px] text-sm text-semantic-error border-red-100 hover:border-red-200"
            >
              {s.profile_logout || "Sign out"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
