/**
 * useVantageApproval.ts
 *
 * Hook for managing ERC-20 token approvals required before calling
 * Router.increasePosition (the Router transfers collateral from the user's wallet).
 *
 * Reuses the existing GMX allowance / approval infrastructure:
 * - useTokensAllowanceData  — multicall-based allowance polling
 * - approveTokens           — submits approve() with optional EIP-2612 permit fallback
 *
 * Usage:
 *   const { isApprovalNeeded, approve, isLoading } = useVantageApproval(chainId, usdcAddress);
 *   if (isApprovalNeeded(amountIn)) await approve();
 */

import { useCallback, useState } from "react";
import { maxUint256 } from "viem";

import { approveTokens } from "domain/tokens/approveTokens";
import { useTokensAllowanceData } from "domain/synthetics/tokens/useTokenAllowanceData";
import useWallet from "lib/wallets/useWallet";
import type { AnyChainId } from "sdk/configs/chains";
import { getVantageContractAddress } from "vantage/contracts";

export function useVantageApproval(chainId: number, tokenAddress: string | undefined) {
  const { signer } = useWallet();
  const [isApproving, setIsApproving] = useState(false);

  const routerAddress = getVantageContractAddress(chainId, "Router");

  const { tokensAllowanceData, isLoading } = useTokensAllowanceData(chainId as AnyChainId, {
    spenderAddress: routerAddress,
    tokenAddresses: tokenAddress ? [tokenAddress] : [],
  });

  /**
   * Returns true if the Router's current allowance is below `amount`.
   * Always returns true if allowance data is not yet loaded.
   */
  const isApprovalNeeded = useCallback(
    (amount: bigint): boolean => {
      if (!tokenAddress || !tokensAllowanceData) return true;
      const allowance = tokensAllowanceData[tokenAddress];
      if (allowance === undefined) return true;
      return allowance < amount;
    },
    [tokenAddress, tokensAllowanceData]
  );

  /**
   * Submit an unlimited approve() transaction for the collateral token → Router.
   * Uses EIP-2612 permit when available (falls back to standard approve).
   */
  const approve = useCallback(async (): Promise<void> => {
    if (!tokenAddress || !signer) return;
    await approveTokens({
      setIsApproving,
      signer,
      tokenAddress,
      spender: routerAddress,
      chainId,
      permitParams: undefined,
      approveAmount: maxUint256,
    });
  }, [tokenAddress, signer, routerAddress, chainId]);

  return {
    isApprovalNeeded,
    approve,
    /** true while the approval tx is in flight or allowance data is loading */
    isLoading: isLoading || isApproving,
  };
}
