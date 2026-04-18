import { useMemo, type ReactNode, type CSSProperties } from "react";

/**
 * 6 StepCard icons for HowItWorks — glass-3D style, #ecff3e base.
 * Matches MergeIcons.tsx tone.
 *
 * Icons:
 *   BoltIcon     — 01 leverage
 *   UnlockIcon   — 02 break free from FR
 *   SparkleIcon  — 03 earn while hedging
 *   DropletIcon  — 04 LP 2.0
 *   DiamondIcon  — 05 margin to work
 *   ChartUpIcon  — 06 IR futures
 *
 * StepIconTile — dark rounded tile with green glow halo; wrap any icon.
 */

let __stepIconUid = 0;
const nextStepId = (p: string): string => `${p}-${++__stepIconUid}`;

const SVG_STYLE: CSSProperties = { overflow: "visible" };

const STEP_ICON_TILE_INNER: CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: 10,
  background: "radial-gradient(ellipse 70% 50% at 50% 55%, rgba(236,255,62,0.22) 0%, transparent 70%)",
  pointerEvents: "none",
};

function Defs({ gId, gId2, glowId }: { gId: string; gId2: string; glowId: string }) {
  return (
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
        <feGaussianBlur stdDeviation="0.9" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

interface IconProps {
  size?: number;
}

export function BoltIcon({ size = 40 }: IconProps) {
  const gId = useMemo(() => nextStepId("b-grad"), []);
  const gId2 = useMemo(() => nextStepId("b-grad2"), []);
  const glowId = useMemo(() => nextStepId("b-glow"), []);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={SVG_STYLE}>
      <Defs gId={gId} gId2={gId2} glowId={glowId} />
      <g filter={`url(#${glowId})`}>
        <path
          d="M18 3 L8 17 L14 17 L12 28 L24 13 L17 13 L20 3 Z"
          fill={`url(#${gId})`}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="0.5"
        />
        <path d="M18 3 L8 17 L14 17 L18 6 Z" fill={`url(#${gId2})`} opacity="0.55" />
      </g>
    </svg>
  );
}

export function UnlockIcon({ size = 40 }: IconProps) {
  const gId = useMemo(() => nextStepId("u-grad"), []);
  const gId2 = useMemo(() => nextStepId("u-grad2"), []);
  const glowId = useMemo(() => nextStepId("u-glow"), []);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={SVG_STYLE}>
      <Defs gId={gId} gId2={gId2} glowId={glowId} />
      <g filter={`url(#${glowId})`}>
        <path
          d="M9 14 L9 10 A5 5 0 0 1 19 9"
          stroke={`url(#${gId})`}
          strokeWidth="2.4"
          fill="none"
          strokeLinecap="round"
        />
        <rect
          x="6"
          y="14"
          width="16"
          height="13"
          rx="2"
          fill={`url(#${gId})`}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="0.5"
        />
        <rect x="6" y="14" width="16" height="5" rx="2" fill={`url(#${gId2})`} opacity="0.55" />
        <circle cx="14" cy="19" r="1.6" fill="#0a0a0a" opacity="0.7" />
        <rect x="13.3" y="20" width="1.4" height="4" fill="#0a0a0a" opacity="0.7" />
      </g>
    </svg>
  );
}

export function SparkleIcon({ size = 40 }: IconProps) {
  const gId = useMemo(() => nextStepId("s-grad"), []);
  const gId2 = useMemo(() => nextStepId("s-grad2"), []);
  const glowId = useMemo(() => nextStepId("s-glow"), []);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={SVG_STYLE}>
      <Defs gId={gId} gId2={gId2} glowId={glowId} />
      <g filter={`url(#${glowId})`}>
        <path
          d="M16 3 L19 13 L29 16 L19 19 L16 29 L13 19 L3 16 L13 13 Z"
          fill={`url(#${gId})`}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="0.5"
        />
        <path d="M16 3 L19 13 L29 16 L16 16 Z" fill={`url(#${gId2})`} opacity="0.5" />
        <path d="M26 5 L27 8 L30 9 L27 10 L26 13 L25 10 L22 9 L25 8 Z" fill={`url(#${gId})`} opacity="0.75" />
      </g>
    </svg>
  );
}

export function DropletIcon({ size = 40 }: IconProps) {
  const gId = useMemo(() => nextStepId("d-grad"), []);
  const gId2 = useMemo(() => nextStepId("d-grad2"), []);
  const glowId = useMemo(() => nextStepId("d-glow"), []);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={SVG_STYLE}>
      <Defs gId={gId} gId2={gId2} glowId={glowId} />
      <g filter={`url(#${glowId})`}>
        <path
          d="M16 3 C16 3 6 15 6 21 A10 10 0 0 0 26 21 C26 15 16 3 16 3 Z"
          fill={`url(#${gId})`}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="0.5"
        />
        <path
          d="M11 13 C10 18 11 22 14 23"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path d="M16 3 C16 3 10 10 9 16 C13 14 15 10 16 3 Z" fill={`url(#${gId2})`} opacity="0.45" />
      </g>
    </svg>
  );
}

export function DiamondIcon({ size = 40 }: IconProps) {
  const gId = useMemo(() => nextStepId("dm-grad"), []);
  const gId2 = useMemo(() => nextStepId("dm-grad2"), []);
  const glowId = useMemo(() => nextStepId("dm-glow"), []);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={SVG_STYLE}>
      <Defs gId={gId} gId2={gId2} glowId={glowId} />
      <g filter={`url(#${glowId})`}>
        <path
          d="M6 12 L10 5 L22 5 L26 12 L16 28 Z"
          fill={`url(#${gId})`}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        <path
          d="M6 12 L26 12 M10 5 L16 12 L22 5 M6 12 L16 28 L26 12"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="0.6"
          fill="none"
        />
        <path d="M6 12 L26 12 M10 5 L16 12 L22 5" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" fill="none" />
        <path d="M10 5 L22 5 L20 10 L12 10 Z" fill={`url(#${gId2})`} opacity="0.7" />
      </g>
    </svg>
  );
}

export function ChartUpIcon({ size = 40 }: IconProps) {
  const gId = useMemo(() => nextStepId("c-grad"), []);
  const gId2 = useMemo(() => nextStepId("c-grad2"), []);
  const glowId = useMemo(() => nextStepId("c-glow"), []);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={SVG_STYLE}>
      <Defs gId={gId} gId2={gId2} glowId={glowId} />
      <g filter={`url(#${glowId})`}>
        <rect x="5" y="18" width="4" height="10" rx="1" fill={`url(#${gId})`} opacity="0.45" />
        <rect x="11" y="13" width="4" height="15" rx="1" fill={`url(#${gId})`} opacity="0.6" />
        <rect x="17" y="16" width="4" height="12" rx="1" fill={`url(#${gId})`} opacity="0.55" />
        <rect x="23" y="9" width="4" height="19" rx="1" fill={`url(#${gId})`} opacity="0.75" />
        <path
          d="M4 22 L11 17 L17 19 L25 8"
          stroke={`url(#${gId})`}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M25 8 L21 8 M25 8 L25 12" stroke="#ecff3e" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path
          d="M4 22 L11 17 L17 19 L25 8"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="0.7"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

interface StepIconTileProps {
  children: ReactNode;
  size?: number;
}

export function StepIconTile({ children, size = 72 }: StepIconTileProps) {
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
      boxShadow: "0 0 24px rgba(236,255,62,0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
    }),
    [size]
  );
  return (
    <div style={outerStyle}>
      <div style={STEP_ICON_TILE_INNER} />
      {children}
    </div>
  );
}
