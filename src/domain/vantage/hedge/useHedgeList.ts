/**
 * useHedgeList.ts
 *
 * Returns a combined list of hedge opportunities derived from VAULT_CONFIGS.
 * Each entry exposes:
 *   - Vault APY (RWA yield)
 *   - Short funding rate (annualised, from Vault.cumulativeFundingRate)
 *   - Net APY for Managed mode  = vaultApy + fundingApy
 *   - Net APY for Self-Custody  = fundingApy only
 *   - Vault AUM and capacity
 */

import { Contract } from "ethers";
import { useEffect, useMemo, useState } from "react";

import { useChainId } from "lib/chains";
import { getProvider } from "lib/rpc";
import VaultAbi from "vantage/abis/Vault.json";

import { useVaultApy } from "../vaults/useVaultApy";
import { VAULT_CONFIGS } from "../vaults/vaultConfig";
import type { AssetTypeId, VaultConfig } from "../vaults/vaultConfig";

const POLL_MS = 30_000;

export type HedgeListItem = {
  key: string;
  symbol: string;
  name: string;
  assetType: AssetTypeId;
  vaultAddress: string;
  indexToken: string;
  /** Prism axis for sUSDe entries ("price" | "yield" | "total"), undefined for standard assets */
  prismAxis: VaultConfig["prismAxis"];
  /** RWA vault APY (null if unavailable) */
  vaultApy: number | null;
  /** Short funding rate annualised (null if unavailable) */
  fundingApy: number | null;
  /** Managed Net APY = vaultApy + fundingApy */
  managedNetApy: number | null;
  /** Self-Custody APY = fundingApy only */
  selfCustodyApy: number | null;
  /** Vault AUM in USD WAD */
  aum: bigint;
  isLoading: boolean;
  imageUrl?: string;
};

/** Annualise hourly cumulative funding rate stored in the Vault. */
function annualiseFunding(hourlyRateBps: bigint): number {
  // cumulativeFundingRate is in BPS (1 BPS = 0.01%) per hour (Vault convention).
  // Convert to decimal per year: (rate / 10_000) * 8760
  const hourly = Number(hourlyRateBps) / 10_000;
  return hourly * 8_760;
}

function useFundingApy(vaultAddress: string | undefined, indexToken: string | undefined): number | null {
  const { chainId } = useChainId();
  const [apy, setApy] = useState<number | null>(null);

  useEffect(() => {
    if (!vaultAddress || !indexToken) return;

    const provider = getProvider(undefined, chainId);
    const vault = new Contract(vaultAddress, VaultAbi, provider);

    let cancelled = false;

    async function poll() {
      try {
        // cumulativeFundingRate(indexToken, isLong) → BPS per hour
        const shortRate: bigint = await vault.cumulativeFundingRate(indexToken, false);
        if (!cancelled) setApy(annualiseFunding(shortRate));
      } catch {
        // Funding rate unavailable — leave null
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [chainId, vaultAddress, indexToken]);

  return apy;
}

function useVaultAum(vaultAddress: string | undefined): { aum: bigint; isLoading: boolean } {
  const { chainId } = useChainId();
  const [aum, setAum] = useState(0n);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!vaultAddress) return;
    const provider = getProvider(undefined, chainId);
    const vault = new Contract(vaultAddress, VaultAbi, provider);
    let cancelled = false;

    async function poll() {
      try {
        const result: bigint = await vault.getAUM();
        if (!cancelled) {
          setAum(result);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) setIsLoading(false);
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [chainId, vaultAddress]);

  return { aum, isLoading };
}

// ── Per-vault hook (stable order) ─────────────────────────────────────────────

function useHedgeItem(cfg: VaultConfig): HedgeListItem {
  const vaultApy = useVaultApy(cfg);
  const fundingApy = useFundingApy(cfg.vaultAddress, cfg.tokenAddress);
  const { aum, isLoading } = useVaultAum(cfg.vaultAddress);

  return useMemo<HedgeListItem>(() => {
    const managedNetApy = vaultApy !== null && fundingApy !== null ? vaultApy + fundingApy : null;
    const selfCustodyApy = fundingApy;

    return {
      key: cfg.key,
      symbol: cfg.symbol,
      name: cfg.name,
      assetType: cfg.assetType,
      vaultAddress: cfg.vaultAddress ?? "",
      indexToken: cfg.tokenAddress ?? "",
      prismAxis: cfg.prismAxis,
      vaultApy,
      fundingApy,
      managedNetApy,
      selfCustodyApy,
      aum,
      isLoading,
      imageUrl: cfg.imageUrl,
    };
  }, [cfg, vaultApy, fundingApy, aum, isLoading]);
}

// ── Public hook (fixed-order: hooks must not be conditional) ──────────────────
//
// Supports up to 8 hedgeable vaults. sUSDe has 3 Prism axes (Price/Yield/Total)
// so the ceiling is: 3 standard (mBUIDL/mUSDY/mRWA) + 3 sUSDe = 6 minimum.
// Padded to 8 to accommodate near-future additions without another refactor.

const HEDGEABLE = VAULT_CONFIGS.filter((v) => v.tokenAddress && v.vaultAddress && v.assetType !== "stable");
const FALLBACK = VAULT_CONFIGS[0];

export function useHedgeList(): HedgeListItem[] {
  // Hooks called in fixed order — never inside map()
  const item0 = useHedgeItem(HEDGEABLE[0] ?? FALLBACK);
  const item1 = useHedgeItem(HEDGEABLE[1] ?? FALLBACK);
  const item2 = useHedgeItem(HEDGEABLE[2] ?? FALLBACK);
  const item4 = useHedgeItem(HEDGEABLE[4] ?? FALLBACK);
  const item5 = useHedgeItem(HEDGEABLE[5] ?? FALLBACK);
  const item6 = useHedgeItem(HEDGEABLE[6] ?? FALLBACK);

  return useMemo(
    () => [item0, item1, item2, item4, item5, item6].slice(0, HEDGEABLE.length),
    [item0, item1, item2, item4, item5, item6]
  );
}
