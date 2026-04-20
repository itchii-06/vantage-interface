/**
 * BufferGauges.tsx
 *
 * Dual gauge panel showing:
 *   - Reserve Fund: USD held in Vault.reserveFund (Phase 2-4 source).
 *   - Junior Buffer: juniorDeficitAbsorbed vs juniorAumUsd total (Phase 2-5).
 *
 * The Junior Buffer gauge shows "absorbed / total AUM" so the bar fills
 * as the junior tranche takes on more FR deficit.
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

interface GaugeBarProps {
  /** Fill fraction 0–1. */
  fill: number;
  /** Tailwind color class for the filled portion. */
  color: string;
}

function GaugeBar({ fill, color }: GaugeBarProps) {
  const pct = Math.min(100, Math.max(0, fill * 100));
  const barStyle = useMemo(() => ({ width: `${pct}%` }), [pct]);
  return (
    <div className="h-8 w-full overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={barStyle} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BufferGaugesProps {
  reserveFundUsd: number | null;
  lpBoostPoolUsd: number | null;
  juniorDeficitAbsorbed: number | null;
  juniorAumUsd: number | null;
}

export function BufferGauges({
  reserveFundUsd,
  lpBoostPoolUsd,
  juniorDeficitAbsorbed,
  juniorAumUsd,
}: BufferGaugesProps) {
  // Reserve Fund — show how much is available vs redirected to LP boost.
  // Total reserve = reserveFundUsd (remaining) + lpBoostPoolUsd (redirected).
  const totalReserve = reserveFundUsd !== null && lpBoostPoolUsd !== null ? reserveFundUsd + lpBoostPoolUsd : null;
  const reserveAvailFill = totalReserve && totalReserve > 0 ? (reserveFundUsd ?? 0) / totalReserve : 0;

  // Junior Buffer — absorbed / total AUM.
  const juniorAbsorbedFill = juniorAumUsd && juniorAumUsd > 0 ? (juniorDeficitAbsorbed ?? 0) / juniorAumUsd : 0;
  const juniorRemainingUsd = juniorAumUsd !== null ? Math.max(0, juniorAumUsd - (juniorDeficitAbsorbed ?? 0)) : null;

  return (
    <div className="rounded-4 border-b border-b-vantage-border bg-vantage-base p-20">
      <h2 className="mb-16 text-15 font-semibold text-white">{t`Internal Buffers`}</h2>

      <div className="space-y-20">
        {/* Reserve Fund */}
        <div>
          <div className="mb-8 flex items-center justify-between">
            <div>
              <span className="text-slate-300 text-13 font-medium">{t`Reserve Fund`}</span>
              <span className="ml-8 text-12 text-slate-500">{t`Phase 2-4`}</span>
            </div>
            <span className="text-13 text-white">{fmtUsd(reserveFundUsd)}</span>
          </div>
          <GaugeBar fill={reserveAvailFill} color="bg-blue-500" />
          <div className="mt-6 flex items-center justify-between text-12 text-slate-500">
            <span>
              {t`Available`}: {fmtUsd(reserveFundUsd)}
            </span>
            {lpBoostPoolUsd !== null && lpBoostPoolUsd > 0 && (
              <span className="text-blue-400">
                {t`LP Boost`}: {fmtUsd(lpBoostPoolUsd)}
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-stroke-primary" />

        {/* Junior Tranche Buffer */}
        <div>
          <div className="mb-8 flex items-center justify-between">
            <div>
              <span className="text-slate-300 text-13 font-medium">{t`Junior Buffer (PAYOUT Tranche)`}</span>
              <span className="ml-8 text-12 text-slate-500">{t`Phase 2-5`}</span>
            </div>
            <span className="text-13 text-white">{juniorAumUsd !== null ? fmtUsd(juniorAumUsd) : "—"}</span>
          </div>
          <GaugeBar fill={juniorAbsorbedFill} color="bg-orange-500" />
          <div className="mt-6 flex items-center justify-between text-12 text-slate-500">
            <span>
              {t`Absorbed`}: {fmtUsd(juniorDeficitAbsorbed)}
            </span>
            <span>
              {t`Remaining capacity`}: {fmtUsd(juniorRemainingUsd)}
            </span>
          </div>
          {juniorVaultAbsent(juniorAumUsd, juniorDeficitAbsorbed) && (
            <p className="mt-8 text-12 text-slate-600">{t`Junior TrancheVault not configured for this deployment.`}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function juniorVaultAbsent(aum: number | null, absorbed: number | null): boolean {
  return aum === null && absorbed === null;
}
