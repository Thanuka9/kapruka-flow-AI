const STEP_ORDER = ["understanding", "finding", "budget", "delivery", "cart"];

export default function McpActivityTicker({ events = [], strings }) {
  if (!events.length) return null;

  const s = strings || {};

  return (
    <div className="w-full mt-2 p-4 bg-flow-bg-secondary rounded-2xl border border-flow-border text-left">
      <div className="flex items-center gap-2 mb-3">
        <span className="trust-badge-dot" />
        <span className="text-label font-semibold text-flow-text">
          {s.mcp_live || "Live MCP"}
        </span>
      </div>
      <div className="max-h-28 overflow-y-auto space-y-2">
        {events.map((evt, idx) => (
          <div key={`${evt.step}-${idx}`} className="text-base text-flow-secondary leading-snug flex gap-2">
            <span className="text-semantic-success shrink-0">✓</span>
            <span>{evt.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function stepIndexForEvent(step) {
  const idx = STEP_ORDER.indexOf(step);
  return idx >= 0 ? idx : 0;
}
