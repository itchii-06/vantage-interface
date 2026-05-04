/**
 * PortfolioPage.tsx
 *
 * Route: /portfolio
 *
 * Layout:
 *   1. Hero     — Global Stats (Total Net Worth, Total Protection, Hedge Ratio, Net Yield)
 *   2. Hedge    — Per-vault balancer bar + spread metric
 *   3. Trading  — All open positions (directional long/short)
 *   4. Vault LP — Per-vault LP status & APY
 */

import { t } from "@lingui/macro";
import { Contract, formatEther } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";

import { usePortfolioData } from "domain/vantage/portfolio/usePortfolioData";
import type { HedgePortfolioItem, VaultLpItem } from "domain/vantage/portfolio/usePortfolioData";
import type { VantagePosition } from "domain/vantage/positions/types";
import { VAULT_CONFIGS } from "domain/vantage/vaults/vaultConfig";
import { useChainId } from "lib/chains";
import { getProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";
import type { HedgePositionSummary } from "pages/Status/components/AdlLeaderboard";
import VaultAbi from "vantage/abis/Vault.json";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";

import { AppHeader } from "components/AppHeader/AppHeader";
import { AppNav } from "components/AppNav/AppNav";
import { VantagePageContainer } from "components/VantagePageContainer/VantagePageContainer";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LP_USDC_ADDRESS: string = (localhostDeployment.addresses as { tokens?: { USDC?: string } }).tokens?.USDC ?? "";

const POLL_MS = 15_000;
const USDC_ADDRESS = LP_USDC_ADDRESS;
const PRIMARY_CFG = VAULT_CONFIGS.find((v) => v.assetType !== "stable" && v.vaultAddress) ?? VAULT_CONFIGS[0];

// ---------------------------------------------------------------------------
// useUserPositions — fetches hedge (short) ADL data for the primary vault
// ---------------------------------------------------------------------------

interface UserPositions {
  hedge: HedgePositionSummary | null;
}

function useUserPositions(chainId: number, account: string | undefined): UserPositions {
  const [positions, setPositions] = useState<UserPositions>({ hedge: null });

  useEffect(() => {
    if (!account || !PRIMARY_CFG.vaultAddress || !PRIMARY_CFG.tokenAddress || !USDC_ADDRESS) return;

    const provider = getProvider(undefined, chainId);
    const vault = new Contract(PRIMARY_CFG.vaultAddress, VaultAbi, provider);
    let cancelled = false;

    async function poll() {
      try {
        const tokenAddr = PRIMARY_CFG.tokenAddress;
        const shortKey: string = await vault.getPositionKey(account, USDC_ADDRESS, tokenAddr, false);

        const [shortPos, shouldConvertOnADL] = await Promise.all([
          vault.positions(shortKey),
          vault.shouldConvertOnADL(shortKey).catch(() => false) as Promise<boolean>,
        ]);

        let hedge: HedgePositionSummary | null = null;
        if (BigInt(shortPos.size) > 0n) {
          const sizeUsd = parseFloat(formatEther(shortPos.size));
          const collateralUsd = parseFloat(formatEther(shortPos.collateral));
          const openedAtMs = Number(shortPos.lastIncreasedTime ?? 0) * 1_000;
          hedge = { sizeUsd, collateralUsd, openedAtMs, shouldConvertOnADL };
        }

        if (!cancelled) setPositions({ hedge });
      } catch {
        // leave previous data intact
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
// Helpers
// ---------------------------------------------------------------------------

function fmtUsd(n: number, decimals = 2): string {
  if (n === 0) return "$0.00";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtUsdWad(wad: bigint): string {
  return fmtUsd(parseFloat(formatEther(wad)));
}

function fmtApy(apy: number | null): string {
  if (apy === null) return "—";
  const sign = apy >= 0 ? "+" : "";
  return `${sign}${(apy * 100).toFixed(2)}%`;
}

function apyColor(apy: number | null): string {
  if (apy === null) return "text-slate-500";
  return apy >= 0 ? "text-green-400" : "text-red-400";
}

function fmtLeverage(size: bigint, collateral: bigint): string {
  if (collateral === 0n) return "—";
  const lev = parseFloat(formatEther(size)) / parseFloat(formatEther(collateral));
  return `${lev.toFixed(1)}×`;
}

function fmtPnl(pnl: bigint): { text: string; cls: string } {
  const n = parseFloat(formatEther(pnl));
  const sign = n >= 0 ? "+" : "";
  return {
    text: `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    cls: n >= 0 ? "text-green-400" : "text-red-400",
  };
}

// ---------------------------------------------------------------------------
// Hero section — Global Stats
// ---------------------------------------------------------------------------

type HeroProps = {
  totalNetWorthUsd: number;
  totalProtectionUsd: number;
  avgHedgeRatio: number | null;
  netYieldApy: number | null;
};

function HeroSection({ totalNetWorthUsd, totalProtectionUsd, avgHedgeRatio, netYieldApy }: HeroProps) {
  const ratioText = avgHedgeRatio !== null ? `${(avgHedgeRatio * 100).toFixed(1)}%` : "—";
  const ratioColor =
    avgHedgeRatio === null
      ? "text-slate-400"
      : avgHedgeRatio >= 0.95
        ? "text-green-400"
        : avgHedgeRatio >= 0.7
          ? "text-yellow-400"
          : "text-red-400";

  return (
    <div className="mb-24 grid grid-cols-2 gap-0 rounded-4 border-b border-b-vantage-border bg-vantage-base lg:grid-cols-4">
      {[
        {
          label: t`Total Net Worth`,
          value: fmtUsd(totalNetWorthUsd),
          sub: t`LP + Trade collateral ± PnL`,
          valueClass: "text-white",
        },
        {
          label: t`Total Protection`,
          value: fmtUsd(totalProtectionUsd),
          sub: t`Sum of short position sizes`,
          valueClass: "text-white",
        },
        {
          label: t`Avg. Hedge Ratio`,
          value: ratioText,
          sub: t`Short size / Your LP value`,
          valueClass: ratioColor,
        },
        {
          label: t`Net Yield`,
          value: fmtApy(netYieldApy),
          sub: t`LP-weighted net APY (annualized)`,
          valueClass: apyColor(netYieldApy),
        },
      ].map(({ label, value, sub, valueClass }, i) => (
        <div
          key={i}
          className="flex flex-col gap-8 border-b border-b-vantage-border border-r-vantage-border bg-vantage-base p-20 lg:border-b-0 lg:border-r"
        >
          <div className="text-14 text-slate-500">{label}</div>
          <div className={`mt-6 text-15 font-semibold ${valueClass}`}>{value}</div>
          <div className="mt-2 text-14 text-slate-500">{sub}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Protocol Solvency section (Issue #180 — Soft Deleveraging)
// ---------------------------------------------------------------------------

type SolvencyItemProps = {
  symbol: string;
  solvencyDropAt: number | null;
  isSoftLocked: boolean;
  yieldAprBps: number | null;
  fundingRateBps: number | null;
};

function SolvencyItem({ symbol, solvencyDropAt, isSoftLocked, yieldAprBps, fundingRateBps }: SolvencyItemProps) {
  // Solvency ratio: yield / |cost|  (< 1 = insolvent)
  const costBps = fundingRateBps !== null ? Math.max(0, -fundingRateBps) : null;
  const yieldBps = yieldAprBps ?? 0;
  const solvencyRatio = costBps !== null && costBps > 0 ? yieldBps / costBps : null;

  const maxScale = Math.max(yieldBps, costBps ?? 0, 100);
  const yieldPct = Math.min(100, (yieldBps / maxScale) * 100);
  const costPct = costBps !== null ? Math.min(100, (costBps / maxScale) * 100) : 0;

  // useMemo called before any conditional return (Rules of Hooks)
  const yieldBarStyle = useMemo(() => ({ width: `${yieldPct}%` }), [yieldPct]);
  const costBarStyle = useMemo(() => ({ width: `${costPct}%` }), [costPct]);

  // Deficit duration
  let deficitDuration: string | null = null;
  if (solvencyDropAt && solvencyDropAt > 0) {
    const nowSec = Math.floor(Date.now() / 1000);
    const elapsedSec = Math.max(0, nowSec - solvencyDropAt);
    const hours = Math.floor(elapsedSec / 3600);
    const minutes = Math.floor((elapsedSec % 3600) / 60);
    deficitDuration = hours > 0 ? `${hours}時間${minutes}分` : `${minutes}分`;
  }

  // Only show when in deficit or user is soft-locked (after all hooks)
  const isInDeficit = (solvencyDropAt !== null && solvencyDropAt > 0) || isSoftLocked;
  if (!isInDeficit) return null;

  return (
    <div className="border-amber-800/40 bg-amber-900/10 rounded-4 border p-16">
      {/* Header */}
      <div className="mb-12 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-700 text-14 font-bold text-white">
            {symbol.slice(0, 2)}
          </div>
          <span className="text-13 font-semibold text-white">{symbol}</span>
        </div>
        <div className="flex items-center gap-8">
          {isSoftLocked && (
            <span className="bg-amber-900/50 text-amber-300 rounded-full px-8 py-2 text-14 font-semibold">
              {t`FR相殺停止中`}
            </span>
          )}
          {deficitDuration && (
            <span className="text-14 text-slate-500">
              {deficitDuration}
              {t`前より赤字検知`}
            </span>
          )}
        </div>
      </div>

      {/* Warning */}
      {isSoftLocked && (
        <div className="text-amber-400/90 mb-12 text-14">
          ⚠️ {t`システム収益保護のため、現在一時的にFR相殺が停止されています`}
        </div>
      )}

      {/* Solvency ratio bar */}
      {yieldAprBps !== null && fundingRateBps !== null && (
        <div className="space-y-8">
          {/* Yield */}
          <div className="flex items-center gap-10">
            <div className="w-[60px] text-right text-14 text-slate-400">{t`利回り`}</div>
            <div className="relative h-12 flex-1 overflow-hidden rounded-full bg-slate-700/50">
              <div className="h-full rounded-full bg-green-500 transition-all" style={yieldBarStyle} />
            </div>
            <div className="w-[48px] text-right text-14 font-semibold text-green-400">
              {(yieldBps / 100).toFixed(2)}%
            </div>
          </div>
          {/* FR cost */}
          <div className="flex items-center gap-10">
            <div className="w-[60px] text-right text-14 text-slate-400">{t`FRコスト`}</div>
            <div className="relative h-12 flex-1 overflow-hidden rounded-full bg-slate-700/50">
              <div className="h-full rounded-full bg-red-500 transition-all" style={costBarStyle} />
            </div>
            <div className="w-[48px] text-right text-14 font-semibold text-red-400">
              {costBps !== null ? (costBps / 100).toFixed(2) : "—"}%
            </div>
          </div>
          {/* Ratio */}
          {solvencyRatio !== null && (
            <div className="border-t border-slate-700/60 pt-8">
              <div className="flex items-center justify-between text-14">
                <span className="text-slate-400">{t`ソルベンシー比率`}</span>
                <div className="flex items-center gap-8">
                  <span className={`font-semibold ${solvencyRatio >= 1 ? "text-green-400" : "text-red-400"}`}>
                    {solvencyRatio.toFixed(2)}×
                  </span>
                  <span className={`text-14 ${solvencyRatio >= 1 ? "text-green-500/70" : "text-red-500/70"}`}>
                    {solvencyRatio >= 1 ? t`（健全）` : t`（赤字）`}
                  </span>
                </div>
              </div>
              <div className="mt-6 text-14 text-slate-500">
                {solvencyRatio < 1
                  ? t`RWA利回りがFRコストを下回っているため、ヘッジのFR相殺が一時停止されています。ソルベンシー回復後に自動的に復元されます。`
                  : t`ソルベンシーは回復しています。ポジションの復元を待っています。`}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type SolvencySectionProps = { items: HedgePortfolioItem[] };

function SolvencySection({ items }: SolvencySectionProps) {
  const activeItems = items.filter((h) => (h.solvencyDropAt !== null && h.solvencyDropAt > 0) || h.isSoftLocked);
  if (activeItems.length === 0) return null;

  return (
    <div className="mb-24">
      <h2 className="mb-12 text-16 font-bold text-white">{t`プロトコル・ソルベンシー`}</h2>
      <div className="space-y-12">
        {activeItems.map((h) => (
          <SolvencyItem
            key={h.key}
            symbol={h.symbol}
            solvencyDropAt={h.solvencyDropAt}
            isSoftLocked={h.isSoftLocked}
            yieldAprBps={h.yieldAprBps}
            fundingRateBps={h.fundingRateBps}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prism axis label helper (Issue #225/#227)
// ---------------------------------------------------------------------------

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

function getPrismAxisLabel(adapterAddress: string): string | null {
  if (!adapterAddress || adapterAddress === ZERO_ADDR) return null;
  const cfg = VAULT_CONFIGS.find((v) => v.adapterAddress?.toLowerCase() === adapterAddress.toLowerCase());
  if (!cfg?.prismAxis) return null;
  return { price: "Price", yield: "Yield", total: "Total" }[cfg.prismAxis] ?? null;
}

// ---------------------------------------------------------------------------
// ADL Risk helpers
// ---------------------------------------------------------------------------

type AdlRiskLevel = "high" | "warning" | "low";

const ADL_RISK_BADGE_CLS: Record<AdlRiskLevel, string> = {
  high: "bg-red-900/50 text-red-400 border border-red-700/50",
  warning: "bg-yellow-900/50 text-yellow-400 border border-yellow-700/50",
  low: "bg-green-900/50 text-green-400 border border-green-700/50",
};
const ADL_RISK_LABEL: Record<AdlRiskLevel, string> = {
  high: "ADL High",
  warning: "ADL Warning",
  low: "ADL Low",
};

function AdlRiskBadge({ level }: { level: AdlRiskLevel }) {
  return (
    <span className={`mt-4 inline-block rounded-full px-8 py-2 text-11 font-medium ${ADL_RISK_BADGE_CLS[level]}`}>
      {ADL_RISK_LABEL[level]}
    </span>
  );
}

function calcHedgeAdlRisk(sizeUsd: number, collateralUsd: number, openedAtMs: number): AdlRiskLevel {
  const lev = collateralUsd > 0 ? sizeUsd / collateralUsd : 0;
  const ageDays = (Date.now() - openedAtMs) / 86_400_000;
  if (lev >= 5) return "high";
  if (lev >= 3 || ageDays < 7) return "warning";
  return "low";
}

function calcTradeAdlRisk(size: bigint, collateral: bigint, pendingPnl: bigint, isLong: boolean): AdlRiskLevel | null {
  if (!isLong || collateral === 0n) return null;
  const lev = parseFloat(formatEther(size)) / parseFloat(formatEther(collateral));
  const pnlUsd = parseFloat(formatEther(pendingPnl));
  const sizeUsd = parseFloat(formatEther(size));
  if (lev >= 5 && pnlUsd > 0) return "high";
  if (lev >= 3 || pnlUsd > sizeUsd * 0.1) return "warning";
  return "low";
}

// ---------------------------------------------------------------------------
// Hedge Positions section — Balancer bar
// ---------------------------------------------------------------------------

type BalancerBarProps = {
  lpUsd: number;
  shortUsd: number;
};

function BalancerBar({ lpUsd, shortUsd }: BalancerBarProps) {
  const total = Math.max(lpUsd + shortUsd, 1);
  const lpPct = Math.min(100, (lpUsd / total) * 100);
  const shortPct = Math.min(100, (shortUsd / total) * 100);
  const delta = Math.abs(lpUsd - shortUsd);
  const isBalanced = delta / Math.max(lpUsd, shortUsd, 1) < 0.05;
  const lpBarStyle = useMemo(() => ({ width: `${lpPct}%` }), [lpPct]);
  const shortBarStyle = useMemo(() => ({ width: `${shortPct}%` }), [shortPct]);

  return (
    <div className="flex flex-col gap-4">
      {/* Bar */}
      <div className="flex h-12 w-full overflow-hidden rounded-full">
        <div className="bg-indigo-500/70 transition-all duration-300" style={lpBarStyle} />
        <div className="w-px bg-slate-600" />
        <div className="bg-emerald-500/70 transition-all duration-300" style={shortBarStyle} />
      </div>
      {/* Labels */}
      <div className="text-10 flex justify-between text-slate-500">
        <span className="text-indigo-400">
          {t`LP`} {fmtUsd(lpUsd)}
        </span>
        {isBalanced ? (
          <span className="font-medium text-green-400">{t`Balanced ✓`}</span>
        ) : (
          <span className="text-yellow-400">
            {t`Δ`} {fmtUsd(delta)}
          </span>
        )}
        <span className="text-emerald-400">
          {t`Short`} {fmtUsd(shortUsd)}
        </span>
      </div>
    </div>
  );
}

type HedgeSectionProps = {
  items: HedgePortfolioItem[];
  hasAccount: boolean;
  adlHedge?: HedgePositionSummary | null;
  primaryVaultKey?: string;
};

function HedgeSection({ items, hasAccount, adlHedge, primaryVaultKey }: HedgeSectionProps) {
  const hasAny = items.some((h) => h.lpUsdValue > 0n || h.shortSizeUsd !== null);

  return (
    <div className="mb-24">
      <h2 className="mb-12 text-16 font-bold text-white">{t`Hedge Positions`}</h2>
      <div className="overflow-hidden rounded-4 border-b border-b-vantage-border bg-vantage-base">
        {/* Header */}
        <div className="grid grid-cols-[2fr_3fr_1fr_1fr] items-center gap-0 border-b border-b-vantage-border bg-vantage-base px-20 py-10 text-14 text-slate-500">
          <div>{t`Asset`}</div>
          <div>{t`Balance (LP ↔ Short)`}</div>
          <div className="text-right">{t`Spread`}</div>
          <div className="text-right">{t`Status`}</div>
        </div>

        {!hasAccount ? (
          <div className="py-32 text-center text-13 text-slate-500">{t`Connect wallet to view hedge positions`}</div>
        ) : !hasAny ? (
          <div className="py-32 text-center text-13 text-slate-500">
            {t`No hedge positions. Open a hedge on the`}{" "}
            <a href="/#/hedge" className="text-indigo-400 underline">{t`Hedge page`}</a>.
          </div>
        ) : (
          items.map((h) => {
            const lpUsd = parseFloat(formatEther(h.lpUsdValue));
            const shortUsd = h.shortSizeUsd ?? 0;
            const spread = h.vaultApy !== null && h.fundingApy !== null ? h.vaultApy + h.fundingApy : null;
            const hasPosition = lpUsd > 0 || shortUsd > 0;

            return (
              <div
                key={h.key}
                className="grid grid-cols-[2fr_3fr_1fr_1fr] items-center gap-0 border-b border-b-vantage-border bg-vantage-base px-20 py-16 last:border-0"
              >
                {/* Asset */}
                <div className="flex items-center gap-10">
                  <div className="flex h-32 w-32 items-center justify-center rounded-full bg-slate-700 text-14 font-bold text-white">
                    {h.symbol.slice(0, 2)}
                  </div>
                  <span className="text-14 font-semibold text-white">{h.symbol}</span>
                </div>

                {/* Balancer */}
                <div className="pr-16">
                  {hasPosition ? (
                    <BalancerBar lpUsd={lpUsd} shortUsd={shortUsd} />
                  ) : (
                    <span className="text-14 text-slate-500">—</span>
                  )}
                </div>

                {/* Spread = Yield + Funding (from short's perspective) */}
                <div className={`text-right text-13 font-semibold ${apyColor(spread)}`}>{fmtApy(spread)}</div>

                {/* Status */}
                <div className="flex flex-col items-end gap-4">
                  {h.isSoftLocked ? (
                    <span className="bg-amber-900/40 text-amber-300 rounded-full px-8 py-2 text-14">{t`FR停止中`}</span>
                  ) : hasPosition ? (
                    <span className="rounded-full bg-green-900/40 px-8 py-2 text-14 text-green-400">{t`Active`}</span>
                  ) : (
                    <span className="text-14 text-slate-500">—</span>
                  )}
                  {h.key === primaryVaultKey && adlHedge && shortUsd > 0 && (
                    <AdlRiskBadge
                      level={calcHedgeAdlRisk(adlHedge.sizeUsd, adlHedge.collateralUsd, adlHedge.openedAtMs)}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trading Terminal section
// ---------------------------------------------------------------------------

type TradingSectionProps = { positions: VantagePosition[]; hasAccount: boolean };

function TradingSection({ positions, hasAccount }: TradingSectionProps) {
  return (
    <div className="mb-24">
      <h2 className="mb-12 text-16 font-bold text-white">{t`Trading Positions`}</h2>
      <div className="overflow-hidden rounded-4 border-b border-b-vantage-border bg-vantage-base">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-0 border-b border-b-vantage-border bg-vantage-base px-20 py-10 text-14 text-slate-500">
          <div>{t`Asset`}</div>
          <div className="text-right">{t`Side`}</div>
          <div className="text-right">{t`Size`}</div>
          <div className="text-right">{t`Leverage`}</div>
          <div className="text-right">{t`Unrealized P&L`}</div>
        </div>

        {!hasAccount ? (
          <div className="py-32 text-center text-13 text-slate-500">{t`Connect wallet to view positions`}</div>
        ) : positions.length === 0 ? (
          <div className="py-32 text-center text-13 text-slate-500">
            {t`No open positions. Go to the`}{" "}
            <a href="/#/trade" className="text-indigo-400 underline">{t`Trade page`}</a>.
          </div>
        ) : (
          positions.map((p) => {
            const pnl = fmtPnl(p.pendingPnl);
            const adlRisk = calcTradeAdlRisk(p.size, p.collateral, p.pendingPnl, p.isLong);
            return (
              <div
                key={p.key}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-0 border-b border-b-vantage-border bg-vantage-base px-20 py-14 last:border-0"
              >
                {/* Asset */}
                <div className="flex items-center gap-10">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-700 text-14 font-bold text-white">
                    {p.indexToken.slice(2, 4).toUpperCase()}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-6">
                      <span className="text-13 font-medium text-white">
                        {p.indexToken.slice(0, 6)}…{p.indexToken.slice(-4)}
                      </span>
                      {getPrismAxisLabel(p.priceAdapter) && (
                        <span className="bg-indigo-900/50 text-10 text-indigo-300 rounded-full px-6 py-1 font-medium">
                          {getPrismAxisLabel(p.priceAdapter)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Side */}
                <div className="text-right">
                  <span
                    className={`rounded-full px-8 py-2 text-14 font-semibold ${
                      p.isLong ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"
                    }`}
                  >
                    {p.isLong ? t`Long` : t`Short`}
                  </span>
                </div>
                {/* Size */}
                <div className="text-right text-13 text-white">{fmtUsdWad(p.size)}</div>
                {/* Leverage */}
                <div className="text-right text-13 text-slate-400">{fmtLeverage(p.size, p.collateral)}</div>
                {/* PnL + ADL risk */}
                <div className="flex flex-col items-end gap-4">
                  <span className={`text-13 font-semibold ${pnl.cls}`}>{pnl.text}</span>
                  {adlRisk && <AdlRiskBadge level={adlRisk} />}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vault LP section
// ---------------------------------------------------------------------------

type VaultLpSectionProps = { items: VaultLpItem[]; hasAccount: boolean };

function VaultLpSection({ items, hasAccount }: VaultLpSectionProps) {
  const history = useHistory();

  function goToWithdraw(vaultAddress: string) {
    history.push({ pathname: `/vaults/${vaultAddress}`, state: { tab: "withdraw" } });
  }

  return (
    <div className="mb-24">
      <h2 className="mb-12 text-16 font-bold text-white">{t`Vault LP`}</h2>
      <div className="overflow-hidden rounded-4 border-b border-b-vantage-border bg-vantage-base">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_100px] items-center gap-0 border-b border-b-vantage-border bg-vantage-base px-20 py-10 text-14 text-slate-500">
          <div>{t`Vault`}</div>
          <div className="text-right">{t`My Liquidity`}</div>
          <div className="text-right">{t`APY`}</div>
          <div className="text-right">{t`Vault AUM`}</div>
          <div />
        </div>

        {items.map((v) => {
          const vaultAddress = VAULT_CONFIGS.find((c) => c.key === v.key)?.vaultAddress ?? "";
          const hasLiquidity = hasAccount && v.usdValue > 0n;
          return (
            <div
              key={v.key}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_100px] items-center gap-0 border-b border-b-vantage-border bg-vantage-base px-20 py-14 last:border-0"
            >
              {/* Vault */}
              <div className="flex items-center gap-10">
                <div className="flex h-48 w-48 items-center justify-center rounded-full bg-slate-700 text-14 font-bold text-white">
                  {v.symbol.slice(0, 2)}
                </div>
                <div>
                  <div className="text-16 font-semibold text-white">{v.symbol}</div>
                  <div className="text-14 text-slate-500">{v.name}</div>
                </div>
              </div>

              {/* My Liquidity */}
              <div className="text-right">
                {!hasAccount ? (
                  <span className="text-13 text-slate-500">—</span>
                ) : v.isLoading ? (
                  <span className="text-13 text-slate-500">…</span>
                ) : v.usdValue > 0n ? (
                  <div>
                    <div className="text-13 font-semibold text-white">{fmtUsdWad(v.usdValue)}</div>
                    <div className="text-14 text-slate-500">{parseFloat(formatEther(v.vlpBalance)).toFixed(4)} VLP</div>
                  </div>
                ) : (
                  <span className="text-13 text-slate-500">—</span>
                )}
              </div>

              {/* APY */}
              <div className={`text-right text-13 font-semibold ${apyColor(v.apy)}`}>{fmtApy(v.apy)}</div>

              {/* AUM */}
              <div className="text-right text-13 text-white">{v.isLoading ? "…" : fmtUsdWad(v.aum)}</div>

              {/* Withdraw button */}
              <div className="flex justify-end">
                {hasLiquidity && vaultAddress ? (
                  <button
                    onClick={() => goToWithdraw(vaultAddress)}
                    className="rounded-4 border border-vantage-border px-12 py-6 text-12 text-vantage-text-secondary transition-colors hover:border-slate-500 hover:text-white"
                  >
                    {t`Withdraw`}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PortfolioPage() {
  const { account } = useWallet();
  const { chainId } = useChainId();

  const { globalStats, hedgeItems, vaultLpItems, allPositions } = usePortfolioData(chainId, account ?? undefined);
  const { hedge: adlHedge } = useUserPositions(chainId, account ?? undefined);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-b-vantage-border bg-vantage-base px-16 py-8">
        <AppHeader leftContent={<AppNav />} />
      </div>

      <VantagePageContainer
        title={t`Portfolio`}
        description={t`Your delta-neutral positions, trade history, and LP status across all vaults.`}
      >
        {/* ① Hero: Global Stats */}
        <HeroSection
          totalNetWorthUsd={globalStats.totalNetWorthUsd}
          totalProtectionUsd={globalStats.totalProtectionUsd}
          avgHedgeRatio={globalStats.avgHedgeRatio}
          netYieldApy={globalStats.netYieldApy}
        />

        {/* ② Solvency Alerts (Issue #180 — shown only when deficit is active) */}
        <SolvencySection items={hedgeItems} />

        {/* ③ Hedge Positions */}
        <HedgeSection items={hedgeItems} hasAccount={!!account} adlHedge={adlHedge} primaryVaultKey={PRIMARY_CFG.key} />

        {/* ④ Trading Terminal */}
        <TradingSection positions={allPositions} hasAccount={!!account} />

        {/* ⑤ Vault LP Status */}
        <VaultLpSection items={vaultLpItems} hasAccount={!!account} />

        {/* Disclaimer */}
        <p className="mt-8 text-center text-14 text-slate-600">
          {t`Wallet balances are not included in Total Net Worth. Net Yield is annualized; past rates are not indicative of future returns.`}
        </p>
      </VantagePageContainer>
    </div>
  );
}
