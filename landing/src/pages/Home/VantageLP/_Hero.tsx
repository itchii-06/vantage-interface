import { motion } from "framer-motion";

import { useCountUp } from "./hooks/useCountUp";

const COLORS = {
  bg: "#000000",
  bgCard: "#0C0C0C",
  border: "rgba(255,255,255,0.1)",
  textPrimary: "#FFFFFF",
  textMuted: "#888888",
};

interface StatItemProps {
  target: number;
  format: "dollar-M" | "percent" | "integer";
  label: string;
  decimals?: number;
}

const STAT_CONTAINER_STYLE: React.CSSProperties = {
  textAlign: "center",
  padding: "20px 32px",
  background: COLORS.bgCard,
  borderRadius: "4px",
  border: `1px solid ${COLORS.border}`,
  minWidth: "140px",
};

const STAT_VALUE_STYLE: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 600,
  color: COLORS.textPrimary,
  letterSpacing: "-1px",
  display: "block",
};

const STAT_LABEL_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: COLORS.textMuted,
  fontWeight: 500,
  marginTop: "4px",
  display: "block",
  textTransform: "uppercase",
  letterSpacing: "1px",
};

function StatItem({ target, format, label, decimals }: StatItemProps) {
  const { display, elementRef } = useCountUp({ target, format, decimals, duration: 1600 });

  return (
    <div style={STAT_CONTAINER_STYLE}>
      <span ref={elementRef as React.RefObject<HTMLSpanElement>} style={STAT_VALUE_STYLE}>
        {display}
      </span>
      <span style={STAT_LABEL_STYLE}>{label}</span>
    </div>
  );
}

const STATS: StatItemProps[] = [
  { target: 12.4, format: "dollar-M", label: "Total Value Locked", decimals: 1 },
  { target: 3, format: "integer", label: "Active Vaults" },
  { target: 142, format: "integer", label: "Positions Protected" },
];

const SECTION_STYLE: React.CSSProperties = {
  position: "relative",
  minHeight: "100vh",
  background: COLORS.bg,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  paddingTop: "80px",
  paddingBottom: "80px",
};

const INNER_STYLE: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  maxWidth: "1920px",
  margin: "0 auto",
  padding: "0 40px",
  textAlign: "center",
};

const BADGE_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "rgba(255,255,255,0.06)",
  border: `1px solid ${COLORS.border}`,
  borderRadius: "4px",
  padding: "6px 16px",
  marginBottom: "28px",
};

const HEADLINE_STYLE: React.CSSProperties = {
  fontSize: "clamp(42px, 7vw, 80px)",
  fontWeight: 600,
  color: COLORS.textPrimary,
  lineHeight: 1.0,
  letterSpacing: "-3px",
  marginBottom: "24px",
};

const SUBTEXT_STYLE: React.CSSProperties = {
  fontSize: "18px",
  color: COLORS.textMuted,
  lineHeight: 1.6,
  maxWidth: "560px",
  margin: "0 auto 40px auto",
};

const CTA_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  justifyContent: "center",
  marginBottom: "72px",
  flexWrap: "wrap",
};

const PRIMARY_BTN_STYLE: React.CSSProperties = {
  background: "#ecff3e",
  color: "#000000",
  fontWeight: 600,
  fontSize: "16px",
  padding: "14px 32px",
  borderRadius: "9999px",
  border: "none",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
  letterSpacing: "-0.2px",
};

const SECONDARY_BTN_STYLE: React.CSSProperties = {
  background: "transparent",
  color: COLORS.textPrimary,
  fontWeight: 500,
  fontSize: "16px",
  padding: "14px 32px",
  borderRadius: "9999px",
  border: "1px solid rgba(255,255,255,0.4)",
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
};

const STATS_GRID_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "16px",
  justifyContent: "center",
  flexWrap: "wrap",
};

const BADGE_LABEL_STYLE: React.CSSProperties = {
  color: COLORS.textPrimary,
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "1.5px",
  textTransform: "uppercase",
};

const HERO_BADGE_INITIAL = { opacity: 0, y: 30 };
const HERO_BADGE_ANIMATE = { opacity: 1, y: 0 };
const HERO_BADGE_TRANSITION = { duration: 0.6, ease: "easeOut" };

const HERO_H1_INITIAL = { opacity: 0, y: 40 };
const HERO_H1_ANIMATE = { opacity: 1, y: 0 };
const HERO_H1_TRANSITION = { duration: 0.7, delay: 0.1, ease: "easeOut" };

const HERO_P_INITIAL = { opacity: 0, y: 30 };
const HERO_P_ANIMATE = { opacity: 1, y: 0 };
const HERO_P_TRANSITION = { duration: 0.6, delay: 0.2, ease: "easeOut" };

const HERO_CTA_INITIAL = { opacity: 0, y: 20 };
const HERO_CTA_ANIMATE = { opacity: 1, y: 0 };
const HERO_CTA_TRANSITION = { duration: 0.5, delay: 0.35, ease: "easeOut" };

const HERO_STATS_INITIAL = { opacity: 0, y: 20 };
const HERO_STATS_ANIMATE = { opacity: 1, y: 0 };
const HERO_STATS_TRANSITION = { duration: 0.5, delay: 0.5, ease: "easeOut" };

export function Hero() {
  return (
    <section style={SECTION_STYLE}>
      <div style={INNER_STYLE}>
        <motion.div initial={HERO_BADGE_INITIAL} animate={HERO_BADGE_ANIMATE} transition={HERO_BADGE_TRANSITION}>
          <div style={BADGE_STYLE}>
            <span style={BADGE_LABEL_STYLE}>Perp Hedge DEX</span>
          </div>
        </motion.div>

        <motion.h1
          style={HEADLINE_STYLE}
          initial={HERO_H1_INITIAL}
          animate={HERO_H1_ANIMATE}
          transition={HERO_H1_TRANSITION}
        >
          Neutralize Interest Rate Hikes
        </motion.h1>

        <motion.p
          style={SUBTEXT_STYLE}
          initial={HERO_P_INITIAL}
          animate={HERO_P_ANIMATE}
          transition={HERO_P_TRANSITION}
        >
          Protect your earnings with the power of yield-bearing tokens. B Cellar is the world's first perp hedge DEX,
          securing your returns and your portfolio.
        </motion.p>

        <motion.div
          style={CTA_ROW_STYLE}
          initial={HERO_CTA_INITIAL}
          animate={HERO_CTA_ANIMATE}
          transition={HERO_CTA_TRANSITION}
        >
          <a
            href="/#/trade"
            style={PRIMARY_BTN_STYLE}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
            }}
          >
            Launch App ↗
          </a>
          <a
            href="https://docs.vantage.finance"
            target="_blank"
            rel="noopener noreferrer"
            style={SECONDARY_BTN_STYLE}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.3)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = COLORS.border;
            }}
          >
            Docs
          </a>
        </motion.div>

        <motion.div
          style={STATS_GRID_STYLE}
          initial={HERO_STATS_INITIAL}
          animate={HERO_STATS_ANIMATE}
          transition={HERO_STATS_TRANSITION}
        >
          {STATS.map((stat, i) => (
            <StatItem key={i} {...stat} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
