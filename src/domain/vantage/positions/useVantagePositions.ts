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

import { useVault } from "hooks/useVantageContracts";
import { getProvider } from "lib/rpc";
import { getVantageContractAddress } from "vantage/contracts";
import { VaultReader__factory } from "vantage/types";

import type { VantagePosition } from "./types";

type UseVantagePositionsResult = {
  positions: VantagePosition[];
  isLoading: boolean;
  error: Error | undefined;
  refetch: () => void;
};

export function useVantagePositions(
  account: string | undefined,
  chainId: number,
  /** Known collateral tokens to check against each index token. Defaults to [indexToken] (GMX-style). */
  collateralTokens?: string[]
): UseVantagePositionsResult {
  const [positions, setPositions] = useState<VantagePosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [tick, setTick] = useState(0);

  const vault = useVault(undefined, chainId);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!account) {
      setPositions([]);
      return;
    }

    // VaultReader may not be deployed on all networks (e.g. localhost).
    // Create it lazily inside the effect so missing address doesn't throw.
    const ZERO = "0x0000000000000000000000000000000000000000";
    const vaultReaderAddress = getVantageContractAddress(chainId, "VaultReader");
    const vaultReader =
      vaultReaderAddress && vaultReaderAddress !== ZERO
        ? VaultReader__factory.connect(vaultReaderAddress, getProvider(undefined, chainId))
        : null;

    let cancelled = false;

    async function fetch() {
      setIsLoading(true);
      setError(undefined);

      try {
        const vaultAddress = getVantageContractAddress(chainId, "Vault");
        const assets: string[] = await vault.getPositionAssets();

        const openPositions: VantagePosition[] = [];

        for (const indexToken of assets) {
          // Candidate collateral tokens: caller-supplied list + the index token itself
          // (GMX-style longs use collateral == index; our UI uses USDC for all positions).
          const collaterals = collateralTokens ? [...new Set([...collateralTokens, indexToken])] : [indexToken];

          for (const collateralToken of collaterals) {
            for (const isLong of [true, false]) {
              if (cancelled) return;

              const key = await vault.getPositionKey(account!, collateralToken, indexToken, isLong);
              const raw = await vault.positions(key);

              // Skip closed or never-opened positions
              if (raw.size === 0n) continue;

              // Fetch unrealized PnL (skipped when VaultReader is not deployed)
              let pendingPnl = 0n;
              if (vaultReader) {
                try {
                  const pnlResult = await vaultReader.getPendingPnL(
                    vaultAddress,
                    account!,
                    collateralToken,
                    indexToken,
                    isLong
                  );
                  if (pnlResult.exists) {
                    pendingPnl = pnlResult.pnlUsd;
                  }
                } catch {
                  // getPendingPnL may revert if position doesn't exist — safe to ignore
                }
              }

              openPositions.push({
                key: key as string,
                account: account!,
                collateralToken,
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
  }, [account, chainId, vault, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return { positions, isLoading, error, refetch };
}
