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
 * - Long:  accepts up to a HIGHER price  (markPrice * (1 + slippage))
 * - Short: accepts down to a LOWER price (markPrice * (1 - slippage))
 *
 * Passing the wrong direction will cause the Vault to immediately revert.
 *
 * @param markPrice     Current mark price in USD × 1e18
 * @param slippageBps   Slippage in basis points (default 30 = 0.3%)
 * @param isLong        true for long, false for short
 * @returns             Acceptable price in USD × 1e18
 */
export function calcAcceptablePrice(markPrice: bigint, slippageBps: number = DEFAULT_SLIPPAGE_BPS, isLong: boolean): bigint {
  const bps = BigInt(slippageBps);
  if (isLong) {
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
