/**
 * useSpread.ts
 *
 * Computes the current Bid/Ask spread for a token by comparing
 * Vault.getMaxPrice (Ask) and Vault.getMinPrice (Bid).
 *
 * Spread formula:
 *   spreadBps = (maxPrice - minPrice) * 10_000 / maxPrice
 *   bidPrice  = minPrice  (used for long close / short open)
 *   askPrice  = maxPrice  (used for long open / short close)
 */

import { Contract } from "ethers";
import { useEffect, useMemo, useState } from "react";

import { useChainId } from "lib/chains";
import { getProvider } from "lib/rpc";
import VaultAbi from "vantage/abis/Vault.json";
import { getVantageContractAddress } from "vantage/contracts";

export type SpreadData = {
  /** Ask price — use for long open / short close (1e18) */
  askPrice: bigint;
  /** Bid price — use for long close / short open (1e18) */
  bidPrice: bigint;
  /** Spread in basis points (0 if prices are equal) */
  spreadBps: number;
  isLoading: boolean;
};

const POLL_MS = 10_000;

export function useSpread(tokenAddress: string | undefined): SpreadData {
  const { chainId } = useChainId();
  const provider = useMemo(() => getProvider(undefined, chainId), [chainId]);

  const [data, setData] = useState<SpreadData>({
    askPrice: 0n,
    bidPrice: 0n,
    spreadBps: 0,
    isLoading: true,
  });

  useEffect(() => {
    if (!tokenAddress) {
      setData({ askPrice: 0n, bidPrice: 0n, spreadBps: 0, isLoading: false });
      return;
    }

    const vaultAddress = getVantageContractAddress(chainId, "Vault");
    const vault = new Contract(vaultAddress, VaultAbi, provider);

    async function fetch() {
      try {
        const [maxPrice, minPrice] = await Promise.all([
          vault.getMaxPrice(tokenAddress) as Promise<bigint>,
          vault.getMinPrice(tokenAddress) as Promise<bigint>,
        ]);

        const spreadBps = maxPrice > 0n ? Number(((maxPrice - minPrice) * 10_000n) / maxPrice) : 0;

        setData({ askPrice: maxPrice, bidPrice: minPrice, spreadBps, isLoading: false });
      } catch {
        setData((prev) => ({ ...prev, isLoading: false }));
      }
    }

    fetch();
    const timer = setInterval(fetch, POLL_MS);
    return () => clearInterval(timer);
  }, [tokenAddress, chainId, provider]);

  return data;
}
