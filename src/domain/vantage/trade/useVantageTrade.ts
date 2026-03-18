/**
 * useVantageTrade.ts
 *
 * Action hook for submitting Vantage trade transactions.
 *
 * Uses Router.increasePosition / Router.decreasePosition with slippage-protected
 * acceptablePrice. Integrates with the existing GMX pending-tx and toast notification
 * system for full transaction lifecycle feedback.
 *
 * Usage:
 *   const { increasePosition, decreasePosition, isReady } = useVantageTrade(chainId);
 *   await increasePosition({ collateralToken, indexToken, amountIn, sizeDelta, isLong, markPrice });
 */

import { t } from "@lingui/macro";
import { useCallback } from "react";

import { pushSuccessNotification } from "lib/contracts/notifications";
import { helperToast } from "lib/helperToast";
import useWallet from "lib/wallets/useWallet";
import { useRouter } from "hooks/useVantageContracts";
import { usePendingTxns } from "context/PendingTxnsContext/PendingTxnsContext";

import type { DecreasePositionParams, IncreasePositionParams } from "./types";
import { calcAcceptablePrice } from "./utils";

const DEFAULT_SLIPPAGE_BPS = 30; // 0.3%

export function useVantageTrade(chainId: number) {
  const { account, signer } = useWallet();
  const { setPendingTxns } = usePendingTxns();
  // Pass signer as runnerOverride so contract calls are signed automatically
  const router = useRouter(signer ?? undefined, chainId);

  const increasePosition = useCallback(
    async (params: IncreasePositionParams): Promise<void> => {
      if (!account || !signer) {
        helperToast.error(t`Wallet not connected`);
        return;
      }

      const slippageBps = params.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
      const acceptablePrice = calcAcceptablePrice(params.markPrice, slippageBps, params.isLong);

      try {
        // path = [collateralToken] (no token swap; Router is nonpayable — no ETH value)
        const tx = await router.increasePosition(
          [params.collateralToken],
          params.indexToken,
          params.amountIn,
          params.sizeDelta,
          params.isLong,
          acceptablePrice
        );

        helperToast.info(t`Transaction submitted`);
        setPendingTxns((prev) => [
          ...prev,
          { hash: tx.hash, message: t`Opening position...` },
        ]);

        const receipt = await tx.wait();
        if (receipt) {
          pushSuccessNotification(chainId, t`Position opened`, { transactionHash: receipt.hash });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        helperToast.error(message);
      }
    },
    [account, signer, router, chainId, setPendingTxns]
  );

  const decreasePosition = useCallback(
    async (params: DecreasePositionParams): Promise<void> => {
      if (!account || !signer) {
        helperToast.error(t`Wallet not connected`);
        return;
      }

      const slippageBps = params.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
      const acceptablePrice = calcAcceptablePrice(params.markPrice, slippageBps, params.isLong);

      try {
        const tx = await router.decreasePosition(
          params.collateralToken,
          params.indexToken,
          params.collateralDelta,
          params.sizeDelta,
          params.isLong,
          params.receiver,
          acceptablePrice
        );

        helperToast.info(t`Transaction submitted`);
        setPendingTxns((prev) => [
          ...prev,
          { hash: tx.hash, message: t`Closing position...` },
        ]);

        const receipt = await tx.wait();
        if (receipt) {
          pushSuccessNotification(chainId, t`Position closed`, { transactionHash: receipt.hash });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        helperToast.error(message);
      }
    },
    [account, signer, router, chainId, setPendingTxns]
  );

  return {
    increasePosition,
    decreasePosition,
    /** true when a wallet is connected and ready to sign transactions */
    isReady: Boolean(account && signer),
  };
}
