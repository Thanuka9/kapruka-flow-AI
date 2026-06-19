import { motion } from "framer-motion";

export function computePlanDiff(previousItems = [], nextItems = []) {
  const prevIds = new Set(previousItems.map((item) => item.id));
  const nextIds = new Set(nextItems.map((item) => item.id));

  const added = nextItems.filter((item) => !prevIds.has(item.id));
  const removed = previousItems.filter((item) => !nextIds.has(item.id));
  const kept = nextItems.filter((item) => prevIds.has(item.id));

  return { added, removed, kept };
}

export default function PlanDiff({ diff, strings, activeVersion }) {
  const s = strings || {
    plan_changes: "Plan Changes",
    added: "Added",
    removed: "Removed",
  };

  if (!diff) {
    return null;
  }

  const hasChanges = diff.added.length > 0 || diff.removed.length > 0;

  if (!hasChanges) {
    let note = "";
    if (activeVersion === "cheaper") {
      note = "This version is identical to the previous one because the selected items are already the most budget-friendly options.";
    } else if (activeVersion === "premium") {
      note = "This version is identical to the previous one because no higher-priced alternatives were found in the catalog.";
    } else if (activeVersion === "fast") {
      note = "This version is identical to the previous one because all selected items already support the fastest delivery.";
    } else {
      note = "This version matches your initial ideal shopping plan.";
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="flow-card p-4 border-flow-border bg-flow-bg-secondary text-sm text-flow-muted flex items-center gap-2"
      >
        <span>ℹ️</span>
        <div>
          <span className="font-semibold text-flow-secondary">Plan Note:</span> {note}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flow-card p-5 border-kapruka-gold/30 bg-amber-50/50 space-y-3"
    >
      <h4 className="text-lg font-bold text-flow-text">
        {s.plan_changes}
      </h4>
      {diff.added.length > 0 && (
        <div className="text-base text-semantic-success">
          <span className="font-semibold mr-1">{s.added}:</span>
          {diff.added.map((item) => item.name).join(", ")}
        </div>
      )}
      {diff.removed.length > 0 && (
        <div className="text-base text-semantic-error">
          <span className="font-semibold mr-1">{s.removed}:</span>
          {diff.removed.map((item) => item.name).join(", ")}
        </div>
      )}
    </motion.div>
  );
}
