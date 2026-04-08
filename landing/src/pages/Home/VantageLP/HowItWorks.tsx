import { motion } from "framer-motion";
import { useMemo } from "react";

const COLORS = {
  bg: "#0A0A18",
  bgCard: "#0E0E1C",
  borderSubtle: "rgba(255,255,255,0.07)",
  neonYellow: "#F5E642",
  neonPink: "#FF3CAC",
  neonCyan: "#3CF7FF",
  textPrimary: "#FFFFFF",
  textMuted: "#6B6B99",
};

interface Step {
  number: string;
  icon: string;
  title: string;
  description: string;
  accentColor: string;
  animationProps: {
    initial: { opacity: number; x?: number; scale?: number };
    whileInView: { opacity: number; x?: number; scale?: number };
  };
}

const STEPS: Step[] = [
  {
    number: "01",
    icon: "🏦",
    title: "Deposit RWA",
    description:
      "Deposit your real-world asset tokens — like mBUIDL, mUSDY, or mRWA — directly into the vault. Your principal is securely custodied on-chain.",
    accentColor: COLORS.neonYellow,
    animationProps: {
      initial: { opacity: 0, x: -60 },
      whileInView: { opacity: 1, x: 0 },
    },
  },
  {
    number: "02",
    icon: "↕",
    title: "Short Opens Automatically",
    description:
      "The protocol automatically opens a corresponding short position using funding-rate arbitrage — neutralizing any price exposure on your deposited asset.",
    accentColor: COLORS.neonCyan,
    animationProps: {
      initial: { opacity: 0, x: 60 },
      whileInView: { opacity: 1, x: 0 },
    },
  },
  {
    number: "03",
    icon: "🛡️",
    title: "Earn Delta-Neutral Yield",
    description:
      "You collect the RWA's native yield plus positive funding rates — with zero directional risk. Withdraw anytime as conditions update.",
    accentColor: COLORS.neonPink,
    animationProps: {
      initial: { opacity: 0, scale: 0.85 },
      whileInView: { opacity: 1, scale: 1 },
    },
  },
];

const CARD_BASE_STYLE: React.CSSProperties = {
  background: COLORS.bgCard,
  borderRadius: "24px",
  border: `1px solid ${COLORS.borderSubtle}`,
  padding: "36px 32px",
  position: "relative",
  overflow: "hidden",
};

const ICON_WRAP_STYLE: React.CSSProperties = {
  width: "60px",
  height: "60px",
  borderRadius: "16px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "28px",
  marginBottom: "20px",
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 800,
  color: COLORS.textPrimary,
  letterSpacing: "-0.5px",
  marginBottom: "12px",
};

const DESC_STYLE: React.CSSProperties = {
  fontSize: "15px",
  color: COLORS.textMuted,
  lineHeight: 1.65,
};

const CARD_VIEWPORT = { once: true };

function StepCard({ step, index }: { step: Step; index: number }) {
  const accentLineStyle = useMemo(
    () => ({
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      height: "3px",
      background: step.accentColor,
      borderRadius: "24px 24px 0 0",
    }),
    [step.accentColor]
  );

  const stepNumStyle = useMemo(
    () => ({
      fontSize: "11px",
      fontWeight: 800,
      color: step.accentColor,
      letterSpacing: "2px",
      textTransform: "uppercase" as const,
      marginBottom: "16px",
      display: "block",
    }),
    [step.accentColor]
  );

  const cardTransition = useMemo(() => ({ duration: 0.6, delay: index * 0.15, ease: "easeOut" }), [index]);

  return (
    <motion.div
      style={CARD_BASE_STYLE}
      initial={step.animationProps.initial}
      whileInView={step.animationProps.whileInView}
      viewport={CARD_VIEWPORT}
      transition={cardTransition}
    >
      <div style={accentLineStyle} />
      <span style={stepNumStyle}>Step {step.number}</span>
      <div style={ICON_WRAP_STYLE}>{step.icon}</div>
      <div style={TITLE_STYLE}>{step.title}</div>
      <p style={DESC_STYLE}>{step.description}</p>
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

const HEADER_STYLE: React.CSSProperties = {
  textAlign: "center",
  marginBottom: "64px",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "inline-block",
  fontSize: "11px",
  fontWeight: 700,
  color: COLORS.neonCyan,
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
  maxWidth: "480px",
  margin: "0 auto",
};

const GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "24px",
};

const TRUST_ROW_STYLE: React.CSSProperties = {
  marginTop: "64px",
  padding: "28px 32px",
  background: "rgba(245,230,66,0.04)",
  borderRadius: "16px",
  border: "1px solid rgba(245,230,66,0.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "32px",
  flexWrap: "wrap",
  textAlign: "center",
};

const TRUST_ITEM_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const TRUST_ICON_STYLE: React.CSSProperties = {
  fontSize: "18px",
};

const TRUST_LABEL_STYLE: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: COLORS.textMuted,
};

const HEADER_INITIAL = { opacity: 0, y: 24 };
const HEADER_WHILE_IN_VIEW = { opacity: 1, y: 0 };
const HEADER_VIEWPORT = { once: true };
const HEADER_TRANSITION = { duration: 0.5, ease: "easeOut" };

const TRUST_ROW_INITIAL = { opacity: 0, y: 20 };
const TRUST_ROW_WHILE_IN_VIEW = { opacity: 1, y: 0 };
const TRUST_ROW_VIEWPORT = { once: true };
const TRUST_ROW_TRANSITION = { duration: 0.5, ease: "easeOut" };

const TRUST_ITEMS = [
  { icon: "🔒", label: "Non-Custodial" },
  { icon: "⚡", label: "Automated Rebalancing" },
  { icon: "📊", label: "On-Chain Transparency" },
  { icon: "🌐", label: "24/7 Protection" },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" style={SECTION_STYLE}>
      <div style={INNER_STYLE}>
        <motion.div
          style={HEADER_STYLE}
          initial={HEADER_INITIAL}
          whileInView={HEADER_WHILE_IN_VIEW}
          viewport={HEADER_VIEWPORT}
          transition={HEADER_TRANSITION}
        >
          <span style={LABEL_STYLE}>How It Works</span>
          <h2 style={HEADING_STYLE}>Three Simple Steps</h2>
          <p style={SUB_STYLE}>Fully automated from deposit to yield — no manual hedging required.</p>
        </motion.div>

        <div style={GRID_STYLE}>
          {STEPS.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </div>

        {/* Trust row */}
        <motion.div
          style={TRUST_ROW_STYLE}
          initial={TRUST_ROW_INITIAL}
          whileInView={TRUST_ROW_WHILE_IN_VIEW}
          viewport={TRUST_ROW_VIEWPORT}
          transition={TRUST_ROW_TRANSITION}
        >
          {TRUST_ITEMS.map((item) => (
            <div key={item.label} style={TRUST_ITEM_STYLE}>
              <span style={TRUST_ICON_STYLE}>{item.icon}</span>
              <span style={TRUST_LABEL_STYLE}>{item.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
