import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useMemo, type ReactNode } from "react";

import { ShieldIcon, ShortIcon, YieldTokenIcon } from "./MergeIcons";
import { BoltIcon, UnlockIcon, SparkleIcon, DropletIcon, DiamondIcon, ChartUpIcon } from "./StepIcons";

const COLORS = {
  bg: "#000000",
  bgCard: "#0C0C0C",
  border: "rgba(255,255,255,0.1)",
  textPrimary: "#FFFFFF",
  textMuted: "#888888",
};

interface Step {
  number: string;
  icon: ReactNode;
  title: string;
  description: string;
  animationProps: {
    initial: { opacity: number; x?: number; y?: number; scale?: number };
    whileInView: { opacity: number; x?: number; y?: number; scale?: number };
  };
}

const STEP_ANIM = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
};

const STEPS: Step[] = [
  {
    number: "01",
    icon: <BoltIcon />,
    title: "Dominate Risk with Minimal Capital",
    description:
      "10x leverage lets you deploy maximum interest rate hedging with a fraction of the capital. Small position, massive protection.",
    animationProps: STEP_ANIM,
  },
  {
    number: "02",
    icon: <UnlockIcon />,
    title: "Break Free from Funding Rates",
    description:
      "Yield-bearing token earnings offset your short's FR payments. Maintain your hedge at near-zero ongoing cost — indefinitely.",
    animationProps: STEP_ANIM,
  },
  {
    number: "03",
    icon: <SparkleIcon />,
    title: "Earn While You Hedge",
    description:
      "Your backend assets keep generating yield while the short runs. A dual-yield structure that attacks and defends simultaneously.",
    animationProps: STEP_ANIM,
  },
  {
    number: "04",
    icon: <DropletIcon />,
    title: "LP 2.0: Liquidity That Never Loses",
    description:
      "A next-generation LP model that stays profitable even in bull markets. Delta-neutral design protects LP returns in every market condition.",
    animationProps: STEP_ANIM,
  },
  {
    number: "05",
    icon: <DiamondIcon />,
    title: "Put Your Margin to Work",
    description:
      "Yield-bearing tokens deposited as collateral keep earning while they secure your position. Nothing sits idle — ultimate capital efficiency.",
    animationProps: STEP_ANIM,
  },
  {
    number: "06",
    icon: <ChartUpIcon />,
    title: "Trade Interest Rate Futures",
    description:
      "Go long or short on future funding rates. Lock in your expected yield today, or speculate on where rates are headed — the first on-chain IR futures market.",
    animationProps: STEP_ANIM,
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
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 20px",
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 600,
  color: COLORS.textPrimary,
  letterSpacing: "-0.5px",
  marginBottom: "12px",
  textAlign: "center",
};

const DESC_STYLE: React.CSSProperties = {
  fontSize: "15px",
  color: COLORS.textMuted,
  lineHeight: 1.65,
  textAlign: "center",
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
  height: "320px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const MERGE_ICON_BASE: React.CSSProperties = {
  position: "absolute",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "4px",
};

const MERGE_ICON_BOX: React.CSSProperties = {
  width: "256px",
  height: "256px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const MERGE_ICON_LABEL: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: COLORS.textMuted,
  letterSpacing: "1px",
  textTransform: "uppercase",
};

const SHIELD_BOX_STYLE: React.CSSProperties = {
  width: "256px",
  height: "256px",
  borderRadius: "4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "88px",
};

function MergeAnimation() {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.4", "end 0.3"],
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
  return (
    <div ref={ref} style={MERGE_SECTION_STYLE}>
      <span style={MERGE_LABEL_STYLE}>The Magic</span>
      <h3 style={MERGE_HEADING_STYLE}>Yield Token APY + Short Funding → Full Protection & Funding Income</h3>

      <div style={MERGE_STAGE_STYLE}>
        {/* Yield Token icon — slides from left */}
        <motion.div style={rwaIconStyle}>
          <div style={MERGE_ICON_BOX}>
            <YieldTokenIcon size={134} />
          </div>
          <span style={MERGE_ICON_LABEL}>Yield Token APY</span>
        </motion.div>

        {/* Short icon — slides from right */}
        <motion.div style={shortIconStyle}>
          <div style={MERGE_ICON_BOX}>
            <ShortIcon size={134} />
          </div>
          <span style={MERGE_ICON_LABEL}>Short Funding</span>
        </motion.div>

        {/* Shield — appears at center after merge */}
        <motion.div style={shieldIconStyle}>
          <div style={SHIELD_BOX_STYLE}>
            <ShieldIcon size={163} />
          </div>
          <span style={MERGE_ICON_LABEL}>Protection & FR Income</span>
        </motion.div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section layout constants
// ---------------------------------------------------------------------------

const SECTION_STYLE: React.CSSProperties = {
  background: COLORS.bg,
  padding: "100px 40px",
};

const INNER_STYLE: React.CSSProperties = {
  maxWidth: "1920px",
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
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "24px",
};

const HEADER_INITIAL = { opacity: 0, y: 24 };
const HEADER_WHILE_IN_VIEW = { opacity: 1, y: 0 };
const HEADER_VIEWPORT = { once: true };
const HEADER_TRANSITION = { duration: 0.5, ease: "easeOut" };

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
          <span style={LABEL_STYLE}>Why B Cellar</span>
          <h2 style={HEADING_STYLE}>Built Different</h2>
          <p style={SUB_STYLE}>
            Six structural advantages that make B Cellar the most capital-efficient hedging protocol.
          </p>
        </motion.div>

        <div style={GRID_STYLE}>
          {STEPS.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </div>

        {/* Scroll-driven merge animation */}
        <MergeAnimation />
      </div>
    </section>
  );
}
