/**
 * OIStats.tsx
 *
 * OI utilization panel — shows:
 *   - OI utilization bar (totalShortUsd / maxShortCapacityUsd)
 *   - Current hedge premium rate (funding rate bps)
 *   - Hedge capacity % (shortCostBps / bufferedYieldBps)
 */

import { t } from "@lingui/macro";
import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtBps(bps: number | null): string {
  if (bps === null) return "—";
  const sign = bps >= 0 ? "+" : "";
  return sign + (bps / 100).toFixed(2) + "%";
}

function fmtPct(n: number | null, decimals = 1): string {
  if (n === null) return "—";
  return n.toFixed(decimals) + "%";
}

function utilizationColor(pct: number | null): string {
  if (pct === null) return "bg-slate-700";
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-orange-500";
  if (pct >= 50) return "bg-yellow-500";
  return "bg-green-500";
}

function capacityColor(pct: number | null): string {
  if (pct === null) return "text-slate-500";
  if (pct >= 100) return "text-red-400";
  if (pct >= 80) return "text-orange-400";
  if (pct >= 60) return "text-yellow-400";
  return "text-green-400";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OIStatsProps {
  totalShortUsd: number | null;
  maxShortCapacityUsd: number | null;
  oiUtilizationPct: number | null;
  fundingRateBps: number | null;
  yieldAprBps: number | null;
  hedgeCapacityPct: number | null;
}

export function OIStats({
  totalShortUsd,
  maxShortCapacityUsd,
  oiUtilizationPct,
  fundingRateBps,
  yieldAprBps,
  hedgeCapacityPct,
}: OIStatsProps) {
  const oiFill = Math.min(100, Math.max(0, oiUtilizationPct ?? 0));
  const capFill = Math.min(100, Math.max(0, hedgeCapacityPct ?? 0));

  function fmtUsd(n: number | null): string {
    if (n === null) return "—";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  }

  const oiBarStyle = useMemo(() => ({ width: `${oiFill}%` }), [oiFill]);
  const capBarStyle = useMemo(() => ({ width: `${capFill}%` }), [capFill]);

  return (
    <div className="bg-cold-blue-950 rounded-4 border border-stroke-primary p-20">
      <h2 className="mb-16 text-15 font-semibold text-white">{t`Hedge Inventory`}</h2>

      <div className="space-y-20">
        {/* OI Utilization */}
        <div>
          <div className="mb-8 flex items-center justify-between">
            <span className="text-13 text-slate-400">{t`OI Utilization`}</span>
            <span className="text-13 font-medium text-white">{fmtPct(oiUtilizationPct)}</span>
          </div>
          <div className="h-8 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${utilizationColor(oiUtilizationPct)}`}
              style={oiBarStyle}
            />
          </div>
          <div className="mt-6 flex justify-between text-11 text-slate-500">
            <span>
              {t`Current`}: {fmtUsd(totalShortUsd)}
            </span>
            <span>
              {t`Max`}: {fmtUsd(maxShortCapacityUsd)}
            </span>
          </div>
        </div>

        <div className="border-t border-stroke-primary" />

        {/* Funding Rate */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-13 text-slate-400">{t`Hedge FR (Shorts perspective)`}</p>
            <p className="mt-2 text-11 text-slate-600">{t`+ve = shorts receive payment`}</p>
          </div>
          <span
            className={`text-15 font-medium ${
              fundingRateBps === null ? "text-slate-500" : fundingRateBps >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {fmtBps(fundingRateBps)}
          </span>
        </div>

        <div className="border-t border-stroke-primary" />

        {/* Vault Yield */}
        <div className="flex items-center justify-between">
          <span className="text-13 text-slate-400">{t`Vault Yield APR`}</span>
          <span className="text-15 font-medium text-green-400">{fmtBps(yieldAprBps)}</span>
        </div>

        <div className="border-t border-stroke-primary" />

        {/* Hedge Capacity % */}
        <div>
          <div className="mb-8 flex items-center justify-between">
            <div>
              <span className="text-13 text-slate-400">{t`Hedge Capacity Used`}</span>
              <p className="mt-2 text-11 text-slate-600">{t`FR cost / buffered yield`}</p>
            </div>
            <span className={`text-15 font-medium ${capacityColor(hedgeCapacityPct)}`}>{fmtPct(hedgeCapacityPct)}</span>
          </div>
          <div className="h-8 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                capFill >= 100 ? "bg-red-500" : capFill >= 80 ? "bg-orange-500" : "bg-blue-500"
              }`}
              style={capBarStyle}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
