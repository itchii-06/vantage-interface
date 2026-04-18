import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";

const COLORS = {
  bg: "#000000",
  bgCard: "#0C0C0C",
  bgCardHover: "#111111",
  border: "rgba(255,255,255,0.1)",
  textPrimary: "#FFFFFF",
  textMuted: "#888888",
};

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is delta-neutral hedging?",
    answer: `It is a strategy designed to cancel out price fluctuations of an asset so you can focus purely on earning or hedging specific risks—like interest rates. By holding a position that moves inversely to your asset (e.g., holding a token while opening an equivalent short position), your net "Delta" becomes zero. This means you remain unaffected by market price swings while B Cellar focuses on neutralizing your funding rate costs.`,
  },
  {
    question: "How do you hedge?",
    answer: `It’s simple and seamless. You deposit your yield-bearing tokens as collateral and select "Hedge Mode." With up to 10x leverage, you can protect a large amount of value with a fraction of the capital. B Cellar’s engine then automatically uses the yield from our Yield-bearing pools to offset your funding rates, creating a "set-and-forget" shield for your portfolio.`,
  },
  {
    question: "Can a hedge be closed at any time?",
    answer: `Absolutely. Your assets are never locked. You have full control to close your hedge, adjust your leverage, or withdraw your collateral at any moment. B Cellar is built on the principles of DeFi—meaning complete liquidity and 24/7 access to your funds without any paperwork or waiting periods.`,
  },
  {
    question: `Where does the "magic" yield come from to offset the FR?`,
    answer: `Our Liquidity Pools are backed by high-quality yield-bearing assets (like stETH/Treasuries). The steady earnings from these assets are redirected to cover the funding costs of hedge-users.`,
  },
  {
    question: "What happens if the market becomes extremely volatile?",
    answer: `B Cellar employs a multi-layered defense sequence, including a Reserve Fund and a Junior Vault buffer. In extreme black-swan events, we prioritize protecting low-leverage, long-term hedgers to ensure system stability.`,
  },
  {
    question: "How is B Cellar different from GMX or Hyperliquid?",
    answer: `While other DEXs focus on speculation with high fluctuating costs, B Cellar is a purpose-built "Interest Rate Infrastructure" that uses asset yields to neutralize trading costs.`,
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
  fontWeight: 600,
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
              stroke={open ? COLORS.textPrimary : COLORS.textMuted}
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
