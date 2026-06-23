import { useId } from "react";

/**
 * Glossy "3D" SVG icon set — gradient fills, specular highlights and soft
 * depth shadows, no external assets. Use in place of flat emojis.
 *
 * <Icon3D name="cart" size={20} float tilt />
 */

function Defs({ id, from, to, hi = "#ffffff" }) {
  return (
    <defs>
      <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0%" stopColor={from} />
        <stop offset="100%" stopColor={to} />
      </linearGradient>
      <radialGradient id={`${id}-hi`} cx="0.32" cy="0.22" r="0.7">
        <stop offset="0%" stopColor={hi} stopOpacity="0.85" />
        <stop offset="45%" stopColor={hi} stopOpacity="0.15" />
        <stop offset="100%" stopColor={hi} stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/* Each icon draws in a 24x24 viewBox. `id` namespaces gradient defs. */
const ICONS = {
  cart: (id) => (
    <>
      <Defs id={id} from="#FFD86B" to="#E8960B" />
      <path
        d="M3 4h2.2l1.1 2.4 1.7 7.1c.2.9 1 1.5 1.9 1.5h7.3c.9 0 1.7-.6 1.9-1.5L21 8.2c.2-.8-.4-1.6-1.3-1.6H6.6"
        fill="none" stroke={`url(#${id}-g)`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="10.2" cy="19.4" r="1.9" fill={`url(#${id}-g)`} />
      <circle cx="17.4" cy="19.4" r="1.9" fill={`url(#${id}-g)`} />
      <path d="M7 7h13l-1.6 6H8.5L7 7z" fill={`url(#${id}-g)`} opacity="0.9" />
      <path d="M7 7h13l-1.6 6H8.5L7 7z" fill={`url(#${id}-hi)`} />
    </>
  ),
  gift: (id) => (
    <>
      <Defs id={id} from="#FF6B6B" to="#C81E1E" />
      <rect x="3.5" y="9" width="17" height="11.5" rx="2.2" fill={`url(#${id}-g)`} />
      <rect x="3.5" y="9" width="17" height="11.5" rx="2.2" fill={`url(#${id}-hi)`} />
      <rect x="2.6" y="6" width="18.8" height="4.6" rx="1.6" fill={`url(#${id}-g)`} />
      <rect x="2.6" y="6" width="18.8" height="4.6" rx="1.6" fill={`url(#${id}-hi)`} />
      <rect x="10.7" y="6" width="2.6" height="14.5" rx="1.1" fill="#FFD86B" />
      <path d="M12 6c-1.8-3-5.4-3.4-5.4-1 0 1.8 3 1.6 5.4 1zm0 0c1.8-3 5.4-3.4 5.4-1 0 1.8-3 1.6-5.4 1z" fill="#FFD86B" />
    </>
  ),
  sparkle: (id) => (
    <>
      <Defs id={id} from="#FFE08A" to="#F0A50A" />
      <path d="M12 2.5l2.1 6.1 6.4 1.4-6.4 1.9L12 18.5l-2.1-6.6-6.4-1.9 6.4-1.4L12 2.5z" fill={`url(#${id}-g)`} />
      <path d="M12 2.5l2.1 6.1 6.4 1.4-6.4 1.9L12 18.5l-2.1-6.6-6.4-1.9 6.4-1.4L12 2.5z" fill={`url(#${id}-hi)`} />
      <path d="M19 15.5l.9 2.4 2.6.6-2.6.8-.9 2.7-.9-2.7-2.6-.8 2.6-.6.9-2.4z" fill={`url(#${id}-g)`} />
    </>
  ),
  bolt: (id) => (
    <>
      <Defs id={id} from="#7DD3FC" to="#0369A1" />
      <path d="M13.4 2L4.5 13.4h5.4L9.6 22l9-11.6h-5.5L13.4 2z" fill={`url(#${id}-g)`} />
      <path d="M13.4 2L4.5 13.4h5.4L9.6 22l9-11.6h-5.5L13.4 2z" fill={`url(#${id}-hi)`} />
    </>
  ),
  pin: (id) => (
    <>
      <Defs id={id} from="#FF8A8A" to="#B91C1C" />
      <path d="M12 2.2c-4 0-7.2 3.1-7.2 7 0 5.2 7.2 12.6 7.2 12.6s7.2-7.4 7.2-12.6c0-3.9-3.2-7-7.2-7z" fill={`url(#${id}-g)`} />
      <path d="M12 2.2c-4 0-7.2 3.1-7.2 7 0 5.2 7.2 12.6 7.2 12.6s7.2-7.4 7.2-12.6c0-3.9-3.2-7-7.2-7z" fill={`url(#${id}-hi)`} />
      <circle cx="12" cy="9.1" r="2.8" fill="#fff" opacity="0.95" />
    </>
  ),
  coin: (id) => (
    <>
      <Defs id={id} from="#FFE08A" to="#D97706" />
      <ellipse cx="12" cy="12" rx="9.2" ry="9.2" fill={`url(#${id}-g)`} />
      <ellipse cx="12" cy="12" rx="9.2" ry="9.2" fill={`url(#${id}-hi)`} />
      <circle cx="12" cy="12" r="6.4" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.4" />
      <text x="12" y="16" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#7C2D12">₨</text>
    </>
  ),
  truck: (id) => (
    <>
      <Defs id={id} from="#86EFAC" to="#15803D" />
      <rect x="1.8" y="6" width="12.6" height="9.4" rx="1.6" fill={`url(#${id}-g)`} />
      <rect x="1.8" y="6" width="12.6" height="9.4" rx="1.6" fill={`url(#${id}-hi)`} />
      <path d="M14.4 9h4.1l3 3.4v3h-7.1V9z" fill={`url(#${id}-g)`} />
      <circle cx="7" cy="17.4" r="2.2" fill="#1E293B" />
      <circle cx="7" cy="17.4" r="1" fill="#94A3B8" />
      <circle cx="17.6" cy="17.4" r="2.2" fill="#1E293B" />
      <circle cx="17.6" cy="17.4" r="1" fill="#94A3B8" />
    </>
  ),
  box: (id) => (
    <>
      <Defs id={id} from="#FDBA74" to="#C2540A" />
      <path d="M12 2.8l8.6 4.3v9.8L12 21.2l-8.6-4.3V7.1L12 2.8z" fill={`url(#${id}-g)`} />
      <path d="M12 2.8l8.6 4.3v9.8L12 21.2l-8.6-4.3V7.1L12 2.8z" fill={`url(#${id}-hi)`} />
      <path d="M3.4 7.1L12 11.4l8.6-4.3M12 11.4v9.8" fill="none" stroke="#7C2D12" strokeOpacity="0.45" strokeWidth="1.3" />
      <path d="M7.7 4.9l8.6 4.3v3l-2.2 1.1V9.2L5.5 6l2.2-1.1z" fill="#FFEDD5" opacity="0.8" />
    </>
  ),
  star: (id) => (
    <>
      <Defs id={id} from="#FFE08A" to="#EA9D0A" />
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4L2.6 9.4l6.5-.9L12 2.6z" fill={`url(#${id}-g)`} />
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4L2.6 9.4l6.5-.9L12 2.6z" fill={`url(#${id}-hi)`} />
    </>
  ),
  flower: (id) => (
    <>
      <Defs id={id} from="#FDA4AF" to="#E11D48" />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <ellipse
          key={deg}
          cx="12" cy="6.6" rx="3" ry="4.6"
          transform={`rotate(${deg} 12 12)`}
          fill={`url(#${id}-g)`}
          opacity="0.92"
        />
      ))}
      <circle cx="12" cy="12" r="3.4" fill="#FFD86B" />
      <circle cx="12" cy="12" r="3.4" fill={`url(#${id}-hi)`} />
    </>
  ),
  home: (id) => (
    <>
      <Defs id={id} from="#A5B4FC" to="#4338CA" />
      <path d="M3.4 11.2L12 3.6l8.6 7.6h-2.2v8.2a1.4 1.4 0 01-1.4 1.4h-10a1.4 1.4 0 01-1.4-1.4v-8.2H3.4z" fill={`url(#${id}-g)`} />
      <path d="M3.4 11.2L12 3.6l8.6 7.6h-2.2v8.2a1.4 1.4 0 01-1.4 1.4h-10a1.4 1.4 0 01-1.4-1.4v-8.2H3.4z" fill={`url(#${id}-hi)`} />
      <rect x="9.8" y="13.4" width="4.4" height="7.4" rx="0.9" fill="#FFEDD5" opacity="0.95" />
    </>
  ),
  chat: (id) => (
    <>
      <Defs id={id} from="#94A3B8" to="#334155" />
      <path d="M4 4.6h16a1.8 1.8 0 011.8 1.8v9a1.8 1.8 0 01-1.8 1.8h-8.4L7 21v-3.8H4a1.8 1.8 0 01-1.8-1.8v-9A1.8 1.8 0 014 4.6z" fill={`url(#${id}-g)`} />
      <path d="M4 4.6h16a1.8 1.8 0 011.8 1.8v9a1.8 1.8 0 01-1.8 1.8h-8.4L7 21v-3.8H4a1.8 1.8 0 01-1.8-1.8v-9A1.8 1.8 0 014 4.6z" fill={`url(#${id}-hi)`} />
      <circle cx="8" cy="11" r="1.2" fill="#fff" />
      <circle cx="12" cy="11" r="1.2" fill="#fff" />
      <circle cx="16" cy="11" r="1.2" fill="#fff" />
    </>
  ),
  shield: (id) => (
    <>
      <Defs id={id} from="#6EE7B7" to="#047857" />
      <path d="M12 2.4l8 3v6.2c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V5.4l8-3z" fill={`url(#${id}-g)`} />
      <path d="M12 2.4l8 3v6.2c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V5.4l8-3z" fill={`url(#${id}-hi)`} />
      <path d="M8.4 12l2.4 2.5 4.8-5" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  bag: (id) => (
    <>
      <Defs id={id} from="#F0ABFC" to="#A21CAF" />
      <path d="M5 8.4h14l-1 11a2 2 0 01-2 1.8H8a2 2 0 01-2-1.8l-1-11z" fill={`url(#${id}-g)`} />
      <path d="M5 8.4h14l-1 11a2 2 0 01-2 1.8H8a2 2 0 01-2-1.8l-1-11z" fill={`url(#${id}-hi)`} />
      <path d="M8.6 10.6V7a3.4 3.4 0 016.8 0v3.6" fill="none" stroke="#701A75" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  user: (id) => (
    <>
      <Defs id={id} from="#93C5FD" to="#2563EB" />
      <circle cx="12" cy="8" r="4" fill={`url(#${id}-g)`} />
      <circle cx="12" cy="8" r="4" fill={`url(#${id}-hi)`} />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6H5z" fill={`url(#${id}-g)`} />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6H5z" fill={`url(#${id}-hi)`} />
    </>
  ),
};

export default function Icon3D({
  name = "sparkle",
  size = 20,
  float = false,
  tilt = false,
  spin = false,
  className = "",
  title,
}) {
  const id = useId().replace(/[:]/g, "");
  const draw = ICONS[name] || ICONS.sparkle;
  const cls = [
    "icon-3d",
    float ? "icon-3d-float" : "",
    tilt ? "icon-3d-tilt" : "",
    spin ? "icon-3d-spin" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls} style={{ width: size, height: size }} title={title} aria-hidden={!title}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {draw(id)}
      </svg>
    </span>
  );
}
