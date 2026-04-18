import { motion } from "framer-motion";

import { useLocale } from "../../../contexts/LocaleContext";

const COLORS = {
  bg: "#000000",
  border: "rgba(255,255,255,0.1)",
  textPrimary: "#FFFFFF",
  textMuted: "#888888",
};

const LINKS = [
  { label: "Docs", href: "https://docs.vantage.finance" },
  { label: "GitHub", href: "https://github.com/vantage-finance" },
  { label: "Discord", href: "https://discord.gg/vantage" },
  { label: "X", href: "https://twitter.com/vantage_fi" },
];

const SECTION_STYLE: React.CSSProperties = {
  background: COLORS.bg,
  borderTop: `1px solid ${COLORS.border}`,
  padding: "48px 40px 0",
  overflow: "hidden",
};

const GIANT_WRAPPER_STYLE: React.CSSProperties = {
  height: "18vw",
  overflow: "hidden",
  marginTop: "40px",
  marginLeft: "calc(-40px - 5vw)",
};

const GIANT_TEXT_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "clamp(192px, 33.6vw, 672px)",
  fontWeight: 500,
  color: "rgba(255,255,255,0.07)",
  lineHeight: 0.82,
  letterSpacing: "-0.02em",
  whiteSpace: "nowrap",
  userSelect: "none",
  pointerEvents: "none",
};

const INNER_STYLE: React.CSSProperties = {
  maxWidth: "1920px",
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

const LOGO_IMG_STYLE: React.CSSProperties = {
  height: "48px",
  width: "auto",
  display: "block",
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
  fontSize: "16px",
  fontWeight: 500,
  transition: "color 0.15s",
};

const COPYRIGHT_STYLE: React.CSSProperties = {
  width: "100%",
  paddingTop: "24px",
  borderTop: `1px solid ${COLORS.border}`,
  marginTop: "8px",
  maxWidth: "1920px",
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
  color: "rgba(136,136,136,0.6)",
  maxWidth: "480px",
  textAlign: "right",
};

const FOOTER_INITIAL = { opacity: 0, y: 16 };
const FOOTER_WHILE_IN_VIEW = { opacity: 1, y: 0 };
const FOOTER_VIEWPORT = { once: true };
const FOOTER_TRANSITION = { duration: 0.5, ease: "easeOut" };

export function Footer() {
  const { locale } = useLocale();
  const { footer } = locale;

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
          <img src="/icon.svg" alt="B Cellar" style={LOGO_IMG_STYLE} />
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
        <span style={COPYRIGHT_TEXT_STYLE}>{footer.copyright}</span>
        <span style={DISCLAIMER_STYLE}>{footer.disclaimer}</span>
      </div>

      <div style={GIANT_WRAPPER_STYLE}>
        <span style={GIANT_TEXT_STYLE}>BCELLAR</span>
      </div>
    </footer>
  );
}
