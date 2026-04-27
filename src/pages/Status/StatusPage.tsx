/**
 * StatusPage.tsx
 *
 * Protocol Solvency Dashboard.
 * Route: /status
 *
 * Shows the 8-step FR risk defense sequence in real-time.
 * Per-user ADL risk indicators have moved to /portfolio.
 */

import { t } from "@lingui/macro";
import { formatDistanceToNow } from "date-fns";

import type { DefenseStep } from "domain/vantage/solvency/getDefenseStep";
import { useStatusPageData } from "domain/vantage/solvency/useStatusPageData";
import { VAULT_CONFIGS } from "domain/vantage/vaults/vaultConfig";
import { useChainId } from "lib/chains";

import { AppHeader } from "components/AppHeader/AppHeader";
import { AppNav } from "components/AppNav/AppNav";
import { VantagePageContainer } from "components/VantagePageContainer/VantagePageContainer";

import { BufferGauges } from "./components/BufferGauges";
import { OIStats } from "./components/OIStats";
import { ProtocolCommitmentBanner } from "./components/ProtocolCommitmentBanner";
import { SolvencySpeedometer } from "./components/SolvencySpeedometer";
import { WaterfallAdlRisk } from "./components/WaterfallAdlRisk";
import { WaterfallHealthWidget } from "./components/WaterfallHealthWidget";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Use first non-stable vault for OI + funding data; fall back to the USDC vault.
const PRIMARY_CFG = VAULT_CONFIGS.find((v) => v.assetType !== "stable" && v.vaultAddress) ?? VAULT_CONFIGS[0];

// ---------------------------------------------------------------------------
// SolvencyDropBanner — shows elapsed time since solvencyDropAt
// ---------------------------------------------------------------------------

function SolvencyDropBanner({ solvencyDropAt, defenseStep }: { solvencyDropAt: number; defenseStep: DefenseStep }) {
  if (solvencyDropAt === 0 || defenseStep < 6) return null;

  const dropDate = new Date(solvencyDropAt * 1_000);
  const elapsed = formatDistanceToNow(dropDate, { addSuffix: false });

  return (
    <div className="bg-red-950/40 flex items-center gap-10 rounded-4 border px-16 py-12">
      <div className="h-8 w-8 flex-shrink-0 animate-pulse rounded-full bg-red-500" />
      <p className="text-red-300 text-13">
        {t`Trade ADL in progress for ${elapsed}. Long positions with high leverage × profit are being force-closed.`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StatusPage() {
  const { chainId } = useChainId();

  const data = useStatusPageData(chainId, PRIMARY_CFG);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-b-vantage-border px-16 py-8">
        <AppHeader leftContent={<AppNav />} />
      </div>

      <VantagePageContainer
        title={t`Protocol Status`}
        description={t`Real-time solvency dashboard. 9-step defense sequence transparency.`}
      >
        <div className="flex flex-col gap-20">
          {/* Solvency drop banner (Phase 3+) */}
          <SolvencyDropBanner solvencyDropAt={data.solvencyDropAt} defenseStep={data.defenseStep} />

          {/* 2-column layout */}
          <div className="grid grid-cols-1 items-start gap-20 lg:grid-cols-2">
            {/* Left: Protocol Defense Status */}
            <div className="flex flex-col gap-20">
              <SolvencySpeedometer defenseStep={data.defenseStep} />
              <ProtocolCommitmentBanner />
            </div>

            {/* Right: Internal Buffers → Hedge Inventory */}
            <div className="flex flex-col gap-20">
              <BufferGauges
                reserveFundUsd={data.reserveFundUsd}
                lpBoostPoolUsd={data.lpBoostPoolUsd}
                juniorDeficitAbsorbed={data.juniorDeficitAbsorbed}
                juniorAumUsd={data.juniorAumUsd}
              />
              <OIStats
                totalShortUsd={data.totalShortUsd}
                maxShortCapacityUsd={data.maxShortCapacityUsd}
                oiUtilizationPct={data.oiUtilizationPct}
                fundingRateBps={data.fundingRateBps}
                yieldAprBps={data.yieldAprBps}
                hedgeCapacityPct={data.hedgeCapacityPct}
              />
            </div>
          </div>

          {/* Waterfall Payout solvency row (Issue #216) */}
          <div className="grid grid-cols-1 items-start gap-20 lg:grid-cols-2">
            {/* Junior LP: Health Factor */}
            <WaterfallHealthWidget
              totalBalance={data.waterfallTotalBalance}
              payoutCapacity={data.waterfallPayoutCapacity}
              netUPnL={data.waterfallNetUPnL}
              isCritical={data.waterfallIsCritical}
            />

            {/* Trader: ADL Risk Indicator */}
            <WaterfallAdlRisk
              payoutCapacity={data.waterfallPayoutCapacity}
              netUPnL={data.waterfallNetUPnL}
              isCritical={data.waterfallIsCritical}
            />
          </div>
        </div>
      </VantagePageContainer>
    </div>
  );
}
