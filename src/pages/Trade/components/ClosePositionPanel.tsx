/**
 * ClosePositionPanel.tsx
 *
 * Form for partially or fully closing a selected open position.
 * Submitted via PositionRouter.createDecreasePosition.
 */

import { t } from "@lingui/macro";
import { formatEther } from "ethers";
import { useState } from "react";

import type { VantagePosition } from "domain/vantage/positions/types";
import { formatVantageUsd } from "domain/vantage/positions/utils";
import type { UsePositionRequestsResult } from "domain/vantage/trade/usePositionRequests";
import type { PositionRouterTradeResult } from "domain/vantage/trade/usePositionRouterTrade";
import { DEFAULT_SLIPPAGE_BPS } from "domain/vantage/trade/usePositionRouterTrade";
import type { SpreadData } from "domain/vantage/trade/useSpread";
import { calcAcceptablePrice } from "domain/vantage/trade/utils";

import { SpreadBadge } from "./SpreadBadge";

type Props = {
  position: VantagePosition;
  spread: SpreadData;
  trade: PositionRouterTradeResult;
  requests: UsePositionRequestsResult;
  account: string;
  onClose?: () => void;
};

export function ClosePositionPanel({ position, spread, trade, requests, account, onClose }: Props) {
  const [closePct, setClosePct] = useState(100); // percentage of position to close
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sizeDelta = (position.size * BigInt(closePct)) / 100n;
  const collateralDelta = (position.collateral * BigInt(closePct)) / 100n;
  const markPrice = position.isLong ? spread.bidPrice : spread.askPrice;
  const acceptablePrice = calcAcceptablePrice(markPrice, slippageBps, position.isLong, false);

  async function handleClose() {
    if (!account || sizeDelta === 0n) return;
    setIsSubmitting(true);
    try {
      const now = Date.now();
      const expiresAtMs = trade.maxTimeDelay > 0 ? now + trade.maxTimeDelay * 1000 : 0;

      const requestKey = await trade.createDecreasePosition({
        collateralToken: position.collateralToken,
        indexToken: position.indexToken,
        collateralDelta,
        sizeDelta,
        isLong: position.isLong,
        receiver: account,
        markPrice,
        slippageBps,
      });

      if (requestKey) {
        requests.addRequest({
          requestKey,
          type: "decrease",
          createdAtMs: now,
          expiresAtMs,
          indexToken: position.indexToken,
          isLong: position.isLong,
          sizeDelta,
        });
        onClose?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const feeEth = parseFloat(formatEther(trade.minExecutionFee)).toFixed(5);

  return (
    <div className="flex flex-col gap-12">
      <SpreadBadge spread={spread} />

      {/* Position summary */}
      <div className="rounded-4 border border-vantage-border bg-vantage-base px-16 py-12 text-12">
        <div className="mb-8 font-semibold text-white">{position.isLong ? t`Long` : t`Short`}</div>
        <div className="flex justify-between text-slate-400">
          <span>{t`Size`}</span>
          <span className="text-white">{formatVantageUsd(position.size)}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>{t`Collateral`}</span>
          <span className="text-white">{formatVantageUsd(position.collateral)}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>{t`Avg Entry`}</span>
          <span className="text-white">${parseFloat(formatEther(position.averagePrice)).toFixed(4)}</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>{t`Unrealized PnL`}</span>
          <span className={position.pendingPnl >= 0n ? "text-green-400" : "text-red-400"}>
            {position.pendingPnl >= 0n ? "+" : ""}
            {formatVantageUsd(position.pendingPnl < 0n ? -position.pendingPnl : position.pendingPnl)}
          </span>
        </div>
      </div>

      {/* Close % slider */}
      <div>
        <div className="mb-6 flex items-center justify-between text-12">
          <span className="text-slate-400">{t`Close`}</span>
          <span className="font-semibold text-white">{closePct}%</span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={closePct}
          onChange={(e) => setClosePct(Number(e.target.value))}
          className="w-full accent-[#ecff3e]"
        />
        <div className="mt-2 flex justify-between text-11 text-slate-500">
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              onClick={() => setClosePct(p)}
              className={`px-6 py-2 text-11 transition-colors ${closePct === p ? "text-vantage-accent" : "text-vantage-text-secondary"}`}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      {/* Size to close */}
      <div className="flex items-center justify-between text-12">
        <span className="text-slate-400">{t`Closing Size`}</span>
        <span className="text-white">{formatVantageUsd(sizeDelta)}</span>
      </div>

      {/* Slippage */}
      <div className="flex items-center gap-8 text-12">
        <span className="text-slate-400">{t`Slippage`}</span>
        {[10, 30, 50].map((bps) => (
          <button
            key={bps}
            onClick={() => setSlippageBps(bps)}
            className={`rounded-4 px-10 py-4 transition-colors ${slippageBps === bps ? "bg-vantage-accent text-black" : "bg-vantage-input text-vantage-text-secondary"}`}
          >
            {bps / 100}%
          </button>
        ))}
      </div>

      {/* Accept price */}
      {acceptablePrice > 0n && (
        <div className="flex items-center justify-between text-12">
          <span className="text-slate-400">{t`Acceptable Price`}</span>
          <span className="text-slate-300">${parseFloat(formatEther(acceptablePrice)).toFixed(4)}</span>
        </div>
      )}

      {/* Execution fee */}
      <div className="flex items-center justify-between text-12">
        <span className="text-slate-400">{t`Execution Fee`}</span>
        <span className="text-slate-300">{feeEth} ETH</span>
      </div>

      {/* Submit */}
      <button
        onClick={handleClose}
        disabled={isSubmitting || sizeDelta === 0n}
        className={`w-full rounded-4 py-14 text-15 font-semibold transition-colors disabled:cursor-not-allowed ${isSubmitting || sizeDelta === 0n ? "bg-[#334155] text-[#94a3b8]" : "bg-vantage-accent text-black"}`}
      >
        {isSubmitting ? t`Submitting…` : closePct === 100 ? t`Close Position` : t`Reduce Position (${closePct}%)`}
      </button>

      <button
        onClick={onClose}
        className="w-full rounded-4 border border-vantage-border py-14 text-15 font-medium text-vantage-text-secondary transition-colors hover:text-white"
      >
        {t`Cancel`}
      </button>
    </div>
  );
}
