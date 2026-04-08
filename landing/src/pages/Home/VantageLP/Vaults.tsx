import { motion } from "framer-motion";
import { useMemo, useState } from "react";

const COLORS = {
  bg: "#07070F",
  bgCard: "#0E0E1C",
  bgCardHover: "#12122A",
  borderSubtle: "rgba(255,255,255,0.07)",
  neonYellow: "#F5E642",
  neonPink: "#FF3CAC",
  neonCyan: "#3CF7FF",
  textPrimary: "#FFFFFF",
  textMuted: "#6B6B99",
  green: "#22C55E",
};

interface VaultData {
  name: string;
  type: string;
  icon: string;
  iconBg: string;
  vaultApy: number;
  fundingRate: number;
  netApy: number;
  capacity: number; // 0-100
  typeBadgeColor: string;
}

const VAULTS: VaultData[] = [
  {
    name: "mBUIDL",
    type: "Money Market RWA",
    icon: "B",
    iconBg: "linear-gradient(135deg, #F5E642 0%, #E5D400 100%)",
    vaultApy: 5.2,
    fundingRate: 3.6,
    netApy: 8.8,
    capacity: 68,
    typeBadgeColor: "rgba(245,230,66,0.15)",
  },
  {
    name: "mUSDY",
    type: "Yield-Bearing Stablecoin",
    icon: "U",
    iconBg: "linear-gradient(135deg, #3CF7FF 0%, #00D4E0 100%)",
    vaultApy: 6.1,
    fundingRate: 2.4,
    netApy: 8.5,
    capacity: 45,
    typeBadgeColor: "rgba(60,247,255,0.12)",
  },
  {
    name: "mRWA",
    type: "Diversified RWA Basket",
    icon: "R",
    iconBg: "linear-gradient(135deg, #FF3CAC 0%, #CC2288 100%)",
    vaultApy: 4.8,
    fundingRate: 5.2,
    netApy: 10.0,
    capacity: 32,
    typeBadgeColor: "rgba(255,60,172,0.12)",
  },
];

const CARD_METRIC_LABEL_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: COLORS.textMuted,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  marginBottom: "4px",
};

const CARD_PROGRESS_BG_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "100px",
  height: "6px",
  overflow: "hidden",
  marginBottom: "20px",
};

const CARD_BTN_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "13px",
  background: COLORS.neonYellow,
  color: "#07070F",
  fontWeight: 700,
  fontSize: "15px",
  borderRadius: "12px",
  border: "none",
  cursor: "pointer",
  textDecoration: "none",
  textAlign: "center",
  letterSpacing: "-0.2px",
};

const CARD_INITIAL = { opacity: 0, y: 40 };
const CARD_WHILE_IN_VIEW = { opacity: 1, y: 0 };
const CARD_VIEWPORT = { once: true };
const CARD_WHILE_HOVER = { y: -6 };

const CARD_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  marginBottom: "24px",
};

const CARD_ICON_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
};

const CARD_METRICS_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "16px",
  marginBottom: "24px",
};

const CARD_CAPACITY_ROW_STYLE: React.CSSProperties = {
  marginBottom: "8px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const CARD_VAULT_APY_STYLE: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  color: COLORS.textPrimary,
};

const CARD_FUNDING_RATE_STYLE: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 700,
  color: COLORS.neonCyan,
};

const CARD_NET_APY_STYLE: React.CSSProperties = {
  fontSize: "26px",
  fontWeight: 900,
  color: COLORS.green,
  letterSpacing: "-1px",
};

const CARD_CAPACITY_LABEL_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: COLORS.textMuted,
  fontWeight: 500,
};

const CARD_CAPACITY_VALUE_STYLE: React.CSSProperties = {
  fontSize: "11px",
  color: COLORS.textMuted,
  fontWeight: 600,
};

const CARD_VAULT_NAME_STYLE: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 800,
  color: COLORS.textPrimary,
  letterSpacing: "-0.5px",
};

const CARD_BADGE_WRAPPER_STYLE: React.CSSProperties = {
  marginTop: "4px",
};

function VaultCard({ vault, index }: { vault: VaultData; index: number }) {
  const [hovered, setHovered] = useState(false);

  const cardStyle = useMemo(
    () => ({
      background: hovered ? COLORS.bgCardHover : COLORS.bgCard,
      borderRadius: "24px",
      border: hovered ? `1px solid rgba(245,230,66,0.5)` : `1px solid ${COLORS.borderSubtle}`,
      padding: "28px",
      cursor: "pointer",
      boxShadow: hovered ? "0 0 40px rgba(245,230,66,0.12), 0 16px 48px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.2)",
      transition: "background 0.2s, border 0.2s, box-shadow 0.2s",
    }),
    [hovered]
  );

  const iconStyle = useMemo(
    () => ({
      width: "48px",
      height: "48px",
      borderRadius: "14px",
      background: vault.iconBg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "20px",
      fontWeight: 900,
      color: "#07070F",
      flexShrink: 0,
    }),
    [vault.iconBg]
  );

  const badgeStyle = useMemo(
    () => ({
      background: vault.typeBadgeColor,
      borderRadius: "6px",
      padding: "3px 10px",
      fontSize: "11px",
      fontWeight: 600,
      color: COLORS.textMuted,
      letterSpacing: "0.3px",
    }),
    [vault.typeBadgeColor]
  );

  const progressFillStyle = useMemo(
    () => ({
      height: "100%",
      borderRadius: "100px",
      width: `${vault.capacity}%`,
      background: `linear-gradient(90deg, ${COLORS.neonYellow} 0%, ${COLORS.neonPink} 100%)`,
      transition: "width 0.8s ease",
    }),
    [vault.capacity]
  );

  const cardTransition = useMemo(() => ({ duration: 0.5, delay: index * 0.12, ease: "easeOut" }), [index]);

  return (
    <motion.div
      style={cardStyle}
      initial={CARD_INITIAL}
      whileInView={CARD_WHILE_IN_VIEW}
      viewport={CARD_VIEWPORT}
      transition={cardTransition}
      whileHover={CARD_WHILE_HOVER}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      {/* Header */}
      <div style={CARD_HEADER_STYLE}>
        <div style={CARD_ICON_ROW_STYLE}>
          <div style={iconStyle}>{vault.icon}</div>
          <div>
            <div style={CARD_VAULT_NAME_STYLE}>{vault.name}</div>
            <div style={CARD_BADGE_WRAPPER_STYLE}>
              <span style={badgeStyle}>{vault.type}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div style={CARD_METRICS_GRID_STYLE}>
        <div>
          <div style={CARD_METRIC_LABEL_STYLE}>Vault APY</div>
          <div style={CARD_VAULT_APY_STYLE}>{vault.vaultApy.toFixed(1)}%</div>
        </div>
        <div>
          <div style={CARD_METRIC_LABEL_STYLE}>Funding Rate</div>
          <div style={CARD_FUNDING_RATE_STYLE}>+{vault.fundingRate.toFixed(1)}%</div>
        </div>
        <div>
          <div style={CARD_METRIC_LABEL_STYLE}>Net APY</div>
          <div style={CARD_NET_APY_STYLE}>+{vault.netApy.toFixed(1)}%</div>
        </div>
      </div>

      {/* Capacity bar */}
      <div style={CARD_CAPACITY_ROW_STYLE}>
        <span style={CARD_CAPACITY_LABEL_STYLE}>Capacity</span>
        <span style={CARD_CAPACITY_VALUE_STYLE}>{vault.capacity}% filled</span>
      </div>
      <div style={CARD_PROGRESS_BG_STYLE}>
        <div style={progressFillStyle} />
      </div>

      {/* CTA */}
      <a
        href="/#/trade"
        style={CARD_BTN_STYLE}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = "0.88";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = "1";
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        }}
      >
        Zap &amp; Deposit →
      </a>
    </motion.div>
  );
}

const SECTION_STYLE: React.CSSProperties = {
  background: COLORS.bg,
  padding: "100px 24px",
};

const INNER_STYLE: React.CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "inline-block",
  fontSize: "11px",
  fontWeight: 700,
  color: COLORS.neonYellow,
  letterSpacing: "2px",
  textTransform: "uppercase",
  marginBottom: "16px",
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "clamp(32px, 5vw, 52px)",
  fontWeight: 900,
  color: COLORS.textPrimary,
  letterSpacing: "-2px",
  marginBottom: "12px",
};

const SUB_STYLE: React.CSSProperties = {
  fontSize: "17px",
  color: COLORS.textMuted,
  marginBottom: "56px",
};

const GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "24px",
};

const VAULTS_HEADER_INITIAL = { opacity: 0, y: 24 };
const VAULTS_HEADER_WHILE_IN_VIEW = { opacity: 1, y: 0 };
const VAULTS_HEADER_VIEWPORT = { once: true };
const VAULTS_HEADER_TRANSITION = { duration: 0.5, ease: "easeOut" };

export function Vaults() {
  return (
    <section id="vaults" style={SECTION_STYLE}>
      <div style={INNER_STYLE}>
        <motion.div
          initial={VAULTS_HEADER_INITIAL}
          whileInView={VAULTS_HEADER_WHILE_IN_VIEW}
          viewport={VAULTS_HEADER_VIEWPORT}
          transition={VAULTS_HEADER_TRANSITION}
        >
          <span style={LABEL_STYLE}>Live Vaults</span>
          <h2 style={HEADING_STYLE}>Pick Your Strategy</h2>
          <p style={SUB_STYLE}>Each vault is backed by real-world assets and actively hedged with a perpetual short.</p>
        </motion.div>

        <div style={GRID_STYLE}>
          {VAULTS.map((vault, i) => (
            <VaultCard key={vault.name} vault={vault} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
