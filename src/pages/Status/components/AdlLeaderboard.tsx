/**
 * AdlLeaderboard.tsx
 *
 * Displays ADL priority risk indicators for the connected wallet.
 *
 * Full anonymized leaderboard requires a Subgraph (orderBy: leverage, desc).
 * This implementation shows:
 *   - User's own Trade-mode position with Profit Extraction Risk score
 *   - User's own Hedge-mode position with Hedge Protection Status
 *   - Qualitative risk badge: Low / Warning / High
 *
 * ADL priority formulas:
 *   Trade Mode (Phase 3): Score = leverage × unrealizedPnlUsd   (higher = closer to ADL)
 *   Hedge Mode (Phase 4): Priority = leverage DESC → openedAt DESC (LIFO) → Mode A first
 */

import { t } from "@lingui/macro";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TradePositionSummary {
  sizeUsd: number;
  collateralUsd: number;
  unrealizedPnlUsd: number; // positive = profit
}

export interface HedgePositionSummary {
  sizeUsd: number;
  collateralUsd: number;
  openedAtMs: number; // Date.now() equivalent
  shouldConvertOnADL: boolean; // true = Mode B (convert), false = Mode A (terminate)
}

type RiskLevel = "low" | "warning" | "high";

// ---------------------------------------------------------------------------
// ADL score helpers
// ---------------------------------------------------------------------------

function tradeLeverageX(pos: TradePositionSummary): number {
  return pos.collateralUsd > 0 ? pos.sizeUsd / pos.collateralUsd : 0;
}

function tradeAdlScore(pos: TradePositionSummary): number {
  return tradeLeverageX(pos) * Math.max(0, pos.unrealizedPnlUsd);
}

function tradeRiskLevel(pos: TradePositionSummary): RiskLevel {
  const lev = tradeLeverageX(pos);
  const pnl = pos.unrealizedPnlUsd;
  if (lev >= 5 && pnl > 0) return "high";
  if (lev >= 3 || pnl > pos.sizeUsd * 0.1) return "warning";
  return "low";
}

function hedgeLeverageX(pos: HedgePositionSummary): number {
  return pos.collateralUsd > 0 ? pos.sizeUsd / pos.collateralUsd : 0;
}

const DAYS_MS = 86_400_000;

function hedgeRiskLevel(pos: HedgePositionSummary): RiskLevel {
  const lev = hedgeLeverageX(pos);
  const ageMs = Date.now() - pos.openedAtMs;
  const ageDays = ageMs / DAYS_MS;

  // High leverage → always Warning or High
  if (lev >= 5) return "high";
  if (lev >= 3 || ageDays < 7) return "warning";
  return "low";
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const RISK_BADGE: Record<RiskLevel, string> = {
  low: "bg-green-900/60 text-green-400 border border-green-700",
  warning: "bg-yellow-900/60 text-yellow-400 border border-yellow-700",
  high: "bg-red-900/60 text-red-400 border border-red-700",
};

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Low",
  warning: "Warning",
  high: "High",
};

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtLev(lev: number): string {
  return lev.toFixed(1) + "×";
}

// ---------------------------------------------------------------------------
// Sub-panels
// ---------------------------------------------------------------------------

function TradeAdlPanel({ pos }: { pos: TradePositionSummary | null }) {
  if (!pos || pos.sizeUsd === 0) {
    return <p className="text-12 text-slate-500">{t`No active trade (long) position in this vault.`}</p>;
  }

  const lev = tradeLeverageX(pos);
  const risk = tradeRiskLevel(pos);
  const score = tradeAdlScore(pos);

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <span className="text-12 text-slate-400">{t`Profit Extraction Risk`}</span>
        <span className={`rounded-full px-10 py-3 text-11 font-medium ${RISK_BADGE[risk]}`}>{RISK_LABEL[risk]}</span>
      </div>

      <div className="grid grid-cols-3 gap-12 rounded-4 bg-slate-900/60 px-16 py-12 text-center">
        <div>
          <p className="text-10 text-slate-500">{t`Size`}</p>
          <p className="text-13 font-medium text-white">{fmtUsd(pos.sizeUsd)}</p>
        </div>
        <div>
          <p className="text-10 text-slate-500">{t`Leverage`}</p>
          <p className="text-13 font-medium text-white">{fmtLev(lev)}</p>
        </div>
        <div>
          <p className="text-10 text-slate-500">{t`Unrealized PnL`}</p>
          <p className={`text-13 font-medium ${pos.unrealizedPnlUsd >= 0 ? "text-green-400" : "text-red-400"}`}>
            {pos.unrealizedPnlUsd >= 0 ? "+" : ""}
            {fmtUsd(pos.unrealizedPnlUsd)}
          </p>
        </div>
      </div>

      <p className="text-11 text-slate-500">
        {t`ADL Score`}: {score.toFixed(0)} (Leverage × Profit).{" "}
        {risk === "high"
          ? t`Your position carries high leverage with significant profit — among the most likely ADL candidates.`
          : risk === "warning"
            ? t`Consider reducing leverage to lower your ADL priority.`
            : t`Low ADL risk. Your position has low leverage or minimal unrealized profit.`}
      </p>
    </div>
  );
}

function HedgeAdlPanel({ pos }: { pos: HedgePositionSummary | null }) {
  if (!pos || pos.sizeUsd === 0) {
    return <p className="text-12 text-slate-500">{t`No active hedge (short) position in this vault.`}</p>;
  }

  const lev = hedgeLeverageX(pos);
  const risk = hedgeRiskLevel(pos);
  const ageMs = Date.now() - pos.openedAtMs;
  const ageDays = Math.floor(ageMs / DAYS_MS);

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <span className="text-12 text-slate-400">{t`Hedge Protection Status`}</span>
        <span className={`rounded-full px-10 py-3 text-11 font-medium ${RISK_BADGE[risk]}`}>{RISK_LABEL[risk]}</span>
      </div>

      <div className="grid grid-cols-3 gap-12 rounded-4 bg-slate-900/60 px-16 py-12 text-center">
        <div>
          <p className="text-10 text-slate-500">{t`Size`}</p>
          <p className="text-13 font-medium text-white">{fmtUsd(pos.sizeUsd)}</p>
        </div>
        <div>
          <p className="text-10 text-slate-500">{t`Leverage`}</p>
          <p className="text-13 font-medium text-white">{fmtLev(lev)}</p>
        </div>
        <div>
          <p className="text-10 text-slate-500">{t`Position Age`}</p>
          <p
            className={`text-13 font-medium ${ageDays >= 30 ? "text-green-400" : ageDays >= 7 ? "text-yellow-400" : "text-red-400"}`}
          >
            {ageDays}d
          </p>
        </div>
      </div>

      {/* ADL Priority explanation */}
      <div className="space-y-6 rounded-4 bg-slate-900/60 px-16 py-12">
        <p className="text-11 font-medium text-slate-400">{t`ADL Priority Factors (Hedge Mode):`}</p>
        <div className="flex items-center justify-between text-11">
          <span className="text-slate-500">{t`1. Leverage (higher = first)`}</span>
          <span className={lev >= 5 ? "text-red-400" : lev >= 3 ? "text-yellow-400" : "text-green-400"}>
            {fmtLev(lev)}
          </span>
        </div>
        <div className="flex items-center justify-between text-11">
          <span className="text-slate-500">{t`2. Entry recency (newer = first)`}</span>
          <span className={ageDays < 7 ? "text-red-400" : ageDays < 30 ? "text-yellow-400" : "text-green-400"}>
            {ageDays >= 30 ? t`Protected (30d+)` : ageDays >= 7 ? t`${ageDays} days` : t`New (${ageDays}d)`}
          </span>
        </div>
        <div className="flex items-center justify-between text-11">
          <span className="text-slate-500">{t`3. Mode (Auto-Close first)`}</span>
          <span className={!pos.shouldConvertOnADL ? "text-orange-400" : "text-slate-400"}>
            {pos.shouldConvertOnADL ? t`Mode B (Convert)` : t`Mode A (Auto-Close) ⚠`}
          </span>
        </div>
      </div>

      {risk === "low" ? (
        <p className="text-11 text-green-600">{t`Low leverage and long tenure protect you from ADL. You are in the loyalty tier.`}</p>
      ) : risk === "warning" ? (
        <p className="text-yellow-600 text-11">{t`High leverage or recent entry increases ADL risk. Consider reducing leverage.`}</p>
      ) : (
        <p className="text-red-600 text-11">{t`High ADL risk. Reduce leverage or hold position longer to improve protection.`}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface AdlLeaderboardProps {
  tradePosition: TradePositionSummary | null;
  hedgePosition: HedgePositionSummary | null;
}

export function AdlLeaderboard({ tradePosition, hedgePosition }: AdlLeaderboardProps) {
  return (
    <div className="bg-cold-blue-950 rounded-4 border border-stroke-primary p-20">
      <div className="mb-16 flex items-center justify-between">
        <h2 className="text-15 font-semibold text-white">{t`Your ADL Risk`}</h2>
        <span className="text-11 text-slate-600">{t`Full leaderboard requires Subgraph`}</span>
      </div>

      <div className="grid grid-cols-1 gap-20 lg:grid-cols-2">
        {/* Trade Mode (Phase 3 ADL) */}
        <div>
          <div className="mb-12 flex items-center gap-8">
            <span className="bg-orange-900/40 text-10 text-orange-400 rounded-2 px-8 py-3 font-medium">
              {t`Phase 3 · Trade ADL`}
            </span>
            <span className="text-12 text-slate-500">{t`Long profit positions`}</span>
          </div>
          <TradeAdlPanel pos={tradePosition} />
        </div>

        {/* Hedge Mode (Phase 4 ADL) */}
        <div>
          <div className="mb-12 flex items-center gap-8">
            <span className="text-10 rounded-2 bg-red-900/40 px-8 py-3 font-medium text-red-400">
              {t`Phase 4 · Hedge ADL`}
            </span>
            <span className="text-12 text-slate-500">{t`Short (hedge) positions`}</span>
          </div>
          <HedgeAdlPanel pos={hedgePosition} />
        </div>
      </div>
    </div>
  );
}
