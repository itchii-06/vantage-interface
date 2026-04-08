import { motion } from "framer-motion";

const COLORS = {
  bg: "#07070F",
  borderSubtle: "rgba(255,255,255,0.07)",
  neonYellow: "#F5E642",
  textPrimary: "#FFFFFF",
  textMuted: "#6B6B99",
};

const NAV_STYLE: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 100,
  background: "rgba(7,7,15,0.85)",
  backdropFilter: "blur(20px)",
  borderBottom: `1px solid ${COLORS.borderSubtle}`,
};

const INNER_STYLE: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "0 24px",
  height: "64px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const LOGO_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  textDecoration: "none",
};

const LOGO_MARK_STYLE: React.CSSProperties = {
  width: "32px",
  height: "32px",
  borderRadius: "8px",
  background: `linear-gradient(135deg, ${COLORS.neonYellow} 0%, #FF3CAC 100%)`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: "14px",
  color: "#07070F",
};

const LOGO_TEXT_STYLE: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 800,
  color: COLORS.textPrimary,
  letterSpacing: "-0.5px",
};

const LAUNCH_BTN_STYLE: React.CSSProperties = {
  background: COLORS.neonYellow,
  color: "#07070F",
  fontWeight: 700,
  fontSize: "14px",
  padding: "10px 20px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  textDecoration: "none",
  letterSpacing: "0.2px",
  display: "inline-block",
  transition: "opacity 0.15s",
};

const NAV_LINKS_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "32px",
};

const NAV_LINK_STYLE: React.CSSProperties = {
  color: COLORS.textMuted,
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: 500,
};

const NAV_INITIAL = { y: -64, opacity: 0 };
const NAV_ANIMATE = { y: 0, opacity: 1 };
const NAV_TRANSITION = { duration: 0.5, ease: "easeOut" };

export function Nav() {
  return (
    <motion.nav style={NAV_STYLE} initial={NAV_INITIAL} animate={NAV_ANIMATE} transition={NAV_TRANSITION}>
      <div style={INNER_STYLE}>
        <a href="/#/" style={LOGO_STYLE}>
          <div style={LOGO_MARK_STYLE}>V</div>
          <span style={LOGO_TEXT_STYLE}>Vantage</span>
        </a>

        <nav style={NAV_LINKS_STYLE}>
          <a href="/#/vaults" style={NAV_LINK_STYLE}>
            Vaults
          </a>
          <a href="/#/trade" style={NAV_LINK_STYLE}>
            Trade
          </a>
          <a
            href="/#/trade"
            style={LAUNCH_BTN_STYLE}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            Launch App
          </a>
        </nav>
      </div>
    </motion.nav>
  );
}
