import type { SVGProps } from 'react';

/**
 * Unified icon set — all icons inherit currentColor so they adapt to the
 * black/white/blue palette via text color utilities.
 */
const PATHS: Record<string, JSX.Element> = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" strokeLinecap="round" strokeLinejoin="round" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></>,
  cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M3 4h2l2.5 12h10L20 8H7" strokeLinecap="round" strokeLinejoin="round" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" strokeLinecap="round" /></>,
  package: <><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" strokeLinejoin="round" /><path d="M4 7l8 4 8-4M12 11v10" strokeLinejoin="round" /></>,
  store: <><path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" strokeLinecap="round" strokeLinejoin="round" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" /></>,
  shield: <><path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6l-7-3Z" strokeLinejoin="round" /><path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" strokeLinejoin="round" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" /></>,
  plus: <path d="M12 5v14M5 12h14" strokeLinecap="round" />,
  minus: <path d="M5 12h14" strokeLinecap="round" />,
  x: <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />,
  check: <path d="m4 12.5 5 5L20 6.5" strokeLinecap="round" strokeLinejoin="round" />,
  chevronRight: <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />,
  chevronLeft: <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />,
  chevronDown: <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />,
  arrowLeft: <path d="M19 12H5m6-7-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />,
  filter: <path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" strokeLinejoin="round" />,
  star: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3Z" strokeLinejoin="round" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" /></>,
  location: <><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" strokeLinejoin="round" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" strokeLinejoin="round" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" strokeLinecap="round" /></>,
  mobile: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" strokeLinecap="round" /></>,
  bank: <><path d="M3 9 12 4l9 5M4 9v10M20 9v10M8 12v5M12 12v5M16 12v5M2 19h20" strokeLinecap="round" strokeLinejoin="round" /></>,
  alert: <><path d="M12 3 2 20h20L12 3Z" strokeLinejoin="round" /><path d="M12 10v4M12 17.5v.5" strokeLinecap="round" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5V8" strokeLinecap="round" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
  eyeOff: <><path d="M4 4l16 16M10 6.1A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.6M6.6 6.9A16.6 16.6 0 0 0 2 12s3.5 6 10 6c1.4 0 2.7-.3 3.8-.8" strokeLinecap="round" strokeLinejoin="round" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.7c2.3.7 4 2.3 4 5.3" strokeLinecap="round" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.5M3.5 12h.5M3.5 18h.5" strokeLinecap="round" />,
  tag: <><path d="m3 12 9-9h9v9l-9 9-9-9Z" strokeLinejoin="round" /><circle cx="16.5" cy="7.5" r="1.5" /></>,
  truck: <><path d="M2 6h12v10H2zM14 10h4l3 3v3h-7" strokeLinejoin="round" /><circle cx="6.5" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.6M20 3v4h-4" strokeLinecap="round" strokeLinejoin="round" /></>,
  ban: <><circle cx="12" cy="12" r="9" /><path d="m6 6 12 12" strokeLinecap="round" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 8v4l3 2" strokeLinecap="round" /></>,
  send: <path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z" strokeLinejoin="round" />,
  camera: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.5" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" strokeLinejoin="round" /><path d="M4 19a2 2 0 0 1 2-2h13" strokeLinejoin="round" /></>,
  laptop: <><rect x="4" y="4" width="16" height="11" rx="1.5" /><path d="M2 19h20" strokeLinecap="round" /></>,
  headphones: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="13" width="4" height="6" rx="1.5" /><rect x="17" y="13" width="4" height="6" rx="1.5" /></>,
  calculator: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h.5M12 12h.5M16 12h.5M8 16h.5M12 16h.5M16 16h.5" strokeLinecap="round" /></>,
  sofa: <><path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M3 13a2 2 0 0 1 4 0v1h10v-1a2 2 0 0 1 4 0v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3Z" strokeLinejoin="round" /></>,
  desk: <><path d="M3 8h18M5 8v12M19 8v12M5 14h14" strokeLinecap="round" /></>,
  bed: <><path d="M3 18v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8M3 18h18M3 18v2M21 18v2M6 8V6h12v2" strokeLinecap="round" strokeLinejoin="round" /></>,
  box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" strokeLinejoin="round" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" strokeLinejoin="round" /></>,
  shirt: <><path d="m8 4-5 3 2 4 2-1v10h10V10l2 1 2-4-5-3a4 4 0 0 1-8 0Z" strokeLinejoin="round" /></>,
  shoe: <path d="M3 16V8h4l3 4c2 2.5 4 4 8 4.5V18H3v-2Z" strokeLinejoin="round" />,
  bag: <><path d="M6 8h12l1 12H5L6 8Z" strokeLinejoin="round" /><path d="M9 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round" /></>,
  jacket: <><path d="m8 3-5 3 2 4 2-1v11h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0Z" strokeLinejoin="round" /></>,
  food: <><path d="M4 11h16a8 8 0 0 1-16 0Z" /><path d="M12 11V8M8 8c0-2 1.5-3 4-3s4 1 4 3" strokeLinecap="round" /></>,
  meal: <><path d="M5 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M7 3v18M17 3c-2 0-3 2.5-3 5v4h3v9M17 3v18" strokeLinecap="round" /></>,
  snack: <><path d="M6 3h12l-1.5 18h-9L6 3Z" strokeLinejoin="round" /><path d="M6 8h12" strokeLinecap="round" /></>,
  sparkles: <><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" strokeLinejoin="round" /></>,
  dumbbell: <><path d="M7 8v8M17 8v8M3 10v4M21 10v4M7 12h10" strokeLinecap="round" /></>,
  pencil: <><path d="m14 5 5 5L8 21H3v-5L14 5Z" strokeLinejoin="round" /><path d="m12 7 5 5" strokeLinejoin="round" /></>,
  chip: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" strokeLinecap="round" /></>,
  flask: <><path d="M10 3h4M10 3v6l-5 9a2.4 2.4 0 0 0 2 3.6h10a2.4 2.4 0 0 0 2-3.6l-5-9V3" strokeLinecap="round" strokeLinejoin="round" /></>,
  chat: <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" strokeLinejoin="round" />,
  clipboard: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4a3 3 0 0 1 6 0M9 11h6M9 15h4" strokeLinecap="round" /></>,
  printer: <><path d="M7 8V3h10v5M7 17H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-3" /><rect x="7" y="14" width="10" height="7" /></>,
  washer: <><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="13" r="4" /><path d="M7 6h.5M10 6h.5" strokeLinecap="round" /></>,
  wrench: <path d="M14.5 6.5a4.5 4.5 0 0 0-6 6L3 18l3 3 5.5-5.5a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.5-3.5Z" strokeLinejoin="round" />,
  scissors: <><circle cx="6" cy="7" r="2.5" /><circle cx="6" cy="17" r="2.5" /><path d="M8 8.5 20 19M8 15.5 20 5" strokeLinecap="round" /></>,
  key: <><circle cx="8" cy="14" r="4.5" /><path d="m11 11 9-9M17 5l3 3M14 8l2 2" strokeLinecap="round" strokeLinejoin="round" /></>,
  percent: <><path d="M19 5 5 19" strokeLinecap="round" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></>,
  wallet: <><path d="M3 7a2 2 0 0 1 2-2h13v3M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2Z" strokeLinejoin="round" /><circle cx="16.5" cy="14.5" r="1.2" /></>,
  receipt: <><path d="M5 3h14v18l-2.3-1.5L14.4 21l-2.4-1.5L9.6 21l-2.3-1.5L5 21V3Z" strokeLinejoin="round" /><path d="M9 8h6M9 12h6" strokeLinecap="round" /></>,
  scale: <><path d="M12 3v18M5 7h14M7 7l-3 6a3.5 3.5 0 0 0 6 0L7 7ZM17 7l-3 6a3.5 3.5 0 0 0 6 0l-3-6ZM8 21h8" strokeLinecap="round" strokeLinejoin="round" /></>,
  fileText: <><path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" strokeLinejoin="round" /><path d="M14 2v5h5M9 12h6M9 16h6" strokeLinejoin="round" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z" /></>,
  bell: <><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9Z" strokeLinejoin="round" /><path d="M10 20a2.2 2.2 0 0 0 4 0" strokeLinecap="round" /></>,
  heart: <path d="M12 20.5C6 16 3 12.7 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 3.7-3 7-9 11.5Z" strokeLinejoin="round" />,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" strokeLinecap="round" /></>,
  edit: <><path d="m14 6 4 4L8 20H4v-4L14 6Z" strokeLinejoin="round" /><path d="m12 8 4 4" strokeLinejoin="round" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" /></>,
  pause: <><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>,
  play: <path d="M7 4.5v15l13-7.5-13-7.5Z" strokeLinejoin="round" />,
  zap: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinejoin="round" />,
  trending: <><path d="m3 17 6-6 4 4 8-8" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 7h6v6" strokeLinecap="round" strokeLinejoin="round" /></>,
  award: <><circle cx="12" cy="9" r="5" /><path d="m8.5 13-2 8 5.5-3 5.5 3-2-8" strokeLinejoin="round" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 21v-4h6v4M8 7h2M14 7h2M8 11h2M14 11h2" strokeLinecap="round" /></>,
  graduation: <><path d="m2 9 10-5 10 5-10 5L2 9Z" strokeLinejoin="round" /><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v5" strokeLinecap="round" /></>,
  handshake: <><path d="m11 17 2 2a1.4 1.4 0 0 0 2-2M7 11l4-4a2 2 0 0 1 3 0l4 4M3 8l4-4a2 2 0 0 1 3 0l2 2M14 12l3 3a2 2 0 0 1-3 3l-2-2" strokeLinecap="round" strokeLinejoin="round" /></>,
};

export type IconName = keyof typeof PATHS;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: string;
  size?: number;
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  const path = PATHS[name] ?? PATHS.grid;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
      {...rest}
    >
      {path}
    </svg>
  );
}
