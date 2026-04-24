/**
 * getDefenseStep.ts
 *
 * Pure function that maps on-chain defense flags to a 0–7 step number.
 * Steps are cumulative — evaluate highest (most severe) first (descending).
 *
 * Step 0: Normal — no defense active.
 * Step 1: LP Boost (Phase 1-1) — reserveFund being redirected to lpBoostPool.
 * Step 2: High-Lev Lock or OI Cap (Phase 1-2) — new high-leverage hedges blocked.
 * Step 3: Premium Surge (Phase 1-3) — new hedges pay elevated premium.
 * Step 4: Reserve Fund releasing (Phase 2-4) — hedgeCapacityPct >= 80.
 * Step 5: Junior Buffer absorbing (Phase 2-5) — juniorDeficitAbsorbed > 0.
 * Step 6: Trade ADL in progress (Phase 3-6) — isHedgeDisabled && solvencyDropAt > 0.
 * Step 7: Hedge ADL / Termination (Phase 3-7) — isHedgeDisabled with extended duration.
 *
 * The function always returns the highest active step so the UI shows
 * the most critical phase even when multiple phases overlap.
 */

export type DefenseStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface DefenseStepInput {
  isLPBoostActive: boolean;
  isHighLeverageLocked: boolean;
  isPremiumSurgeActive: boolean;
  isHedgeDisabled: boolean;
  solvencyDropAt: number; // Unix timestamp; 0 = healthy
  juniorDeficitAbsorbed: number | null; // USD WAD as JS number; null = unknown
  hedgeCapacityPct: number | null; // 0–100+; null = unknown
}

// 24 hours in seconds — if solvencyDropAt is older than this, escalate to Step 7.
const HEDGE_ADL_THRESHOLD_S = 24 * 60 * 60;

export function getDefenseStep(input: DefenseStepInput): DefenseStep {
  const {
    isLPBoostActive,
    isHighLeverageLocked,
    isPremiumSurgeActive,
    isHedgeDisabled,
    solvencyDropAt,
    juniorDeficitAbsorbed,
    hedgeCapacityPct,
  } = input;

  const nowS = Math.floor(Date.now() / 1000);
  const dropDurationS = solvencyDropAt > 0 ? nowS - solvencyDropAt : 0;

  // Descending priority: highest step evaluated first.

  // Step 7: Hedge ADL — extended solvency deficit (>24h) while hedge is disabled.
  if (isHedgeDisabled && solvencyDropAt > 0 && dropDurationS >= HEDGE_ADL_THRESHOLD_S) {
    return 7;
  }

  // Step 6: Trade ADL — solvency dropped and hedge intake disabled.
  if (isHedgeDisabled && solvencyDropAt > 0) {
    return 6;
  }

  // Step 5: Junior Buffer actively absorbing FR deficit.
  if (juniorDeficitAbsorbed !== null && juniorDeficitAbsorbed > 0) {
    return 5;
  }

  // Step 4: Reserve Fund being tapped (hedgeCapacityPct >= 80 indicates approaching limit).
  if (hedgeCapacityPct !== null && hedgeCapacityPct >= 80) {
    return 4;
  }

  // Step 3: Premium Surge for new hedges.
  if (isPremiumSurgeActive) {
    return 3;
  }

  // Step 2: High-leverage lock or OI Cap (isHedgeDisabled without solvency drop
  // is the OI Cap scenario).
  if (isHighLeverageLocked || isHedgeDisabled) {
    return 2;
  }

  // Step 1: LP Boost active (mildest prevention phase).
  if (isLPBoostActive) {
    return 1;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Display metadata for each step
// ---------------------------------------------------------------------------

export interface StepMeta {
  label: string;
  phase: string;
  description: string;
  severity: "normal" | "warning" | "danger" | "critical";
}

export const STEP_META: Record<DefenseStep, StepMeta> = {
  0: {
    label: "Normal",
    phase: "Phase 0 · Normal",
    description: "Protocol operating normally. No defense measures active.",
    severity: "normal",
  },
  1: {
    label: "LP Boost",
    phase: "Phase 1 · Prevention",
    description: "Reserve fund redirected to boost LP rewards, attracting new liquidity.",
    severity: "normal",
  },
  2: {
    label: "High-Lev Lock",
    phase: "Phase 1 · Prevention",
    description: "New high-leverage hedge positions are blocked. Existing positions unaffected.",
    severity: "warning",
  },
  3: {
    label: "Premium Surge",
    phase: "Phase 1 · Prevention",
    description: "New hedges carry an elevated entry premium. Existing positions maintain original rate.",
    severity: "warning",
  },
  4: {
    label: "Reserve Fund",
    phase: "Phase 2 · Internal Buffer",
    description: "Stability reserve fund covering FR shortfall. Existing user costs unchanged.",
    severity: "warning",
  },
  5: {
    label: "Junior Buffer",
    phase: "Phase 2 · Internal Buffer",
    description: "Junior LP (USDC) absorbing FR deficit. Senior RWA LP and hedge users protected.",
    severity: "warning",
  },
  6: {
    label: "Trade ADL",
    phase: "Phase 3 · Enforcement",
    description: "High-profit long positions being force-closed to reduce FR obligations.",
    severity: "danger",
  },
  7: {
    label: "Hedge ADL",
    phase: "Phase 3 · Final Defense",
    description: "Some hedge positions being force-closed. Protocol exercising last-resort termination.",
    severity: "critical",
  },
  8: {
    label: "Trade ADL",
    phase: "Phase 3 · Enforcement",
    description: "High-profit long positions being force-closed to reduce FR obligations.",
    severity: "danger",
  },
  9: {
    label: "Hedge ADL",
    phase: "Phase 3 · Final Defense",
    description: "Some hedge positions being force-closed. Protocol exercising last-resort termination.",
    severity: "critical",
  },
};
