/**
 * utils.ts — Pure helpers for Vantage position data.
 *
 * All USD values from the Vault contract use PRICE_PRECISION = 1e18 (WAD),
 * NOT GMX's 1e30. The helpers here handle this correctly.
 */

/** Vantage PRICE_PRECISION — same as WAD (1e18), unlike GMX's 1e30 */
export const VANTAGE_PRICE_PRECISION = 10n ** 18n;

/**
 * Format a Vantage USD value (1e18 precision) into a human-readable string.
 * Example: 1_500_000000000000000000n → "$1,500.00"
 */
export function formatVantageUsd(value: bigint, decimals = 2): string {
  const divisor = VANTAGE_PRICE_PRECISION;
  const abs = value < 0n ? -value : value;
  const whole = abs / divisor;
  const frac = abs % divisor;
  const fracStr = frac.toString().padStart(18, "0").slice(0, decimals);
  const sign = value < 0n ? "-" : "";
  const wholeFormatted = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${wholeFormatted}.${fracStr}`;
}

/**
 * Calculate leverage in basis points (10000 = 1x).
 * Returns 0n if collateral is 0 to avoid division by zero.
 */
export function calcLeverageBps(size: bigint, collateral: bigint): bigint {
  if (collateral === 0n) return 0n;
  return (size * 10_000n) / collateral;
}

/**
 * Format leverage from basis points to a human-readable string.
 * Example: 50000n → "5.0x"
 */
export function formatLeverage(leverageBps: bigint): string {
  const whole = leverageBps / 10_000n;
  const frac = (leverageBps % 10_000n) / 1_000n; // 1 decimal place
  return `${whole}.${frac}x`;
}

/**
 * Convert margin usage from basis points (10000 = 100%) to percent string.
 * Example: 7500n → "75.00%"
 */
export function marginUsageToPercent(bps: bigint): string {
  const whole = bps / 100n;
  const frac = bps % 100n;
  return `${whole}.${frac.toString().padStart(2, "0")}%`;
}

/**
 * Returns true if a position's data is stale (older than `maxAgeSeconds`).
 * Uses block timestamp (seconds). Default max age: 5 minutes.
 */
export function isDataStale(lastUpdatedAt: bigint, maxAgeSeconds = 300): boolean {
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  return nowSec - lastUpdatedAt > BigInt(maxAgeSeconds);
}
