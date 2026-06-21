import { motion } from "framer-motion";
import Icon3D from "./Icon3D";

function getPlanDescription(ver, lang) {
  if (lang === "si-LK") {
    return {
      initial: "AI මඟින් සකසන ලද ඔබගේ ප්‍රශස්ත සැලැස්ම",
      cheaper: "අඩුම මිල ගණන් යටතේ සකසන ලද ආර්ථික සැලැස්ම",
      premium: "උසස්ම තත්ත්වයේ නිෂ්පාදන ඇතුළත් ප්‍රමුඛ සැලැස්ම",
      fast: "වේගවත්ම බෙදාහැරීම සහතික කරන සැලැස්ම"
    }[ver] || "";
  }
  if (lang === "en-LK") {
    return {
      initial: "Your AI-composed ideal shopping plan",
      cheaper: "Budget-optimized plan saving maximum LKR",
      premium: "Luxury grade alternatives and gift upgrades",
      fast: "Fast-tracked items optimized for today delivery"
    }[ver] || "";
  }
  return {
    initial: "Your AI-composed ideal shopping plan",
    cheaper: "Budget-optimized plan saving maximum LKR",
    premium: "Luxury grade alternatives and gift upgrades",
    fast: "Fast-tracked items optimized for today delivery"
  }[ver] || "";
}

function getPlanCurationScore(ver, items = []) {
  if (items.length === 0) return 0;
  // Deterministic curation score based on plan type and contents
  return {
    initial: 95,
    cheaper: 90,
    premium: 98,
    fast: 92
  }[ver] || 85;
}

export default function PlanComparisonMatrix({
  cartVersions = {},
  activeVersion = "initial",
  onSelectVersion,
  onClose,
  strings = {},
  language = "en-US"
}) {
  const versions = ["initial", "cheaper", "premium", "fast"];
  const formattedTotal = (val) =>
    new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      maximumFractionDigits: 0
    }).format(val);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md overflow-y-auto flex items-center justify-center p-4">
      <div 
        className="w-full max-w-5xl bg-flow-card border border-flow-border rounded-2xl shadow-card overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-flow-border flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-flow-text flex items-center gap-2">
              ⚖️ {strings.compare_plans || "Compare Crate Variations"}
            </h3>
            <p className="text-sm text-flow-muted mt-1">
              Select the best configuration matching your budget, speed, and gifting goals.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-flow-muted hover:text-flow-text hover:bg-flow-bg-secondary transition-colors font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {/* Matrix Grid */}
        <div className="flex-1 overflow-x-auto p-6">
          <div className="min-w-[800px] grid grid-cols-4 gap-4 pb-4">
            {versions.map((ver) => {
              const items = cartVersions[ver] || [];
              const totalCost = items.reduce((sum, it) => sum + ((it.price?.amount ?? it.price ?? 0) * (it.quantity ?? 1)), 0);
              const isActive = activeVersion === ver;
              const curationScore = getPlanCurationScore(ver, items);

              return (
                <div
                  key={ver}
                  className={`flex flex-col rounded-xl border p-5 transition-all ${
                    isActive
                      ? "border-kapruka-red bg-kapruka-red/[0.02] shadow-[0_0_15px_rgba(216,0,0,0.06)]"
                      : "border-flow-border bg-flow-bg-secondary/40 hover:border-flow-border/80"
                  }`}
                >
                  {/* Badge */}
                  <div className="flex justify-between items-start mb-3">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-pill uppercase tracking-wider ${
                        ver === "initial"
                          ? "bg-blue-500/10 text-blue-400"
                          : ver === "cheaper"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : ver === "premium"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-purple-500/10 text-purple-400"
                      }`}
                    >
                      {ver === "initial"
                        ? strings.ideal_plan || "Ideal Plan"
                        : ver === "cheaper"
                          ? strings.cheaper || "Budget Saver"
                          : ver === "premium"
                            ? strings.premium || "Premium Upgrade"
                            : strings.fast_delivery || "Fast Same-Day"}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-kapruka-red bg-kapruka-red/10 px-2 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Title & Cost */}
                  <div className="mb-4">
                    <p className="text-2xl font-black text-flow-text font-mono">
                      {formattedTotal(totalCost)}
                    </p>
                    <p className="text-xs text-flow-muted mt-0.5">
                      {items.length} {items.length === 1 ? "item" : "items"}
                    </p>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-flow-secondary leading-relaxed min-h-[40px] mb-4">
                    {getPlanDescription(ver, language)}
                  </p>

                  {/* Ratings Row */}
                  <div className="space-y-2 border-t border-flow-border py-4 my-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-flow-muted">Curation Score:</span>
                      <span className="font-bold text-flow-text flex items-center gap-1">
                        ✨ {curationScore}/100
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-flow-muted">Delivery Speed:</span>
                      <span className="font-semibold text-flow-text">
                        {ver === "fast" ? "⚡ Same-Day" : "🚚 Standard (Next-Day)"}
                      </span>
                    </div>
                  </div>

                  {/* Itemized List */}
                  <div className="flex-1 space-y-2 min-h-[160px] max-h-[220px] overflow-y-auto pr-1 border-t border-flow-border pt-4">
                    {items.length === 0 ? (
                      <p className="text-xs text-flow-muted italic">Empty plan</p>
                    ) : (
                      items.map((item) => (
                        <div key={item.id} className="flex justify-between items-start gap-1 text-[11px] leading-tight">
                          <span className="text-flow-secondary truncate max-w-[130px]" title={item.name}>
                            {item.name}
                          </span>
                          <span className="text-flow-muted font-mono shrink-0">
                            x{item.quantity ?? 1}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Selection Button */}
                  <button
                    type="button"
                    disabled={isActive || items.length === 0}
                    onClick={() => {
                      onSelectVersion(ver);
                      onClose();
                    }}
                    className={`mt-4 w-full py-2.5 rounded-xl font-bold text-xs transition-all ${
                      isActive
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                        : items.length === 0
                          ? "bg-slate-900/40 text-slate-600 cursor-not-allowed"
                          : "bg-kapruka-red hover:bg-kapruka-red-hover text-white shadow-md hover:-translate-y-0.5"
                    }`}
                  >
                    {isActive ? "Currently Selected" : "Activate Plan"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
