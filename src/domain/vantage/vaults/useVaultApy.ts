/**
 * useVaultApy.ts
 *
 * Computes annualised percentage yield (APY) per vault type:
 *
 *   Rebasing  — reads on-chain `Rebased` events, compounds the growth factors,
 *               then annualises over the observed time window.
 *               Requires ≥2 rebase events to produce a value.
 *
 *   PriceShare — tracks the token price polled from MockPriceFeed in memory.
 *               Once the price has moved from the initial observation the rate
 *               is annualised (simple, not compounded).
 *               Returns null until the first price change is detected.
 *
 *   Direct / Stable — always returns null (no yield expectation).
 */

import { Contract } from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useChainId } from "lib/chains";
import { getProvider } from "lib/rpc";
import MockPriceFeedAbi from "vantage/abis/MockPriceFeed.json";
import MockRebasingRWAAbi from "vantage/abis/MockRebasingRWA.json";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";

import type { VaultConfig } from "./vaultConfig";

const d = localhostDeployment.addresses as { MockPriceFeed?: string };
const MOCK_PRICE_FEED = d.MockPriceFeed ?? "";

const YEAR_SEC = 365 * 24 * 3600;
const BLOCK_LOOKBACK = 100_000;
const MIN_TIMESPAN_SEC = 10; // ignore windows shorter than this

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVaultApy(cfg: VaultConfig): number | null {
  const { chainId } = useChainId();
  const provider = useMemo(() => getProvider(undefined, chainId), [chainId]);

  const [apy, setApy] = useState<number | null>(null);

  // For PriceShare: remember the first price observation
  const priceInitRef = useRef<{ price: bigint; ts: number } | null>(null);

  const compute = useCallback(async () => {
    // ── Rebasing ────────────────────────────────────────────────────────────
    if (cfg.assetType === 1) {
      try {
        const token = new Contract(cfg.tokenAddress, MockRebasingRWAAbi, provider);
        const latest = await provider.getBlockNumber();
        const from = Math.max(0, latest - BLOCK_LOOKBACK);

        const logs = await token.queryFilter(token.filters.Rebased(), from);
        if (logs.length < 2) {
          setApy(null);
          return;
        }

        const [firstBlk, lastBlk] = await Promise.all([
          provider.getBlock(logs[0].blockNumber),
          provider.getBlock(logs[logs.length - 1].blockNumber),
        ]);
        const timespan = (lastBlk?.timestamp ?? 0) - (firstBlk?.timestamp ?? 0);
        if (timespan < MIN_TIMESPAN_SEC) {
          setApy(null);
          return;
        }

        // Compound all observed rebase growth factors
        let growth = 1.0;
        for (const log of logs) {
          const e = token.interface.parseLog({ topics: [...log.topics], data: log.data });
          const yieldAdded = Number(e?.args.yieldAdded ?? 0n);
          const newTotal = Number(e?.args.newTotalPooledAssets ?? 0n);
          const prevTotal = newTotal - yieldAdded;
          if (prevTotal > 0) growth *= newTotal / prevTotal;
        }

        // Annualise: (1 + r)^(year / timespan) − 1
        const annualised = Math.pow(growth, YEAR_SEC / timespan) - 1;
        setApy(isFinite(annualised) ? annualised : null);
      } catch {
        setApy(null);
      }
      return;
    }

    // ── PriceShare ──────────────────────────────────────────────────────────
    if (cfg.assetType === 2) {
      if (!MOCK_PRICE_FEED) {
        setApy(null);
        return;
      }
      try {
        const feed = new Contract(MOCK_PRICE_FEED, MockPriceFeedAbi, provider);
        const currentPrice = (await feed.prices(cfg.tokenAddress)) as bigint;
        if (currentPrice === 0n) {
          setApy(null);
          return;
        }

        const now = Date.now();
        if (!priceInitRef.current) {
          priceInitRef.current = { price: currentPrice, ts: now };
          setApy(null);
          return;
        }

        const elapsed = (now - priceInitRef.current.ts) / 1000;
        if (elapsed < MIN_TIMESPAN_SEC) {
          setApy(null);
          return;
        }

        const initPrice = priceInitRef.current.price;
        if (currentPrice <= initPrice) {
          setApy(null);
          return;
        }

        const simpleRate = Number(currentPrice - initPrice) / Number(initPrice);
        setApy(simpleRate * (YEAR_SEC / elapsed));
      } catch {
        setApy(null);
      }
      return;
    }

    // ── Direct / Stable ─────────────────────────────────────────────────────
    setApy(null);
  }, [cfg, provider]);

  useEffect(() => {
    priceInitRef.current = null; // reset on config change
    compute();
    const interval = setInterval(compute, cfg.assetType === 1 ? 5_000 : 15_000);
    return () => clearInterval(interval);
  }, [compute, cfg.assetType]);

  return apy;
}
