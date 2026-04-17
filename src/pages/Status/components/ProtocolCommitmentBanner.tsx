/**
 * ProtocolCommitmentBanner.tsx
 *
 * Permanent transparency declaration: explains the protocol's no-surprise-rate-hike
 * policy and that Step 7 (Hedge ADL) is the last resort rather than fee escalation.
 */

import { t } from "@lingui/macro";

export function ProtocolCommitmentBanner() {
  return (
    <div className="border-blue-900/40 bg-blue-950/30 rounded-4 border px-20 py-16">
      <div className="flex items-start gap-12">
        <div className="mt-2 h-8 w-8 flex-shrink-0 rounded-full bg-blue-500" />
        <div>
          <p className="text-13 font-semibold text-blue-300">{t`Protocol Commitment — No Surprise Rate Hikes`}</p>
          <p className="leading-relaxed mt-6 text-12 text-slate-400">
            {t`This protocol does not raise funding rates retroactively. If the system can no longer sustain hedge payments, it executes Step 7 (contract termination) rather than increasing costs for existing users. The 7-step defense sequence above is the complete, publicly committed framework — nothing will happen outside this order.`}
          </p>
        </div>
      </div>
    </div>
  );
}
