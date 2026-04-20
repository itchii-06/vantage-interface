/**
 * SolvencySpeedometer.tsx
 *
 * Horizontal 7-step defense-phase indicator.
 * Supports a compact variant (single-line badge) for embedding in other pages.
 */

import { t } from "@lingui/macro";

import type { DefenseStep } from "domain/vantage/solvency/getDefenseStep";
import { STEP_META } from "domain/vantage/solvency/getDefenseStep";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STEP_COLORS: Record<DefenseStep, string> = {
  0: "bg-green-500",
  1: "bg-green-400",
  2: "bg-yellow-400",
  3: "bg-yellow-500",
  4: "bg-orange-400",
  5: "bg-orange-500",
  6: "bg-red-500",
  7: "bg-red-700",
};

const BADGE_COLORS: Record<string, string> = {
  normal: "bg-green-900/60 text-green-400 border border-green-700",
  warning: "bg-yellow-900/60 text-yellow-400 border border-yellow-700",
  danger: "bg-orange-900/60 text-orange-400 border border-orange-700",
  critical: "bg-red-900/60 text-red-400 border border-red-700",
};

const STEPS = [1, 2, 3, 4, 5, 6, 7] as const;

const STEP_SHORT: Record<number, string> = {
  1: "LP Boost",
  2: "Lev Lock",
  3: "Surge",
  4: "Reserve",
  5: "Jr Buffer",
  6: "Trade ADL",
  7: "Hedge ADL",
};

// ---------------------------------------------------------------------------
// Full speedometer (for /status page)
// ---------------------------------------------------------------------------

interface SolvencySpeedometerProps {
  defenseStep: DefenseStep;
}

export function SolvencySpeedometer({ defenseStep }: SolvencySpeedometerProps) {
  const meta = STEP_META[defenseStep];

  return (
    <div className="rounded-4 border-b border-b-vantage-border bg-vantage-base p-20">
      <div className="mb-16 flex items-center justify-between">
        <h2 className="text-15 font-semibold text-white">{t`Protocol Defense Status`}</h2>
        <span className={`rounded-full px-10 py-4 text-12 font-medium ${BADGE_COLORS[meta.severity]}`}>
          {meta.label}
        </span>
      </div>

      {/* Step bar */}
      <div className="mb-12 flex gap-4">
        {STEPS.map((step) => {
          const isActive = step <= defenseStep && defenseStep > 0;
          const isCurrent = step === defenseStep;
          return (
            <div key={step} className="flex-1">
              <div
                className={`h-6 w-full rounded-full transition-all ${
                  isActive ? STEP_COLORS[defenseStep] : "bg-slate-800"
                } ${isCurrent ? "ring-2 ring-white/30 ring-offset-1 ring-offset-slate-950" : ""}`}
              />
            </div>
          );
        })}
      </div>

      {/* Step labels */}
      <div className="mb-16 flex gap-4">
        {STEPS.map((step) => (
          <div key={step} className="flex-1 text-center">
            <span
              className={`text-10 font-medium ${
                step === defenseStep ? "text-white" : step < defenseStep ? "text-slate-500" : "text-slate-700"
              }`}
            >
              {STEP_SHORT[step]}
            </span>
          </div>
        ))}
      </div>

      {/* Current status description */}
      <div className="rounded-4 bg-slate-900/60 px-16 py-12">
        <p className="text-12 text-slate-400">
          <span className="text-slate-300 font-medium">{meta.phase}</span>
          {meta.phase !== "—" && " · "}
          {meta.description}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact badge (for Hedge list page)
// ---------------------------------------------------------------------------

interface SolvencyBadgeProps {
  defenseStep: DefenseStep;
}

export function SolvencyBadge({ defenseStep }: SolvencyBadgeProps) {
  const meta = STEP_META[defenseStep];

  if (defenseStep === 0) {
    return (
      <div className="flex items-center gap-6 text-16 text-green-400">
        <span className="h-6 w-6 rounded-full bg-green-500" />
        {t`System Status: Normal`}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-8 rounded-full px-10 py-4 text-12 font-medium ${BADGE_COLORS[meta.severity]}`}
    >
      <span className={`h-6 w-6 rounded-full ${STEP_COLORS[defenseStep]}`} />
      {t`Step ${defenseStep}:`} {meta.label} — {meta.phase}
    </div>
  );
}
