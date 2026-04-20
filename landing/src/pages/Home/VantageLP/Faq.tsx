import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";

import { useLocale } from "../../../contexts/LocaleContext";
import { COLORS } from "../../../styles/vantageTheme";

interface FaqItem {
  question: string;
  answer: string;
}

const ROW_HEADER_STYLE: React.CSSProperties = {
  padding: "20px 24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
};

const QUESTION_STYLE: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: COLORS.textPrimary,
  letterSpacing: "-0.3px",
  flex: 1,
};

const ANSWER_STYLE: React.CSSProperties = {
  padding: "0 24px 20px 24px",
  fontSize: "15px",
  color: COLORS.textSecondary,
  lineHeight: 1.7,
};

const ANSWER_OVERFLOW_STYLE: React.CSSProperties = {
  overflow: "hidden",
};

const ROW_VIEWPORT = { once: true };
const ROW_INITIAL = { opacity: 0, y: 16 };
const ROW_WHILE_IN_VIEW = { opacity: 1, y: 0 };
const CHEVRON_TRANSITION = { duration: 0.25 };

const FAQ_ANSWER_INITIAL = { height: 0, opacity: 0 };
const FAQ_ANSWER_ANIMATE = { height: "auto", opacity: 1 };
const FAQ_ANSWER_EXIT = { height: 0, opacity: 0 };
const FAQ_ANSWER_TRANSITION = { duration: 0.28, ease: "easeOut" };

function FaqRow({ item, index }: { item: FaqItem; index: number }) {
  const [open, setOpen] = useState(false);

  const rowStyle = useMemo(
    () => ({
      background: open ? COLORS.baseHover : COLORS.base,
      borderRadius: "4px",
      border: open ? `1px solid rgba(255,255,255,0.2)` : `1px solid ${COLORS.border}`,
      overflow: "hidden",
      cursor: "pointer",
      transition: "background 0.2s, border-color 0.2s",
    }),
    [open]
  );

  const chevronStyle = useMemo(
    () => ({
      width: "28px",
      height: "28px",
      borderRadius: "4px",
      background: open ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      transition: "background 0.2s",
    }),
    [open]
  );

  const rowTransition = useMemo(() => ({ duration: 0.4, delay: index * 0.08, ease: "easeOut" }), [index]);

  const chevronRotate = useMemo(() => ({ rotate: open ? 180 : 0 }), [open]);

  return (
    <motion.div
      style={rowStyle}
      initial={ROW_INITIAL}
      whileInView={ROW_WHILE_IN_VIEW}
      viewport={ROW_VIEWPORT}
      transition={rowTransition}
      onClick={() => setOpen((prev) => !prev)}
    >
      <div style={ROW_HEADER_STYLE}>
        <span style={QUESTION_STYLE}>{item.question}</span>
        <div style={chevronStyle}>
          <motion.svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            animate={chevronRotate}
            transition={CHEVRON_TRANSITION}
          >
            <path
              d="M2 4.5L7 9.5L12 4.5"
              stroke={open ? COLORS.textPrimary : COLORS.textSecondary}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={FAQ_ANSWER_INITIAL}
            animate={FAQ_ANSWER_ANIMATE}
            exit={FAQ_ANSWER_EXIT}
            transition={FAQ_ANSWER_TRANSITION}
            style={ANSWER_OVERFLOW_STYLE}
          >
            <div style={ANSWER_STYLE}>{item.answer}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const SECTION_STYLE: React.CSSProperties = {
  background: COLORS.bg,
  padding: "100px 40px",
};

const INNER_STYLE: React.CSSProperties = {
  maxWidth: "1920px",
  margin: "0 auto",
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "clamp(28px, 4vw, 44px)",
  fontWeight: 600,
  color: COLORS.textPrimary,
  letterSpacing: "-1.5px",
  marginBottom: "48px",
};

const LIST_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const FAQ_HEADER_INITIAL = { opacity: 0, y: 24 };
const FAQ_HEADER_WHILE_IN_VIEW = { opacity: 1, y: 0 };
const FAQ_HEADER_VIEWPORT = { once: true };
const FAQ_HEADER_TRANSITION = { duration: 0.5, ease: "easeOut" };

export function Faq() {
  const { locale } = useLocale();
  const { faq } = locale;

  return (
    <section id="faq" style={SECTION_STYLE}>
      <div style={INNER_STYLE}>
        <motion.div
          initial={FAQ_HEADER_INITIAL}
          whileInView={FAQ_HEADER_WHILE_IN_VIEW}
          viewport={FAQ_HEADER_VIEWPORT}
          transition={FAQ_HEADER_TRANSITION}
        >
          <h2 style={HEADING_STYLE}>{faq.heading}</h2>
        </motion.div>

        <div style={LIST_STYLE}>
          {faq.items.map((item: FaqItem, i: number) => (
            <FaqRow key={i} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
