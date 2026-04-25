/**
 * FrDefenseExplainer.tsx
 *
 * Collapsible accordion inside Protocol Defense Status.
 * Explains the 4-phase / 9-step FR risk management sequence
 * so first-time users understand how the protocol protects them.
 *
 * Step mapping (matches SolvencySpeedometer / getDefenseStep):
 *   Phase 0 (Normal):     Step 0
 *   Phase 1 (Prevention): Steps 1–3
 *   Phase 2 (Internal):   Steps 4–7
 *   Phase 3 (ADL):        Steps 8–9
 */

import type { MessageDescriptor } from "@lingui/core";
import { msg, t } from "@lingui/macro";
import { useLingui } from "@lingui/react";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

type PhaseStep = {
  num: number | null;
  icon: string | null;
  title: MessageDescriptor;
  desc: MessageDescriptor;
};

type Phase = {
  label: MessageDescriptor;
  subLabel: MessageDescriptor;
  activeRange: [number, number];
  bg: string;
  titleColor: string;
  badgeClass: string;
  steps: PhaseStep[];
};

const PHASES: Phase[] = [
  {
    label: msg`Normal Operation`,
    subLabel: msg`System working as intended`,
    activeRange: [0, 0],
    bg: "bg-green-950/20",
    titleColor: "text-green-400",
    badgeClass: "bg-gradient-to-br from-green-500 to-green-400 text-black",
    steps: [
      {
        num: null,
        icon: "✓",
        title: msg`Safe`,
        desc: msg`Users pay zero fees for perpetual hedging, thanks to the Yield Token FR Offset mechanism.`,
      },
    ],
  },
  {
    label: msg`Phase 1 — Prevention`,
    subLabel: msg`Steps 1–3`,
    activeRange: [1, 3],
    bg: "bg-yellow-950/20",
    titleColor: "text-yellow-400",
    badgeClass: "border border-yellow-700/60 bg-yellow-900/50 text-yellow-300",
    steps: [
      {
        num: 1,
        icon: null,
        title: msg`Supply-Side Incentive`,
        desc: msg`The stability fund temporarily boosts LP rewards to attract new RWA deposits and expand pool capacity.`,
      },
      {
        num: 2,
        icon: null,
        title: msg`New Entry Restriction`,
        desc: msg`High-leverage (5×+) new hedges are locked. Once the OI cap is reached, all new entries are frozen.`,
      },
      {
        num: 3,
        icon: null,
        title: msg`New Entry Premium Surge`,
        desc: msg`Entry premiums rise only for incoming users. All existing hedge positions are unaffected.`,
      },
    ],
  },
  {
    label: msg`Phase 2 — Internal Defense`,
    subLabel: msg`Steps 4–7`,
    activeRange: [4, 7],
    bg: "bg-orange-950/20",
    titleColor: "text-orange-400",
    badgeClass: "border border-orange-700/60 bg-orange-900/50 text-orange-300",
    steps: [
      {
        num: 4,
        icon: null,
        title: msg`Junior Vault Buffer`,
        desc: msg`High-yield junior LP (USDC) profits absorb the FR deficit, shielding senior LPs (RWA) and maintaining hedge user costs.`,
      },
      {
        num: 5,
        icon: null,
        title: msg`Senior Vault Yield`,
        desc: msg`Yield earned by senior LP (RWA) deposits is routed to cover the remaining FR shortfall.`,
      },
      {
        num: 6,
        icon: null,
        title: msg`Reserve Fund Utilization`,
        desc: msg`The protocol stability fund covers FR shortfalls using surplus accumulated from past profits.`,
      },
      {
        num: 7,
        icon: null,
        title: msg`Junior Vault Principal (up to 50%)`,
        desc: msg`Up to 50% of junior LP principal is used to absorb the deficit. Once this cap is reached, the protocol escalates to Phase 3 ADL. This burden will decrease as protocol reserves grow.`,
      },
    ],
  },
  {
    label: msg`Phase 3 — Last Resort`,
    subLabel: msg`Steps 8–9`,
    activeRange: [8, 9],
    bg: "bg-red-950/20",
    titleColor: "text-red-400",
    badgeClass: "border border-red-700/60 bg-red-900/50 text-red-300",
    steps: [
      {
        num: 8,
        icon: null,
        title: msg`ADL for Long Profits`,
        desc: msg`Highly profitable speculative long positions are force-closed to directly reduce the FR obligation. Priority: Trade Mode positions first, then highest pnl-per-collateral.`,
      },
      {
        num: 9,
        icon: null,
        title: msg`ADL for Hedge-Shorts`,
        desc: msg`Last line of defense. Hedge shorts are force-closed (or converted to paid-shorts) to prevent LP insolvency. Priority: highest leverage first, then most recently opened (LIFO), then auto-terminate mode.`,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FrDefenseExplainerProps {
  defenseStep: number;
}

export function FrDefenseExplainer({ defenseStep }: FrDefenseExplainerProps) {
  const { _ } = useLingui();

  return (
    <div className="mt-16">
      {/* Expandable content */}
      <div className="mt-14 space-y-12">
        {PHASES.map((phase) => (
          <div
            key={phase.label.id}
            className={`rounded-4 ${phase.bg} px-12 py-10 transition-opacity duration-300 ${defenseStep >= phase.activeRange[0] && defenseStep <= phase.activeRange[1] ? "opacity-100" : "opacity-35"}`}
          >
            {/* Phase header */}
            <div className="mb-20 flex items-baseline justify-between">
              <span className={`text-16 font-semibold ${phase.titleColor}`}>{_(phase.label)}</span>
              <span className="text-10 text-slate-600">{_(phase.subLabel)}</span>
            </div>

            {/* Steps */}
            <div className="space-y-10">
              {phase.steps.map((step) => (
                <div key={step.title.id} className="flex gap-10">
                  {/* Badge */}
                  <span
                    className={`text-10 mt-1 flex h-18 w-18 shrink-0 items-center justify-center rounded-full font-bold ${phase.badgeClass}`}
                  >
                    {step.num !== null ? step.num : "✓"}
                  </span>
                  <div>
                    <div className="text-slate-200 text-14 font-medium">{_(step.title)}</div>
                    <div className="leading-relaxed mt-2 text-11 text-slate-500">{_(step.desc)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Escalation note */}
        <p className="px-4 text-11 text-slate-600">
          {t`Defense escalates only when the previous phase is insufficient. Phase 0 covers the vast majority of market conditions.`}
        </p>
      </div>
    </div>
  );
}
