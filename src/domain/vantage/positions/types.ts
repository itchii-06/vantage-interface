/**
 * types.ts — Vantage position domain types
 *
 * NOTE: All USD values (size, collateral, averagePrice, pnl) are in WAD precision
 * (PRICE_PRECISION = 1e18), NOT GMX's 1e30.
 * Use formatVantageUsd() from utils.ts — do NOT use GMX's formatUsd() directly.
 */

export type VantagePosition = {
  /** bytes32 position key from Vault.getPositionKey() */
  key: string;
  account: string;
  collateralToken: string;
  indexToken: string;
  isLong: boolean;
  /** Position size in USD, 1e18 precision */
  size: bigint;
  /** Net collateral in USD after fees, 1e18 precision */
  collateral: bigint;
  /** Average entry price, 1e18 precision */
  averagePrice: bigint;
  entryFundingRate: bigint;
  /** Unix timestamp (seconds) of last update */
  lastUpdatedAt: bigint;
  /** Unrealized PnL in USD, 1e18 precision (from VaultReader.getPendingPnL) */
  pendingPnl: bigint;
};

export type VantageAccountSummary = {
  /** Total collateral across all positions, 1e18 precision */
  totalCollateralUsd: bigint;
  /** Total position value (size) across all positions, 1e18 precision */
  totalPositionValueUsd: bigint;
  /** Net unrealized PnL, 1e18 precision (can be negative) */
  netPnlUsd: bigint;
  /** Margin usage in basis points (10000 = 100%) */
  marginUsageBps: bigint;
  isLiquidatable: boolean;
};
