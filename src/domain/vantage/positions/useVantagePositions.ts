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
 *        vault.getMinPrice(indexToken)  → currentPrice
 *        assetRegistry.getAssetRiskInfo(indexToken) → maintenanceMarginBps (cached per token)
 *
 * NOTE: Individual RPC calls are used here (no Multicall yet).
 *       Future optimisation: inject a Multicall provider via the runnerOverride
 *       parameter of useVault / useVaultReader.
 *
 * NOTE: All USD values are in PRICE_PRECISION = 1e18 (WAD), not GMX's 1e30.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { getProvider } from "lib/rpc";
import { getVantageContractAddress } from "vantage/contracts";
import { AssetRegistry__factory, Vault__factory, VaultReader__factory } from "vantage/types";

import type { VantagePosition } from "./types";

const POLL_INTERVAL_MS = 30_000;
const ZERO = "0x0000000000000000000000000000000000000000";

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
  collateralTokens?: string[],
  /** Override vault address. Defaults to the primary Vault from deployment config. */
  vaultAddress?: string
): UseVantagePositionsResult {
  const [positions, setPositions] = useState<VantagePosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [tick, setTick] = useState(0);

  // Cache maintenanceMarginBps per indexToken to avoid repeated RPC calls
  const riskInfoCache = useRef<Map<string, bigint>>(new Map());

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!account) {
      setPositions([]);
      return;
    }

    const provider = getProvider(undefined, chainId);
    const resolvedVaultAddress = vaultAddress ?? getVantageContractAddress(chainId, "Vault");
    const vault = Vault__factory.connect(resolvedVaultAddress, provider);

    // VaultReader may not be deployed on all networks (e.g. localhost).
    const vaultReaderAddress = getVantageContractAddress(chainId, "VaultReader");
    const vaultReader =
      vaultReaderAddress && vaultReaderAddress !== ZERO
        ? VaultReader__factory.connect(vaultReaderAddress, provider)
        : null;

    // AssetRegistry may not be deployed on all networks (e.g. localhost).
    const registryAddr = getVantageContractAddress(chainId, "AssetRegistry");
    const assetRegistry =
      registryAddr && registryAddr !== ZERO ? AssetRegistry__factory.connect(registryAddr, provider) : null;

    let cancelled = false;

    async function fetch() {
      setIsLoading(true);
      setError(undefined);

      try {
        const assets: string[] = await vault.getPositionAssets();

        const openPositions: VantagePosition[] = [];

        for (const indexToken of assets) {
          // Candidate collateral tokens: caller-supplied list + the index token itself
          const collaterals = collateralTokens ? [...new Set([...collateralTokens, indexToken])] : [indexToken];

          // Fetch current oracle price for this index token
          let currentPrice = 0n;
          try {
            currentPrice = await vault.getMinPrice(indexToken);
          } catch {
            // price unavailable — skip health calculations for this token
          }

          // Fetch maintenanceMarginBps from AssetRegistry (with per-token cache)
          let maintenanceMarginBps = riskInfoCache.current.get(indexToken) ?? 0n;
          if (maintenanceMarginBps === 0n && assetRegistry) {
            try {
              const riskInfo = await assetRegistry.getAssetRiskInfo(indexToken);
              maintenanceMarginBps = riskInfo.maintenanceMarginBps;
              riskInfoCache.current.set(indexToken, maintenanceMarginBps);
            } catch {
              // AssetRegistry not configured for this token — leave as 0
            }
          }

          for (const collateralToken of collaterals) {
            for (const isLong of [true, false]) {
              if (cancelled) return;

              const key = await vault.getPositionKey(account!, collateralToken, indexToken, isLong);
              const raw = await vault.positions(key);

              if (raw.size === 0n) continue;

              // Fetch unrealized PnL (skipped when VaultReader is not deployed)
              let pendingPnl = 0n;
              if (vaultReader) {
                try {
                  const pnlResult = await vaultReader.getPendingPnL(
                    resolvedVaultAddress,
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
                currentPrice,
                maintenanceMarginBps,
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

    // Poll every 30 seconds for real-time PnL and price updates
    const intervalId = setInterval(() => {
      if (!cancelled) fetch();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [account, chainId, vaultAddress, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return { positions, isLoading, error, refetch };
}
