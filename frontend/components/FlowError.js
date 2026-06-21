export default function FlowError({ message, onRetry, onDismiss, strings }) {
  if (!message) return null;

  const activeStrings = strings || {
    flow_error_title: "Something went wrong",
    try_again: "Try Again",
    dismiss: "Dismiss",
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-fadeIn">
      <div className="bg-[#0f172a] border border-red-900/40 rounded-card p-5 shadow-2xl flex items-start gap-4">
        <span className="text-semantic-error text-2xl shrink-0">⚠</span>
        <div className="flex-1 min-w-0">
          <p className="text-flow-text font-bold text-lg">{activeStrings.flow_error_title}</p>
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
