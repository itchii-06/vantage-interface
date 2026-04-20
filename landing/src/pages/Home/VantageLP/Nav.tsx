import { motion } from "framer-motion";

import { useLocale } from "../../../contexts/LocaleContext";
import { COLORS } from "../../../styles/vantageTheme";

const NAV_STYLE: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 100,
  background: "rgba(0,0,0,0.85)",
  backdropFilter: "blur(20px)",
  borderBottom: `1px solid ${COLORS.border}`,
};

const INNER_STYLE: React.CSSProperties = {
  maxWidth: "1920px",
  margin: "0 auto",
  padding: "0 40px",
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

const LOGO_IMG_STYLE: React.CSSProperties = {
  height: "22px",
  width: "auto",
  display: "block",
};

const LAUNCH_BTN_STYLE: React.CSSProperties = {
  background: "#ecff3e",
  color: "#000000",
  fontWeight: 600,
  fontSize: "14px",
  padding: "10px 20px",
  borderRadius: "9999px",
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
  color: COLORS.textSecondary,
  textDecoration: "none",
  fontSize: "16px",
  fontWeight: 500,
};

const LANG_TOGGLE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "2px",
  background: "rgba(255,255,255,0.06)",
  borderRadius: "9999px",
  padding: "2px",
  border: `1px solid ${COLORS.border}`,
};

const LANG_BTN_STYLE: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: COLORS.textSecondary,
  fontSize: "12px",
  fontWeight: 600,
  padding: "4px 10px",
  borderRadius: "9999px",
  cursor: "pointer",
  letterSpacing: "0.5px",
};

const LANG_BTN_ACTIVE_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.15)",
  border: "none",
  color: COLORS.textPrimary,
  fontSize: "12px",
  fontWeight: 600,
  padding: "4px 10px",
  borderRadius: "9999px",
  cursor: "pointer",
  letterSpacing: "0.5px",
};

const NAV_INITIAL = { y: -64, opacity: 0 };
const NAV_ANIMATE = { y: 0, opacity: 1 };
const NAV_TRANSITION = { duration: 0.5, ease: "easeOut" };

export function Nav() {
  const { locale, lang, setLang } = useLocale();

  return (
    <motion.nav style={NAV_STYLE} initial={NAV_INITIAL} animate={NAV_ANIMATE} transition={NAV_TRANSITION}>
      <div style={INNER_STYLE}>
        <a href="/#/" style={LOGO_STYLE}>
          <img src="/logo-w.svg" alt="B Cellar" style={LOGO_IMG_STYLE} />
        </a>

        <nav style={NAV_LINKS_STYLE}>
          <a href="/#/hedge" style={NAV_LINK_STYLE}>
            {locale.nav.hedge}
          </a>
          <a href="/#/trade" style={NAV_LINK_STYLE}>
            {locale.nav.trade}
          </a>
          <a href="https://docs.vantage.finance" style={NAV_LINK_STYLE}>
            {locale.nav.docs}
          </a>

          <div style={LANG_TOGGLE_STYLE}>
            <button style={lang === "en" ? LANG_BTN_ACTIVE_STYLE : LANG_BTN_STYLE} onClick={() => setLang("en")}>
              EN
            </button>
            <button style={lang === "ja" ? LANG_BTN_ACTIVE_STYLE : LANG_BTN_STYLE} onClick={() => setLang("ja")}>
              JA
            </button>
          </div>

          <a
            href="/#/trade"
            style={LAUNCH_BTN_STYLE}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.85")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
          >
            {locale.nav.launchApp}
          </a>
        </nav>
      </div>
    </motion.nav>
  );
}
