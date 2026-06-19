import { useEffect, useState } from "react";

/** Brief number pulse when budget totals change. */
export default function AnimatedTotal({ value, className = "" }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 450);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <span className={`${className} ${pulse ? "total-animate" : ""}`}>{value}</span>
  );
}
