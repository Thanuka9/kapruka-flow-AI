import { useEffect, useState } from "react";
import McpActivityTicker, { stepIndexForEvent } from "./McpActivityTicker";
import { KapriAvatar } from "./AgentPersona";

const STEP_INTERVAL_MS = 180;
const COMPLETE_DELAY_MS = 280;
const STAGED_TICK_MS = 350;
const FAST_STEP_INTERVAL_MS = 90;
const FAST_COMPLETE_DELAY_MS = 120;
const FAST_STAGED_TICK_MS = 180;

export default function AIWorkspace({
  active = false,
  apiComplete = false,
  pipelineEvents = [],
  onComplete,
  strings,
  fastMode = false,
}) {
  const stepInterval = fastMode ? FAST_STEP_INTERVAL_MS : STEP_INTERVAL_MS;
  const completeDelay = fastMode ? FAST_COMPLETE_DELAY_MS : COMPLETE_DELAY_MS;
  const stagedTick = fastMode ? FAST_STAGED_TICK_MS : STAGED_TICK_MS;
  const [currentStep, setCurrentStep] = useState(0);
  const [displayedEvents, setDisplayedEvents] = useState([]);

  const s = strings || {};
  const STEPS = [
    { key: "understanding", label: s.step_understanding || "Understanding", icon: "🧠" },
    { key: "finding", label: s.step_finding || "Searching", icon: "🔍" },
    { key: "budget", label: s.step_budget || "Curating", icon: "✨" },
    { key: "delivery", label: s.step_delivery || "Delivery", icon: "🚚" },
    { key: "cart", label: s.step_cart || "Ready", icon: "✓" },
  ];

  const latestEvent = displayedEvents[displayedEvents.length - 1];
  const message = !apiComplete
    ? s.mcp_connecting || "Connecting to Kapruka MCP..."
    : latestEvent?.message || s.waiting_pipeline || "Building your cart...";

  useEffect(() => {
    if (!active) {
      setCurrentStep(0);
      setDisplayedEvents([]);
      return;
    }
    setDisplayedEvents([]);
    setCurrentStep(0);
  }, [active]);

  /* Staged progress while API is in flight — perceived <300ms response */
  useEffect(() => {
    if (!active || apiComplete) return undefined;
    setCurrentStep(1);
    let step = 1;
    const tick = setInterval(() => {
      step = Math.min(step + 1, STEPS.length - 2);
      setCurrentStep(step);
    }, stagedTick);
    return () => clearInterval(tick);
  }, [active, apiComplete, stagedTick, STEPS.length]);

  useEffect(() => {
    if (!active || !apiComplete) return undefined;

    if (!pipelineEvents.length) {
      setCurrentStep(STEPS.length - 1);
      const timer = setTimeout(() => onComplete?.(), completeDelay);
      return () => clearTimeout(timer);
    }

    let eventIdx = 0;
    setDisplayedEvents([pipelineEvents[0]]);
    setCurrentStep(stepIndexForEvent(pipelineEvents[0].step));

    const interval = setInterval(() => {
      eventIdx += 1;
      if (eventIdx >= pipelineEvents.length) {
        clearInterval(interval);
        setCurrentStep(STEPS.length - 1);
        setTimeout(() => onComplete?.(), completeDelay);
        return;
      }
      const evt = pipelineEvents[eventIdx];
      setDisplayedEvents((prev) => [...prev, evt]);
      setCurrentStep(stepIndexForEvent(evt.step));
    }, stepInterval);

    return () => clearInterval(interval);
  }, [active, apiComplete, pipelineEvents, onComplete, STEPS.length, stepInterval, completeDelay]);

  if (!active) return null;

  const progressPercent = apiComplete
    ? Math.min(((currentStep + 1) / STEPS.length) * 100, 100)
    : Math.max(12, ((currentStep + 1) / STEPS.length) * 45);

  return (
    <div className="w-full max-w-lg mx-auto glass-panel p-6 md:p-8 text-center animate-fadeIn">
      <div className="flex items-center justify-center gap-3 mb-5">
        <KapriAvatar size={44} pulse={!apiComplete || currentStep < STEPS.length - 1} />
        <div className="text-left min-w-0">
          <h2 className="text-lg font-bold text-flow-text">
            {s.curation_in_progress || "Curating your cart"}
          </h2>
          <p className="text-sm text-flow-muted truncate animate-progress-pulse">{message}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4 text-left">
        {STEPS.map((step, idx) => {
          const done = currentStep > idx;
          const activeStep = currentStep === idx;
          return (
            <div
              key={step.key}
              className={`flex items-center gap-3 p-2.5 rounded-xl transition-all duration-150 ${
                done
                  ? "bg-green-50 border border-green-100"
                  : activeStep
                    ? "bg-flow-bg-secondary border border-flow-border"
                    : "opacity-45"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  done
                    ? "bg-semantic-success text-white"
                    : activeStep
                      ? "bg-kapruka-red text-white"
                      : "bg-flow-bg-secondary text-flow-muted border border-flow-border"
                }`}
              >
                {done ? "✓" : step.icon}
              </div>
              <span className={`text-sm font-semibold ${activeStep ? "text-flow-text" : "text-flow-secondary"}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <McpActivityTicker events={displayedEvents} strings={strings} />

      <div className="w-full h-2 bg-flow-bg-secondary rounded-pill overflow-hidden mt-4">
        <div
          className="h-full bg-kapruka-red transition-all duration-300 ease-out rounded-pill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
