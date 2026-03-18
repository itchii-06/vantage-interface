/**
 * types.ts — Parameter types for Vantage trade execution.
 *
 * Decimal precision quick reference:
 *   amountIn       → token's own decimals  (USDC: 1e6, WETH: 1e18)
 *   sizeDelta      → USD × 1e18 (Vantage WAD — NOT GMX's 1e30)
 *   collateralDelta→ USD × 1e18
 *   markPrice      → USD × 1e18
 *   acceptablePrice→ USD × 1e18 (computed by calcAcceptablePrice)
 */

export type IncreasePositionParams = {
  /** Collateral token contract address (e.g. USDC, WETH). Native ETH not supported — use WETH. */
  collateralToken: string;
  /** Index token address for the market (e.g. WETH for ETH/USD). */
  indexToken: string;
  /** Collateral amount in the token's own decimals (e.g. 100_000000n = 100 USDC at 6 dec). */
  amountIn: bigint;
  /** Position size delta in USD × 1e18 (Vantage WAD). Example: 500n * 10n**18n = $500. */
  sizeDelta: bigint;
  isLong: boolean;
  /** Current mark price in USD × 1e18. */
  markPrice: bigint;
  /** Slippage tolerance in basis points. Default: 30 (0.3%). */
  slippageBps?: number;
};

export type DecreasePositionParams = {
  /** Collateral token contract address. */
  collateralToken: string;
  /** Index token address for the market. */
  indexToken: string;
  /** USD collateral to withdraw × 1e18. */
  collateralDelta: bigint;
  /** USD position size to reduce × 1e18. */
  sizeDelta: bigint;
  isLong: boolean;
  /** Address that receives the withdrawn collateral. */
  receiver: string;
  /** Current mark price in USD × 1e18. */
  markPrice: bigint;
  /** Slippage tolerance in basis points. Default: 30 (0.3%). */
  slippageBps?: number;
};

export type TradeValidationResult = {
  valid: boolean;
  error?: string;
};
