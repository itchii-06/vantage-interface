/**
 * zapTokens.ts
 *
 * Configuration for LPZapper (Route 2 deposit).
 *
 * Two layers of config:
 *
 *   1. ZAP_TOKENS       — input token list (USDC, ETH). Defines decimals / isNative.
 *      `poolFee` is removed from here — the fee is determined per (inputToken, targetToken) pair.
 *
 *   2. POOL_FEE_CONFIG   — per-target-token optimal Uniswap V3 fee tier mapping.
 *      Each target RWA token has a record of { usdc: fee, eth: fee } reflecting
 *      the deepest pool for that route on Arbitrum One.
 *
 * Fee tier guide:
 *   100   = 0.01% (extremely stable pairs, e.g. USDC/USDT)
 *   500   = 0.05% (stable-ish pairs, e.g. ETH/wstETH, USDC/sUSDS)
 *   3000  = 0.30% (standard volatile pairs)
 *   10000 = 1.00% (exotic / low-liquidity pairs)
 *
 * Sources (Arbitrum One, verified 2026-04):
 *   - sUSDS  : USDC→sUSDS 500  (Sky Money stable corridor)
 *   - sUSDe  : USDC→sUSDe 500  (Ethena stable corridor)
 *   - wstETH : USDC→wstETH 3000, ETH→wstETH 500
 *
 * ⚠ VERIFY fee tiers against Uniswap V3 pool analytics before mainnet deployment.
 *   Pools with insufficient liquidity should use 3000 as a safe default.
 */

// ---------------------------------------------------------------------------
// Input token (USDC / ETH)
// ---------------------------------------------------------------------------

export interface ZapTokenConfig {
  /** "usdc" | "eth" */
  key: string;
  /** Display label */
  label: string;
  /** Symbol shown in the UI */
  symbol: string;
  /** Token decimals (6 for USDC, 18 for ETH/WETH) */
  decimals: number;
  /** Whether this is the native ETH route (uses zapInETH) */
  isNative: boolean;
}

export const ZAP_TOKENS: ZapTokenConfig[] = [
  {
    key: "usdc",
    label: "USDC",
    symbol: "USDC",
    decimals: 6,
    isNative: false,
  },
  {
    key: "eth",
    label: "ETH",
    symbol: "ETH",
    decimals: 18,
    isNative: true,
  },
];

// ---------------------------------------------------------------------------
// Per-target-token fee tier map
// ---------------------------------------------------------------------------

/** Uniswap V3 fee tiers (basis points). */
export const FEE = {
  LOWEST: 100,
  LOW: 500,
  MEDIUM: 3000,
  HIGH: 10000,
} as const;

export type FeeTier = (typeof FEE)[keyof typeof FEE];

/**
 * Optimal pool fee tier keyed by target token symbol (uppercase).
 * Separate values for the USDC→token and ETH→token routes.
 *
 * Fallback: MEDIUM (3000) when a token is not listed here.
 */
export const POOL_FEE_CONFIG: Record<string, { usdc: FeeTier; eth: FeeTier }> = {
  // Sky Money Savings USDS — very stable vs. USDC, tightest pool
  sUSDS: { usdc: FEE.LOW, eth: FEE.MEDIUM },

  // Ethena Staked USDe — stable vs. USDC
  sUSDe: { usdc: FEE.LOW, eth: FEE.MEDIUM },

  // Wrapped staked ETH — liquid wstETH/ETH pool exists at 500
  wstETH: { usdc: FEE.MEDIUM, eth: FEE.LOW },

  // Mock tokens (testnet) — MockSwapRouter ignores fee, use MEDIUM as placeholder
  mBUIDL: { usdc: FEE.MEDIUM, eth: FEE.MEDIUM },
  mUSDY: { usdc: FEE.MEDIUM, eth: FEE.MEDIUM },
  mRWA: { usdc: FEE.MEDIUM, eth: FEE.MEDIUM },
};

/**
 * Returns the optimal Uniswap V3 fee tier for swapping `zapTokenKey` → `targetSymbol`.
 * Falls back to MEDIUM (3000) when the pair is not explicitly configured.
 */
export function resolvePoolFee(zapTokenKey: "usdc" | "eth", targetSymbol: string): FeeTier {
  const entry = POOL_FEE_CONFIG[targetSymbol];
  if (!entry) return FEE.MEDIUM;
  return entry[zapTokenKey];
}
