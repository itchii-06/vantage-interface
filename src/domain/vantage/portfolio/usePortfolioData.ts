/**
 * usePortfolioData.ts
 *
 * Aggregates on-chain data for the Portfolio page:
 *   - Per-vault LP balances (user's VLP balance in USD) via useVaultDetail
 *   - Per-hedgeable-vault user short position & APY via useHedgePageData
 *   - Hedge APY data via useHedgeList
 *   - All trade positions across all hedgeable vaults via useVantagePositions
 *
 * All hooks are called in fixed order — no conditional hook calls.
 * Supports up to 4 total vaults and up to 3 hedgeable vaults.
 */

import { formatEther } from "ethers";
import { useMemo } from "react";

import { useHedgeList } from "domain/vantage/hedge/useHedgeList";
import { useHedgePageData } from "domain/vantage/hedge/useHedgePageData";
import type { VantagePosition } from "domain/vantage/positions/types";
import { useVantagePositions } from "domain/vantage/positions/useVantagePositions";
import { useVaultApy } from "domain/vantage/vaults/useVaultApy";
import { useVaultDetail } from "domain/vantage/vaults/useVaultDetail";
import { VAULT_CONFIGS } from "domain/vantage/vaults/vaultConfig";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USDC_ADDRESS = (localhostDeployment.addresses as { tokens?: { USDC?: string } }).tokens?.USDC ?? "";
const FALLBACK = VAULT_CONFIGS[0];

const ALL_VAULTS = VAULT_CONFIGS.filter((v) => v.vaultAddress && v.lpManagerAddress);
const HEDGEABLE = VAULT_CONFIGS.filter((v) => v.tokenAddress && v.vaultAddress && v.assetType !== "stable");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VaultLpItem = {
  key: string;
  symbol: string;
  name: string;
  aum: bigint;
  /** User's VLP balance */
  vlpBalance: bigint;
  /** User's LP value in USD (WAD) */
  usdValue: bigint;
  /** Annualized vault yield APY (decimal, e.g. 0.052 = 5.2%) */
  apy: number | null;
  isLoading: boolean;
};

export type HedgePortfolioItem = {
  key: string;
  symbol: string;
  /** Vault yield APY (decimal) */
  vaultApy: number | null;
  /** Short funding APY from short holder's perspective (decimal) */
  fundingApy: number | null;
  /** Net APY = vaultApy + fundingApy (decimal) */
  netApy: number | null;
  /** User's LP value in USD (WAD) */
  lpUsdValue: bigint;
  /** User's short position size in USD (float) — null if no position */
  shortSizeUsd: number | null;
  /** User's short collateral in USD (float) — null if no position */
  shortCollateralUsd: number | null;
  isLoading: boolean;
  /**
   * Unix timestamp when the vault's raw SolvencyRatio first dropped below 1.0 (Issue #180).
   * 0 or null = currently healthy.
   */
  solvencyDropAt: number | null;
  /** True if the user's own short position is currently soft-locked (FR offset suspended). */
  isSoftLocked: boolean;
  /** Yield APR in bps — used for solvency ratio display */
  yieldAprBps: number | null;
  /** Funding rate in bps from short's perspective (negative = shorts pay) */
  fundingRateBps: number | null;
};

export type PortfolioGlobalStats = {
  /** Σ(LP USD) + Σ(position collateral ± PnL) */
  totalNetWorthUsd: number;
  /** Σ(short position size USD across hedgeable vaults) */
  totalProtectionUsd: number;
  /**
   * Total short size / user's total LP USD.
   * null when user has no LP positions.
   */
  avgHedgeRatio: number | null;
  /**
   * LP-value-weighted average of netApy across hedge positions.
   * null when no hedge data available.
   */
  netYieldApy: number | null;
};

export type PortfolioData = {
  globalStats: PortfolioGlobalStats;
  hedgeItems: HedgePortfolioItem[];
  vaultLpItems: VaultLpItem[];
  /** All trade positions aggregated from hedgeable vaults */
  allPositions: VantagePosition[];
  isLoading: boolean;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePortfolioData(chainId: number, account: string | undefined): PortfolioData {
  // ── Vault LP detail (fixed order, max 4) ──────────────────────────────────
  const vd0 = useVaultDetail(ALL_VAULTS[0] ?? FALLBACK, chainId);
  const vd1 = useVaultDetail(ALL_VAULTS[1] ?? FALLBACK, chainId);
  const vd2 = useVaultDetail(ALL_VAULTS[2] ?? FALLBACK, chainId);
  const vd3 = useVaultDetail(ALL_VAULTS[3] ?? FALLBACK, chainId);
  const vaultDetails = [vd0, vd1, vd2, vd3].slice(0, ALL_VAULTS.length);

  // ── Vault APY per vault (fixed order, max 4) ──────────────────────────────
  const apy0 = useVaultApy(ALL_VAULTS[0] ?? FALLBACK);
  const apy1 = useVaultApy(ALL_VAULTS[1] ?? FALLBACK);
  const apy2 = useVaultApy(ALL_VAULTS[2] ?? FALLBACK);
  const apy3 = useVaultApy(ALL_VAULTS[3] ?? FALLBACK);
  const apyList = [apy0, apy1, apy2, apy3].slice(0, ALL_VAULTS.length);

  // ── Hedge on-chain data per hedgeable vault (fixed order, max 3) ──────────
  const hd0 = useHedgePageData(chainId, HEDGEABLE[0], account);
  const hd1 = useHedgePageData(chainId, HEDGEABLE[1], account);
  const hd2 = useHedgePageData(chainId, HEDGEABLE[2], account);
  const hedgePageDatas = [hd0, hd1, hd2].slice(0, HEDGEABLE.length);

  // ── Hedge APY list (vaultApy + fundingApy per hedgeable vault) ─────────────
  const hedgeList = useHedgeList();

  // ── Trade positions per hedgeable vault (fixed order, max 3) ─────────────
  const collateralTokens = USDC_ADDRESS ? [USDC_ADDRESS] : undefined;
  const pos0 = useVantagePositions(account, chainId, collateralTokens, HEDGEABLE[0]?.vaultAddress);
  const pos1 = useVantagePositions(account, chainId, collateralTokens, HEDGEABLE[1]?.vaultAddress);
  const pos2 = useVantagePositions(account, chainId, collateralTokens, HEDGEABLE[2]?.vaultAddress);

  // ── Derived: Vault LP items ───────────────────────────────────────────────
  const vaultLpItems = useMemo<VaultLpItem[]>(
    () =>
      ALL_VAULTS.map((cfg, i) => ({
        key: cfg.key,
        symbol: cfg.symbol,
        name: cfg.name,
        aum: vaultDetails[i]?.aum ?? 0n,
        vlpBalance: vaultDetails[i]?.vlpBalance ?? 0n,
        usdValue: vaultDetails[i]?.usdValue ?? 0n,
        apy: apyList[i] ?? null,
        isLoading: vaultDetails[i]?.isLoading ?? true,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vd0, vd1, vd2, vd3, apy0, apy1, apy2, apy3]
  );

  // ── Derived: Hedge portfolio items ────────────────────────────────────────
  const hedgeItems = useMemo<HedgePortfolioItem[]>(
    () =>
      HEDGEABLE.map((cfg, i) => {
        const hedge = hedgeList[i];
        const hd = hedgePageDatas[i];

        // Find the user's LP USD value for this vault from vaultLpItems
        const vaultIdx = ALL_VAULTS.findIndex((v) => v.key === cfg.key);
        const lpUsdValue = vaultIdx >= 0 ? vaultDetails[vaultIdx]?.usdValue ?? 0n : 0n;

        return {
          key: cfg.key,
          symbol: cfg.symbol,
          vaultApy: hedge?.vaultApy ?? null,
          fundingApy: hedge?.fundingApy ?? null,
          netApy: hedge?.managedNetApy ?? null,
          lpUsdValue,
          shortSizeUsd: hd?.userPosition?.sizeUsd ?? null,
          shortCollateralUsd: hd?.userPosition?.collateralUsd ?? null,
          isLoading: hd ? false : true,
          solvencyDropAt: hd?.solvencyDropAt ?? null,
          isSoftLocked: hd?.isSoftLockedPosition ?? false,
          yieldAprBps: hd?.yieldAprBps ?? null,
          fundingRateBps: hd?.fundingRateBps ?? null,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hd0, hd1, hd2, hedgeList, vd0, vd1, vd2, vd3]
  );

  // ── Derived: All positions merged ─────────────────────────────────────────
  const allPositions = useMemo<VantagePosition[]>(
    () => [...pos0.positions, ...pos1.positions, ...pos2.positions],
    [pos0.positions, pos1.positions, pos2.positions]
  );

  // ── Derived: Global stats ─────────────────────────────────────────────────
  const globalStats = useMemo<PortfolioGlobalStats>(() => {
    // Total LP USD value (WAD → float)
    const totalLpUsd = vaultLpItems.reduce((sum, v) => sum + parseFloat(formatEther(v.usdValue)), 0);

    // Total trade collateral ± PnL
    const totalTradeUsd = allPositions.reduce(
      (sum, p) => sum + parseFloat(formatEther(p.collateral)) + parseFloat(formatEther(p.pendingPnl)),
      0
    );

    // Total short size across hedge positions
    const totalProtectionUsd = hedgeItems.reduce((sum, h) => sum + (h.shortSizeUsd ?? 0), 0);

    // Avg hedge ratio = total short / user's total LP
    const avgHedgeRatio = totalLpUsd > 0 ? totalProtectionUsd / totalLpUsd : null;

    // Weighted avg net APY (weighted by LP USD value)
    let apyNumerator = 0;
    let apyDenominator = 0;
    for (const h of hedgeItems) {
      if (h.netApy !== null && h.lpUsdValue > 0n) {
        const lpFloat = parseFloat(formatEther(h.lpUsdValue));
        apyNumerator += h.netApy * lpFloat;
        apyDenominator += lpFloat;
      }
    }
    const netYieldApy = apyDenominator > 0 ? apyNumerator / apyDenominator : null;

    return {
      totalNetWorthUsd: totalLpUsd + totalTradeUsd,
      totalProtectionUsd,
      avgHedgeRatio,
      netYieldApy,
    };
  }, [vaultLpItems, allPositions, hedgeItems]);

  // ── Loading state ─────────────────────────────────────────────────────────
  const isLoading = vaultDetails.some((v) => v.isLoading) || pos0.isLoading || pos1.isLoading || pos2.isLoading;

  return { globalStats, hedgeItems, vaultLpItems, allPositions, isLoading };
}
