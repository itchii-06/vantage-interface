/**
 * HedgePage.tsx
 *
 * Delta-Neutral Strategy interface.
 * Route: /hedge
 */

import { t } from "@lingui/macro";

import { AppHeader } from "components/AppHeader/AppHeader";
import { AppNav } from "components/AppNav/AppNav";

export default function HedgePage() {
  return (
    <div className="w-full">
      <div className="border-b border-stroke-primary px-16 py-8">
        <AppHeader leftContent={<AppNav />} />
      </div>

      <div className="mt-24 px-16">
        <div className="mb-24">
          <h1 className="text-h1">{t`Hedge`}</h1>
          <p className="text-body-medium mt-4 text-slate-400">{t`Delta-neutral strategy — coming soon.`}</p>
        </div>
      </div>
    </div>
  );
}
