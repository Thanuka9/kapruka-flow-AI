export default function FlowError({ message, onRetry, onDismiss, strings, errorType = "generic" }) {
  if (!message) return null;

  const activeStrings = strings || {
    flow_error_title: "Something went wrong",
    flow_error_rate_limit: "Too many requests — please wait a moment and try again.",
    flow_error_mcp: "Kapruka catalog is temporarily unavailable. Try again shortly.",
    network_fail: "Network error — check your connection and try again.",
    try_again: "Try Again",
    dismiss: "Dismiss",
  };

  const config = {
    rate_limit: {
      icon: "⏳",
      title: activeStrings.flow_error_rate_limit_title || "Slow down",
      border: "border-amber-900/40",
      iconColor: "text-amber-400",
    },
    network: {
      icon: "📡",
      title: activeStrings.network_fail_title || "Connection issue",
      border: "border-sky-900/40",
      iconColor: "text-sky-400",
    },
    mcp: {
      icon: "🔌",
      title: activeStrings.flow_error_mcp_title || "Catalog unavailable",
      border: "border-orange-900/40",
      iconColor: "text-orange-400",
    },
    no_products: {
      icon: "🔍",
      title: activeStrings.no_products_title || "No products found",
      border: "border-slate-700/60",
      iconColor: "text-slate-300",
    },
    generic: {
      icon: "⚠",
      title: activeStrings.flow_error_title,
      border: "border-red-900/40",
      iconColor: "text-semantic-error",
    },
  };

  const style = config[errorType] || config.generic;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-fadeIn">
      <div className={`bg-[#0f172a] border ${style.border} rounded-card p-5 shadow-2xl flex items-start gap-4`}>
        <span className={`${style.iconColor} text-2xl shrink-0`}>{style.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-flow-text font-bold text-lg">{style.title}</p>
          <p className="text-flow-secondary text-base mt-1 leading-relaxed">{message}</p>
          <div className="flex gap-3 mt-4">
            {onRetry && (
              <button type="button" onClick={onRetry} className="btn-primary min-h-[44px] px-5">
                {activeStrings.try_again}
              </button>
            )}
            {onDismiss && (
              <button type="button" onClick={onDismiss} className="btn-secondary min-h-[44px] px-5">
                {activeStrings.dismiss}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
