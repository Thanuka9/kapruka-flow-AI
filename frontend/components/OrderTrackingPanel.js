import { useEffect, useState } from "react";
import LiveDeliveryMap from "./LiveDeliveryMap";

export default function OrderTrackingPanel({ trackingData, language = "en-US", strings = {} }) {
  if (!trackingData) return null;

  const t = (key, fallback) => strings[key] || fallback;

  const {
    order_number,
    status_display = "Pending",
    status = "pending",
    order_date,
    delivery_date,
    amount = {},
    recipient = {},
    greeting_message,
    progress = [],
    live_tracking_available = false
  } = trackingData;

  const getStatusColor = (st = "") => {
    const s = st.toLowerCase();
    if (s === "delivered" || s.includes("complete")) {
      return {
        bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
        dot: "bg-emerald-400"
      };
    }
    if (s.includes("out") || s.includes("shipped") || s.includes("preparing")) {
      return {
        bg: "bg-sky-500/10 border-sky-500/30 text-sky-400",
        dot: "bg-sky-400"
      };
    }
    return {
      bg: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      dot: "bg-amber-400"
    };
  };

  const statusStyle = getStatusColor(status_display);

  return (
    <div className="w-full space-y-6 text-slate-200">
      {/* Title & Status Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
        <div>
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            {t("order_tracking_title", "Order Tracking")}
          </span>
          <h2 className="text-2xl font-black text-white font-mono mt-1">
            #{order_number}
          </h2>
          {order_date && (
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Ordered: {order_date}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-4 py-2 rounded-xl text-sm font-extrabold border ${statusStyle.bg} flex items-center gap-2`}>
            <span className={`w-2.5 h-2.5 rounded-full ${statusStyle.dot} animate-pulse`} />
            {status_display}
          </span>
        </div>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Summary and Recipient Details */}
        <div className="space-y-6">
          {/* Order Summary Card */}
          <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white tracking-wide border-b border-white/5 pb-2">
              Summary
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-sans">
                  {t("order_tracking_total", "Total Amount")}
                </p>
                <p className="text-white font-bold text-sm mt-0.5">
                  {amount.currency || "LKR"} {amount.value ? Number(amount.value).toLocaleString() : "0"}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-sans">
                  {t("order_tracking_est_delivery", "Est. Delivery Date")}
                </p>
                <p className="text-kapruka-gold font-bold text-sm mt-0.5">
                  {delivery_date}
                </p>
              </div>
            </div>
          </div>

          {/* Recipient Card */}
          <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white tracking-wide border-b border-white/5 pb-2">
              {t("order_tracking_details", "Delivery Details")}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-sans">{t("order_tracking_recipient", "Recipient")}</p>
                <p className="text-white font-semibold mt-0.5">{recipient.name}</p>
              </div>
              {recipient.phone && (
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-sans">{t("order_tracking_phone", "Phone Number")}</p>
                  <p className="text-white mt-0.5 font-mono">{recipient.phone.replace(/<[^>]*>?/gm, '')}</p>
                </div>
              )}
              {recipient.address && (
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-sans">{t("order_tracking_address", "Delivery Address")}</p>
                  <p className="text-white mt-0.5 leading-relaxed">{recipient.address.replace(/<[^>]*>?/gm, '')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Greeting message if present */}
          {greeting_message && (
            <div className="bg-gradient-to-r from-pink-500/5 to-rose-500/5 border border-pink-500/20 rounded-2xl p-5 relative overflow-hidden">
              <div className="absolute top-2 right-2 text-3xl opacity-20 select-none">✉️</div>
              <h3 className="text-xs font-bold text-pink-400 tracking-wider uppercase mb-2">
                {t("order_tracking_greeting", "Greeting Card Message")}
              </h3>
              <p className="text-white text-sm italic font-medium leading-relaxed">
                "{greeting_message}"
              </p>
            </div>
          )}
        </div>

        {/* Right column: Timeline and Map */}
        <div className="space-y-6">
          {/* Timeline Card */}
          <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white tracking-wide border-b border-white/5 pb-2">
              {t("order_tracking_timeline", "Delivery Timeline")}
            </h3>
            
            {progress && progress.length > 0 ? (
              <div className="relative pl-6 border-l-2 border-white/5 space-y-6 my-2">
                {progress.map((step, idx) => {
                  const isLatest = idx === progress.length - 1;
                  const dotColor = isLatest ? statusStyle.dot : "bg-slate-700 border border-slate-600";
                  
                  return (
                    <div key={idx} className="relative group">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full ${dotColor} ${isLatest ? 'animate-ping' : ''}`} />
                      <span className={`absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full ${dotColor}`} />
                      
                      <div>
                        <p className={`text-xs font-bold ${isLatest ? 'text-white' : 'text-slate-400'}`}>
                          {step.step}
                        </p>
                        {step.timestamp && (
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {step.timestamp}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No timeline progress recorded yet.</p>
            )}
          </div>

          {/* Live Delivery Map if available */}
          {live_tracking_available && recipient.city && (
            <LiveDeliveryMap city={recipient.city} />
          )}
        </div>
      </div>
    </div>
  );
}
