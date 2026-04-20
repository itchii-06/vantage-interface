/**
 * StatusPage.tsx
 *
 * Protocol Solvency Dashboard.
 * Route: /status
 *
 * Shows the 7-step FR risk defense sequence in real-time and displays
 * per-user ADL risk indicators for both trade and hedge positions.
 */

import { t } from "@lingui/macro";
import { formatDistanceToNow } from "date-fns";
import { Contract, formatEther } from "ethers";
import { useEffect, useState } from "react";

import type { DefenseStep } from "domain/vantage/solvency/getDefenseStep";
import { useStatusPageData } from "domain/vantage/solvency/useStatusPageData";
import { VAULT_CONFIGS } from "domain/vantage/vaults/vaultConfig";
import { useChainId } from "lib/chains";
import { getProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";
import type { HedgePositionSummary, TradePositionSummary } from "pages/Status/components/AdlLeaderboard";
import VaultAbi from "vantage/abis/Vault.json";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";

import { AppHeader } from "components/AppHeader/AppHeader";
import { AppNav } from "components/AppNav/AppNav";
import { VantagePageContainer } from "components/VantagePageContainer/VantagePageContainer";

import { AdlLeaderboard } from "./components/AdlLeaderboard";
import { BufferGauges } from "./components/BufferGauges";
import { OIStats } from "./components/OIStats";
import { ProtocolCommitmentBanner } from "./components/ProtocolCommitmentBanner";
import { SolvencySpeedometer } from "./components/SolvencySpeedometer";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_MS = 15_000;

const dep = localhostDeployment.addresses as { tokens?: { USDC?: string } };
const USDC_ADDRESS = dep.tokens?.USDC ?? "";

// Use first non-stable vault for OI + funding data; fall back to the USDC vault.
const PRIMARY_CFG = VAULT_CONFIGS.find((v) => v.assetType !== "stable" && v.vaultAddress) ?? VAULT_CONFIGS[0];

// ---------------------------------------------------------------------------
// useUserPositions — fetches both long (trade) and short (hedge) positions
// ---------------------------------------------------------------------------

interface UserPositions {
  trade: TradePositionSummary | null;
  hedge: HedgePositionSummary | null;
}

function useUserPositions(chainId: number, account: string | undefined): UserPositions {
  const [positions, setPositions] = useState<UserPositions>({ trade: null, hedge: null });

  useEffect(() => {
    if (!account || !PRIMARY_CFG.vaultAddress || !PRIMARY_CFG.tokenAddress || !USDC_ADDRESS) return;

    const provider = getProvider(undefined, chainId);
    const vault = new Contract(PRIMARY_CFG.vaultAddress, VaultAbi, provider);
    let cancelled = false;

    async function poll() {
      try {
        const tokenAddr = PRIMARY_CFG.tokenAddress;

        // Long (trade) position key
        const longKey: string = await vault.getPositionKey(account, USDC_ADDRESS, tokenAddr, true);
        // Short (hedge) position key
        const shortKey: string = await vault.getPositionKey(account, USDC_ADDRESS, tokenAddr, false);

        const [longPos, shortPos, shouldConvertOnADL] = await Promise.all([
          vault.positions(longKey),
          vault.positions(shortKey),
          vault.shouldConvertOnADL(shortKey).catch(() => false) as Promise<boolean>,
        ]);

        const tokenPrice: bigint = await vault.getMinPrice(tokenAddr).catch(() => 0n);
        const PRICE_PRECISION = 10n ** 18n;

        // ── Trade position ──────────────────────────────────────────────────
        let trade: TradePositionSummary | null = null;
        if (BigInt(longPos.size) > 0n) {
          const sizeUsd = parseFloat(formatEther(longPos.size));
          const collateralUsd = parseFloat(formatEther(longPos.collateral));
          // Estimated PnL: (currentPrice - avgPrice) × size / avgPrice
          const avgPrice = BigInt(longPos.averagePrice);
          const unrealizedPnlWad =
            avgPrice > 0n ? ((tokenPrice - avgPrice) * BigInt(longPos.size)) / avgPrice / PRICE_PRECISION : 0n;
          trade = {
            sizeUsd,
            collateralUsd,
            unrealizedPnlUsd: parseFloat(formatEther(unrealizedPnlWad)),
          };
        }

        // ── Hedge (short) position ──────────────────────────────────────────
        let hedge: HedgePositionSummary | null = null;
        if (BigInt(shortPos.size) > 0n) {
          const sizeUsd = parseFloat(formatEther(shortPos.size));
          const collateralUsd = parseFloat(formatEther(shortPos.collateral));
          // openedAt is stored in block.timestamp seconds — convert to ms
          const openedAtMs = Number(shortPos.lastIncreasedTime ?? 0) * 1_000;
          hedge = {
            sizeUsd,
            collateralUsd,
            openedAtMs,
            shouldConvertOnADL,
          };
        }

        if (!cancelled) setPositions({ trade, hedge });
      } catch {
        // Leave previous data intact.
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [chainId, account]);

  return positions;
}

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
  const { account } = useWallet();

  const data = useStatusPageData(chainId, PRIMARY_CFG);
  const { trade, hedge } = useUserPositions(chainId, account);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-b-vantage-border px-16 py-8">
        <AppHeader leftContent={<AppNav />} />
      </div>

      <VantagePageContainer
        title={t`Protocol Status`}
        description={t`Real-time solvency dashboard. 7-step defense sequence transparency.`}
      >
        <div className="flex flex-col gap-20">
          {/* Solvency drop banner (Phase 3+) */}
          <SolvencyDropBanner solvencyDropAt={data.solvencyDropAt} defenseStep={data.defenseStep} />

          {/* 7-Step Speedometer */}
          <SolvencySpeedometer defenseStep={data.defenseStep} />

          {/* Buffer Gauges + OI Stats */}
          <div className="grid grid-cols-1 gap-20 lg:grid-cols-2">
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

          {/* ADL Risk (user's own positions) */}
          <AdlLeaderboard tradePosition={trade} hedgePosition={hedge} />

          {/* Protocol Commitment */}
          <ProtocolCommitmentBanner />
        </div>
      </VantagePageContainer>
    </div>
  );
}
