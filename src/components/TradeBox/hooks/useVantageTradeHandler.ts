/**
 * useVantageTradeHandler.ts
 *
 * "Bypass surgery" hook — maps TradeBox's existing GMX state to the Vantage
 * trade hooks and returns a single `handleVantageTrade` function that replaces
 * the GMX `wrappedOnSubmit` for position increase/decrease flows.
 *
 * Key precision conversion: GMX uses USD × 1e30, Vantage uses USD × 1e18.
 * All conversions happen inside this hook so callers deal only in GMX units.
 *
 * Feature flag: set VANTAGE_TRADE_ENABLED = false to instantly revert to
 * the legacy GMX submit path without touching any other code.
 */

import { useCallback } from "react";

import { useVantageApproval } from "domain/vantage/trade/useVantageApproval";
import { useVantageTrade } from "domain/vantage/trade/useVantageTrade";
import { validateDecreasePosition, validateIncreasePosition } from "domain/vantage/trade/utils";
import { helperToast } from "lib/helperToast";

/** Toggle to instantly switch the trade button between Vantage and GMX flows. */
export const VANTAGE_TRADE_ENABLED = true;

const PRECISION_DIVISOR = 10n ** 12n; // GMX 1e30 → Vantage 1e18

type Params = {
  chainId: number;
  account: string | undefined;
  tradeFlags: {
    isLong: boolean;
    isIncrease: boolean;
    isSwap: boolean;
  };
  /** "From" token (collateral for increase) */
  fromToken: { address: string; decimals: number } | undefined;
  /** "To" / index token (e.g. WETH for ETH/USD market) */
  toToken: { address: string } | undefined;
  /** Mark price from GMX oracle — USD × 1e30 */
  markPrice: bigint | undefined;
  /** GMX increase amounts — all USD fields in 1e30 */
  increaseAmounts:
    | {
        /** Collateral in token's own decimals (e.g. 1e6 for USDC) */
        initialCollateralAmount: bigint;
        /** Position size delta — USD × 1e30 */
        sizeDeltaUsd: bigint;
      }
    | undefined;
  /** GMX decrease amounts — all USD fields in 1e30 */
  decreaseAmounts:
    | {
        /** Size to close — USD × 1e30 */
        sizeDeltaUsd: bigint;
        /** Collateral to withdraw — USD × 1e30 */
        collateralDeltaUsd: bigint;
      }
    | undefined;
  /** Currently selected open position */
  selectedPosition:
    | {
        collateralTokenAddress: string;
        /** Current size — USD × 1e30 */
        sizeInUsd: bigint;
      }
    | undefined;
};

export function useVantageTradeHandler({
  chainId,
  account,
  tradeFlags,
  fromToken,
  toToken,
  markPrice,
  increaseAmounts,
  decreaseAmounts,
  selectedPosition,
}: Params) {
  const { increasePosition, decreasePosition } = useVantageTrade(chainId);
  const vantageApproval = useVantageApproval(chainId, fromToken?.address);

  const handleVantageTrade = useCallback(async (): Promise<void> => {
    if (!account || !fromToken || !toToken || markPrice === undefined) return;

    // Convert GMX 1e30 → Vantage 1e18
    const vantagePriceMark = markPrice / PRECISION_DIVISOR;

    // ── INCREASE (open / add to position) ─────────────────────────────────
    if (tradeFlags.isIncrease && increaseAmounts) {
      const amountIn = increaseAmounts.initialCollateralAmount; // already token decimals
      const sizeDelta = increaseAmounts.sizeDeltaUsd / PRECISION_DIVISOR;

      const validation = validateIncreasePosition(sizeDelta, amountIn, amountIn, 0n);
      if (!validation.valid) {
        helperToast.error(validation.error!);
        return;
      }

      // Approval check — if approval needed, trigger it and return;
      // the user will re-click the button after MetaMask confirms.
      if (vantageApproval.isApprovalNeeded(amountIn)) {
        await vantageApproval.approve();
        return;
      }

      await increasePosition({
        collateralToken: fromToken.address,
        indexToken: toToken.address,
        amountIn,
        sizeDelta,
        isLong: tradeFlags.isLong,
        markPrice: vantagePriceMark,
        // isIncrease defaults to true → correct upper/lower bound in calcAcceptablePrice
      });
      return;
    }

    // ── DECREASE (close / reduce position) ────────────────────────────────
    if (!tradeFlags.isIncrease && decreaseAmounts && selectedPosition) {
      const sizeDelta = decreaseAmounts.sizeDeltaUsd / PRECISION_DIVISOR;
      const collateralDelta = decreaseAmounts.collateralDeltaUsd / PRECISION_DIVISOR;
      const currentSize = selectedPosition.sizeInUsd / PRECISION_DIVISOR;

      const validation = validateDecreasePosition(sizeDelta, currentSize);
      if (!validation.valid) {
        helperToast.error(validation.error!);
        return;
      }

      await decreasePosition({
        collateralToken: selectedPosition.collateralTokenAddress,
        indexToken: toToken.address,
        collateralDelta,
        sizeDelta,
        isLong: tradeFlags.isLong,
        receiver: account,
        markPrice: vantagePriceMark,
        // isIncrease=false → calcAcceptablePrice inverts the bound for close
      });
    }
  }, [
    account,
    fromToken,
    toToken,
    markPrice,
    tradeFlags,
    increaseAmounts,
    decreaseAmounts,
    selectedPosition,
    increasePosition,
    decreasePosition,
    vantageApproval,
  ]);

  return {
    handleVantageTrade,
    /** true while an approval tx is in-flight or allowance data is loading */
    isApprovalPending: vantageApproval.isLoading,
  };
}
