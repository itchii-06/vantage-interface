/**
 * PositionListPanel.tsx
 *
 * Shows all open positions for the connected wallet.
 * Clicking a row selects it for the ClosePositionPanel.
 */

import { t } from "@lingui/macro";

import type { VantagePosition } from "domain/vantage/positions/types";
import { formatVantageUsd } from "domain/vantage/positions/utils";

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function leverageLabel(size: bigint, collateral: bigint): string {
  if (collateral === 0n) return "—";
  return `${(Number(size) / Number(collateral)).toFixed(1)}×`;
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
      <div className="bg-cold-blue-950 grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] border-b border-stroke-primary px-16 py-10 text-11 text-slate-400">
        <div>{t`Market`}</div>
        <div className="text-right">{t`Side`}</div>
        <div className="text-right">{t`Size`}</div>
        <div className="text-right">{t`Leverage`}</div>
        <div className="text-right">{t`PnL`}</div>
      </div>

      {isLoading && <div className="py-24 text-center text-13 text-slate-400">{t`Loading positions…`}</div>}

      {!isLoading && positions.length === 0 && (
        <div className="py-24 text-center text-13 text-slate-400">{t`No open positions`}</div>
      )}

      {positions.map((pos) => {
        const isSelected = pos.key === selectedKey;
        const pnlColor = pos.pendingPnl >= 0n ? "text-green-400" : "text-red-400";
        const pnlSign = pos.pendingPnl >= 0n ? "+" : "";

        return (
          <div
            key={pos.key}
            onClick={() => onSelect(isSelected ? null : pos.key)}
            className={`grid cursor-pointer grid-cols-[1.5fr_1fr_1fr_1fr_1fr] items-center border-b border-stroke-primary px-16 py-12 text-13 transition-colors last:border-0 hover:bg-slate-800/40 ${
              isSelected ? "bg-blue-900/20 ring-1 ring-inset ring-blue-600" : ""
            }`}
          >
            <div className="font-medium text-white">{shortenAddr(pos.indexToken)}</div>
            <div className={`text-right font-medium ${pos.isLong ? "text-green-400" : "text-red-400"}`}>
              {pos.isLong ? t`Long` : t`Short`}
            </div>
            <div className="text-right text-white">{formatVantageUsd(pos.size)}</div>
            <div className="text-slate-300 text-right">{leverageLabel(pos.size, pos.collateral)}</div>
            <div className={`text-right font-medium ${pnlColor}`}>
              {pnlSign}
              {formatVantageUsd(pos.pendingPnl < 0n ? -pos.pendingPnl : pos.pendingPnl)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
