import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";

const COLORS = {
  bg: "#07070F",
  bgCard: "#0E0E1C",
  bgCardHover: "#12122A",
  borderSubtle: "rgba(255,255,255,0.07)",
  neonYellow: "#F5E642",
  textPrimary: "#FFFFFF",
  textMuted: "#6B6B99",
};

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is delta-neutral hedging?",
    answer:
      "Delta-neutral hedging means holding positions whose combined price exposure nets to zero. In Vantage, we pair your long RWA holding with a precisely sized perpetual short. If the underlying asset drops 10%, your short gains approximately the same amount, so your capital remains protected. You still collect the RWA's native yield and any positive funding rates earned from holding the short.",
  },
  {
    question: "How does the vault earn yield?",
    answer:
      "Vaults earn from two complementary sources: (1) the native yield of the real-world asset — such as BlackRock money market fund accruals on mBUIDL — and (2) the funding rate paid by leveraged longs on the perpetual exchange. When market sentiment is bullish and funding rates are positive, short holders receive periodic payments. The combined yield is distributed continuously to vault depositors.",
  },
  {
    question: "Can I withdraw anytime?",
    answer:
      "Yes. Withdrawals are non-custodial and can be initiated at any time. When you withdraw, the protocol automatically unwinds the corresponding short position and returns your principal plus accrued yield. During periods of extreme market volatility, there may be a short execution delay to ensure orderly unwinding, but there are no lock-up periods or withdrawal gates under normal conditions.",
  },
  {
    question: "What are the risks?",
    answer:
      "Key risks include: (1) Smart contract risk — audited code, but on-chain bugs can never be fully eliminated. (2) Oracle risk — price feeds could temporarily diverge, affecting hedge precision. (3) Extreme funding rate reversal — if funding turns sharply negative, net APY may decrease temporarily. (4) RWA issuer risk — the underlying asset's issuer could face regulatory or operational issues. We mitigate these through multi-oracle price feeds, insurance fund reserves, and circuit-breaker mechanisms.",
  },
];

const ROW_HEADER_STYLE: React.CSSProperties = {
  padding: "20px 24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
};

const QUESTION_STYLE: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  color: COLORS.textPrimary,
  letterSpacing: "-0.3px",
  flex: 1,
};

const ANSWER_STYLE: React.CSSProperties = {
  padding: "0 24px 20px 24px",
  fontSize: "15px",
  color: COLORS.textMuted,
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
      background: open ? COLORS.bgCardHover : COLORS.bgCard,
      borderRadius: "16px",
      border: open ? `1px solid rgba(245,230,66,0.2)` : `1px solid ${COLORS.borderSubtle}`,
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
      borderRadius: "8px",
      background: open ? "rgba(245,230,66,0.12)" : "rgba(255,255,255,0.05)",
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
              stroke={open ? COLORS.neonYellow : COLORS.textMuted}
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
  padding: "100px 24px",
};

const INNER_STYLE: React.CSSProperties = {
  maxWidth: "760px",
  margin: "0 auto",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "inline-block",
  fontSize: "11px",
  fontWeight: 700,
  color: COLORS.neonYellow,
  letterSpacing: "2px",
  textTransform: "uppercase",
  marginBottom: "16px",
};

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "clamp(28px, 4vw, 44px)",
  fontWeight: 900,
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
  return (
    <section id="faq" style={SECTION_STYLE}>
      <div style={INNER_STYLE}>
        <motion.div
          initial={FAQ_HEADER_INITIAL}
          whileInView={FAQ_HEADER_WHILE_IN_VIEW}
          viewport={FAQ_HEADER_VIEWPORT}
          transition={FAQ_HEADER_TRANSITION}
        >
          <span style={LABEL_STYLE}>FAQ</span>
          <h2 style={HEADING_STYLE}>Common Questions</h2>
        </motion.div>

        <div style={LIST_STYLE}>
          {FAQ_ITEMS.map((item, i) => (
            <FaqRow key={i} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
