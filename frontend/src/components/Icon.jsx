// Custom line-icon set for KIBO360 — no emoji.
// 24x24 grid, stroke = currentColor so icons inherit color from their container.

const paths = {
  network: (
    <>
      <circle cx="12" cy="5" r="2.4" />
      <circle cx="5" cy="18" r="2.4" />
      <circle cx="19" cy="18" r="2.4" />
      <path d="M10.6 6.7 6.6 15.9M13.4 6.7l4 9.2M7.4 18h9.2" />
    </>
  ),
  workflow: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  heart: <path d="M12 21C12 21 4 15.4 4 9.4A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 20 9.4C20 15.4 12 21 12 21Z" />,
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4.5" />
    </>
  ),
  "trending-up": (
    <>
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  "chart-down": (
    <>
      <path d="M3 7 9 13l4-4 8 8" />
      <path d="M21 12v6h-6" />
    </>
  ),
  cloud: <path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 3.5 3.5 0 0 0 7 18Z" />,
  cpu: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  smartphone: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  link: (
    <>
      <path d="M9 15 15 9" />
      <path d="M10.5 6.5 12 5a3.5 3.5 0 0 1 5 5l-1.5 1.5M13.5 17.5 12 19a3.5 3.5 0 0 1-5-5l1.5-1.5" />
    </>
  ),
  hospital: (
    <>
      <path d="M4 21V8l8-5 8 5v13" />
      <path d="M9 21v-5h6v5" />
      <path d="M12 6.5v4M10 8.5h4" />
    </>
  ),
  buildings: (
    <>
      <rect x="3" y="8" width="8" height="13" rx="1" />
      <rect x="13" y="3" width="8" height="18" rx="1" />
      <path d="M6 12h2M6 16h2M16 7h2M16 11h2M16 15h2" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6M10 3v6l-5 8a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-8V3" />
      <path d="M7.5 15h9" />
    </>
  ),
  cap: (
    <>
      <path d="m2 8 10-4 10 4-10 4L2 8Z" />
      <path d="M6 10v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
      <path d="M22 8v5" />
    </>
  ),
  stethoscope: (
    <>
      <path d="M6 3v6a4 4 0 0 0 8 0V3" />
      <path d="M6 3H4.5M14 3h-1.5" />
      <path d="M10 15v.5a4.5 4.5 0 0 0 9 0V13" />
      <circle cx="19" cy="11" r="2" />
    </>
  ),
  "file-text": (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21V3Z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  banknote: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 10v4M18 10v4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  box: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1Z" />
      <path d="M17 8.5a4 4 0 0 1 0 7" />
    </>
  ),
  folders: <path d="M4 7a2 2 0 0 1 2-2h3l2 2h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />,
  "bell-off": (
    <>
      <path d="M9 5.2A5 5 0 0 1 17 9c0 3 1 5 2 6H9M6.5 9c0 3-1 5-2 6h2" />
      <path d="M10 19a2 2 0 0 0 4 0" />
      <path d="m3 3 18 18" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 9.5h16M8 3v4M16 3v4" />
    </>
  ),
  pill: (
    <>
      <rect x="2.6" y="8.5" width="18.8" height="7" rx="3.5" transform="rotate(-45 12 12)" />
      <path d="M8.8 8.8 15.2 15.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 20c0-3 2.2-5 5-5s5 2 5 5" />
      <path d="M15 5.5a3 3 0 0 1 0 6M20.5 20c0-2.5-1.6-4.5-4-5" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="12" height="12" rx="2" />
      <path d="m15 10 6-3v10l-6-3" />
    </>
  ),
  message: <path d="M21 12a8 8 0 0 1-8 8 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8 8 0 1 1 21 12Z" />,
  "bar-chart": (
    <>
      <path d="M3 21h18" />
      <path d="M6 21v-7M12 21V6M18 21v-9" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.6 6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-6-3.6-9S9.5 5.6 12 3Z" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  rocket: (
    <>
      <path d="M9 13c1.8-6 5-9 11-9 0 6-3 9.2-9 11l-2-2Z" />
      <path d="M9 13 5.5 12C4.5 13 4 16 4 16s3-.5 4-1.5L11 15" />
      <circle cx="14.5" cy="9.5" r="1.4" />
    </>
  ),
  sparkle: <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
};

export default function Icon({ name, size = 20, className = "", strokeWidth = 1.7 }) {
  const glyph = paths[name];
  if (!glyph) return null;
  return (
    <svg
      className={`lx-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyph}
    </svg>
  );
}
