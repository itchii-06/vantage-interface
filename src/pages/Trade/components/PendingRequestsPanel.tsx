/**
 * PendingRequestsPanel.tsx
 *
 * Shows pending PositionRouter requests and their execution status.
 */

import { t } from "@lingui/macro";

import { formatVantageUsd } from "domain/vantage/positions/utils";
import type { PositionRequest, UsePositionRequestsResult } from "domain/vantage/trade/usePositionRequests";

function shortenKey(key: string) {
  return `${key.slice(0, 8)}…${key.slice(-6)}`;
}

function StatusBadge({ status }: { status: PositionRequest["status"] }) {
  const map: Record<PositionRequest["status"], { label: string; cls: string }> = {
    pending: { label: t`Pending`, cls: "bg-yellow-900/40 text-yellow-300" },
    executed: { label: t`Executed`, cls: "bg-green-900/40 text-green-300" },
    cancelled: { label: t`Cancelled`, cls: "bg-slate-700 text-slate-400" },
    expired: { label: t`Expired`, cls: "bg-red-900/40 text-red-300" },
  };
  const { label, cls } = map[status];
  return <span className={`rounded-full px-8 py-2 text-11 font-medium ${cls}`}>{label}</span>;
}

type Props = {
  requests: UsePositionRequestsResult;
  onCancel: (requestKey: string, type: "increase" | "decrease") => void;
};

export function PendingRequestsPanel({ requests, onCancel }: Props) {
  const { requests: list, clearCompleted } = requests;

  if (list.length === 0) {
    return <div className="py-20 text-center text-13 text-slate-400">{t`No pending requests`}</div>;
  }

  const hasCompleted = list.some((r) => r.status !== "pending");

  return (
    <div className="flex flex-col gap-0 overflow-hidden rounded-4 border border-stroke-primary">
      {/* Header */}
      <div className="bg-cold-blue-950 flex items-center justify-between border-b border-stroke-primary px-16 py-10">
        <span className="text-slate-300 text-12 font-semibold">{t`Pending Requests`}</span>
        {hasCompleted && (
          <button onClick={clearCompleted} className="hover:text-slate-300 text-11 text-slate-500">
            {t`Clear completed`}
          </button>
        )}
      </div>

      {list.map((req) => (
        <div
          key={req.requestKey}
          className="flex items-center justify-between border-b border-stroke-primary px-16 py-12 last:border-0"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-8">
              <span className={`text-12 font-medium ${req.isLong ? "text-green-400" : "text-red-400"}`}>
                {req.type === "increase"
                  ? req.isLong
                    ? t`Open Long`
                    : t`Open Short`
                  : req.isLong
                    ? t`Close Long`
                    : t`Close Short`}
              </span>
              <StatusBadge status={req.status} />
            </div>
            <div className="text-11 text-slate-500">
              {formatVantageUsd(req.sizeDelta)} · {shortenKey(req.requestKey)}
            </div>
            {req.status === "pending" && req.expiresAtMs > 0 && (
              <div className="text-11 text-slate-600">
                {t`Expires`} {new Date(req.expiresAtMs).toLocaleTimeString()}
              </div>
            )}
          </div>

          {(req.status === "pending" || req.status === "expired") && (
            <button
              onClick={() => onCancel(req.requestKey, req.type)}
              className="rounded-4 px-10 py-5 text-12 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            >
              {t`Cancel`}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
