/**
 * useStatusPageData.ts
 *
 * Polls all on-chain data needed to render the /status Solvency Dashboard.
 *
 * Data sources:
 *   Vault          — defense flags, reserve fund, LP boost pool, AUM
 *   TrancheVault   — juniorDeficitAbsorbed, junior AUM (optional, gracefully absent)
 *   AssetRegistry  — OI utilization, funding params
 *   YieldAccumulator — yield APR
 *
 * The primary vault used is the first configured vault (USDC). For multi-vault
 * environments the caller should pass a specific VaultConfig.
 */

import { Contract, formatEther } from "ethers";
import { useEffect, useState } from "react";

import type { DefenseStep } from "domain/vantage/solvency/getDefenseStep";
import { getDefenseStep } from "domain/vantage/solvency/getDefenseStep";
import type { VaultConfig } from "domain/vantage/vaults/vaultConfig";
import { getProvider } from "lib/rpc";
import AssetRegistryAbi from "vantage/abis/AssetRegistry.json";
import TrancheVaultAbi from "vantage/abis/TrancheVault.json";
import VaultAbi from "vantage/abis/Vault.json";
import YieldAccumulatorAbi from "vantage/abis/YieldAccumulator.json";
import { getVantageContractAddress } from "vantage/contracts";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_MS = 15_000;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

const dep = localhostDeployment.addresses as {
  tokens?: { USDC?: string };
  JuniorTrancheVault?: string;
};

const USDC_ADDRESS = dep.tokens?.USDC ?? "";
// Optional PAYOUT TrancheVault address. May be absent in early deployments.
const JUNIOR_TRANCHE_VAULT = dep.JuniorTrancheVault ?? "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatusPageData {
  // ── Defense phase flags ───────────────────────────────────────────────────
  isLPBoostActive: boolean;
  isHighLeverageLocked: boolean;
  isPremiumSurgeActive: boolean;
  isHedgeDisabled: boolean;
  /** Unix timestamp when solvency first dropped; 0 = currently healthy. */
  solvencyDropAt: number;

  // ── Derived step ──────────────────────────────────────────────────────────
  /** Current defense step 0–7 (highest active phase). */
  defenseStep: DefenseStep;

  // ── Buffer gauges ─────────────────────────────────────────────────────────
  /** USD WAD in the Vault reserve fund for USDC token. */
  reserveFundUsd: number | null;
  /** USD WAD redirected from reserveFund into lpBoostPool (raises VLP share price). */
  lpBoostPoolUsd: number | null;
  /** USD WAD absorbed from Junior (PAYOUT) tranche AUM to cover FR deficit. */
  juniorDeficitAbsorbed: number | null;
  /** Total AUM of the Junior (PAYOUT) TrancheVault. Used as the gauge denominator. */
  juniorAumUsd: number | null;

  // ── OI utilization ────────────────────────────────────────────────────────
  totalShortUsd: number | null;
  totalLongUsd: number | null;
  maxShortCapacityUsd: number | null;
  /** 0–100+ %; >100 means cap exceeded. */
  oiUtilizationPct: number | null;

  // ── Yield & funding ───────────────────────────────────────────────────────
  yieldAprBps: number | null;
  fundingRateBps: number | null;
  hedgeCapacityPct: number | null;
  safetyBufferBps: number | null;
}

const EMPTY: StatusPageData = {
  isLPBoostActive: false,
  isHighLeverageLocked: false,
  isPremiumSurgeActive: false,
  isHedgeDisabled: false,
  solvencyDropAt: 0,
  defenseStep: 0,
  reserveFundUsd: null,
  lpBoostPoolUsd: null,
  juniorDeficitAbsorbed: null,
  juniorAumUsd: null,
  totalShortUsd: null,
  totalLongUsd: null,
  maxShortCapacityUsd: null,
  oiUtilizationPct: null,
  yieldAprBps: null,
  fundingRateBps: null,
  hedgeCapacityPct: null,
  safetyBufferBps: null,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStatusPageData(chainId: number, cfg: VaultConfig | undefined): StatusPageData {
  const [data, setData] = useState<StatusPageData>(EMPTY);

  useEffect(() => {
    if (!cfg?.vaultAddress || !cfg?.tokenAddress) return;

    const provider = getProvider(undefined, chainId);
    const vault = new Contract(cfg.vaultAddress, VaultAbi, provider);

    const assetRegAddr = getVantageContractAddress(chainId, "AssetRegistry");
    const yieldAccAddr = getVantageContractAddress(chainId, "YieldAccumulator");

    const assetReg =
      assetRegAddr && assetRegAddr !== ZERO_ADDR ? new Contract(assetRegAddr, AssetRegistryAbi, provider) : null;

    const yieldAcc =
      yieldAccAddr && yieldAccAddr !== ZERO_ADDR ? new Contract(yieldAccAddr, YieldAccumulatorAbi, provider) : null;

    const juniorVault =
      JUNIOR_TRANCHE_VAULT && JUNIOR_TRANCHE_VAULT !== ZERO_ADDR
        ? new Contract(JUNIOR_TRANCHE_VAULT, TrancheVaultAbi, provider)
        : null;

    let cancelled = false;

    async function poll() {
      try {
        const tokenAddr = cfg!.tokenAddress;

        // ── 1. Defense flags ────────────────────────────────────────────────
        const [
          isHedgeDisabled,
          isHighLeverageLocked,
          isPremiumSurgeActive,
          isLPBoostActive,
          solvencyDropAtRaw,
          safetyBufferBpsRaw,
        ] = await Promise.all([
          vault.isHedgeDisabled().catch(() => false) as Promise<boolean>,
          vault.isHighLeverageLocked().catch(() => false) as Promise<boolean>,
          vault.isPremiumSurgeActive().catch(() => false) as Promise<boolean>,
          vault.isLPBoostActive().catch(() => false) as Promise<boolean>,
          vault.solvencyDropAt().catch(() => 0n) as Promise<bigint>,
          vault.safetyBufferBps().catch(() => 0n) as Promise<bigint>,
        ]);

        const solvencyDropAt = Number(solvencyDropAtRaw);
        const safetyBufferBps = Number(safetyBufferBpsRaw);

        // ── 2. Buffer gauges ────────────────────────────────────────────────
        let reserveFundUsd: number | null = null;
        let lpBoostPoolUsd: number | null = null;
        if (USDC_ADDRESS) {
          const [rfRaw, lbRaw] = await Promise.all([
            vault.reserveFund(USDC_ADDRESS).catch(() => 0n) as Promise<bigint>,
            vault.lpBoostPool(USDC_ADDRESS).catch(() => 0n) as Promise<bigint>,
          ]);
          reserveFundUsd = parseFloat(formatEther(rfRaw));
          lpBoostPoolUsd = parseFloat(formatEther(lbRaw));
        }

        // ── 3. Junior TrancheVault ──────────────────────────────────────────
        let juniorDeficitAbsorbed: number | null = null;
        let juniorAumUsd: number | null = null;
        if (juniorVault) {
          const [deficitRaw, juniorAumRaw] = await Promise.all([
            juniorVault.juniorDeficitAbsorbed().catch(() => 0n) as Promise<bigint>,
            juniorVault.getAUM().catch(() => 0n) as Promise<bigint>,
          ]);
          juniorDeficitAbsorbed = parseFloat(formatEther(deficitRaw));
          juniorAumUsd = parseFloat(formatEther(juniorAumRaw));
        }

        // ── 4. OI utilization ───────────────────────────────────────────────
        const [totalShortRaw, totalLongRaw] = await Promise.all([
          vault.totalShortSize(tokenAddr).catch(() => 0n) as Promise<bigint>,
          vault.totalLongSize(tokenAddr).catch(() => 0n) as Promise<bigint>,
        ]);
        const totalShortUsd = parseFloat(formatEther(totalShortRaw));
        const totalLongUsd = parseFloat(formatEther(totalLongRaw));

        let maxShortCapacityUsd: number | null = null;
        let oiUtilizationPct: number | null = null;
        if (assetReg) {
          const assetData = await assetReg.assets(tokenAddr).catch(() => null);
          if (assetData) {
            const maxShortWad: bigint = BigInt(assetData.maxGlobalShortSize) / 10n ** 12n;
            maxShortCapacityUsd = parseFloat(formatEther(maxShortWad));
            oiUtilizationPct = maxShortCapacityUsd > 0 ? (totalShortUsd / maxShortCapacityUsd) * 100 : null;
          }
        }

        // ── 5. Yield & funding rate ─────────────────────────────────────────
        let yieldAprBps: number | null = null;
        if (yieldAcc) {
          const assetYield = await yieldAcc.assetYields(tokenAddr).catch(() => null);
          if (assetYield) yieldAprBps = Number(assetYield.annualYieldBps);
        }

        let fundingRateBps: number | null = null;
        if (assetReg) {
          const totalOI = totalShortRaw + totalLongRaw;
          if (totalOI > 0n) {
            const { fundingRateFactor } = await assetReg.getFundingParams(tokenAddr).catch(() => ({
              fundingRateFactor: 0n,
            }));
            if (BigInt(fundingRateFactor) > 0n) {
              const PRICE_PRECISION = 10n ** 18n;
              const skew = ((totalLongRaw - totalShortRaw) * PRICE_PRECISION) / totalOI;
              const annualRateWad = (skew * BigInt(fundingRateFactor)) / PRICE_PRECISION;
              fundingRateBps = Number(annualRateWad) / 1e14;
            } else {
              fundingRateBps = 0;
            }
          } else {
            fundingRateBps = 0;
          }
        }

        // ── 6. Hedge capacity % ─────────────────────────────────────────────
        let hedgeCapacityPct: number | null = null;
        if (fundingRateBps !== null && yieldAprBps !== null && safetyBufferBps !== null) {
          const shortCostBps = Math.max(0, -fundingRateBps);
          const bufferedYieldBps = yieldAprBps * (1 - safetyBufferBps / 10_000);
          hedgeCapacityPct =
            bufferedYieldBps > 0 ? (shortCostBps / bufferedYieldBps) * 100 : shortCostBps > 0 ? 100 : 0;
        }

        // ── 7. Derive current defense step ──────────────────────────────────
        const defenseStep = getDefenseStep({
          isLPBoostActive,
          isHighLeverageLocked,
          isPremiumSurgeActive,
          isHedgeDisabled,
          solvencyDropAt,
          juniorDeficitAbsorbed,
          hedgeCapacityPct,
        });

        if (!cancelled) {
          setData({
            isLPBoostActive,
            isHighLeverageLocked,
            isPremiumSurgeActive,
            isHedgeDisabled,
            solvencyDropAt,
            defenseStep,
            reserveFundUsd,
            lpBoostPoolUsd,
            juniorDeficitAbsorbed,
            juniorAumUsd,
            totalShortUsd,
            totalLongUsd,
            maxShortCapacityUsd,
            oiUtilizationPct,
            yieldAprBps,
            fundingRateBps,
            hedgeCapacityPct,
            safetyBufferBps,
          });
        }
      } catch {
        // Leave previous data intact on transient errors.
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [chainId, cfg]);

  return data;
}
