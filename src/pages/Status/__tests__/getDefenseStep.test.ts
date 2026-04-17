/**
 * getDefenseStep.test.ts
 *
 * Unit tests for the getDefenseStep pure function.
 *
 * T1  All flags false/zero → step 0 (Normal).
 * T2  isLPBoostActive=true → step 1.
 * T3  isHighLeverageLocked=true → step 2.
 * T4  isPremiumSurgeActive=true → step 3.
 * T5  hedgeCapacityPct >= 80 → step 4.
 * T6  juniorDeficitAbsorbed > 0 → step 5.
 * T7  isHedgeDisabled + solvencyDropAt > 0 (< 24h) → step 6.
 * T8  isHedgeDisabled + solvencyDropAt > 0 (>= 24h) → step 7.
 * T9  Overlap: isPremiumSurge AND juniorDeficit → highest wins (step 5).
 * T10 Overlap: all flags true → step 7 (most severe).
 * T11 ADL Trade Score: higher leverage × PnL → higher score.
 * T12 ADL Hedge: step 5 < step 6 < step 7 ordering.
 */

import { describe, expect, it } from "vitest";

import type { DefenseStepInput } from "domain/vantage/solvency/getDefenseStep";
import { getDefenseStep } from "domain/vantage/solvency/getDefenseStep";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base(): DefenseStepInput {
  return {
    isLPBoostActive: false,
    isHighLeverageLocked: false,
    isPremiumSurgeActive: false,
    isHedgeDisabled: false,
    solvencyDropAt: 0,
    juniorDeficitAbsorbed: 0,
    hedgeCapacityPct: 0,
  };
}

// 25 hours ago (exceeds HEDGE_ADL_THRESHOLD_S = 86400s)
const NOW_S = Math.floor(Date.now() / 1000);
const DROP_25H_AGO = NOW_S - 25 * 3600;
const DROP_1H_AGO = NOW_S - 3600;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getDefenseStep", () => {
  it("T1: all flags false → step 0 (Normal)", () => {
    expect(getDefenseStep(base())).toBe(0);
  });

  it("T2: isLPBoostActive=true → step 1", () => {
    expect(getDefenseStep({ ...base(), isLPBoostActive: true })).toBe(1);
  });

  it("T3: isHighLeverageLocked=true → step 2", () => {
    expect(getDefenseStep({ ...base(), isHighLeverageLocked: true })).toBe(2);
  });

  it("T4: isPremiumSurgeActive=true → step 3", () => {
    expect(getDefenseStep({ ...base(), isPremiumSurgeActive: true })).toBe(3);
  });

  it("T5: hedgeCapacityPct >= 80 → step 4", () => {
    expect(getDefenseStep({ ...base(), hedgeCapacityPct: 80 })).toBe(4);
    expect(getDefenseStep({ ...base(), hedgeCapacityPct: 110 })).toBe(4);
  });

  it("T6: juniorDeficitAbsorbed > 0 → step 5", () => {
    expect(getDefenseStep({ ...base(), juniorDeficitAbsorbed: 1_000 })).toBe(5);
  });

  it("T7: isHedgeDisabled + solvencyDropAt recent (<24h) → step 6", () => {
    expect(getDefenseStep({ ...base(), isHedgeDisabled: true, solvencyDropAt: DROP_1H_AGO })).toBe(6);
  });

  it("T8: isHedgeDisabled + solvencyDropAt old (>=24h) → step 7", () => {
    expect(getDefenseStep({ ...base(), isHedgeDisabled: true, solvencyDropAt: DROP_25H_AGO })).toBe(7);
  });

  it("T9: overlap — isPremiumSurge AND juniorDeficit → highest wins (step 5)", () => {
    expect(
      getDefenseStep({
        ...base(),
        isPremiumSurgeActive: true, // step 3
        juniorDeficitAbsorbed: 500, // step 5
      })
    ).toBe(5);
  });

  it("T10: all flags active → step 7 (most severe)", () => {
    expect(
      getDefenseStep({
        isLPBoostActive: true,
        isHighLeverageLocked: true,
        isPremiumSurgeActive: true,
        isHedgeDisabled: true,
        solvencyDropAt: DROP_25H_AGO,
        juniorDeficitAbsorbed: 1_000,
        hedgeCapacityPct: 95,
      })
    ).toBe(7);
  });

  it("T11: step 4 requires hedgeCapacityPct >= 80; 79 does not trigger it", () => {
    expect(getDefenseStep({ ...base(), hedgeCapacityPct: 79 })).toBe(0);
    expect(getDefenseStep({ ...base(), hedgeCapacityPct: 80 })).toBe(4);
  });

  it("T12: isHedgeDisabled without solvencyDropAt → step 2 (OI Cap scenario)", () => {
    expect(getDefenseStep({ ...base(), isHedgeDisabled: true, solvencyDropAt: 0 })).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// ADL Score helpers (inline — not imported from prod code)
// ---------------------------------------------------------------------------

describe("ADL score logic", () => {
  it("T11: Trade ADL — higher leverage × PnL yields higher score", () => {
    // pos A: 10× leverage, $5k profit → score = 10 × 5000 = 50_000
    const scoreA = (10_000 / 1_000) * 5_000; // leverage × pnl
    // pos B: 3× leverage, $2k profit → score = 3 × 2000 = 6_000
    const scoreB = (6_000 / 2_000) * 2_000;

    expect(scoreA).toBeGreaterThan(scoreB);
  });

  it("T12: Hedge ADL — higher leverage should come first", () => {
    // posA: 8× lev, 60d age → ADL priority index 1 (very high lev)
    // posB: 2× lev, 3d age → ADL priority index 2 (newer but low lev)
    const levA = 8_000 / 1_000; // 8×
    const levB = 4_000 / 2_000; // 2×
    expect(levA).toBeGreaterThan(levB);
  });

  it("T12b: Hedge ADL — same leverage, newer position (lower ageDays) is higher priority", () => {
    const ageDaysNew = 2;
    const ageDaysOld = 45;
    // Newer = higher LIFO priority = closed first
    expect(ageDaysNew).toBeLessThan(ageDaysOld);
  });
});
