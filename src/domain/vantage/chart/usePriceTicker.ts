/**
 * usePriceTicker.ts
 *
 * Polls vault.getMinPrice(indexToken) at a regular interval and returns the
 * results as TradeEvent[] so the price chart renders even when no trades have
 * occurred yet.
 *
 * These synthetic events have sizeDelta = 0, so they do NOT affect OI or
 * Funding Rate charts — only the candlestick price chart uses them.
 */

import { formatEther } from "ethers";
import { useEffect, useState } from "react";

import { getProvider } from "lib/rpc";
import { getVantageContractAddress } from "vantage/contracts";
import { Vault__factory } from "vantage/types";

import type { TradeEvent } from "./types";

const POLL_INTERVAL_MS = 10_000; // 10 seconds
const ZERO = "0x0000000000000000000000000000000000000000";

export function usePriceTicker(chainId: number, indexToken: string, vaultAddress?: string): TradeEvent[] {
  const [ticks, setTicks] = useState<TradeEvent[]>([]);

  useEffect(() => {
    if (!indexToken) return;

    const resolvedVaultAddress = vaultAddress ?? getVantageContractAddress(chainId, "JuniorTrancheVault");
    if (!resolvedVaultAddress || resolvedVaultAddress === ZERO) return;

    const provider = getProvider(undefined, chainId);
    const vault = Vault__factory.connect(resolvedVaultAddress, provider);

    let cancelled = false;

    async function tick() {
      try {
        const raw = await vault.getMinPrice(indexToken);
        const price = parseFloat(formatEther(raw));
        if (price <= 0 || cancelled) return;

        const event: TradeEvent = {
          price,
          sizeDelta: 0,
          isLong: true,
          timestamp: Math.floor(Date.now() / 1000),
          type: "increase",
        };

        setTicks((prev) => [...prev, event]);
      } catch {
        // Price feed unavailable — skip this tick silently
      }
    }

    tick(); // Initial fetch immediately
    const timer = setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [chainId, indexToken, vaultAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  return ticks;
}
