import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useMemo, type ReactNode } from "react";

import { ShieldIcon, ShortIcon, YieldTokenIcon } from "./MergeIcons";
import { BoltIcon, UnlockIcon, SparkleIcon, DropletIcon, DiamondIcon, ChartUpIcon } from "./StepIcons";
import { useLocale } from "../../../contexts/LocaleContext";

const COLORS = {
  bg: "#000000",
  bgCard: "#0C0C0C",
  border: "rgba(255,255,255,0.1)",
  textPrimary: "#FFFFFF",
  textMuted: "#888888",
};

interface StepIcon {
  number: string;
  icon: ReactNode;
  animationProps: {
    initial: { opacity: number; y: number };
    whileInView: { opacity: number; y: number };
  };
}

const STEP_ANIM = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
};

const STEP_ICONS: StepIcon[] = [
  { number: "01", icon: <BoltIcon />, animationProps: STEP_ANIM },
  { number: "02", icon: <UnlockIcon />, animationProps: STEP_ANIM },
  { number: "03", icon: <SparkleIcon />, animationProps: STEP_ANIM },
  { number: "04", icon: <DropletIcon />, animationProps: STEP_ANIM },
  { number: "05", icon: <DiamondIcon />, animationProps: STEP_ANIM },
  { number: "06", icon: <ChartUpIcon />, animationProps: STEP_ANIM },
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

function StepCard({
  stepIcon,
  title,
  description,
  index,
}: {
  stepIcon: StepIcon;
  title: string;
  description: string;
  index: number;
}) {
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
      initial={stepIcon.animationProps.initial}
      whileInView={stepIcon.animationProps.whileInView}
      viewport={CARD_VIEWPORT}
      transition={cardTransition}
    >
      <div style={accentLineStyle} />
      <div style={ICON_WRAP_STYLE}>{stepIcon.icon}</div>
      <div style={TITLE_STYLE}>{title}</div>
      <p style={DESC_STYLE}>{description}</p>
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

function MergeAnimation({
  label,
  heading,
  yieldTokenLabel,
  shortLabel,
  shieldLabel,
}: {
  label: string;
  heading: string;
  yieldTokenLabel: string;
  shortLabel: string;
  shieldLabel: string;
}) {
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
      <span style={MERGE_LABEL_STYLE}>{label}</span>
      <h3 style={MERGE_HEADING_STYLE}>{heading}</h3>

      <div style={MERGE_STAGE_STYLE}>
        {/* Yield Token icon — slides from left */}
        <motion.div style={rwaIconStyle}>
          <div style={MERGE_ICON_BOX}>
            <YieldTokenIcon size={134} />
          </div>
          <span style={MERGE_ICON_LABEL}>{yieldTokenLabel}</span>
        </motion.div>

        {/* Short icon — slides from right */}
        <motion.div style={shortIconStyle}>
          <div style={MERGE_ICON_BOX}>
            <ShortIcon size={134} />
          </div>
          <span style={MERGE_ICON_LABEL}>{shortLabel}</span>
        </motion.div>

        {/* Shield — appears at center after merge */}
        <motion.div style={shieldIconStyle}>
          <div style={SHIELD_BOX_STYLE}>
            <ShieldIcon size={163} />
          </div>
          <span style={MERGE_ICON_LABEL}>{shieldLabel}</span>
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
  const { locale } = useLocale();
  const { howItWorks } = locale;

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
          <span style={LABEL_STYLE}>{howItWorks.label}</span>
          <h2 style={HEADING_STYLE}>{howItWorks.heading}</h2>
          <p style={SUB_STYLE}>{howItWorks.sub}</p>
        </motion.div>

        <div style={GRID_STYLE}>
          {STEP_ICONS.map((stepIcon, i) => (
            <StepCard
              key={stepIcon.number}
              stepIcon={stepIcon}
              title={howItWorks.steps[i].title}
              description={howItWorks.steps[i].description}
              index={i}
            />
          ))}
        </div>

        {/* Scroll-driven merge animation */}
        <MergeAnimation
          label={howItWorks.merge.label}
          heading={howItWorks.merge.heading}
          yieldTokenLabel={howItWorks.merge.yieldTokenLabel}
          shortLabel={howItWorks.merge.shortLabel}
          shieldLabel={howItWorks.merge.shieldLabel}
        />
      </div>
    </section>
  );
}
