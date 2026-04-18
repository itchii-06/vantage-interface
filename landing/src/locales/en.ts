export interface LocaleData {
  nav: {
    hedge: string;
    trade: string;
    docs: string;
    launchApp: string;
  };
  hero: {
    badge: string;
    headline: string;
    subtext: string;
    ctaPrimary: string;
    ctaSecondary: string;
    stats: {
      tvl: string;
      activeVaults: string;
      positionsProtected: string;
    };
  };
  vaults: {
    heading: string;
    sub: string;
    metrics: {
      vaultApy: string;
      fundingRate: string;
      netApy: string;
    };
    capacity: string;
    filled: string;
    cta: string;
    vaultTypes: [string, string, string];
  };
  howItWorks: {
    label: string;
    heading: string;
    sub: string;
    steps: Array<{ title: string; description: string }>;
    trustLabels: [string, string, string, string];
    merge: {
      label: string;
      heading: string;
      yieldTokenLabel: string;
      shortLabel: string;
      shieldLabel: string;
    };
  };
  faq: {
    heading: string;
    items: Array<{ question: string; answer: string }>;
  };
  footer: {
    copyright: string;
    disclaimer: string;
  };
}

export const en: LocaleData = {
  nav: {
    hedge: "Hedge",
    trade: "Trade",
    docs: "Docs",
    launchApp: "Launch App",
  },
  hero: {
    badge: "Perp Hedge DEX",
    headline: "Neutralize Interest Rate Hikes",
    subtext:
      "Protect your earnings with the power of yield-bearing tokens. B Cellar is the world's first perp hedge DEX, securing your returns and your portfolio.",
    ctaPrimary: "Launch App ↗",
    ctaSecondary: "Docs",
    stats: {
      tvl: "Total Value Locked",
      activeVaults: "Active Vaults",
      positionsProtected: "Positions Protected",
    },
  },
  vaults: {
    heading: "Pick Your Strategy",
    sub: "Each vault is actively hedged with a perpetual short.",
    metrics: {
      vaultApy: "Vault APY",
      fundingRate: "Funding Rate",
      netApy: "Net APY",
    },
    capacity: "Capacity",
    filled: "% filled",
    cta: "Zap & Deposit →",
    vaultTypes: ["Money Market RWA", "Yield-Bearing Stablecoin", "Diversified RWA Basket"],
  },
  howItWorks: {
    label: "Why B Cellar",
    heading: "Built Different",
    sub: "Six structural advantages that make B Cellar the most capital-efficient hedging protocol.",
    steps: [
      {
        title: "Dominate Risk with Minimal Capital",
        description:
          "10x leverage lets you deploy maximum interest rate hedging with a fraction of the capital. Small position, massive protection.",
      },
      {
        title: "Break Free from Funding Rates",
        description:
          "Yield-bearing token earnings offset your short's FR payments. Maintain your hedge at near-zero ongoing cost — indefinitely.",
      },
      {
        title: "Earn While You Hedge",
        description:
          "Your backend assets keep generating yield while the short runs. A dual-yield structure that attacks and defends simultaneously.",
      },
      {
        title: "LP 2.0: Liquidity That Never Loses",
        description:
          "A next-generation LP model that stays profitable even in bull markets. Delta-neutral design protects LP returns in every market condition.",
      },
      {
        title: "Put Your Margin to Work",
        description:
          "Yield-bearing tokens deposited as collateral keep earning while they secure your position. Nothing sits idle — ultimate capital efficiency.",
      },
      {
        title: "Trade Interest Rate Futures",
        description:
          "Go long or short on future funding rates. Lock in your expected yield today, or speculate on where rates are headed — the first on-chain IR futures market.",
      },
    ],
    trustLabels: ["Non-Custodial", "Automated Rebalancing", "On-Chain Transparency", "24/7 Protection"],
    merge: {
      label: "The Magic",
      heading: "Yield Token APY + Short Funding → Full Protection & Funding Income",
      yieldTokenLabel: "Yield Token APY",
      shortLabel: "Short Funding",
      shieldLabel: "Protection & FR Income",
    },
  },
  faq: {
    heading: "Common Questions",
    items: [
      {
        question: "What is delta-neutral hedging?",
        answer:
          'It is a strategy designed to cancel out price fluctuations of an asset so you can focus purely on earning or hedging specific risks—like interest rates. By holding a position that moves inversely to your asset (e.g., holding a token while opening an equivalent short position), your net "Delta" becomes zero. This means you remain unaffected by market price swings while B Cellar focuses on neutralizing your funding rate costs.',
      },
      {
        question: "How do you hedge?",
        answer:
          'It\'s simple and seamless. You deposit your yield-bearing tokens as collateral and select "Hedge Mode." With up to 10x leverage, you can protect a large amount of value with a fraction of the capital. B Cellar\'s engine then automatically uses the yield from our Yield-bearing pools to offset your funding rates, creating a "set-and-forget" shield for your portfolio.',
      },
      {
        question: "Can a hedge be closed at any time?",
        answer:
          "Absolutely. Your assets are never locked. You have full control to close your hedge, adjust your leverage, or withdraw your collateral at any moment. B Cellar is built on the principles of DeFi—meaning complete liquidity and 24/7 access to your funds without any paperwork or waiting periods.",
      },
      {
        question: `Where does the "magic" yield come from to offset the FR?`,
        answer:
          "Our Liquidity Pools are backed by high-quality yield-bearing assets (like stETH/Treasuries). The steady earnings from these assets are redirected to cover the funding costs of hedge-users.",
      },
      {
        question: "What happens if the market becomes extremely volatile?",
        answer:
          "B Cellar employs a multi-layered defense sequence, including a Reserve Fund and a Junior Vault buffer. In extreme black-swan events, we prioritize protecting low-leverage, long-term hedgers to ensure system stability.",
      },
      {
        question: "How is B Cellar different from GMX or Hyperliquid?",
        answer:
          'While other DEXs focus on speculation with high fluctuating costs, B Cellar is a purpose-built "Interest Rate Infrastructure" that uses asset yields to neutralize trading costs.',
      },
    ],
  },
  footer: {
    copyright: "© 2026 B Cellar Finance. All rights reserved.",
    disclaimer: "DeFi involves risk. Past yields are not indicative of future results. Not financial advice.",
  },
};
