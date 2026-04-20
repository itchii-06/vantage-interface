import { useMemo } from "react";

import { COLORS } from "../../../styles/vantageTheme";

const EVENTS = [
  { text: "mBUIDL Vault: +5.2% APY", icon: "✓", color: COLORS.textPrimary },
  { text: "Hedge Position Active", icon: "✓", color: COLORS.green },
  { text: "ADL Status: Healthy", icon: "✓", color: COLORS.green },
  { text: "Cover Ratio: 142%", icon: "✓", color: COLORS.textPrimary },
  { text: "Short Funding: +3.6%", icon: "✓", color: COLORS.textPrimary },
  { text: "Payout Hub: Solvent", icon: "✓", color: COLORS.green },
  { text: "mUSDY Vault: +8.5% Net APY", icon: "✓", color: COLORS.textPrimary },
  { text: "mRWA Vault: +10.0% Net APY", icon: "✓", color: COLORS.textPrimary },
  { text: "Compliance Check: Passed", icon: "✓", color: COLORS.green },
  { text: "NAV Sync: Up to Date", icon: "✓", color: COLORS.textPrimary },
];

// Duplicate for seamless loop
const ALL_EVENTS = [...EVENTS, ...EVENTS];

interface TickerItemProps {
  text: string;
  icon: string;
  color: string;
}

const TICKER_ITEM_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 20px",
  whiteSpace: "nowrap",
  marginRight: "8px",
};

const TICKER_TEXT_STYLE: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: COLORS.textSecondary,
};

const TICKER_SEP_STYLE: React.CSSProperties = {
  marginLeft: "8px",
  color: "rgba(255,255,255,0.08)",
  fontWeight: 300,
};

function TickerItem({ text, icon, color }: TickerItemProps) {
  const dotStyle = useMemo(
    () => ({
      width: "6px",
      height: "6px",
      borderRadius: "50%",
      background: color,
      flexShrink: 0,
    }),
    [color]
  );

  const iconStyle = useMemo(
    () => ({
      fontSize: "13px",
      color: color,
      fontWeight: 600,
    }),
    [color]
  );

  return (
    <span style={TICKER_ITEM_STYLE}>
      <span style={dotStyle} />
      <span style={TICKER_TEXT_STYLE}>{text}</span>
      <span style={iconStyle}>{icon}</span>
      <span style={TICKER_SEP_STYLE}>|</span>
    </span>
  );
}

const SECTION_STYLE: React.CSSProperties = {
  background: COLORS.bg,
  borderTop: `1px solid ${COLORS.border}`,
  borderBottom: `1px solid ${COLORS.border}`,
  padding: "16px 0",
  overflow: "hidden",
};

const TRACK_STYLE: React.CSSProperties = {
  display: "flex",
  animation: "scroll 30s linear infinite",
  width: "max-content",
};

const OVERFLOW_STYLE: React.CSSProperties = {
  overflow: "hidden",
};

export function Ticker() {
  return (
    <div style={SECTION_STYLE}>
      <div style={OVERFLOW_STYLE}>
        <div style={TRACK_STYLE}>
          {ALL_EVENTS.map((event, i) => (
            <TickerItem key={i} text={event.text} icon={event.icon} color={event.color} />
          ))}
        </div>
      </div>
    </div>
  );
}
