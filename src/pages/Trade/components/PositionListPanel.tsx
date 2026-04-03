/**
 * PositionListPanel.tsx
 *
 * Shows all open positions for the connected wallet.
 * Displays real-time PnL, liquidation price, and health indicator.
 * Clicking the 詳細 button selects a position for the ClosePositionPanel.
 */

import { t } from "@lingui/macro";
import { formatEther } from "ethers";

import type { VantagePosition } from "domain/vantage/positions/types";
import { calcHealthBps, calcLiquidationPrice, formatVantageUsd } from "domain/vantage/positions/utils";

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function leverageLabel(size: bigint, collateral: bigint): string {
  if (collateral === 0n) return "—";
  return `${(Number(size) / Number(collateral)).toFixed(1)}×`;
}

/** Health color class and label derived from healthBps. */
function healthInfo(healthBps: number): { colorClass: string; label: string; blink: boolean } {
  if (healthBps > 1_500)
    return { colorClass: "text-green-400", label: `${(healthBps / 100).toFixed(0)}%`, blink: false };
  if (healthBps > 500)
    return { colorClass: "text-yellow-400", label: `${(healthBps / 100).toFixed(0)}%`, blink: false };
  return { colorClass: "text-red-400", label: `${(healthBps / 100).toFixed(0)}%`, blink: true };
}

type Props = {
  positions: VantagePosition[];
  isLoading: boolean;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
};

export function PositionListPanel({ positions, isLoading, selectedKey, onSelect }: Props) {
  return (
    <div className="overflow-hidden rounded-4 border border-stroke-primary">
      {/* Header */}
      <div className="bg-cold-blue-950 grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_auto] border-b border-stroke-primary px-16 py-10 text-11 text-slate-400">
        <div>{t`Market`}</div>
        <div className="text-right">{t`Side`}</div>
        <div className="text-right">{t`Size`}</div>
        <div className="text-right">{t`Liq. Price`}</div>
        <div className="text-right">{t`Health`}</div>
        <div className="text-right">{t`PnL`}</div>
        <div />
      </div>

      {isLoading && <div className="py-24 text-center text-13 text-slate-400">{t`Loading positions…`}</div>}

      {!isLoading && positions.length === 0 && (
        <div className="py-24 text-center text-13 text-slate-400">{t`No open positions`}</div>
      )}

      {positions.map((pos) => {
        const isSelected = pos.key === selectedKey;
        const pnlColor = pos.pendingPnl >= 0n ? "text-green-400" : "text-red-400";
        const pnlSign = pos.pendingPnl >= 0n ? "+" : "";

        const liqPrice = calcLiquidationPrice(
          pos.size,
          pos.collateral,
          pos.averagePrice,
          pos.isLong,
          pos.maintenanceMarginBps
        );

        const health = pos.currentPrice > 0n ? healthInfo(calcHealthBps(pos.currentPrice, liqPrice, pos.isLong)) : null;

        const liqPriceDisplay = liqPrice > 0n ? `$${parseFloat(formatEther(liqPrice)).toFixed(2)}` : "—";

        return (
          <div
            key={pos.key}
            className={`grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_auto] items-center border-b border-stroke-primary px-16 py-12 text-13 transition-colors last:border-0 ${
              isSelected ? "bg-blue-900/20 ring-1 ring-inset ring-blue-600" : "hover:bg-slate-800/40"
            }`}
          >
            <div className="font-medium text-white">{shortenAddr(pos.indexToken)}</div>
            <div className={`text-right font-medium ${pos.isLong ? "text-green-400" : "text-red-400"}`}>
              {pos.isLong ? t`Long` : t`Short`}
              <div className="text-10 font-normal text-slate-500">{leverageLabel(pos.size, pos.collateral)}</div>
            </div>
            <div className="text-right text-white">{formatVantageUsd(pos.size)}</div>
            <div className="text-slate-300 text-right">{liqPriceDisplay}</div>
            <div className="text-right">
              {health ? (
                <span className={`font-medium ${health.colorClass} ${health.blink ? "animate-pulse" : ""}`}>
                  {health.label}
                </span>
              ) : (
                <span className="text-slate-500">—</span>
              )}
            </div>
            <div className={`text-right font-medium ${pnlColor}`}>
              {pnlSign}
              {formatVantageUsd(pos.pendingPnl < 0n ? -pos.pendingPnl : pos.pendingPnl)}
            </div>
            <div className="pl-12">
              <button
                onClick={() => onSelect(isSelected ? null : pos.key)}
                className={`rounded-4 px-10 py-4 text-12 font-medium transition-colors ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 bg-cold-blue-900 hover:bg-blue-700 hover:text-white"
                }`}
              >
                {isSelected ? t`閉じる` : t`詳細`}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
