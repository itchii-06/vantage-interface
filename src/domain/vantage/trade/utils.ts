/**
 * utils.ts — Pure helpers for Vantage trade execution.
 *
 * All USD values use 1e18 precision (Vantage WAD), NOT GMX's 1e30.
 */

import type { TradeValidationResult } from "./types";

const DEFAULT_SLIPPAGE_BPS = 30; // 0.3%

/**
 * Calculate the acceptable price for a position, incorporating slippage.
 *
 * The bound direction depends on BOTH `isLong` and `isIncrease`:
 *
 * | Action         | isLong | isIncrease | Bound  | Reason                         |
 * |----------------|--------|------------|--------|--------------------------------|
 * | Open Long      | true   | true       | +slippage | max price willing to buy    |
 * | Open Short     | false  | true       | -slippage | min price willing to sell   |
 * | Close Long     | true   | false      | -slippage | min price willing to sell   |
 * | Close Short    | false  | false      | +slippage | max price willing to buy    |
 *
 * Rule: use upper bound (+) when `isLong === isIncrease`.
 *
 * ⚠️ Passing the wrong direction will cause the Vault to immediately revert.
 *
 * @param markPrice     Current mark price in USD × 1e18
 * @param slippageBps   Slippage in basis points (default 30 = 0.3%)
 * @param isLong        true for long, false for short
 * @param isIncrease    true for open/increase, false for close/decrease (default: true)
 * @returns             Acceptable price in USD × 1e18
 */
export function calcAcceptablePrice(
  markPrice: bigint,
  slippageBps: number = DEFAULT_SLIPPAGE_BPS,
  isLong: boolean,
  isIncrease = true
): bigint {
  const bps = BigInt(slippageBps);
  // Use upper bound (+slippage) when buying (open long or close short)
  const useUpperBound = isLong === isIncrease;
  if (useUpperBound) {
    return (markPrice * (10_000n + bps)) / 10_000n;
  } else {
    return (markPrice * (10_000n - bps)) / 10_000n;
  }
}

/**
 * Validate params before submitting an increasePosition transaction.
 *
 * @param sizeDelta   Requested position size in USD × 1e18
 * @param amountIn    Collateral amount in token units
 * @param balance     User's current token balance in token units
 * @param minSizeUsd  Minimum allowed position size in USD × 1e18 (default: 0)
 */
export function validateIncreasePosition(
  sizeDelta: bigint,
  amountIn: bigint,
  balance: bigint,
  minSizeUsd = 0n
): TradeValidationResult {
  if (sizeDelta <= 0n) {
    return { valid: false, error: "Position size must be greater than zero" };
  }
  if (sizeDelta < minSizeUsd) {
    return { valid: false, error: "Position size below minimum" };
  }
  if (amountIn > balance) {
    return { valid: false, error: "Insufficient balance" };
  }
  return { valid: true };
}

/**
 * Validate params before submitting a decreasePosition transaction.
 *
 * @param sizeDelta   Size to reduce in USD × 1e18
 * @param currentSize Current open position size in USD × 1e18
 */
export function validateDecreasePosition(sizeDelta: bigint, currentSize: bigint): TradeValidationResult {
  if (sizeDelta <= 0n) {
    return { valid: false, error: "Decrease size must be greater than zero" };
  }
  if (sizeDelta > currentSize) {
    return { valid: false, error: "Cannot decrease by more than current position size" };
  }
  return { valid: true };
}
