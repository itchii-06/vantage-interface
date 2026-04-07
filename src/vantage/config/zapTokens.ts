/**
 * zapTokens.ts
 *
 * Static configuration for tokens supported by LPZapper (Route 2 deposit).
 * Each entry describes an input token that can be swapped via Uniswap V3
 * before being deposited into the target RWA vault.
 *
 * Currently supported: USDC, ETH (native)
 *
 * poolFee: Uniswap V3 fee tier in bps (500=0.05%, 3000=0.3%, 10000=1%)
 * defaultDeviationBps: suggested maxOracleDeviationBps for the route (informational)
 */

export interface ZapTokenConfig {
  /** "usdc" | "eth" */
  key: string;
  /** Display label */
  label: string;
  /** Symbol shown in the UI */
  symbol: string;
  /** Token decimals (6 for USDC, 18 for ETH) */
  decimals: number;
  /** Whether this is the native ETH route (uses zapInETH) */
  isNative: boolean;
  /** Uniswap V3 pool fee tier (bps) */
  poolFee: number;
}

export const ZAP_TOKENS: ZapTokenConfig[] = [
  {
    key: "usdc",
    label: "USDC",
    symbol: "USDC",
    decimals: 6,
    isNative: false,
    poolFee: 3000,
  },
  {
    key: "eth",
    label: "ETH",
    symbol: "ETH",
    decimals: 18,
    isNative: true,
    poolFee: 3000,
  },
];
