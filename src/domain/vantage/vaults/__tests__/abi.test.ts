/**
 * abi.test.ts
 *
 * ABI completeness checks for Issue #230 (Direct Asset Margin).
 *
 * These tests catch the case where a new Solidity function is used by a hook
 * but the corresponding ABI JSON has not been regenerated from the compiled
 * artifacts.  A failing test here means: run `pnpm sync` (or copy the
 * updated artifact) before deploying to any environment.
 *
 * Checked functions:
 *   Vault.json
 *     - getAUM                  (used in useVaultList + useVaultDetail)
 *     - userShortfallDebt       (Issue #124 solvency framework)
 *     - sellPhysicalForSettlement (Issue #230 settlement path)
 *
 *   TrancheVault.json
 *     - getEffectiveAUM         (Junior AUM after juniorDeficitAbsorbed)
 *     - juniorDeficitAbsorbed   (storage var: slippage gap absorbed by Junior)
 *     - executionReserve        (Issue #230: pre-absorbed hedge reserve — lives in TrancheVault)
 *     - reconcileExecutionReserve (HedgeManager settlement callback)
 *
 *   LPManager.json
 *     - getSharePrice           (useVaultList + useVaultDetail)
 *     - lastEpochTimestamp      (useVaultDetail: redemption epoch)
 *     - redemptionCycleDuration (useVaultDetail: redemption epoch)
 *     - redemptionRequests      (useVaultDetail: pending redemption)
 *     - epochPricePerShare      (useVaultDetail: executed epoch price)
 */

import { describe, expect, it } from "vitest";

import LPManagerAbi from "vantage/abis/LPManager.json";
import TrancheVaultAbi from "vantage/abis/TrancheVault.json";
import VaultAbi from "vantage/abis/Vault.json";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

type AbiEntry = { type: string; name?: string };

/** Returns true when the ABI contains a function or state variable with the given name. */
function hasEntry(abi: AbiEntry[], name: string): boolean {
  return abi.some(
    (entry) => (entry.type === "function" || entry.type === "error" || entry.type === "event") && entry.name === name
  );
}

// ---------------------------------------------------------------------------
// Vault.json
// ---------------------------------------------------------------------------

describe("Vault.json ABI completeness", () => {
  it("contains getAUM", () => {
    expect(hasEntry(VaultAbi as AbiEntry[], "getAUM")).toBe(true);
  });

  it("contains userShortfallDebt (Issue #124)", () => {
    expect(hasEntry(VaultAbi as AbiEntry[], "userShortfallDebt")).toBe(true);
  });

  /**
   * sellPhysicalForSettlement is called by HedgeManager during hedge settlement (Issue #230).
   * If this test fails, regenerate Vault.json from the compiled artifact.
   */
  it("contains sellPhysicalForSettlement (Issue #230)", () => {
    expect(
      hasEntry(VaultAbi as AbiEntry[], "sellPhysicalForSettlement"),
      "sellPhysicalForSettlement missing from Vault.json — regenerate ABI from compiled artifact"
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TrancheVault.json
// ---------------------------------------------------------------------------

describe("TrancheVault.json ABI completeness", () => {
  it("contains getEffectiveAUM", () => {
    expect(hasEntry(TrancheVaultAbi as AbiEntry[], "getEffectiveAUM")).toBe(true);
  });

  it("contains juniorDeficitAbsorbed public getter", () => {
    expect(hasEntry(TrancheVaultAbi as AbiEntry[], "juniorDeficitAbsorbed")).toBe(true);
  });

  /**
   * executionReserve lives in TrancheVault (not Vault). It is a public storage variable
   * pre-absorbed from Junior at hedge entry to cover DEX price impact (Issue #230).
   */
  it("contains executionReserve public getter (Issue #230)", () => {
    expect(
      hasEntry(TrancheVaultAbi as AbiEntry[], "executionReserve"),
      "executionReserve missing from TrancheVault.json — regenerate ABI from compiled artifact (Issue #230)"
    ).toBe(true);
  });

  /**
   * reconcileExecutionReserve is called by HedgeManager after settlement.
   * Releases the pre-absorbed executionReserve and absorbs any slippage gap (Issue #230).
   */
  it("contains reconcileExecutionReserve (Issue #230)", () => {
    expect(
      hasEntry(TrancheVaultAbi as AbiEntry[], "reconcileExecutionReserve"),
      "reconcileExecutionReserve missing from TrancheVault.json — regenerate ABI"
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// LPManager.json
// ---------------------------------------------------------------------------

describe("LPManager.json ABI completeness", () => {
  it("contains getSharePrice", () => {
    expect(hasEntry(LPManagerAbi as AbiEntry[], "getSharePrice")).toBe(true);
  });

  it("contains lastEpochTimestamp", () => {
    expect(hasEntry(LPManagerAbi as AbiEntry[], "lastEpochTimestamp")).toBe(true);
  });

  it("contains redemptionCycleDuration", () => {
    expect(hasEntry(LPManagerAbi as AbiEntry[], "redemptionCycleDuration")).toBe(true);
  });

  it("contains redemptionRequests", () => {
    expect(hasEntry(LPManagerAbi as AbiEntry[], "redemptionRequests")).toBe(true);
  });

  it("contains epochPricePerShare", () => {
    expect(hasEntry(LPManagerAbi as AbiEntry[], "epochPricePerShare")).toBe(true);
  });
});
