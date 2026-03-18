/**
 * useVantagePositions.ts
 *
 * Fetches open positions for the connected user from the Vantage Vault contract.
 *
 * Flow:
 *   1. vault.getPositionAssets() → list of collateral/index tokens deployed in the vault
 *   2. For each token × isLong combination:
 *        vault.getPositionKey(account, token, token, isLong) → bytes32 key
 *        vault.positions(key) → raw position struct
 *   3. Filter out positions with size === 0 (closed / never opened)
 *   4. For each open position:
 *        vaultReader.getPendingPnL(...) → unrealized PnL
 *
 * NOTE: Individual RPC calls are used here (no Multicall yet).
 *       Future optimisation: inject a Multicall provider via the runnerOverride
 *       parameter of useVault / useVaultReader.
 *
 * NOTE: All USD values are in PRICE_PRECISION = 1e18 (WAD), not GMX's 1e30.
 */

import { useCallback, useEffect, useState } from "react";

import { getVantageContractAddress } from "vantage/contracts";
import { useVault, useVaultReader } from "hooks/useVantageContracts";

import type { VantagePosition } from "./types";

type UseVantagePositionsResult = {
  positions: VantagePosition[];
  isLoading: boolean;
  error: Error | undefined;
  refetch: () => void;
};

export function useVantagePositions(
  account: string | undefined,
  chainId: number
): UseVantagePositionsResult {
  const [positions, setPositions] = useState<VantagePosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [tick, setTick] = useState(0);

  const vault = useVault(undefined, chainId);
  const vaultReader = useVaultReader(undefined, chainId);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!account) {
      setPositions([]);
      return;
    }

    let cancelled = false;

    async function fetch() {
      setIsLoading(true);
      setError(undefined);

      try {
        const vaultAddress = getVantageContractAddress(chainId, "Vault");
        const assets: string[] = await vault.getPositionAssets();

        const openPositions: VantagePosition[] = [];

        for (const token of assets) {
          for (const isLong of [true, false]) {
            if (cancelled) return;

            const key = await vault.getPositionKey(account!, token, token, isLong);
            const raw = await vault.positions(key);

            // Skip closed or never-opened positions
            if (raw.size === 0n) continue;

            // Fetch unrealized PnL
            let pendingPnl = 0n;
            try {
              const pnlResult = await vaultReader.getPendingPnL(
                vaultAddress,
                account!,
                token,
                token,
                isLong
              );
              if (pnlResult.exists) {
                pendingPnl = pnlResult.pnlUsd;
              }
            } catch {
              // getPendingPnL may revert if position doesn't exist — safe to ignore
            }

            openPositions.push({
              key: key as string,
              account: account!,
              collateralToken: token,
              indexToken: raw.indexToken,
              isLong,
              size: raw.size,
              collateral: raw.collateral,
              averagePrice: raw.averagePrice,
              entryFundingRate: raw.entryFundingRate,
              lastUpdatedAt: raw.lastUpdatedAt,
              pendingPnl,
            });
          }
        }

        if (!cancelled) {
          setPositions(openPositions);
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

  return { positions, isLoading, error, refetch };
}
