import { useEffect, useState } from "react";

const CITY_COORDS = {
  colombo: { x: 65, y: 210, name: "Colombo" },
  kandy: { x: 95, y: 180, name: "Kandy" },
  galle: { x: 75, y: 260, name: "Galle" },
  negombo: { x: 63, y: 190, name: "Negombo" },
  jaffna: { x: 70, y: 50, name: "Jaffna" },
  gampaha: { x: 68, y: 198, name: "Gampaha" },
  kaduwela: { x: 73, y: 208, name: "Kaduwela" },
  kurunegala: { x: 80, y: 170, name: "Kurunegala" },
  anuradhapura: { x: 90, y: 120, name: "Anuradhapura" },
  batticaloa: { x: 140, y: 150, name: "Batticaloa" },
  matara: { x: 85, y: 270, name: "Matara" },
  kalutara: { x: 68, y: 230, name: "Kalutara" },
};

function getCityCoordinates(cityString = "") {
  const clean = cityString.toLowerCase().trim();
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (clean.includes(key)) {
      return coords;
    }
  }
  // Default fallback if not found (e.g. nearby Colombo suburb or Gampaha)
  return { x: 72, y: 202, name: cityString || "Gampaha" };
}

export default function LiveDeliveryMap({ city = "Colombo" }) {
  const start = CITY_COORDS.colombo;
  const dest = getCityCoordinates(city);
  
  // Create a curved route: Quadratic Bezier Curve from Colombo to Destination
  // Control point is slightly offset to create a natural curve
  const cx = (start.x + dest.x) / 2 + 15;
  const cy = (start.y + dest.y) / 2 - 10;
  const pathData = `M ${start.x} ${start.y} Q ${cx} ${cy}, ${dest.x} ${dest.y}`;

  return (
    <div className="relative mt-4 border border-white/10 rounded-xl bg-slate-900/60 p-4 overflow-hidden flex flex-col items-center">
      {/* Map Header */}
      <div className="w-full flex items-center justify-between mb-3 text-xs">
        <span className="text-slate-400 font-semibold tracking-wide">📍 Delivery Route Transit Map</span>
        <span className="text-emerald-400 font-bold font-mono animate-pulse">● Live Tracking</span>
      </div>

      {/* Grid Layout: Map Left, Details Right */}
      <div className="w-full flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* SVG Sri Lanka outline + Transit Path */}
        <div className="relative w-36 h-52 bg-slate-950/40 rounded-lg p-1 border border-white/5 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 200 300" className="w-full h-full text-slate-800">
            {/* Sri Lanka simplified vector outline path */}
            <path
              d="M 70 30 C 65 35, 60 50, 62 60 C 63 70, 75 90, 80 100 C 85 110, 82 120, 80 130 C 78 140, 72 150, 68 160 C 64 170, 62 185, 62 195 C 62 205, 65 215, 66 225 C 67 235, 64 245, 66 255 C 68 265, 75 275, 82 278 C 89 281, 95 278, 105 272 C 115 266, 122 250, 125 240 C 128 230, 135 210, 134 195 C 133 180, 138 165, 140 150 C 142 135, 138 120, 130 105 C 122 90, 125 75, 122 65 C 119 55, 100 42, 90 38 C 80 34, 75 26, 70 30 Z"
              fill="rgba(30, 41, 59, 0.4)"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="2.5"
            />

            {/* Pulsing route line */}
            <path
              d={pathData}
              fill="none"
              stroke="rgba(246, 195, 67, 0.45)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="4 4"
              className="animate-route-shimmer"
            />

            {/* Start Node: Colombo */}
            <circle cx={start.x} cy={start.y} r="4.5" fill="#D80000" className="animate-pulse" />
            <text x={start.x - 36} y={start.y + 4} fontSize="9" fontWeight="bold" fill="#f8fafc">
              Colombo
            </text>

            {/* End Node: Destination */}
            {dest.name !== "Colombo" && (
              <>
                <circle cx={dest.x} cy={dest.y} r="4.5" fill="#f6c343" />
                <text x={dest.x + 8} y={dest.y + 3} fontSize="9" fontWeight="bold" fill="#fae555">
                  {dest.name}
                </text>
              </>
            )}

            {/* Delivery truck moving along path */}
            <g
              style={{
                offsetPath: `path('${pathData}')`,
                animation: "truckTransit 6s linear infinite"
              }}
              className="relative"
            >
              <rect x="-6" y="-4" width="12" height="8" rx="2" fill="#D80000" />
              <rect x="2" y="-3" width="3" height="6" fill="#f8fafc" />
              <circle cx="-3" cy="4" r="1.8" fill="#1e293b" />
              <circle cx="3" cy="4" r="1.8" fill="#1e293b" />
            </g>
          </svg>
        </div>

        {/* Transit Details Column */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Dispatch Location:</span>
              <span className="font-semibold text-white">Kapruka HQ, Colombo</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Destination:</span>
              <span className="font-semibold text-kapruka-gold truncate max-w-[130px]">{dest.name}</span>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2 mt-1">
              <span className="text-slate-400">Est. Transit Time:</span>
              <span className="font-bold text-white font-mono">1 hr 45 min</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 italic leading-relaxed">
            * Delivery dispatching in Colombo 02. The truck's live route updates as Kapruka's logistics agents pack and ship the crate.
          </div>
        </div>

      </div>
    </div>
  );
}
