/**
 * useHedgePageData.ts
 *
 * Polls all on-chain data needed to render the HedgeDetailPage:
 *
 *   - Vault AUM                 vault.getAUM()
 *   - Short OI / capacity       vault.totalShortSize + assetRegistry.assets.maxGlobalShortSize
 *   - Yield APR                 yieldAccumulator.assetYields.annualYieldBps  (bps)
 *   - Funding rate              computed from live OI skew × fundingRateFactor (signed bps)
 *   - User short position       vault.positions(getPositionKey(..., isLong=false))
 *
 * Funding sign convention (from SHORT holder's perspective):
 *   fundingRateBps > 0  → longs dominate → shorts RECEIVE payment   (good for user)
 *   fundingRateBps < 0  → shorts dominate → shorts PAY              (cost for user)
 */

import { Contract, formatEther } from "ethers";
import { useEffect, useState } from "react";

import type { VaultConfig } from "domain/vantage/vaults/vaultConfig";
import { getProvider } from "lib/rpc";
import AssetRegistryAbi from "vantage/abis/AssetRegistry.json";
import VaultAbi from "vantage/abis/Vault.json";
import YieldAccumulatorAbi from "vantage/abis/YieldAccumulator.json";
import { getVantageContractAddress } from "vantage/contracts";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_MS = 15_000;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

// USDC is the default short collateral token
const USDC_ADDRESS = (localhostDeployment.addresses as { tokens?: { USDC?: string } }).tokens?.USDC ?? "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserPosition {
  /** Short position size in USD (WAD) */
  sizeUsd: number;
  /** Net collateral in USD after fees (WAD) */
  collateralUsd: number;
  /** Average entry price (WAD) */
  averagePrice: number;
  /** Which token was used as collateral */
  collateralToken: "USDC" | "ETH";
}

export interface HedgePageData {
  /** Vault total AUM in USD (WAD) */
  vaultAumUsd: number | null;
  /** Total open short size for this token in USD */
  totalShortUsd: number | null;
  /** Max allowed short capacity in USD (from AssetRegistry.maxGlobalShortSize) */
  maxShortCapacityUsd: number | null;
  /** Remaining short capacity = max - current */
  remainingCapacityUsd: number | null;
  /** Yield APR in basis points (e.g. 520 = 5.20%) */
  yieldAprBps: number | null;
  /**
   * Annualized funding rate in bps from SHORT holder's perspective.
   * Positive = shorts receive payment; Negative = shorts pay.
   */
  fundingRateBps: number | null;
  /** Net APY = yieldAprBps + fundingRateBps */
  netApyBps: number | null;
  /** User's existing short position, or null if none */
  userPosition: UserPosition | null;
  /**
   * True when the Safety Buffer Lock is active — new hedge positions are blocked.
   * Set by Vault._checkProtocolSolvency() whenever hedgeCost > bufferedYield.
   */
  isHedgeDisabled: boolean;
  /**
   * Ratio of current hedge FR cost to buffered staked yield (0–100+%).
   * > 100 means the lock should be / is active.
   * null when data is unavailable.
   */
  hedgeCapacityPct: number | null;
  /** Safety buffer configured on the Vault (basis points, e.g. 2000 = 20%) */
  safetyBufferBps: number | null;
}

const EMPTY: HedgePageData = {
  vaultAumUsd: null,
  totalShortUsd: null,
  maxShortCapacityUsd: null,
  remainingCapacityUsd: null,
  yieldAprBps: null,
  fundingRateBps: null,
  netApyBps: null,
  userPosition: null,
  isHedgeDisabled: false,
  hedgeCapacityPct: null,
  safetyBufferBps: null,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHedgePageData(
  chainId: number,
  cfg: VaultConfig | undefined,
  account: string | undefined
): HedgePageData {
  const [data, setData] = useState<HedgePageData>(EMPTY);

  useEffect(() => {
    if (!cfg?.vaultAddress || !cfg?.tokenAddress) return;

    const provider = getProvider(undefined, chainId);
    const vault = new Contract(cfg.vaultAddress, VaultAbi, provider);

    const yieldAccAddr = getVantageContractAddress(chainId, "YieldAccumulator");
    const assetRegAddr = getVantageContractAddress(chainId, "AssetRegistry");

    const yieldAcc =
      yieldAccAddr && yieldAccAddr !== ZERO_ADDR ? new Contract(yieldAccAddr, YieldAccumulatorAbi, provider) : null;

    const assetReg =
      assetRegAddr && assetRegAddr !== ZERO_ADDR ? new Contract(assetRegAddr, AssetRegistryAbi, provider) : null;

    let cancelled = false;

    async function poll() {
      try {
        const tokenAddr = cfg!.tokenAddress;

        // ── 1. Vault AUM ────────────────────────────────────────────────────
        const aumRaw: bigint = await vault.getAUM();
        const vaultAumUsd = parseFloat(formatEther(aumRaw));

        // ── 2. OI (long + short) ────────────────────────────────────────────
        const totalShortRaw: bigint = await vault.totalShortSize(tokenAddr);
        const totalLongRaw: bigint = await vault.totalLongSize(tokenAddr);
        const totalShortUsd = parseFloat(formatEther(totalShortRaw));

        // ── 3. Max short capacity from AssetRegistry ────────────────────────
        let maxShortCapacityUsd: number | null = null;
        let remainingCapacityUsd: number | null = null;
        if (assetReg) {
          const assetData = await assetReg.assets(tokenAddr);
          // maxGlobalShortSize is stored in 1e30; divide by 1e12 to get WAD
          const maxShortWad: bigint = BigInt(assetData.maxGlobalShortSize) / 10n ** 12n;
          maxShortCapacityUsd = parseFloat(formatEther(maxShortWad));
          remainingCapacityUsd = Math.max(0, maxShortCapacityUsd - totalShortUsd);
        }

        // ── 4. Yield APR ────────────────────────────────────────────────────
        let yieldAprBps: number | null = null;
        if (yieldAcc) {
          try {
            const assetYield = await yieldAcc.assetYields(tokenAddr);
            yieldAprBps = Number(assetYield.annualYieldBps);
          } catch {
            yieldAprBps = 0;
          }
        }

        // ── 5. Funding rate (signed, annualized, bps) ───────────────────────
        //
        // Formula (mirrors Vault.updateCumulativeFunding):
        //   skew       = (longOI − shortOI) × PRICE_PRECISION / totalOI
        //   annualRate = skew × fundingRateFactor / PRICE_PRECISION  (WAD = 1e18)
        //
        // From SHORT perspective: positive annualRate = shorts receive payment.
        let fundingRateBps: number | null = null;
        if (assetReg) {
          const totalOI = totalShortRaw + totalLongRaw;
          if (totalOI > 0n) {
            const { fundingRateFactor } = await assetReg.getFundingParams(tokenAddr);
            if (BigInt(fundingRateFactor) > 0n) {
              const PRICE_PRECISION = 10n ** 18n;
              const skewNumerator = (totalLongRaw - totalShortRaw) * PRICE_PRECISION;
              const skew = skewNumerator / totalOI;
              const annualRateWad = (skew * BigInt(fundingRateFactor)) / PRICE_PRECISION;
              // Convert WAD → bps: / 1e18 * 10000 = / 1e14
              fundingRateBps = Number(annualRateWad) / 1e14;
            } else {
              fundingRateBps = 0;
            }
          } else {
            fundingRateBps = 0;
          }
        }

        // ── 6. Net APY ──────────────────────────────────────────────────────
        const netApyBps = yieldAprBps !== null && fundingRateBps !== null ? yieldAprBps + fundingRateBps : null;

        // ── 7. Safety Buffer Lock state ─────────────────────────────────────
        // Read isHedgeDisabled flag and safetyBufferBps from Vault.
        // hedgeCapacityPct = (|shortFR| × totalHedgedNotional) / (yield × (1-buffer)) × 100
        // Simplified per-unit estimate: |shortFRBps| / (yieldAprBps × (1-buffer)) × 100.
        let isHedgeDisabled = false;
        let safetyBufferBps: number | null = null;
        let hedgeCapacityPct: number | null = null;
        try {
          [isHedgeDisabled, safetyBufferBps] = await Promise.all([
            vault.isHedgeDisabled() as Promise<boolean>,
            vault.safetyBufferBps().then(Number) as Promise<number>,
          ]);

          if (fundingRateBps !== null && yieldAprBps !== null && safetyBufferBps !== null) {
            const shortCostBps = Math.max(0, -fundingRateBps); // positive when shorts pay
            const bufferedYieldBps = yieldAprBps * (1 - safetyBufferBps / 10_000);
            hedgeCapacityPct =
              bufferedYieldBps > 0 ? (shortCostBps / bufferedYieldBps) * 100 : shortCostBps > 0 ? 100 : 0;
          }
        } catch {
          // Vault may not have these methods in older deployments — fail silently
        }

        // ── 8. User position (short, USDC collateral) ───────────────────────
        let userPosition: UserPosition | null = null;
        if (account && USDC_ADDRESS) {
          const key: string = await vault.getPositionKey(
            account,
            USDC_ADDRESS,
            tokenAddr,
            false // isLong = false (short)
          );
          const pos = await vault.positions(key);
          if (BigInt(pos.size) > 0n) {
            userPosition = {
              sizeUsd: parseFloat(formatEther(pos.size)),
              collateralUsd: parseFloat(formatEther(pos.collateral)),
              averagePrice: parseFloat(formatEther(pos.averagePrice)),
              collateralToken: "USDC",
            };
          }
        }

        if (!cancelled) {
          setData({
            vaultAumUsd,
            totalShortUsd,
            maxShortCapacityUsd,
            remainingCapacityUsd,
            yieldAprBps,
            fundingRateBps,
            netApyBps,
            userPosition,
            isHedgeDisabled,
            hedgeCapacityPct,
            safetyBufferBps,
          });
        }
      } catch {
        // Leave previous data intact on transient errors
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [chainId, cfg, account]);

  return data;
}
