/**
 * FrDefenseExplainer.tsx
 *
 * Collapsible accordion inside Protocol Defense Status.
 * Explains the 4-phase / 7-step FR risk management sequence
 * so first-time users understand how the protocol protects them.
 */

import { t } from "@lingui/macro";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const PHASES = [
  {
    label: "Phase 0 — Normal Operation",
    color: "text-green-400",
    dot: "bg-green-500",
    border: "border-green-900/60",
    bg: "bg-green-950/20",
    steps: [
      {
        num: null as number | null,
        title: "Yield Token FR Offset",
        desc: "RWA yield continuously offsets funding rate payments, keeping hedge costs at zero for users.",
      },
    ],
  },
  {
    label: "Phase 1 — Prevention (Steps 1–3)",
    color: "text-yellow-400",
    dot: "bg-yellow-400",
    border: "border-yellow-900/60",
    bg: "bg-yellow-950/20",
    steps: [
      {
        num: 1,
        title: "Supply-Side Incentive",
        desc: "Reserve fund temporarily boosts LP rewards to attract new RWA deposits and expand pool capacity.",
      },
      {
        num: 2,
        title: "New Entry Restriction",
        desc: "High-leverage (5×+) new hedges are locked. Once the OI cap is reached, all new entries are frozen.",
      },
      {
        num: 3,
        title: "New Entry Premium Surge",
        desc: "Entry premiums rise only for incoming users. All existing hedge positions are unaffected.",
      },
    ],
  },
  {
    label: "Phase 2 — Internal Defense (Steps 4–5)",
    color: "text-orange-400",
    dot: "bg-orange-400",
    border: "border-yellow-900/60",
    bg: "bg-orange-950/20",
    steps: [
      {
        num: 4,
        title: "Reserve Fund Utilization",
        desc: "The protocol stability fund covers FR shortfalls using surplus accumulated from past profits.",
      },
      {
        num: 5,
        title: "Junior Vault Buffer",
        desc: "High-yield junior LP (USDC) principal/profits absorb the deficit, shielding senior LPs (RWA) and maintaining hedge user costs.",
      },
    ],
  },
  {
    label: "Phase 3 — Last Resort (Steps 6–7)",
    color: "text-red-400",
    dot: "bg-red-500",
    border: "border-red-900/60",
    bg: "bg-red-950/20",
    steps: [
      {
        num: 6,
        title: "ADL for Long Profits",
        desc: "Highly profitable speculative long positions are force-closed, directly reducing the outstanding FR obligation.",
      },
      {
        num: 7,
        title: "ADL for Hedge-Shorts",
        desc: "Last line of defense. Some hedge shorts are force-closed (or converted to paid-shorts) to prevent LP insolvency and protocol halt — rather than raising costs retroactively.",
      },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FrDefenseExplainer() {
  const [open, setOpen] = useState(true);

  return (
    <div className="mt-16 border-t border-vantage-border pt-14">
      {/* Toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-12 text-slate-400 transition-colors hover:text-white"
      >
        <span className="font-medium">{t`FR Risk Defense — How it works`}</span>
        <span className={`text-10 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {/* Expandable content */}
      {open && (
        <div className="mt-12 space-y-8">
          {PHASES.map((phase) => (
            <div key={phase.label} className={`rounded-4 border ${phase.border} ${phase.bg} px-12 py-10`}>
              {/* Phase header */}
              <div className="mb-8 flex items-center gap-6">
                <span className={`h-6 w-6 shrink-0 rounded-full ${phase.dot}`} />
                <span className={`text-12 font-semibold ${phase.color}`}>{phase.label}</span>
              </div>

              {/* Steps */}
              <div className="space-y-8">
                {phase.steps.map((step) => (
                  <div key={step.title} className="flex gap-8">
                    {step.num !== null ? (
                      <span className="text-10 text-slate-300 mt-1 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-800 font-bold">
                        {step.num}
                      </span>
                    ) : (
                      <span className="text-10 mt-1 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-green-900/60 font-bold text-green-400">
                        ✓
                      </span>
                    )}
                    <div>
                      <div className="text-slate-200 text-12 font-medium">{step.title}</div>
                      <div className="leading-relaxed mt-2 text-11 text-slate-500">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
