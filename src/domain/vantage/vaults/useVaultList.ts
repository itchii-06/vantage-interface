/**
 * useVaultList.ts
 *
 * Fetches on-chain state for all 4 vaults (AUM, LP share price, user deposit)
 * and returns a list ready for the Vaults list page.
 *
 * Polling interval: 15 seconds.
 */

import { Contract } from "ethers";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useChainId } from "lib/chains";
import { getProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";
import LPManagerAbi from "vantage/abis/LPManager.json";
import LPTokenAbi from "vantage/abis/LPToken.json";
import VaultAbi from "vantage/abis/Vault.json";

import { VAULT_CONFIGS, type VaultConfig } from "./vaultConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VaultListItem extends VaultConfig {
  aum: bigint;
  sharePrice: bigint;
  vlpBalance: bigint; // user's VLP shares (0 if wallet not connected)
  usdValue: bigint; // user's position in USD WAD
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const WAD = BigInt("1000000000000000000");
const POLL_INTERVAL_MS = 15_000;

export function useVaultList(): VaultListItem[] {
  const { account } = useWallet();
  const { chainId } = useChainId();
  const provider = useMemo(() => getProvider(undefined, chainId), [chainId]);

  const buildInitial = (): VaultListItem[] =>
    VAULT_CONFIGS.map((cfg) => ({
      ...cfg,
      aum: 0n,
      sharePrice: WAD,
      vlpBalance: 0n,
      usdValue: 0n,
      isLoading: true,
    }));

  const [items, setItems] = useState<VaultListItem[]>(buildInitial);

  const fetchAll = useCallback(async () => {
    const results = await Promise.all(
      VAULT_CONFIGS.map(async (cfg): Promise<VaultListItem> => {
        try {
          const vault = new Contract(cfg.vaultAddress, VaultAbi, provider);
          const lpManager = new Contract(cfg.lpManagerAddress, LPManagerAbi, provider);
          const lpToken = new Contract(cfg.lpTokenAddress, LPTokenAbi, provider);

          const [aum, sharePrice, vlpBalance] = await Promise.all([
            vault.getAUM() as Promise<bigint>,
            lpManager.getSharePrice() as Promise<bigint>,
            account ? (lpToken.balanceOf(account) as Promise<bigint>) : Promise.resolve(0n),
          ]);

          const usdValue = (vlpBalance * sharePrice) / WAD;

          return { ...cfg, aum, sharePrice, vlpBalance, usdValue, isLoading: false };
        } catch {
          return { ...cfg, aum: 0n, sharePrice: WAD, vlpBalance: 0n, usdValue: 0n, isLoading: false };
        }
      })
    );
    setItems(results);
  }, [account, provider]);

  useEffect(() => {
    fetchAll();
    const timer = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchAll]);

  return items;
}
