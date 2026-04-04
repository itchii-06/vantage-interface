/**
 * useTradeHistory.ts
 *
 * Fetches historical trade events for a given index token.
 *
 * Data source strategy:
 *   localhost (chainId 31337): vault.queryFilter() — no Subgraph required
 *   other networks:            TODO — replace with Subgraph query
 *
 * Returns arrays of TradeEvent and FundingRateEvent sorted by timestamp ascending.
 */

import { formatEther } from "ethers";
import { useEffect, useState } from "react";

import { getProvider } from "lib/rpc";
import { getVantageContractAddress } from "vantage/contracts";
import { Vault__factory } from "vantage/types";

import type { FundingRateEvent, TradeEvent } from "./types";

const LOCALHOST_CHAIN_ID = 31337;

type UseTradeHistoryResult = {
  tradeEvents: TradeEvent[];
  fundingRateEvents: FundingRateEvent[];
  isLoading: boolean;
};

export function useTradeHistory(chainId: number, indexToken: string, vaultAddress?: string): UseTradeHistoryResult {
  const [tradeEvents, setTradeEvents] = useState<TradeEvent[]>([]);
  const [fundingRateEvents, setFundingRateEvents] = useState<FundingRateEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!indexToken) return;

    let cancelled = false;

    async function fetchLocalhost() {
      setIsLoading(true);
      try {
        const provider = getProvider(undefined, chainId);
        const vaultAddr = vaultAddress ?? getVantageContractAddress(chainId, "Vault");
        const vault = Vault__factory.connect(vaultAddr, provider);

        // --- Trade events (IncreasePosition + DecreasePosition) ---
        const [increaseRaw, decreaseRaw] = await Promise.all([
          vault.queryFilter(vault.filters.IncreasePosition(undefined, undefined, undefined, indexToken), 0, "latest"),
          vault.queryFilter(vault.filters.DecreasePosition(undefined, undefined, undefined, indexToken), 0, "latest"),
        ]);

        // Collect unique block numbers for batch timestamp fetch
        const blockNums = [...new Set([...increaseRaw, ...decreaseRaw].map((e) => e.blockNumber))];
        const blocks = await Promise.all(blockNums.map((n) => provider.getBlock(n)));
        const blockTsMap = new Map(
          blocks.filter((b): b is NonNullable<typeof b> => b !== null).map((b) => [b.number, Number(b.timestamp)])
        );

        const increaseEvents: TradeEvent[] = increaseRaw.map((e) => ({
          price: parseFloat(formatEther(e.args.price)),
          sizeDelta: parseFloat(formatEther(e.args.sizeDelta)),
          isLong: e.args.isLong,
          timestamp: blockTsMap.get(e.blockNumber) ?? Date.now() / 1000,
          type: "increase",
        }));

        const decreaseEvents: TradeEvent[] = decreaseRaw.map((e) => ({
          price: parseFloat(formatEther(e.args.price)),
          sizeDelta: parseFloat(formatEther(e.args.sizeDelta)),
          isLong: e.args.isLong,
          timestamp: blockTsMap.get(e.blockNumber) ?? Date.now() / 1000,
          type: "decrease",
        }));

        const allTrades = [...increaseEvents, ...decreaseEvents].sort((a, b) => a.timestamp - b.timestamp);

        // --- Funding rate events (CumulativeFundingUpdated) ---
        const fundingRaw = await vault.queryFilter(vault.filters.CumulativeFundingUpdated(indexToken), 0, "latest");

        const fundingBlockNums = [...new Set(fundingRaw.map((e) => e.blockNumber))];
        const fundingBlocks = await Promise.all(fundingBlockNums.map((n) => provider.getBlock(n)));
        const fundingTsMap = new Map(
          fundingBlocks
            .filter((b): b is NonNullable<typeof b> => b !== null)
            .map((b) => [b.number, Number(b.timestamp)])
        );

        const fundingEvents: FundingRateEvent[] = fundingRaw.map((e) => ({
          annualRateBps: Number(e.args.annualRate), // int256 bps
          timestamp: fundingTsMap.get(e.blockNumber) ?? Date.now() / 1000,
        }));

        if (!cancelled) {
          setTradeEvents(allTrades);
          setFundingRateEvents(fundingEvents.sort((a, b) => a.timestamp - b.timestamp));
        }
      } catch {
        // Non-critical — chart will show empty state
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    // TODO: Add Subgraph query for non-localhost networks
    // const fetchSubgraph = async () => { ... };

    if (chainId === LOCALHOST_CHAIN_ID || vaultAddress) {
      fetchLocalhost();
    } else {
      // Subgraph not yet deployed — show empty chart with TODO notice
      setTradeEvents([]);
      setFundingRateEvents([]);
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [chainId, indexToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return { tradeEvents, fundingRateEvents, isLoading };
}
