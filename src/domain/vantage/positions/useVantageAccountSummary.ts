/**
 * useVantageAccountSummary.ts
 *
 * Fetches an aggregate account summary for the connected user:
 * total collateral, total position value, net PnL, margin usage, liquidation flag.
 *
 * Uses VaultReader.getUserAccountSummary(vault, user, collateralToken).
 * When a user holds positions in multiple collateral tokens, the summary is
 * returned per-token; this hook fetches all assets and merges the results.
 *
 * NOTE: All USD values are in PRICE_PRECISION = 1e18 (WAD), not GMX's 1e30.
 */

import { useCallback, useEffect, useState } from "react";

import { useVault, useVaultReader } from "hooks/useVantageContracts";
import { getVantageContractAddress } from "vantage/contracts";

import type { VantageAccountSummary } from "./types";

type UseVantageAccountSummaryResult = {
  summary: VantageAccountSummary | undefined;
  isLoading: boolean;
  error: Error | undefined;
  refetch: () => void;
};

export function useVantageAccountSummary(account: string | undefined, chainId: number): UseVantageAccountSummaryResult {
  const [summary, setSummary] = useState<VantageAccountSummary | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [tick, setTick] = useState(0);

  const vault = useVault(undefined, chainId);
  const vaultReader = useVaultReader(undefined, chainId);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!account) {
      setSummary(undefined);
      return;
    }

    let cancelled = false;

    async function fetch() {
      setIsLoading(true);
      setError(undefined);

      try {
        const vaultAddress = getVantageContractAddress(chainId, "Vault");
        const assets: string[] = await vault.getPositionAssets();

        // Accumulate summaries across all collateral tokens
        let totalCollateralUsd = 0n;
        let totalPositionValueUsd = 0n;
        let netPnlUsd = 0n;
        let maxMarginUsageBps = 0n;
        let anyLiquidatable = false;

        for (const collateralToken of assets) {
          if (cancelled) return;

          try {
            const raw = await vaultReader.getUserAccountSummary(vaultAddress, account!, collateralToken);

            totalCollateralUsd += raw.totalCollateralUsd;
            totalPositionValueUsd += raw.totalPositionValueUsd;
            netPnlUsd += raw.netPnlUsd;
            if (raw.marginUsageBps > maxMarginUsageBps) {
              maxMarginUsageBps = raw.marginUsageBps;
            }
            if (raw.isLiquidatable) anyLiquidatable = true;
          } catch {
            // This collateral token may have no positions — safe to skip
          }
        }

        if (!cancelled) {
          setSummary({
            totalCollateralUsd,
            totalPositionValueUsd,
            netPnlUsd,
            marginUsageBps: maxMarginUsageBps,
            isLiquidatable: anyLiquidatable,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e as Error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetch();
    return () => {
      cancelled = true;
    };
  }, [account, chainId, vault, vaultReader, tick]);

  return { summary, isLoading, error, refetch };
}
