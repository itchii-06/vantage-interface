/**
 * useJuniorVaultLiquidity.ts
 *
 * Polls the USDC balance of the JuniorTrancheVault.
 * Returns hasLiquidity=false when the vault has no USDC — meaning trades
 * and hedges cannot be executed (the on-chain tx would revert).
 *
 * Fails open: if the contract call fails, hasLiquidity stays true
 * so we don't inadvertently block the UI on transient RPC errors.
 */

import { Contract } from "ethers";
import { useEffect, useState } from "react";

import { getProvider } from "lib/rpc";
import { getVantageContractAddress } from "vantage/contracts";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";

const USDC_ADDRESS = (localhostDeployment.addresses as { tokens?: { USDC?: string } }).tokens?.USDC ?? "";

const BALANCE_OF_ABI = ["function balanceOf(address) external view returns (uint256)"];

const POLL_MS = 15_000;

export function useJuniorVaultLiquidity(chainId: number): { hasLiquidity: boolean } {
  // Optimistic default: assume liquidity exists until we know otherwise.
  const [hasLiquidity, setHasLiquidity] = useState(true);

  useEffect(() => {
    let vaultAddr: string;
    try {
      vaultAddr = getVantageContractAddress(chainId, "JuniorTrancheVault");
    } catch {
      return;
    }

    if (!vaultAddr || !USDC_ADDRESS) return;

    const provider = getProvider(undefined, chainId);
    const usdc = new Contract(USDC_ADDRESS, BALANCE_OF_ABI, provider);
    let cancelled = false;

    async function poll() {
      try {
        const balance: bigint = await usdc.balanceOf(vaultAddr);
        if (!cancelled) setHasLiquidity(balance > 0n);
      } catch {
        // Fail open — don't block on RPC errors.
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [chainId]);

  return { hasLiquidity };
}
