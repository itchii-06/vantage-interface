/**
 * SolvencySpeedometer.tsx
 *
 * Horizontal 8-step defense-phase indicator.
 * Supports a compact variant (single-line badge) for embedding in other pages.
 */

import type { MessageDescriptor } from "@lingui/core";
import { msg, t } from "@lingui/macro";
import { useLingui } from "@lingui/react";

import type { DefenseStep } from "domain/vantage/solvency/getDefenseStep";
import { STEP_META } from "domain/vantage/solvency/getDefenseStep";

import { FrDefenseExplainer } from "./FrDefenseExplainer";

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
  6: "bg-orange-500",
  7: "bg-orange-500",
  8: "bg-red-500",
  9: "bg-red-700",
};

const BADGE_COLORS: Record<string, string> = {
  normal: "bg-green-900/60 text-green-400 border border-green-700",
  warning: "bg-yellow-900/60 text-yellow-400 border border-yellow-700",
  danger: "bg-orange-900/60 text-orange-400 border border-orange-700",
  critical: "bg-red-900/60 text-red-400 border border-red-700",
};

const STEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const STEP_SHORT_MSG: Record<number, MessageDescriptor> = {
  0: msg`Safe`,
  1: msg`FR Offset`,
  2: msg`LP Boost`,
  3: msg`Lev Lock`,
  4: msg`Surge`,
  5: msg`Reserve`,
  6: msg`Jr Buffer`,
  7: msg`Senior Yield`,
  8: msg`Trade ADL`,
  9: msg`Hedge ADL`,
};

// Translation maps for STEP_META strings (plain strings in getDefenseStep.ts)
const STEP_LABEL_MSG: Record<DefenseStep, MessageDescriptor> = {
  0: msg`Normal`,
  1: msg`LP Boost`,
  2: msg`High-Lev Lock`,
  3: msg`Premium Surge`,
  4: msg`Reserve Fund`,
  5: msg`Junior Buffer`,
  6: msg`Trade ADL`,
  7: msg`Hedge ADL`,
  8: msg`Trade ADL`,
  9: msg`Hedge ADL`,
};

const STEP_PHASE_MSG: Record<DefenseStep, MessageDescriptor> = {
  0: msg`Phase 0 · Normal`,
  1: msg`Phase 1 · Prevention`,
  2: msg`Phase 1 · Prevention`,
  3: msg`Phase 1 · Prevention`,
  4: msg`Phase 2 · Internal Buffer`,
  5: msg`Phase 2 · Internal Buffer`,
  6: msg`Phase 3 · Enforcement`,
  7: msg`Phase 3 · Final Defense`,
  8: msg`Phase 3 · Enforcement`,
  9: msg`Phase 3 · Final Defense`,
};

// ---------------------------------------------------------------------------
// Full speedometer (for /status page)
// ---------------------------------------------------------------------------

interface SolvencySpeedometerProps {
  defenseStep: DefenseStep;
}

export function SolvencySpeedometer({ defenseStep }: SolvencySpeedometerProps) {
  const { _ } = useLingui();
  const meta = STEP_META[defenseStep];

  return (
    <div className="rounded-4 border-b border-b-vantage-border bg-vantage-base p-20">
      <div className="mb-16 flex items-center justify-between">
        <h2 className="text-15 font-semibold text-white">{t`Protocol Defense Status`}</h2>
        <span className={`rounded-full px-10 py-4 text-12 font-medium ${BADGE_COLORS[meta.severity]}`}>
          {_(STEP_LABEL_MSG[defenseStep])}
        </span>
      </div>

      {/* Step bar */}
      <div className="mb-12 flex gap-4">
        {STEPS.map((step) => {
          const isActive = step === 0 ? defenseStep === 0 : step <= defenseStep && defenseStep > 0;
          const isCurrent = step === defenseStep;
          const barColor = STEP_COLORS[defenseStep];
          return (
            <div key={step} className="flex-1">
              <div
                className={`h-6 w-full rounded-full transition-all ${
                  isActive ? barColor : "bg-slate-800"
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
              {_(STEP_SHORT_MSG[step])}
            </span>
          </div>
        ))}
      </div>

      {/* FR risk defense explainer */}
      <FrDefenseExplainer defenseStep={defenseStep} />
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
  const { _ } = useLingui();
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
      {t`Step ${defenseStep}:`} {_(STEP_LABEL_MSG[defenseStep])} — {_(STEP_PHASE_MSG[defenseStep])}
    </div>
  );
}
