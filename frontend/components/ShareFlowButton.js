import { useState } from "react";

export default function ShareFlowButton({ sessionId, strings }) {
  const [copied, setCopied] = useState(false);

  if (!sessionId) return null;

  const activeStrings = strings || {
    share_flow: "Share Flow",
    link_copied: "Link copied!",
  };

  async function handleCopy() {
    const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="w-full btn-secondary min-h-[48px] text-base font-semibold flex items-center justify-center gap-2"
    >
      {copied ? `✓ ${activeStrings.link_copied}` : `🔗 ${activeStrings.share_flow}`}
    </button>
  );
}
