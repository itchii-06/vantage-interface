import { describe, expect, it } from "vitest";

import { calcAcceptablePrice, validateDecreasePosition, validateIncreasePosition } from "../utils";

const WAD = 10n ** 18n; // Vantage price precision (1e18)
const PRICE_1000 = 1_000n * WAD;

// ---------------------------------------------------------------------------
// calcAcceptablePrice
// ---------------------------------------------------------------------------
describe("calcAcceptablePrice", () => {
  // --- INCREASE positions ---
  it("open long 30bps: acceptable price is HIGHER (max buy price)", () => {
    const result = calcAcceptablePrice(PRICE_1000, 30, true, true);
    expect(result).toBe(1_003n * WAD);
    expect(result).toBeGreaterThan(PRICE_1000);
  });

  it("open short 30bps: acceptable price is LOWER (min sell price)", () => {
    const result = calcAcceptablePrice(PRICE_1000, 30, false, true);
    expect(result).toBe(997n * WAD);
    expect(result).toBeLessThan(PRICE_1000);
  });

  // --- DECREASE positions (isIncrease=false inverts the bound) ---
  it("close long 30bps: acceptable price is LOWER (min sell price)", () => {
    const result = calcAcceptablePrice(PRICE_1000, 30, true, false);
    expect(result).toBe(997n * WAD);
    expect(result).toBeLessThan(PRICE_1000);
  });

  it("close short 30bps: acceptable price is HIGHER (max buy-back price)", () => {
    const result = calcAcceptablePrice(PRICE_1000, 30, false, false);
    expect(result).toBe(1_003n * WAD);
    expect(result).toBeGreaterThan(PRICE_1000);
  });

  // --- Edge cases ---
  it("0bps: acceptable price equals mark price exactly", () => {
    expect(calcAcceptablePrice(PRICE_1000, 0, true, true)).toBe(PRICE_1000);
    expect(calcAcceptablePrice(PRICE_1000, 0, false, true)).toBe(PRICE_1000);
    expect(calcAcceptablePrice(PRICE_1000, 0, true, false)).toBe(PRICE_1000);
    expect(calcAcceptablePrice(PRICE_1000, 0, false, false)).toBe(PRICE_1000);
  });

  it("isIncrease defaults to true (backwards-compatible with Issue #10 callers)", () => {
    // 3-arg call should behave as increase
    expect(calcAcceptablePrice(PRICE_1000, 30, true)).toBe(1_003n * WAD);
    expect(calcAcceptablePrice(PRICE_1000, 30, false)).toBe(997n * WAD);
  });

  it("uses default slippage (30 bps) when not specified", () => {
    expect(calcAcceptablePrice(PRICE_1000, undefined as unknown as number, true)).toBe(1_003n * WAD);
  });
});

// ---------------------------------------------------------------------------
// validateIncreasePosition
// ---------------------------------------------------------------------------
describe("validateIncreasePosition", () => {
  const SIZE = 500n * WAD;
  const AMOUNT_IN = 100_000_000n; // 100 USDC (6 decimals)
  const BALANCE = 200_000_000n;   // 200 USDC

  it("returns valid for correct inputs", () => {
    expect(validateIncreasePosition(SIZE, AMOUNT_IN, BALANCE)).toEqual({ valid: true });
  });

  it("returns error when sizeDelta is zero", () => {
    const result = validateIncreasePosition(0n, AMOUNT_IN, BALANCE);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/greater than zero/i);
  });

  it("returns error when sizeDelta is negative", () => {
    const result = validateIncreasePosition(-1n, AMOUNT_IN, BALANCE);
    expect(result.valid).toBe(false);
  });

  it("returns error when amountIn exceeds balance", () => {
    const result = validateIncreasePosition(SIZE, BALANCE + 1n, BALANCE);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/insufficient balance/i);
  });

  it("returns error when sizeDelta is below minSizeUsd", () => {
    const minSize = 1_000n * WAD;
    const result = validateIncreasePosition(500n * WAD, AMOUNT_IN, BALANCE, minSize);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/minimum/i);
  });

  it("exact balance (amountIn === balance) is valid", () => {
    expect(validateIncreasePosition(SIZE, BALANCE, BALANCE)).toEqual({ valid: true });
  });
});

// ---------------------------------------------------------------------------
// validateDecreasePosition
// ---------------------------------------------------------------------------
describe("validateDecreasePosition", () => {
  const CURRENT_SIZE = 500n * WAD;

  it("returns valid when sizeDelta is within current size", () => {
    expect(validateDecreasePosition(100n * WAD, CURRENT_SIZE)).toEqual({ valid: true });
  });

  it("returns valid when sizeDelta equals current size (full close)", () => {
    expect(validateDecreasePosition(CURRENT_SIZE, CURRENT_SIZE)).toEqual({ valid: true });
  });

  it("returns error when sizeDelta is zero", () => {
    const result = validateDecreasePosition(0n, CURRENT_SIZE);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/greater than zero/i);
  });

  it("returns error when sizeDelta exceeds current size", () => {
    const result = validateDecreasePosition(CURRENT_SIZE + 1n, CURRENT_SIZE);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/current position size/i);
  });
});
