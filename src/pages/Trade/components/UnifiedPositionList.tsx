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
    <div className="overflow-hidden rounded-4 border border-vantage-border bg-vantage-base">
      {/* Header */}
      <div className={`border-b border-b-vantage-border px-16 py-10 ${GRID}`}>
        <div className="text-12 font-medium text-slate-400">{t`Market`}</div>
        <div className="text-right text-12 font-medium text-slate-400">{t`Side`}</div>
        <div className="text-right text-12 font-medium text-slate-400">{t`Size`}</div>
        <div className="text-right text-12 font-medium text-slate-400">{t`Liq. Price`}</div>
        <div className="text-right text-12 font-medium text-slate-400">{t`Health`}</div>
        <div className="text-right text-12 font-medium text-slate-400">{t`PnL`}</div>
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
    <div className={`border-b border-b-vantage-border px-16 py-14 last:border-0 ${GRID}`}>
      {/* Market */}
      <div className="flex flex-col gap-4">
        <span className="text-13 font-semibold text-white">{shortenAddr(req.indexToken)}</span>
        <PendingBadge confirming={confirming} />
      </div>

      {/* Side */}
      <div className="flex justify-end">
        <span
          className={`rounded-full px-8 py-2 text-12 font-semibold ${
            req.isLong ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"
          }`}
        >
          {req.isLong ? t`Long` : t`Short`}
        </span>
      </div>

      {/* Size */}
      <div className="text-right text-13 font-semibold text-white">{formatVantageUsd(req.sizeDelta)}</div>

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
            className="rounded-4 border border-vantage-border px-12 py-6 text-12 text-vantage-text-secondary transition-colors hover:border-slate-500 hover:text-white"
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
      className={`border-b border-b-vantage-border px-16 py-14 transition-colors last:border-0 ${GRID} ${
        isSelected ? "bg-[rgba(236,255,62,0.04)]" : "hover:bg-slate-800/30"
      }`}
    >
      {/* Market */}
      <div className="flex flex-col gap-2">
        <span className="text-13 font-semibold text-white">{shortenAddr(pos.indexToken)}</span>
        <span className="text-11 text-slate-500">{leverageLabel(pos.size, pos.collateral)}</span>
      </div>

      {/* Side */}
      <div className="flex justify-end">
        <span
          className={`rounded-full px-8 py-2 text-12 font-semibold ${
            pos.isLong ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"
          }`}
        >
          {pos.isLong ? t`Long` : t`Short`}
        </span>
      </div>

      {/* Size */}
      <div className="text-right text-13 font-semibold text-white">{formatVantageUsd(pos.size)}</div>

      {/* Liq. Price */}
      <div className="text-right text-13 text-slate-400">{liqPriceDisplay}</div>

      {/* Health */}
      <div className="text-right">
        {health ? (
          <span className={`text-13 font-semibold ${health.colorClass} ${health.blink ? "animate-pulse" : ""}`}>
            {health.label}
          </span>
        ) : (
          <span className="text-13 text-slate-500">—</span>
        )}
      </div>

      {/* PnL */}
      <div className={`text-right text-13 font-semibold ${pnlColor}`}>
        {pnlSign}
        {formatVantageUsd(pos.pendingPnl < 0n ? -pos.pendingPnl : pos.pendingPnl)}
      </div>

      {/* Action */}
      <div className="pl-12">
        {isSelected ? (
          <button
            onClick={() => onSelect(null)}
            className="rounded-4 border border-vantage-border px-12 py-6 text-12 text-vantage-text-secondary transition-colors hover:border-slate-500 hover:text-white"
          >
            {t`Back`}
          </button>
        ) : (
          <button
            onClick={() => onSelect(pos.key)}
            className="border-red-800/50 rounded-4 border px-12 py-6 text-12 text-red-400 transition-colors hover:bg-red-900/20"
          >
            {t`Close`}
          </button>
        )}
      </div>
    </div>
  );
}
