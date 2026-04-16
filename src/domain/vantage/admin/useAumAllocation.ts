/**
 * useAumAllocation.ts
 *
 * Issue #183 — Dynamic AUM Allocation Manager
 *
 * Polls Vault.getAllocationStatus() for each configured vault and exposes
 * setAumCaps() for the owner to update hedge/trade caps on-chain.
 *
 * getAllocationStatus() is not yet in TypeChain-generated types (pending pnpm sync).
 * We use a minimal type-cast (VaultWithAllocation) until regeneration.
 */

import { useCallback, useEffect, useState } from "react";

import { useVault } from "hooks/useVantageContracts";
import { useChainId } from "lib/chains";
import type { Vault } from "vantage/types";

import type { VaultConfig } from "../vaults/vaultConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AllocationStatus = {
  vaultAddress: string;
  currentHedgeOI: bigint;
  maxHedgeOI: bigint;
  currentTradeOI: bigint;
  maxTradeOI: bigint;
  hedgeCapBps: bigint;
  tradeCapBps: bigint;
};

// Issue #183 adds these methods — available after `pnpm sync` regenerates TypeChain types.
type VaultWithAllocation = Vault & {
  getAllocationStatus(): Promise<{
    currentHedgeOI: bigint;
    maxHedgeOI: bigint;
    currentTradeOI: bigint;
    maxTradeOI: bigint;
  }>;
  hedgeCapBps(): Promise<bigint>;
  tradeCapBps(): Promise<bigint>;
  setAumCaps(_hedgeCapBps: bigint, _tradeCapBps: bigint): Promise<{ wait(): Promise<unknown> }>;
};

const POLL_INTERVAL_MS = 15_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns allocation status for a single vault and a setter for the caps.
 * Pass the VaultConfig of the vault you want to inspect/manage.
 */
export function useAumAllocation(vaultConfig: VaultConfig): {
  status: AllocationStatus | null;
  isLoading: boolean;
  isSetting: boolean;
  setAumCaps(hedgeCapBps: bigint, tradeCapBps: bigint): Promise<void>;
} {
  const { chainId } = useChainId();
  const vault = useVault(undefined, chainId) as VaultWithAllocation;

  const [status, setStatus] = useState<AllocationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSetting, setIsSetting] = useState(false);

  const poll = useCallback(async () => {
    if (!vaultConfig.vaultAddress) return;
    try {
      const [alloc, hedgeBps, tradeBps] = await Promise.all([
        vault.getAllocationStatus(),
        vault.hedgeCapBps(),
        vault.tradeCapBps(),
      ]);
      setStatus({
        vaultAddress: vaultConfig.vaultAddress,
        currentHedgeOI: alloc.currentHedgeOI,
        maxHedgeOI: alloc.maxHedgeOI,
        currentTradeOI: alloc.currentTradeOI,
        maxTradeOI: alloc.maxTradeOI,
        hedgeCapBps: hedgeBps,
        tradeCapBps: tradeBps,
      });
    } catch {
      // Silently ignore RPC errors
    } finally {
      setIsLoading(false);
    }
  }, [vault, vaultConfig.vaultAddress]);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  const setAumCaps = useCallback(
    async (hedgeCapBps: bigint, tradeCapBps: bigint) => {
      setIsSetting(true);
      try {
        const tx = await vault.setAumCaps(hedgeCapBps, tradeCapBps);
        await tx.wait();
        await poll();
      } finally {
        setIsSetting(false);
      }
    },
    [vault, poll]
  );

  return { status, isLoading, isSetting, setAumCaps };
}
