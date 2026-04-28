/**
 * WaterfallAdlRisk.tsx
 *
 * Issue #216 — Waterfall Payout: ADL risk indicator for traders.
 *
 * Shows whether the Vault's payout capacity (Junior AUM) can cover
 * all unrealised profits (netUPnL / totalGlobalOI proxy).
 *
 * When isCritical == true, profitable positions are candidates for
 * Auto-Deleveraging (ADL) — the adlKeeper will force-close the most
 * profitable positions first to restore solvency.
 *
 * Target audience: traders with open long positions.
 */

import { t } from "@lingui/macro";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtUsd(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WaterfallAdlRiskProps {
  payoutCapacity: number | null;
  netUPnL: number | null;
  isCritical: boolean;
}

export function WaterfallAdlRisk({ payoutCapacity, netUPnL, isCritical }: WaterfallAdlRiskProps) {
  const healthPct =
    payoutCapacity !== null && netUPnL !== null && netUPnL > 0 ? (payoutCapacity / netUPnL) * 100 : null;

  return (
    <div className="rounded-4 border-b border-b-vantage-border bg-vantage-base p-20">
      <div className="mb-14 flex items-center justify-between">
        <h2 className="text-15 font-semibold text-white">{t`ADL Risk`}</h2>

        {/* Risk badge */}
        {isCritical ? (
          <span className="rounded-full border border-red-700 bg-red-900/60 px-12 py-4 text-13 font-semibold text-red-400">
            {t`High Risk`}
          </span>
        ) : (
          <span className="rounded-full border border-green-700 bg-green-900/60 px-12 py-4 text-13 font-semibold text-green-400">
            {t`Low Risk`}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="mb-14 grid grid-cols-2 gap-12">
        <div className="rounded-4 bg-slate-900/60 px-14 py-12">
          <p className="text-11 text-slate-500">{t`Payout Capacity`}</p>
          <p className="mt-4 text-14 font-medium text-white">{fmtUsd(payoutCapacity)}</p>
          <p className="mt-2 text-11 text-slate-600">{t`Junior AUM`}</p>
        </div>
        <div className="rounded-4 bg-slate-900/60 px-14 py-12">
          <p className="text-11 text-slate-500">{t`Outstanding Risk`}</p>
          <p className="mt-4 text-14 font-medium text-white">{fmtUsd(netUPnL)}</p>
          <p className="mt-2 text-11 text-slate-600">{t`Total OI (proxy)`}</p>
        </div>
      </div>

      {/* Coverage ratio */}
      {healthPct !== null && (
        <div className="mb-14 flex items-center justify-between rounded-4 bg-slate-900/40 px-14 py-10">
          <span className="text-12 text-slate-400">{t`Coverage ratio`}</span>
          <span
            className={`text-13 font-medium ${
              healthPct >= 90 ? "text-green-400" : healthPct >= 50 ? "text-yellow-400" : "text-red-400"
            }`}
          >
            {healthPct.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Explanation */}
      {isCritical ? (
        <div className="bg-red-950/40 border-red-800/40 rounded-4 border px-14 py-12">
          <p className="mb-6 text-12 font-medium text-red-400">{t`ADL may be active`}</p>
          <p className="text-red-300/80 text-12">
            {t`The Vault's payout capacity (Junior AUM) is below the total unrealised profit in the market. Profitable positions — prioritised by leverage × profit — may be force-closed by the ADL keeper to restore solvency.`}
          </p>
        </div>
      ) : (
        <p className="text-12 text-slate-500">
          {t`Payout capacity covers outstanding risk. Your profitable position is not at risk of ADL at this time.`}
        </p>
      )}
    </div>
  );
}
