import { motion } from "framer-motion";

const COLORS = {
  bg: "#07070F",
  borderSubtle: "rgba(255,255,255,0.07)",
  neonYellow: "#F5E642",
  textPrimary: "#FFFFFF",
  textMuted: "#6B6B99",
};

const LINKS = [
  { label: "Docs", href: "https://docs.vantage.finance" },
  { label: "GitHub", href: "https://github.com/vantage-finance" },
  { label: "Discord", href: "https://discord.gg/vantage" },
  { label: "Twitter", href: "https://twitter.com/vantage_fi" },
];

const SECTION_STYLE: React.CSSProperties = {
  background: COLORS.bg,
  borderTop: `1px solid ${COLORS.borderSubtle}`,
  padding: "48px 24px",
};

const INNER_STYLE: React.CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "24px",
};

const LOGO_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  textDecoration: "none",
};

const LOGO_MARK_STYLE: React.CSSProperties = {
  width: "30px",
  height: "30px",
  borderRadius: "8px",
  background: `linear-gradient(135deg, ${COLORS.neonYellow} 0%, #FF3CAC 100%)`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: "13px",
  color: "#07070F",
};

const LOGO_TEXT_STYLE: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 800,
  color: COLORS.textPrimary,
  letterSpacing: "-0.4px",
};

const RIGHT_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "32px",
  flexWrap: "wrap",
};

const LINK_STYLE: React.CSSProperties = {
  color: COLORS.textMuted,
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: 500,
  transition: "color 0.15s",
};

const COPYRIGHT_STYLE: React.CSSProperties = {
  width: "100%",
  paddingTop: "24px",
  borderTop: `1px solid ${COLORS.borderSubtle}`,
  marginTop: "8px",
  maxWidth: "1100px",
  margin: "24px auto 0",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "8px",
};

const COPYRIGHT_TEXT_STYLE: React.CSSProperties = {
  fontSize: "13px",
  color: COLORS.textMuted,
};

const DISCLAIMER_STYLE: React.CSSProperties = {
  fontSize: "12px",
  color: "rgba(107,107,153,0.6)",
  maxWidth: "480px",
  textAlign: "right",
};

const FOOTER_INITIAL = { opacity: 0, y: 16 };
const FOOTER_WHILE_IN_VIEW = { opacity: 1, y: 0 };
const FOOTER_VIEWPORT = { once: true };
const FOOTER_TRANSITION = { duration: 0.5, ease: "easeOut" };

export function Footer() {
  return (
    <footer style={SECTION_STYLE}>
      <motion.div
        style={INNER_STYLE}
        initial={FOOTER_INITIAL}
        whileInView={FOOTER_WHILE_IN_VIEW}
        viewport={FOOTER_VIEWPORT}
        transition={FOOTER_TRANSITION}
      >
        <a href="/#/" style={LOGO_STYLE}>
          <div style={LOGO_MARK_STYLE}>V</div>
          <span style={LOGO_TEXT_STYLE}>Vantage</span>
        </a>

        <div style={RIGHT_STYLE}>
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              style={LINK_STYLE}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = COLORS.textPrimary)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = COLORS.textMuted)}
            >
              {link.label}
            </a>
          ))}
        </div>
      </motion.div>

      <div style={COPYRIGHT_STYLE}>
        <span style={COPYRIGHT_TEXT_STYLE}>© 2025 Vantage Finance. All rights reserved.</span>
        <span style={DISCLAIMER_STYLE}>
          DeFi involves risk. Past yields are not indicative of future results. Not financial advice.
        </span>
      </div>
    </footer>
  );
}
