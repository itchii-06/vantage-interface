/**
 * useVantageLPData.ts
 *
 * Fetches LP-related on-chain state:
 *   - VLP share price (from LPManager)
 *   - Vault AUM
 *   - User's VLP token balance and USD value
 *   - Weekend lock status
 *
 * Polling interval: 15 seconds.
 */

import { useCallback, useEffect, useState } from "react";

import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";
import { useLPManager, useLPToken, useVault } from "hooks/useVantageContracts";

import type { VantageLPData } from "./types";

const WAD = BigInt("1000000000000000000"); // 1e18
const POLL_INTERVAL_MS = 15_000;

/** Returns true when the current UTC time is a weekend (Sat or Sun). */
function isUtcWeekend(): boolean {
  const day = new Date().getUTCDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

export function useVantageLPData(): VantageLPData & { isLoading: boolean } {
  const { chainId } = useChainId();
  const { account } = useWallet();

  const lpManager = useLPManager(undefined, chainId);
  const lpToken = useLPToken(undefined, chainId);
  const vault = useVault(undefined, chainId);

  const [data, setData] = useState<VantageLPData>({
    sharePrice: WAD,
    totalAum: 0n,
    vlpTotalSupply: 0n,
    vlpBalance: 0n,
    usdValue: 0n,
    weekendBufferBps: 0n,
    isWeekendLocked: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const [sharePrice, totalAum, vlpTotalSupply, weekendBufferBps, vlpBalance] = await Promise.all([
        lpManager.getSharePrice(),
        vault.getAUM(),
        lpToken.totalSupply(),
        vault.weekendBufferBps(),
        account ? lpToken.balanceOf(account) : Promise.resolve(0n),
      ]);

      const sp = sharePrice as bigint;
      const balance = vlpBalance as bigint;
      const usdValue = balance * sp / WAD;
      const bps = weekendBufferBps as bigint;

      setData({
        sharePrice: sp,
        totalAum: totalAum as bigint,
        vlpTotalSupply: vlpTotalSupply as bigint,
        vlpBalance: balance,
        usdValue,
        weekendBufferBps: bps,
        isWeekendLocked: bps > 0n && isUtcWeekend(),
      });
    } catch {
      // Silently ignore RPC errors during polling
    } finally {
      setIsLoading(false);
    }
  }, [lpManager, lpToken, vault, account]);

  useEffect(() => {
    fetch();
    const timer = setInterval(fetch, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetch]);

  return { ...data, isLoading };
}
