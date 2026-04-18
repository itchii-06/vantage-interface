import { useMemo, type ReactNode, type CSSProperties } from "react";

/**
 * HowItWorks merge-animation icons — "glass 3D" style on #ecff3e base.
 *
 * Exports:
 *   YieldTokenTile / ShortTile / ShieldTile   — 80×80 (shield 96×96) tiles with glow
 *   YieldTokenIcon / ShortIcon / ShieldIcon   — raw SVG icons (no tile)
 *
 * Drop this file next to Hero.tsx / HowItWorks.tsx and import from HowItWorks.tsx.
 */

const ICON_SIZE = 80;
const SHIELD_SIZE = 96;

// Unique gradient IDs per-instance so multiple copies coexist on the page.
let __mergeIconUid = 0;
const nextId = (prefix: string): string => `${prefix}-${++__mergeIconUid}`;

const SVG_STYLE: CSSProperties = { overflow: "visible" };

const ICON_TILE_INNER_GLOW: CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: 10,
  background: "radial-gradient(ellipse 70% 50% at 50% 55%, rgba(236,255,62,0.22) 0%, transparent 70%)",
  pointerEvents: "none",
};

interface IconTileProps {
  size?: number;
  strong?: boolean;
  children: ReactNode;
}

export function IconTile({ size = ICON_SIZE, strong = false, children }: IconTileProps) {
  const outerStyle = useMemo<CSSProperties>(
    () => ({
      width: size,
      height: size,
      borderRadius: 10,
      background: "linear-gradient(145deg, #0f0f0f 0%, #050505 100%)",
      border: "1px solid rgba(236,255,62,0.18)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "visible",
      boxShadow: strong
        ? "0 0 40px rgba(236,255,62,0.35), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "0 0 24px rgba(236,255,62,0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
    }),
    [size, strong]
  );
  return (
    <div style={outerStyle}>
      <div style={ICON_TILE_INNER_GLOW} />
      {children}
    </div>
  );
}

interface IconProps {
  size?: number;
}

// ---------- Yield Token (coin stack, isometric) ----------
export function YieldTokenIcon({ size = 56 }: IconProps) {
  const gId = useMemo(() => nextId("yt-grad"), []);
  const gId2 = useMemo(() => nextId("yt-grad2"), []);
  const glowId = useMemo(() => nextId("yt-glow"), []);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={SVG_STYLE}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4ff8c" />
          <stop offset="55%" stopColor="#ecff3e" />
          <stop offset="100%" stopColor="#8ea81c" />
        </linearGradient>
        <linearGradient id={gId2} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={`url(#${glowId})`}>
        <ellipse cx="32" cy="50" rx="18" ry="6" fill="#2a3308" opacity="0.9" />
        <path d="M14 46 L14 50 A18 6 0 0 0 50 50 L50 46 Z" fill={`url(#${gId})`} opacity="0.85" />
        <ellipse cx="32" cy="46" rx="18" ry="6" fill={`url(#${gId})`} />
        <path d="M14 38 L14 42 A18 6 0 0 0 50 42 L50 38 Z" fill={`url(#${gId})`} opacity="0.95" />
        <ellipse cx="32" cy="38" rx="18" ry="6" fill={`url(#${gId})`} />
        <path d="M14 30 L14 34 A18 6 0 0 0 50 34 L50 30 Z" fill={`url(#${gId})`} />
        <ellipse cx="32" cy="30" rx="18" ry="6" fill={`url(#${gId})`} />
        <ellipse cx="28" cy="28" rx="10" ry="3" fill={`url(#${gId2})`} opacity="0.7" />
        <path
          d="M26 28 L32 31 L38 28 M32 31 L32 34"
          stroke="#0a0a0a"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.55"
        />
        <path d="M14 30 A18 6 0 0 1 50 30" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" fill="none" />
        <path d="M14 38 A18 6 0 0 1 50 38" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" fill="none" />
      </g>
    </svg>
  );
}

// ---------- Short (descending bar chart, isometric) ----------
export function ShortIcon({ size = 56 }: IconProps) {
  const gId = useMemo(() => nextId("sh-grad"), []);
  const gId2 = useMemo(() => nextId("sh-grad2"), []);
  const glowId = useMemo(() => nextId("sh-glow"), []);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={SVG_STYLE}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4ff8c" />
          <stop offset="55%" stopColor="#ecff3e" />
          <stop offset="100%" stopColor="#8ea81c" />
        </linearGradient>
        <linearGradient id={gId2} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={`url(#${glowId})`}>
        <path d="M8 44 L32 56 L56 44 L32 32 Z" fill="#1a2009" opacity="0.8" />
        <path d="M8 44 L32 56 L56 44 L32 32 Z" fill={`url(#${gId})`} opacity="0.25" />

        <g>
          <path d="M14 40 L14 24 L22 20 L22 36 Z" fill={`url(#${gId})`} />
          <path d="M22 36 L22 20 L28 23 L28 39 Z" fill={`url(#${gId})`} opacity="0.75" />
          <path d="M14 24 L22 20 L28 23 L20 27 Z" fill={`url(#${gId2})`} />
        </g>
        <g transform="translate(10 5)">
          <path d="M14 40 L14 28 L22 24 L22 36 Z" fill={`url(#${gId})`} opacity="0.92" />
          <path d="M22 36 L22 24 L28 27 L28 39 Z" fill={`url(#${gId})`} opacity="0.68" />
          <path d="M14 28 L22 24 L28 27 L20 31 Z" fill={`url(#${gId2})`} opacity="0.9" />
        </g>
        <g transform="translate(20 10)">
          <path d="M14 40 L14 32 L22 28 L22 36 Z" fill={`url(#${gId})`} opacity="0.85" />
          <path d="M22 36 L22 28 L28 31 L28 39 Z" fill={`url(#${gId})`} opacity="0.6" />
          <path d="M14 32 L22 28 L28 31 L20 35 Z" fill={`url(#${gId2})`} opacity="0.85" />
        </g>

        <path
          d="M14 18 L30 26 L44 22 L52 30"
          stroke="#ecff3e"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
        <path d="M52 30 L48 28 M52 30 L50 34" stroke="#ecff3e" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ---------- Shield (faceted, isometric) ----------
export function ShieldIcon({ size = 68 }: IconProps) {
  const gId = useMemo(() => nextId("sd-grad"), []);
  const gId2 = useMemo(() => nextId("sd-grad2"), []);
  const gId3 = useMemo(() => nextId("sd-grad3"), []);
  const glowId = useMemo(() => nextId("sd-glow"), []);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={SVG_STYLE}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8ffaa" />
          <stop offset="50%" stopColor="#ecff3e" />
          <stop offset="100%" stopColor="#7a901a" />
        </linearGradient>
        <linearGradient id={gId2} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.65)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.0)" />
        </linearGradient>
        <linearGradient id={gId3} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ecff3e" stopOpacity="0.0" />
          <stop offset="100%" stopColor="#ecff3e" stopOpacity="0.55" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="32" cy="56" rx="18" ry="3" fill="#ecff3e" opacity="0.28" />

      <g filter={`url(#${glowId})`}>
        <path
          d="M32 6 L52 14 L52 30 C52 42 42 52 32 56 C22 52 12 42 12 30 L12 14 Z"
          fill={`url(#${gId})`}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="0.8"
        />
        <path d="M32 6 L32 56" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
        <path d="M32 6 L12 14 L12 30 C12 42 22 52 32 56 Z" fill="#000" opacity="0.12" />
        <path d="M32 8 L50 15 L50 24 C50 26 46 27 42 26 L34 22 Z" fill={`url(#${gId2})`} opacity="0.9" />
        <path
          d="M14 34 L14 30 C14 42 23 50 32 54 C41 50 50 42 50 30 L50 34 C50 44 42 52 32 55 C22 52 14 44 14 34 Z"
          fill={`url(#${gId3})`}
          opacity="0.5"
        />
        <circle cx="32" cy="30" r="12" fill="#000" stroke="rgba(236,255,62,0.55)" strokeWidth="0.8" />
        <path
          d="M26 30 L30 34 L38 25"
          stroke="#ecff3e"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

// ---------- Ready-to-use tiles (icon + glowing dark tile) ----------
export function YieldTokenTile() {
  return (
    <IconTile>
      <YieldTokenIcon />
    </IconTile>
  );
}
export function ShortTile() {
  return (
    <IconTile>
      <ShortIcon />
    </IconTile>
  );
}
export function ShieldTile() {
  return (
    <IconTile size={SHIELD_SIZE} strong>
      <ShieldIcon />
    </IconTile>
  );
}
