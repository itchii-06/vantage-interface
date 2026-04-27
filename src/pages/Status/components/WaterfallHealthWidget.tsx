/**
 * WaterfallHealthWidget.tsx
 *
 * Issue #216 — Waterfall Payout solvency panel.
 *
 * Displays the three key metrics from Vault.getLiquidityStatus():
 *   totalBalance   → Total Liquidity (USDC) — all physical USDC in the Vault.
 *   juniorAUM      → Payout Capacity (USD)  — logical ceiling for trader profit payouts.
 *   netUPnL        → Outstanding Risk (OI)  — conservative max payout obligation.
 *
 * Health Factor = (Payout Capacity / Outstanding Risk) × 100 %.
 * Thresholds:
 *   ≥ 90%  🟢 Healthy
 *   50–90% 🟡 Warning
 *   < 50% or isCritical  🔴 Critical
 *
 * Target audience: Junior LP (PAYOUT tranche) — transparency into payout risk.
 */

import { t } from "@lingui/macro";
import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtUsd(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

type HealthLevel = "healthy" | "warning" | "critical";

function healthLevel(pct: number | null, isCritical: boolean): HealthLevel {
  if (isCritical || (pct !== null && pct < 50)) return "critical";
  if (pct !== null && pct < 90) return "warning";
  return "healthy";
}

const HEALTH_CONFIG: Record<HealthLevel, { label: string; labelClass: string; barColor: string; bgClass: string }> = {
  healthy: {
    label: "Healthy",
    labelClass: "text-green-400",
    barColor: "bg-green-500",
    bgClass: "bg-green-900/20 border-green-800/40",
  },
  warning: {
    label: "Warning",
    labelClass: "text-yellow-400",
    barColor: "bg-yellow-500",
    bgClass: "bg-yellow-900/20 border-yellow-800/40",
  },
  critical: {
    label: "Critical",
    labelClass: "text-red-400",
    barColor: "bg-red-500",
    bgClass: "bg-red-900/20 border-red-800/40",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WaterfallHealthWidgetProps {
  totalBalance: number | null;
  payoutCapacity: number | null;
  netUPnL: number | null;
  isCritical: boolean;
}

export function WaterfallHealthWidget({
  totalBalance,
  payoutCapacity,
  netUPnL,
  isCritical,
}: WaterfallHealthWidgetProps) {
  const healthPct = useMemo(() => {
    if (payoutCapacity === null || netUPnL === null || netUPnL === 0) return null;
    return (payoutCapacity / netUPnL) * 100;
  }, [payoutCapacity, netUPnL]);

  const level = healthLevel(healthPct, isCritical);
  const cfg = HEALTH_CONFIG[level];

  const barFill = Math.min(100, Math.max(0, healthPct ?? 0));
  const barStyle = useMemo(() => ({ width: `${barFill}%` }), [barFill]);

  // Layer 2 refill alert: physical balance is less than payout capacity
  // (Vault needs a RevenueStore refill even if Junior AUM is logically sufficient).
  const needsRefill = totalBalance !== null && payoutCapacity !== null && totalBalance < payoutCapacity;

  return (
    <div className="rounded-4 border-b border-b-vantage-border bg-vantage-base p-20">
      <div className="mb-16 flex items-center justify-between">
        <h2 className="text-15 font-semibold text-white">{t`Waterfall Payout Health`}</h2>
        <span className="text-12 text-slate-500">{t`Junior LP view`}</span>
      </div>

      {/* Health Factor */}
      <div className={`mb-20 rounded-4 border p-16 ${cfg.bgClass}`}>
        <div className="mb-10 flex items-center justify-between">
          <span className="text-slate-300 text-13">{t`Health Factor (Payout Capacity / Outstanding Risk)`}</span>
          <span className={`text-15 font-bold ${cfg.labelClass}`}>
            {healthPct !== null ? healthPct.toFixed(1) + "%" : "—"}
          </span>
        </div>
        <div className="h-8 w-full overflow-hidden rounded-full bg-slate-800">
          <div className={`h-full rounded-full transition-all duration-500 ${cfg.barColor}`} style={barStyle} />
        </div>
        <div className="mt-8 flex items-center gap-8">
          <span
            className={`rounded-full px-10 py-3 text-12 font-medium ${
              level === "healthy"
                ? "border border-green-700 bg-green-900/60 text-green-400"
                : level === "warning"
                  ? "text-yellow-400 border-yellow-700 border bg-yellow-900/60"
                  : "border border-red-700 bg-red-900/60 text-red-400"
            }`}
          >
            {cfg.label}
          </span>
          {level === "critical" && (
            <span className="text-12 text-red-400">{t`ADL or RevenueStore refill may be triggered.`}</span>
          )}
          {level === "warning" && (
            <span className="text-yellow-400 text-12">
              {t`OI growing relative to payout capacity. Monitor closely.`}
            </span>
          )}
        </div>
      </div>

      {/* Metric rows */}
      <div className="space-y-12">
        <div className="flex items-center justify-between text-13">
          <div>
            <span className="text-slate-300">{t`Payout Capacity`}</span>
            <p className="mt-1 text-12 text-slate-500">{t`Junior AUM — logical payout ceiling`}</p>
          </div>
          <span className="font-medium text-white">{fmtUsd(payoutCapacity)}</span>
        </div>

        <div className="border-t border-stroke-primary" />

        <div className="flex items-center justify-between text-13">
          <div>
            <span className="text-slate-300">{t`Outstanding Risk (OI)`}</span>
            <p className="mt-1 text-12 text-slate-500">{t`Max potential payout if all positions close in profit`}</p>
          </div>
          <span className="font-medium text-white">{fmtUsd(netUPnL)}</span>
        </div>

        <div className="border-t border-stroke-primary" />

        <div className="flex items-center justify-between text-13">
          <div>
            <span className="text-slate-300">{t`Total Liquidity (USDC)`}</span>
            <p className="mt-1 text-12 text-slate-500">{t`Physical USDC in Vault (Senior + Junior combined)`}</p>
          </div>
          <span className="font-medium text-white">{fmtUsd(totalBalance)}</span>
        </div>
      </div>

      {/* Layer 2 refill alert */}
      {needsRefill && (
        <div className="bg-orange-950/40 border-orange-800/40 mt-16 flex items-start gap-10 rounded-4 border px-14 py-12">
          <span className="text-orange-400 mt-1 text-14">⚠</span>
          <p className="text-orange-300 text-12">
            {t`Physical USDC balance is below Payout Capacity. Layer 2: awaiting RevenueStore emergency refill by the protocol team.`}
          </p>
        </div>
      )}
    </div>
  );
}
