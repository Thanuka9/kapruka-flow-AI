import { useState } from "react";
import Icon3D from "./Icon3D";

function getCurationScoreDetails(items = [], budgetLimit = 25000, metadata = {}) {
  const totalCost = items.reduce((sum, it) => sum + ((it.price?.amount ?? it.price ?? 0) * (it.quantity ?? 1)), 0);
  
  // 1. Budget efficiency
  const budgetRatio = totalCost / budgetLimit;
  let budgetScore = 100;
  if (budgetRatio > 1.0) {
    budgetScore = Math.max(50, 100 - Math.round((budgetRatio - 1.0) * 200));
  } else {
    budgetScore = Math.round(budgetRatio * 100);
    if (budgetScore > 98) budgetScore = 98; // keep a tiny gap
  }

  // 2. Variety and completeness
  const categories = new Set(items.map(it => it.category?.toLowerCase() || ""));
  let varietyScore = 75;
  if (categories.has("cakes") || categories.has("cake")) varietyScore += 10;
  if (categories.has("flowers") || categories.has("flower")) varietyScore += 10;
  if (categories.has("chocolates") || categories.has("chocolate")) varietyScore += 5;
  varietyScore = Math.min(100, varietyScore);

  // 3. Recipient match score
  let recipientScore = 90;
  const reasonText = items.map(it => it.reason?.toLowerCase() || "").join(" ");
  const queryText = (metadata.intent_parsed?.query || "").toLowerCase();
  
  if (queryText.includes("amma") || queryText.includes("mother") || queryText.includes("mom")) {
    if (reasonText.includes("mother") || reasonText.includes("amma") || reasonText.includes("rose") || reasonText.includes("flower")) {
      recipientScore = 98;
    }
  } else if (queryText.includes("father") || queryText.includes("dad") || queryText.includes("thaththa")) {
    if (reasonText.includes("father") || reasonText.includes("dad") || reasonText.includes("shaving") || reasonText.includes("hamper")) {
      recipientScore = 98;
    }
  }

  const overall = Math.round((budgetScore * 0.4) + (varietyScore * 0.3) + (recipientScore * 0.3));

  return {
    overall,
    budgetScore,
    varietyScore,
    recipientScore,
    totalCost
  };
}

export default function CurationReport({
  items = [],
  budgetLimit = 25000,
  metadata = {},
  language = "en-US"
}) {
  const [isOpen, setIsOpen] = useState(true);
  const details = getCurationScoreDetails(items, budgetLimit, metadata);

  const query = metadata.intent_parsed?.query || "your request";
  const recipient = metadata.intent_parsed?.recipient || "family";
  const occasion = metadata.intent_parsed?.occasion || "special day";

  let summaryParagraph = `Ruka composed this plan for ${recipient} on their ${occasion}. It utilizes ${Math.round((details.totalCost / budgetLimit) * 100)}% of your LKR ${budgetLimit.toLocaleString()} budget with curated products.`;
  if (language === "si-LK") {
    summaryParagraph = `ඔබගේ LKR ${budgetLimit.toLocaleString()} අයවැයෙන් ${Math.round((details.totalCost / budgetLimit) * 100)}% ක් සාර්ථකව භාවිත කරමින්, ${occasion} වෙනුවෙන් විශේෂයෙන් තෝරාගත් භාණ්ඩ මෙයට ඇතුළත් කර ඇත.`;
  } else if (language === "en-LK") {
    summaryParagraph = `Ruka custom composed this hamper set for ${recipient}'s ${occasion}. Using ${Math.round((details.totalCost / budgetLimit) * 100)}% of your LKR ${budgetLimit.toLocaleString()} budget perfectly.`;
  }

  return (
    <div className="flow-card p-4 border-flow-border bg-flow-card flex flex-col relative overflow-hidden transition-all duration-300">
      {/* Dynamic glow in background */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-kapruka-gold/5 rounded-full filter blur-xl pointer-events-none" />

      {/* Accordion Trigger Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-kapruka-gold/10 border border-kapruka-gold/25 flex items-center justify-center text-lg shadow-sm">
            ✨
          </div>
          <div>
            <h4 className="text-sm font-bold text-flow-text tracking-tight flex items-center gap-1.5">
              AI Curation Analysis
              <span className="text-[10px] font-extrabold uppercase tracking-widest bg-kapruka-gold/15 text-yellow-600 px-2 py-0.5 rounded">
                Score: {details.overall}/100
              </span>
            </h4>
            <p className="text-xs text-flow-muted">
              Evaluation of appropriateness, budget usage, and variety.
            </p>
          </div>
        </div>
        <span className="text-flow-muted text-base transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-flow-border space-y-4 animate-fadeIn">
          {/* Progress Indicators */}
          <div className="grid grid-cols-3 gap-3">
            {/* Budget utilization */}
            <div className="bg-flow-bg-secondary p-3 rounded-xl border border-flow-border/50 text-center">
              <div className="text-[10px] uppercase font-bold tracking-wider text-flow-muted mb-1">Budget Match</div>
              <div className="text-base font-extrabold text-flow-text font-mono">{details.budgetScore}%</div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${details.budgetScore}%` }} />
              </div>
            </div>

            {/* Variety match */}
            <div className="bg-flow-bg-secondary p-3 rounded-xl border border-flow-border/50 text-center">
              <div className="text-[10px] uppercase font-bold tracking-wider text-flow-muted mb-1">Variety Match</div>
              <div className="text-base font-extrabold text-flow-text font-mono">{details.varietyScore}%</div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${details.varietyScore}%` }} />
              </div>
            </div>

            {/* Recipient match */}
            <div className="bg-flow-bg-secondary p-3 rounded-xl border border-flow-border/50 text-center">
              <div className="text-[10px] uppercase font-bold tracking-wider text-flow-muted mb-1">Relevance</div>
              <div className="text-base font-extrabold text-flow-text font-mono">{details.recipientScore}%</div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-purple-500 h-full rounded-full" style={{ width: `${details.recipientScore}%` }} />
              </div>
            </div>
          </div>

          {/* AI Curation Summary Text */}
          <div className="p-3 bg-amber-500/[0.03] border border-kapruka-gold/15 rounded-xl">
            <p className="text-xs text-flow-secondary leading-relaxed">
              <span className="font-bold text-kapruka-gold mr-1.5">✦ Ruka's Insights:</span>
              {summaryParagraph}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
