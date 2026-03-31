/**
 * useVaultTxHistory.ts
 *
 * Fetches AddLiquidity / RemoveLiquidity events from the vault's LPManager
 * for the connected wallet. Returns the 20 most recent transactions.
 */

import { Contract } from "ethers";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useChainId } from "lib/chains";
import { getProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";
import LPManagerAbi from "vantage/abis/LPManager.json";

import type { VaultConfig } from "./vaultConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TxType = "deposit" | "withdraw";

export interface VaultTx {
  type: TxType;
  txHash: string;
  blockNumber: number;
  tokenAmount: bigint;
  usdValue: bigint; // only on deposit; 0n for withdraw
  sharesMinted: bigint; // only on deposit; 0n for withdraw
  sharesBurned: bigint; // only on withdraw; 0n for deposit
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const MAX_TXS = 20;
const BLOCK_LOOKBACK = 100_000; // scan last 100k blocks (localhost)

export function useVaultTxHistory(cfg: VaultConfig): { txs: VaultTx[]; isLoading: boolean } {
  const { account } = useWallet();
  const { chainId } = useChainId();
  const provider = useMemo(() => getProvider(undefined, chainId), [chainId]);

  const [txs, setTxs] = useState<VaultTx[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!account || !cfg.lpManagerAddress) return;
    setIsLoading(true);
    try {
      const lpManager = new Contract(cfg.lpManagerAddress, LPManagerAbi, provider);
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - BLOCK_LOOKBACK);

      const [depositLogs, withdrawLogs] = await Promise.all([
        lpManager.queryFilter(lpManager.filters.AddLiquidity(account), fromBlock),
        lpManager.queryFilter(lpManager.filters.RemoveLiquidity(account), fromBlock),
      ]);

      const deposits: VaultTx[] = depositLogs.map((log) => {
        const e = lpManager.interface.parseLog({ topics: [...log.topics], data: log.data });
        return {
          type: "deposit",
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          tokenAmount: e?.args.tokenAmount as bigint,
          usdValue: e?.args.usdValue as bigint,
          sharesMinted: e?.args.sharesMinted as bigint,
          sharesBurned: 0n,
        };
      });

      const withdraws: VaultTx[] = withdrawLogs.map((log) => {
        const e = lpManager.interface.parseLog({ topics: [...log.topics], data: log.data });
        return {
          type: "withdraw",
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          tokenAmount: e?.args.tokenAmount as bigint,
          usdValue: 0n,
          sharesMinted: 0n,
          sharesBurned: e?.args.sharesBurned as bigint,
        };
      });

      const all = [...deposits, ...withdraws].sort((a, b) => b.blockNumber - a.blockNumber).slice(0, MAX_TXS);

      setTxs(all);
    } catch {
      // Silently ignore RPC errors
    } finally {
      setIsLoading(false);
    }
  }, [account, cfg.lpManagerAddress, provider]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { txs, isLoading };
}
