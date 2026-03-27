/**
 * useVantageLPActions.ts
 *
 * Transaction hooks for LP deposit and withdraw.
 *
 *   deposit(tokenAddress, amount)
 *     approve collateral token to LPManager (if needed) → LPManager.addLiquidity
 *
 *   withdraw(shares, tokenAddress, minOut)
 *     LPManager.removeLiquidity  (no approve needed — LPManager burns VLP)
 */

import { t } from "@lingui/macro";
import { useCallback, useState } from "react";
import { maxUint256 } from "viem";

import { approveTokens } from "domain/tokens/approveTokens";
import { useTokensAllowanceData } from "domain/synthetics/tokens/useTokenAllowanceData";
import { pushSuccessNotification } from "lib/contracts/notifications";
import { helperToast } from "lib/helperToast";
import useWallet from "lib/wallets/useWallet";
import { usePendingTxns } from "context/PendingTxnsContext/PendingTxnsContext";
import { useLPManager } from "hooks/useVantageContracts";
import { getVantageContractAddress } from "vantage/contracts";
import type { AnyChainId } from "sdk/configs/chains";

const SLIPPAGE_BPS = 50n; // 0.5%

export function useVantageLPActions(chainId: number) {
  const { account, signer } = useWallet();
  const { setPendingTxns } = usePendingTxns();
  const lpManager = useLPManager(signer ?? undefined, chainId);
  const lpManagerAddress = getVantageContractAddress(chainId, "LPManager");

  // ---------------------------------------------------------------------------
  // Approval state
  // ---------------------------------------------------------------------------

  const [approvingToken, setApprovingToken] = useState<string | undefined>();
  const [depositToken, setDepositToken] = useState<string | undefined>();

  const { tokensAllowanceData, isLoading: isAllowanceLoading } = useTokensAllowanceData(
    chainId as AnyChainId,
    {
      spenderAddress: lpManagerAddress,
      tokenAddresses: depositToken ? [depositToken] : [],
    }
  );

  /** Returns true if LPManager's allowance for `tokenAddress` is below `amount`. */
  const isApprovalNeeded = useCallback(
    (tokenAddress: string, amount: bigint): boolean => {
      if (!tokensAllowanceData) return true;
      const allowance = tokensAllowanceData[tokenAddress];
      if (allowance === undefined) return true;
      return allowance < amount;
    },
    [tokensAllowanceData]
  );

  const approve = useCallback(
    async (tokenAddress: string): Promise<void> => {
      if (!signer) return;
      await approveTokens({
        setIsApproving: (v) => setApprovingToken(v ? tokenAddress : undefined),
        signer,
        tokenAddress,
        spender: lpManagerAddress,
        chainId,
        permitParams: undefined,
        approveAmount: maxUint256,
      });
    },
    [signer, lpManagerAddress, chainId]
  );

  // ---------------------------------------------------------------------------
  // Deposit
  // ---------------------------------------------------------------------------

  const deposit = useCallback(
    async (tokenAddress: string, amount: bigint): Promise<void> => {
      if (!account || !signer) {
        helperToast.error(t`Wallet not connected`);
        return;
      }

      // Set the token so allowance data is fetched
      setDepositToken(tokenAddress);

      // Approve if needed
      if (isApprovalNeeded(tokenAddress, amount)) {
        await approve(tokenAddress);
      }

      try {
        const tx = await lpManager.addLiquidity(tokenAddress, amount);

        helperToast.info(t`Transaction submitted`);
        setPendingTxns((prev) => [
          ...prev,
          { hash: tx.hash, message: t`Adding liquidity...` },
        ]);

        const receipt = await tx.wait();
        if (receipt) {
          pushSuccessNotification(chainId, t`Liquidity added`, { transactionHash: receipt.hash });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        helperToast.error(message);
      }
    },
    [account, signer, lpManager, isApprovalNeeded, approve, chainId, setPendingTxns]
  );

  // ---------------------------------------------------------------------------
  // Withdraw
  // ---------------------------------------------------------------------------

  const withdraw = useCallback(
    async (shares: bigint, tokenAddress: string, minOut?: bigint): Promise<void> => {
      if (!account || !signer) {
        helperToast.error(t`Wallet not connected`);
        return;
      }

      // Apply default slippage if minOut not supplied
      const safeMinOut = minOut ?? (shares * (10_000n - SLIPPAGE_BPS)) / 10_000n;

      try {
        const tx = await lpManager.removeLiquidity(shares, tokenAddress, safeMinOut);

        helperToast.info(t`Transaction submitted`);
        setPendingTxns((prev) => [
          ...prev,
          { hash: tx.hash, message: t`Removing liquidity...` },
        ]);

        const receipt = await tx.wait();
        if (receipt) {
          pushSuccessNotification(chainId, t`Liquidity removed`, { transactionHash: receipt.hash });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        helperToast.error(message);
      }
    },
    [account, signer, lpManager, chainId, setPendingTxns]
  );

  return {
    deposit,
    withdraw,
    approve,
    isApprovalNeeded,
    isAllowanceLoading,
    isApproving: Boolean(approvingToken),
    isReady: Boolean(account && signer),
  };
}
