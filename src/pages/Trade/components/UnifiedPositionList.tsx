/**
 * UnifiedPositionList.tsx
 *
 * Single position table that merges pending requests and active positions.
 *
 * Row lifecycle:
 *   1. Request submitted  → "pending"    row (top): skeleton cells + Opening… badge
 *   2. Keeper executes    → "confirming" row: Confirming… badge, triggers refetch once
 *   3. Position appears   → "active"     row: live PnL / health / close button
 *   4. Confirming row auto-clears after position is detected or timeout
 */

import { t } from "@lingui/macro";
import { formatEther } from "ethers";
import { useEffect, useRef } from "react";

import type { VantagePosition } from "domain/vantage/positions/types";
import { calcHealthBps, calcLiquidationPrice, formatVantageUsd } from "domain/vantage/positions/utils";
import type { PositionRequest, UsePositionRequestsResult } from "domain/vantage/trade/usePositionRequests";

// ─── helpers ────────────────────────────────────────────────────────────────

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function leverageLabel(size: bigint, collateral: bigint): string {
  if (collateral === 0n) return "—";
  return `${(Number(size) / Number(collateral)).toFixed(1)}×`;
}

function healthInfo(healthBps: number) {
  if (healthBps > 1_500)
    return { colorClass: "text-green-400", label: `${(healthBps / 100).toFixed(0)}%`, blink: false };
  if (healthBps > 500)
    return { colorClass: "text-yellow-400", label: `${(healthBps / 100).toFixed(0)}%`, blink: false };
  return { colorClass: "text-red-400", label: `${(healthBps / 100).toFixed(0)}%`, blink: true };
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SkeletonCell() {
  return <div className="ml-auto h-12 w-48 animate-pulse rounded-2 bg-slate-700" />;
}

function PendingBadge({ confirming }: { confirming?: boolean }) {
  return (
    <span
      className={`text-10 rounded-full px-8 py-2 font-medium ${
        confirming ? "bg-blue-900/40 text-blue-300" : "bg-yellow-900/40 text-yellow-300"
      }`}
    >
      {confirming ? t`Confirming…` : t`Opening…`}
    </span>
  );
}

// ─── column layout ───────────────────────────────────────────────────────────

const GRID = "grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_auto] items-center";
const HEADER_CELL = "text-11 text-slate-400";

// ─── props ───────────────────────────────────────────────────────────────────

type Props = {
  positions: VantagePosition[];
  requests: UsePositionRequestsResult;
  isLoading: boolean;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onCancel: (requestKey: string, type: "increase" | "decrease") => void;
  onRefetch: () => void;
};

// ─── component ───────────────────────────────────────────────────────────────

export function UnifiedPositionList({
  positions,
  requests,
  isLoading,
  selectedKey,
  onSelect,
  onCancel,
  onRefetch,
}: Props) {
  const { requests: reqList, clearCompleted } = requests;

  // Only show pending and recently-executed (confirming) requests
  const visibleRequests = reqList.filter((r) => r.status === "pending" || r.status === "executed");

  // Track which executed requests have already triggered a refetch
  const refetchedKeys = useRef<Set<string>>(new Set());

  // When a request is executed: trigger refetch once, then auto-clear after delay
  useEffect(() => {
    const executed = reqList.filter((r) => r.status === "executed");
    let triggered = false;

    for (const req of executed) {
      if (!refetchedKeys.current.has(req.requestKey)) {
        refetchedKeys.current.add(req.requestKey);
        triggered = true;
      }
    }

    if (triggered) {
      onRefetch();
      // Clear confirming rows after giving the position poll time to pick up the new position
      const timer = setTimeout(() => {
        clearCompleted();
      }, 8_000);
      return () => clearTimeout(timer);
    }
  }, [reqList]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEmpty = !isLoading && positions.length === 0 && visibleRequests.length === 0;

  return (
    <div className="overflow-hidden rounded-4 border border-stroke-primary">
      {/* Header */}
      <div className={`bg-cold-blue-950 border-b border-stroke-primary px-16 py-10 ${GRID}`}>
        <div className={HEADER_CELL}>{t`Market`}</div>
        <div className={`${HEADER_CELL} text-right`}>{t`Side`}</div>
        <div className={`${HEADER_CELL} text-right`}>{t`Size`}</div>
        <div className={`${HEADER_CELL} text-right`}>{t`Liq. Price`}</div>
        <div className={`${HEADER_CELL} text-right`}>{t`Health`}</div>
        <div className={`${HEADER_CELL} text-right`}>{t`PnL`}</div>
        <div />
      </div>

      {/* Pending / Confirming rows — always at top */}
      {visibleRequests.map((req) => (
        <PendingRow key={req.requestKey} req={req} onCancel={onCancel} />
      ))}

      {/* Active position rows */}
      {positions.map((pos) => (
        <ActiveRow key={pos.key} pos={pos} isSelected={pos.key === selectedKey} onSelect={onSelect} />
      ))}

      {/* Loading state */}
      {isLoading && visibleRequests.length === 0 && (
        <div className="py-24 text-center text-13 text-slate-400">{t`Loading positions…`}</div>
      )}

      {/* Empty state */}
      {isEmpty && <div className="py-24 text-center text-13 text-slate-400">{t`No open positions`}</div>}
    </div>
  );
}

// ─── Pending row ─────────────────────────────────────────────────────────────

function PendingRow({
  req,
  onCancel,
}: {
  req: PositionRequest;
  onCancel: (key: string, type: "increase" | "decrease") => void;
}) {
  const confirming = req.status === "executed";

  return (
    <div className={`border-b border-stroke-primary px-16 py-12 text-13 last:border-0 ${GRID}`}>
      {/* Market */}
      <div className="flex flex-col gap-2">
        <span className="font-medium text-white">{shortenAddr(req.indexToken)}</span>
        <PendingBadge confirming={confirming} />
      </div>

      {/* Side */}
      <div className={`text-right font-medium ${req.isLong ? "text-green-400" : "text-red-400"}`}>
        {req.isLong ? t`Long` : t`Short`}
        <div className="text-10 font-normal text-slate-500">{req.type === "increase" ? t`Open` : t`Close`}</div>
      </div>

      {/* Size */}
      <div className="text-right text-white">{formatVantageUsd(req.sizeDelta)}</div>

      {/* Liq. Price — skeleton */}
      <div className="flex justify-end">
        <SkeletonCell />
      </div>

      {/* Health — skeleton */}
      <div className="flex justify-end">
        <SkeletonCell />
      </div>

      {/* PnL — skeleton */}
      <div className="flex justify-end">
        <SkeletonCell />
      </div>

      {/* Action */}
      <div className="pl-12">
        {req.status === "pending" ? (
          <button
            onClick={() => onCancel(req.requestKey, req.type)}
            className="rounded-4 px-10 py-4 text-12 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            {t`Cancel`}
          </button>
        ) : (
          <span className="px-10 text-12 text-slate-600">—</span>
        )}
      </div>
    </div>
  );
}

// ─── Active position row ──────────────────────────────────────────────────────

function ActiveRow({
  pos,
  isSelected,
  onSelect,
}: {
  pos: VantagePosition;
  isSelected: boolean;
  onSelect: (key: string | null) => void;
}) {
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
      className={`border-b border-stroke-primary px-16 py-12 text-13 transition-colors last:border-0 ${GRID} ${
        isSelected ? "bg-blue-900/20 ring-1 ring-inset ring-blue-600" : "hover:bg-slate-800/40"
      }`}
    >
      {/* Market */}
      <div className="font-medium text-white">{shortenAddr(pos.indexToken)}</div>

      {/* Side */}
      <div className={`text-right font-medium ${pos.isLong ? "text-green-400" : "text-red-400"}`}>
        {pos.isLong ? t`Long` : t`Short`}
        <div className="text-10 font-normal text-slate-500">{leverageLabel(pos.size, pos.collateral)}</div>
      </div>

      {/* Size */}
      <div className="text-right text-white">{formatVantageUsd(pos.size)}</div>

      {/* Liq. Price */}
      <div className="text-slate-300 text-right">{liqPriceDisplay}</div>

      {/* Health */}
      <div className="text-right">
        {health ? (
          <span className={`font-medium ${health.colorClass} ${health.blink ? "animate-pulse" : ""}`}>
            {health.label}
          </span>
        ) : (
          <span className="text-slate-500">—</span>
        )}
      </div>

      {/* PnL */}
      <div className={`text-right font-medium ${pnlColor}`}>
        {pnlSign}
        {formatVantageUsd(pos.pendingPnl < 0n ? -pos.pendingPnl : pos.pendingPnl)}
      </div>

      {/* Action */}
      <div className="pl-12">
        <button
          onClick={() => onSelect(isSelected ? null : pos.key)}
          className={`rounded-4 px-10 py-4 text-12 font-medium transition-colors ${
            isSelected ? "bg-blue-600 text-white" : "text-slate-300 bg-cold-blue-900 hover:bg-blue-700 hover:text-white"
          }`}
        >
          {isSelected ? t`閉じる` : t`詳細`}
        </button>
      </div>
    </div>
  );
}
