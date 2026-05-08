/**
 * useAllRedemptionRequests.ts
 *
 * Polls all vault LPManagers and returns redemption request status for the
 * connected account across every vault that has a non-empty lpManagerAddress.
 *
 * Returns one item per vault that has an active request (pendingShares > 0).
 */

import { Contract } from "ethers";
import { useEffect, useState } from "react";

import { getProvider } from "lib/rpc";
import LPManagerAbi from "vantage/abis/LPManager.json";
import LPTokenAbi from "vantage/abis/LPToken.json";

import { VAULT_CONFIGS, type VaultConfig } from "../vaults/vaultConfig";

const POLL_MS = 15_000;
const WAD = BigInt("1000000000000000000");

export interface RedemptionRequestItem {
  /** VaultConfig key */
  key: string;
  cfg: VaultConfig;
  /** VLP shares locked in LPManager */
  pendingShares: bigint;
  /** Epoch ID at which the request was registered */
  pendingEpochId: bigint;
  /**
   * Share price set when the user's epoch was executed (0 = not yet executed).
   * When > 0, the user can call claimRedeemedFunds().
   */
  pendingEpochPricePerShare: bigint;
  /** USD value of the pending redemption, WAD */
  pendingUsdValue: bigint;
  /** Unix timestamp (seconds) of the next scheduled epoch */
  nextEpochTimestamp: bigint;
  /** True when the epoch has been executed and USDC can be claimed */
  isClaimable: boolean;
}

// Only vaults with a real LPManager (Prism axis configs have empty lpManagerAddress)
const REDEEMABLE_CFGS = VAULT_CONFIGS.filter((v) => v.lpManagerAddress);

export function useAllRedemptionRequests(
  chainId: number,
  account: string | undefined
): { items: RedemptionRequestItem[]; isLoading: boolean } {
  const [items, setItems] = useState<RedemptionRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!account) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    const provider = getProvider(undefined, chainId);
    let cancelled = false;

    async function poll() {
      try {
        const results: RedemptionRequestItem[] = [];

        await Promise.all(
          REDEEMABLE_CFGS.map(async (cfg) => {
            try {
              const lpm = new Contract(cfg.lpManagerAddress, LPManagerAbi, provider);

              const [pendingReq, lastEpochTs, cycleDuration, sharePriceRaw] = await Promise.all([
                lpm.redemptionRequests(account) as Promise<{ shares: bigint; epochId: bigint }>,
                lpm.lastEpochTimestamp() as Promise<bigint>,
                lpm.redemptionCycleDuration() as Promise<bigint>,
                lpm.getSharePrice() as Promise<bigint>,
              ]);

              const pendingShares = pendingReq.shares;
              if (pendingShares === 0n) return; // no active request for this vault

              const pendingEpochId = pendingReq.epochId;
              const baseTs = lastEpochTs > 0n ? lastEpochTs : BigInt(Math.floor(Date.now() / 1000));
              const nextEpochTimestamp = baseTs + cycleDuration;

              const pendingEpochPricePerShare = (await lpm.epochPricePerShare(pendingEpochId)) as bigint;
              const priceForValue = pendingEpochPricePerShare > 0n ? pendingEpochPricePerShare : sharePriceRaw;
              const pendingUsdValue = (pendingShares * priceForValue) / WAD;

              results.push({
                key: cfg.key,
                cfg,
                pendingShares,
                pendingEpochId,
                pendingEpochPricePerShare,
                pendingUsdValue,
                nextEpochTimestamp,
                isClaimable: pendingEpochPricePerShare > 0n,
              });
            } catch {
              // Vault not yet deployed or older deployment — skip
            }
          })
        );

        if (!cancelled) {
          setItems(results);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) setIsLoading(false);
      }
    }

    setIsLoading(true);
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [chainId, account]);

  return { items, isLoading };
}

// Re-export for use in LPToken approve step
export { LPTokenAbi };
