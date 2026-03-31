/**
 * useVaultActions.ts
 *
 * Transaction hooks for Vault LP deposit and withdraw.
 * Mirrors useVantageLPActions but works with any VaultConfig (all 4 vaults).
 *
 *   deposit(amount)
 *     approve token to LPManager (if needed) → LPManager.addLiquidity
 *
 *   withdraw(shares)
 *     LPManager.removeLiquidity  (no approve needed — LPManager burns VLP)
 *
 * NOTE: allowance is checked via a direct ethers call instead of
 * useTokensAllowanceData, because the GMX Multicall infrastructure does not
 * support localhost (chainId 31337). The direct approach works on all networks.
 */

import { t } from "@lingui/macro";
import { Contract, ethers } from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { maxUint256 } from "viem";

import { DEFAULT_SETTLEMENT_CHAIN_ID } from "config/chains";
import { usePendingTxns } from "context/PendingTxnsContext/PendingTxnsContext";
import { pushSuccessNotification } from "lib/contracts/notifications";
import { helperToast } from "lib/helperToast";
import { getProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";
import TokenAbi from "sdk/abis/Token";
import LPManagerAbi from "vantage/abis/LPManager.json";

import type { VaultConfig } from "./vaultConfig";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVaultActions(cfg: VaultConfig, chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID) {
  const { account, signer } = useWallet();
  const { setPendingTxns } = usePendingTxns();

  const lpManager = useMemo(
    () => (signer ? new Contract(cfg.lpManagerAddress, LPManagerAbi, signer) : null),
    [signer, cfg.lpManagerAddress]
  );

  // ---------------------------------------------------------------------------
  // Allowance — direct ethers call (works on localhost + all testnets)
  // ---------------------------------------------------------------------------

  const [allowance, setAllowance] = useState<bigint>(0n);
  const [isApproving, setIsApproving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAllowance = useCallback(async () => {
    if (!account || !cfg.tokenAddress || !cfg.lpManagerAddress) return;
    try {
      const provider = getProvider(undefined, chainId);
      const token = new Contract(cfg.tokenAddress, TokenAbi, provider);
      const raw = (await token.allowance(account, cfg.lpManagerAddress)) as bigint;
      setAllowance(raw);
    } catch {
      // Silently ignore RPC errors
    }
  }, [account, cfg.tokenAddress, cfg.lpManagerAddress, chainId]);

  useEffect(() => {
    fetchAllowance();
    intervalRef.current = setInterval(fetchAllowance, 5_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAllowance]);

  const isApprovalNeeded = useCallback(
    (amount: bigint): boolean => {
      if (!account) return false; // wallet not connected — don't show approve
      return allowance < amount;
    },
    [allowance, account]
  );

  // ---------------------------------------------------------------------------
  // Approve
  // ---------------------------------------------------------------------------

  const approve = useCallback(async (): Promise<void> => {
    if (!signer) return;
    setIsApproving(true);
    try {
      const contract = new Contract(cfg.tokenAddress, TokenAbi, signer);
      const tx = await contract.approve(cfg.lpManagerAddress, maxUint256);
      helperToast.info(t`Approval submitted — waiting for confirmation…`);
      await tx.wait();
      await fetchAllowance(); // refresh immediately after approval
    } finally {
      setIsApproving(false);
    }
  }, [signer, cfg.tokenAddress, cfg.lpManagerAddress, fetchAllowance]);

  // ---------------------------------------------------------------------------
  // Deposit
  // ---------------------------------------------------------------------------

  const deposit = useCallback(
    async (amount: bigint): Promise<void> => {
      if (!account || !signer || !lpManager) {
        helperToast.error(t`Wallet not connected`);
        return;
      }

      if (isApprovalNeeded(amount)) {
        await approve();
      }

      try {
        const tx = await lpManager.addLiquidity(cfg.tokenAddress, amount);
        helperToast.info(t`Transaction submitted`);
        setPendingTxns((prev) => [...prev, { hash: tx.hash, message: t`Adding liquidity...` }]);
        const receipt = await tx.wait();
        if (receipt) {
          pushSuccessNotification(chainId, t`Liquidity added`, { transactionHash: receipt.hash });
        }
      } catch (err: unknown) {
        helperToast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [account, signer, lpManager, cfg.tokenAddress, isApprovalNeeded, approve, chainId, setPendingTxns]
  );

  // ---------------------------------------------------------------------------
  // Withdraw
  // ---------------------------------------------------------------------------

  const withdraw = useCallback(
    async (shares: bigint): Promise<void> => {
      if (!account || !signer || !lpManager) {
        helperToast.error(t`Wallet not connected`);
        return;
      }

      try {
        const tx = await lpManager.removeLiquidity(shares, cfg.tokenAddress, 0n);
        helperToast.info(t`Transaction submitted`);
        setPendingTxns((prev) => [...prev, { hash: tx.hash, message: t`Removing liquidity...` }]);
        const receipt = await tx.wait();
        if (receipt) {
          pushSuccessNotification(chainId, t`Liquidity removed`, { transactionHash: receipt.hash });
        }
      } catch (err: unknown) {
        helperToast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [account, signer, lpManager, cfg.tokenAddress, chainId, setPendingTxns]
  );

  // ---------------------------------------------------------------------------
  // Debug: Rebase (Rebasing vault only)
  // ---------------------------------------------------------------------------

  const debugRebase = useCallback(
    async (basisPoints: number): Promise<void> => {
      if (!signer) return;
      try {
        const MockRebasingRWAAbi = (await import("vantage/abis/MockRebasingRWA.json")).default;
        const token = new Contract(cfg.tokenAddress, MockRebasingRWAAbi, signer);
        const tx = await (
          token as ethers.Contract & { rebaseByUI: (bp: number) => Promise<{ wait: () => Promise<unknown> }> }
        ).rebaseByUI(basisPoints);
        await tx.wait();
        helperToast.success(t`Rebase +${basisPoints / 100}% applied`);
      } catch (err: unknown) {
        helperToast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [signer, cfg.tokenAddress]
  );

  // ---------------------------------------------------------------------------
  // Debug: Set price (PriceShare / Direct vault)
  // ---------------------------------------------------------------------------

  const debugSetPrice = useCallback(
    async (newPrice: bigint): Promise<void> => {
      if (!signer) return;
      try {
        const MockPriceFeedAbi = (await import("vantage/abis/MockPriceFeed.json")).default;
        const localhostDeploy = (await import("vantage/deployments/frontend-localhost.json")).default;
        const feedAddr = (localhostDeploy.addresses as { MockPriceFeed?: string }).MockPriceFeed ?? "";
        if (!feedAddr) return;
        const feed = new Contract(feedAddr, MockPriceFeedAbi, signer);
        const tx = await (
          feed as ethers.Contract & {
            setPrice: (token: string, price: bigint) => Promise<{ wait: () => Promise<unknown> }>;
          }
        ).setPrice(cfg.tokenAddress, newPrice);
        await tx.wait();
        helperToast.success(t`Price updated`);
      } catch (err: unknown) {
        helperToast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [signer, cfg.tokenAddress]
  );

  // ---------------------------------------------------------------------------
  // Debug: Mint tokens to user (testnet only)
  // ---------------------------------------------------------------------------

  const debugMint = useCallback(
    async (amount: bigint): Promise<void> => {
      if (!signer || !account) return;
      try {
        const MockERC20Abi = (await import("vantage/abis/MockERC20.json")).default;
        const token = new Contract(cfg.tokenAddress, MockERC20Abi, signer);
        const tx = await (
          token as ethers.Contract & { mint: (to: string, amount: bigint) => Promise<{ wait: () => Promise<unknown> }> }
        ).mint(account, amount);
        await tx.wait();
        helperToast.success(t`Minted tokens to your wallet`);
      } catch (err: unknown) {
        helperToast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [signer, account, cfg.tokenAddress]
  );

  return {
    deposit,
    withdraw,
    approve,
    debugRebase,
    debugSetPrice,
    debugMint,
    isApprovalNeeded,
    isApproving,
    isReady: Boolean(account && signer),
  };
}
