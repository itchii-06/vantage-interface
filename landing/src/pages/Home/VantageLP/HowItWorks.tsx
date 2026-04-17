import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useMemo } from "react";

const COLORS = {
  bg: "#000000",
  bgCard: "#0C0C0C",
  border: "rgba(255,255,255,0.1)",
  textPrimary: "#FFFFFF",
  textMuted: "#888888",
};

interface Step {
  number: string;
  icon: string;
  title: string;
  description: string;
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
    animationProps: {
      initial: { opacity: 0, scale: 0.85 },
      whileInView: { opacity: 1, scale: 1 },
    },
  },
];

const CARD_BASE_STYLE: React.CSSProperties = {
  background: COLORS.bgCard,
  borderRadius: "4px",
  border: `1px solid ${COLORS.border}`,
  padding: "36px 32px",
  position: "relative",
  overflow: "hidden",
};

const ICON_WRAP_STYLE: React.CSSProperties = {
  width: "60px",
  height: "60px",
  borderRadius: "4px",
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
  fontWeight: 600,
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
      height: "1px",
      background: "rgba(255,255,255,0.2)",
    }),
    []
  );

  const stepNumStyle = useMemo(
    () => ({
      fontSize: "11px",
      fontWeight: 600,
      color: COLORS.textMuted,
      letterSpacing: "2px",
      textTransform: "uppercase" as const,
      marginBottom: "16px",
      display: "block",
    }),
    []
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

// ---------------------------------------------------------------------------
// Scroll-driven merge animation
// ---------------------------------------------------------------------------

const MERGE_SECTION_STYLE: React.CSSProperties = {
  position: "relative",
  margin: "80px 0 0",
  padding: "80px 0",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  overflow: "hidden",
};

const MERGE_LABEL_STYLE: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: COLORS.textMuted,
  letterSpacing: "2px",
  textTransform: "uppercase",
  marginBottom: "12px",
};

const MERGE_HEADING_STYLE: React.CSSProperties = {
  fontSize: "clamp(22px, 3vw, 32px)",
  fontWeight: 600,
  color: COLORS.textPrimary,
  letterSpacing: "-1px",
  marginBottom: "64px",
  textAlign: "center",
};

const MERGE_STAGE_STYLE: React.CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: "600px",
  height: "160px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const MERGE_ICON_BASE: React.CSSProperties = {
  position: "absolute",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
};

const MERGE_ICON_BOX: React.CSSProperties = {
  width: "80px",
  height: "80px",
  borderRadius: "4px",
  background: COLORS.bgCard,
  border: `1px solid ${COLORS.border}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "36px",
};

const MERGE_ICON_LABEL: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: COLORS.textMuted,
  letterSpacing: "1px",
  textTransform: "uppercase",
};

const SHIELD_BOX_STYLE: React.CSSProperties = {
  width: "96px",
  height: "96px",
  borderRadius: "4px",
  background: COLORS.bgCard,
  border: `1px solid rgba(255,255,255,0.25)`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "44px",
};

const MERGE_DIVIDER_STYLE: React.CSSProperties = {
  marginTop: "48px",
  width: "1px",
  height: "40px",
  background: "linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)",
};

const MERGE_RESULT_STYLE: React.CSSProperties = {
  marginTop: "16px",
  textAlign: "center",
};

const MERGE_RESULT_TITLE_STYLE: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: COLORS.textPrimary,
  marginBottom: "4px",
};

const MERGE_RESULT_DESC_STYLE: React.CSSProperties = {
  fontSize: "14px",
  color: COLORS.textMuted,
};

function MergeAnimation() {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.6"],
  });

  // RWA slides from left (-180px) to center (0)
  const rwaX = useTransform(scrollYProgress, [0, 0.45], [-180, 0]);
  // Short slides from right (180px) to center (0)
  const shortX = useTransform(scrollYProgress, [0, 0.45], [180, 0]);
  // Both icons fade out as they merge
  const bothOpacity = useTransform(scrollYProgress, [0.35, 0.55], [1, 0]);
  // Shield fades in + scales up after merge
  const shieldOpacity = useTransform(scrollYProgress, [0.5, 0.75], [0, 1]);
  const shieldScale = useTransform(scrollYProgress, [0.5, 0.75], [0.6, 1]);
  // Result text fades in
  const resultOpacity = useTransform(scrollYProgress, [0.65, 0.85], [0, 1]);
  const resultY = useTransform(scrollYProgress, [0.65, 0.85], [16, 0]);

  const rwaIconStyle = useMemo(
    () => ({ ...MERGE_ICON_BASE, left: "50%" as const, translateX: "-50%", x: rwaX, opacity: bothOpacity }),
    [rwaX, bothOpacity]
  );
  const shortIconStyle = useMemo(
    () => ({ ...MERGE_ICON_BASE, left: "50%" as const, translateX: "-50%", x: shortX, opacity: bothOpacity }),
    [shortX, bothOpacity]
  );
  const shieldIconStyle = useMemo(
    () => ({
      ...MERGE_ICON_BASE,
      left: "50%" as const,
      translateX: "-50%",
      opacity: shieldOpacity,
      scale: shieldScale,
    }),
    [shieldOpacity, shieldScale]
  );
  const resultMotionStyle = useMemo(
    () => ({ ...MERGE_RESULT_STYLE, opacity: resultOpacity, y: resultY }),
    [resultOpacity, resultY]
  );

  return (
    <div ref={ref} style={MERGE_SECTION_STYLE}>
      <span style={MERGE_LABEL_STYLE}>The Magic</span>
      <h3 style={MERGE_HEADING_STYLE}>RWA Yield + Short Funding → Full Protection</h3>

      <div style={MERGE_STAGE_STYLE}>
        {/* RWA icon — slides from left */}
        <motion.div style={rwaIconStyle}>
          <div style={MERGE_ICON_BOX}>🏦</div>
          <span style={MERGE_ICON_LABEL}>RWA</span>
        </motion.div>

        {/* Short icon — slides from right */}
        <motion.div style={shortIconStyle}>
          <div style={MERGE_ICON_BOX}>📉</div>
          <span style={MERGE_ICON_LABEL}>Short</span>
        </motion.div>

        {/* Shield — appears at center after merge */}
        <motion.div style={shieldIconStyle}>
          <div style={SHIELD_BOX_STYLE}>🛡️</div>
          <span style={MERGE_ICON_LABEL}>Protected</span>
        </motion.div>
      </div>

      <div style={MERGE_DIVIDER_STYLE} />

      <motion.div style={resultMotionStyle}>
        <div style={MERGE_RESULT_TITLE_STYLE}>Delta-Neutral Yield</div>
        <div style={MERGE_RESULT_DESC_STYLE}>Price risk cancelled. Native yield stays.</div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section layout constants
// ---------------------------------------------------------------------------

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
  fontWeight: 600,
  color: COLORS.textMuted,
  letterSpacing: "2px",
  textTransform: "uppercase",
  marginBottom: "16px",
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "clamp(32px, 5vw, 52px)",
  fontWeight: 600,
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
  background: "rgba(255,255,255,0.03)",
  borderRadius: "4px",
  border: `1px solid ${COLORS.border}`,
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
  fontWeight: 500,
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

        {/* Scroll-driven merge animation */}
        <MergeAnimation />

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
