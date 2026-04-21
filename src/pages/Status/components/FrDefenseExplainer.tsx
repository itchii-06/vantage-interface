/**
 * FrDefenseExplainer.tsx
 *
 * Collapsible accordion inside Protocol Defense Status.
 * Explains the 4-phase / 7-step FR risk management sequence
 * so first-time users understand how the protocol protects them.
 */

import { t } from "@lingui/macro";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const PHASES = [
  {
    label: "Phase 0 — Normal Operation",
    subLabel: "System working as intended",
    activeRange: [0, 0] as [number, number],
    leftBorder: "border-l-[#ecff3e]",
    bg: "bg-[rgba(236,255,62,0.04)]",
    titleColor: "text-[#ecff3e]",
    badgeClass: "bg-gradient-to-br from-[#ecff3e] to-[#a3e635] text-black",
    steps: [
      {
        num: null as number | null,
        icon: "✓",
        title: "Yield Token FR Offset",
        desc: "RWA yield continuously offsets funding rate payments, keeping hedge costs at zero for users.",
      },
    ],
  },
  {
    label: "Phase 1 — Prevention",
    subLabel: "Steps 1–3",
    activeRange: [1, 3] as [number, number],
    leftBorder: "border-l-yellow-500",
    bg: "bg-yellow-950/20",
    titleColor: "text-yellow-400",
    badgeClass: "border border-yellow-700/60 bg-yellow-900/50 text-yellow-300",
    steps: [
      {
        num: 1,
        icon: null as string | null,
        title: "Supply-Side Incentive",
        desc: "Reserve fund temporarily boosts LP rewards to attract new RWA deposits and expand pool capacity.",
      },
      {
        num: 2,
        icon: null,
        title: "New Entry Restriction",
        desc: "High-leverage (5×+) new hedges are locked. Once the OI cap is reached, all new entries are frozen.",
      },
      {
        num: 3,
        icon: null,
        title: "New Entry Premium Surge",
        desc: "Entry premiums rise only for incoming users. All existing hedge positions are unaffected.",
      },
    ],
  },
  {
    label: "Phase 2 — Internal Defense",
    subLabel: "Steps 4–5",
    activeRange: [4, 5] as [number, number],
    leftBorder: "border-l-orange-500",
    bg: "bg-orange-950/20",
    titleColor: "text-orange-400",
    badgeClass: "border border-orange-700/60 bg-orange-900/50 text-orange-300",
    steps: [
      {
        num: 4,
        icon: null,
        title: "Reserve Fund Utilization",
        desc: "The protocol stability fund covers FR shortfalls using surplus accumulated from past profits.",
      },
      {
        num: 5,
        icon: null,
        title: "Junior Vault Buffer",
        desc: "High-yield junior LP (USDC) principal/profits absorb the deficit, shielding senior LPs (RWA) and maintaining hedge user costs.",
      },
    ],
  },
  {
    label: "Phase 3 — Last Resort",
    subLabel: "Steps 6–7",
    activeRange: [6, 7] as [number, number],
    leftBorder: "border-l-red-500",
    bg: "bg-red-950/20",
    titleColor: "text-red-400",
    badgeClass: "border border-red-700/60 bg-red-900/50 text-red-300",
    steps: [
      {
        num: 6,
        icon: null,
        title: "ADL for Long Profits",
        desc: "Highly profitable speculative long positions are force-closed, directly reducing the outstanding FR obligation.",
      },
      {
        num: 7,
        icon: null,
        title: "ADL for Hedge-Shorts",
        desc: "Last line of defense. Some hedge shorts are force-closed (or converted to paid-shorts) to prevent LP insolvency and protocol halt — rather than raising costs retroactively.",
      },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FrDefenseExplainerProps {
  defenseStep: number;
}

export function FrDefenseExplainer({ defenseStep }: FrDefenseExplainerProps) {
  return (
    <div className="mt-16">
      {/* Expandable content */}
      <div className="mt-14 space-y-12">
        {PHASES.map((phase) => (
          <div
            key={phase.label}
            className={`rounded-4 ${phase.bg} px-12 py-10 transition-opacity duration-300 ${defenseStep >= phase.activeRange[0] && defenseStep <= phase.activeRange[1] ? "opacity-100" : "opacity-35"}`}
          >
            {/* Phase header */}
            <div className="mb-10 flex items-baseline justify-between">
              <span className={`text-12 font-semibold ${phase.titleColor}`}>{phase.label}</span>
              <span className="text-10 text-slate-600">{phase.subLabel}</span>
            </div>

            {/* Steps */}
            <div className="space-y-10">
              {phase.steps.map((step) => (
                <div key={step.title} className="flex gap-10">
                  {/* Badge */}
                  <span
                    className={`text-10 mt-1 flex h-18 w-18 shrink-0 items-center justify-center rounded-full font-bold ${phase.badgeClass}`}
                  >
                    {step.num !== null ? step.num : "✓"}
                  </span>
                  <div>
                    <div className="text-slate-200 text-12 font-medium">{step.title}</div>
                    <div className="leading-relaxed mt-2 text-11 text-slate-500">{step.desc}</div>
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
