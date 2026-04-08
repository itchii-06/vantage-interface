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
import { formatEther } from "ethers";
import { useMemo } from "react";

import { usePortfolioData } from "domain/vantage/portfolio/usePortfolioData";
import type { HedgePortfolioItem, VaultLpItem } from "domain/vantage/portfolio/usePortfolioData";
import type { VantagePosition } from "domain/vantage/positions/types";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";

import { AppHeader } from "components/AppHeader/AppHeader";
import { AppNav } from "components/AppNav/AppNav";

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
    <div className="bg-cold-blue-950 mb-24 grid grid-cols-2 gap-0 rounded-4 border border-stroke-primary lg:grid-cols-4">
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
        <div key={i} className={`p-20 ${i < 3 ? "border-b border-stroke-primary lg:border-b-0 lg:border-r" : ""}`}>
          <div className="text-11 text-slate-500">{label}</div>
          <div className={`mt-6 text-15 font-semibold ${valueClass}`}>{value}</div>
          <div className="mt-2 text-11 text-slate-500">{sub}</div>
        </div>
      ))}
    </div>
  );
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

type HedgeSectionProps = { items: HedgePortfolioItem[]; hasAccount: boolean };

function HedgeSection({ items, hasAccount }: HedgeSectionProps) {
  const hasAny = items.some((h) => h.lpUsdValue > 0n || h.shortSizeUsd !== null);

  return (
    <div className="mb-24">
      <h2 className="mb-12 text-14 font-semibold text-white">{t`Hedge Positions`}</h2>
      <div className="bg-cold-blue-950 overflow-hidden rounded-4 border border-stroke-primary">
        {/* Header */}
        <div className="grid grid-cols-[2fr_3fr_1fr_1fr] items-center gap-0 border-b border-stroke-primary px-20 py-10 text-11 text-slate-500">
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
                className="grid grid-cols-[2fr_3fr_1fr_1fr] items-center gap-0 border-b border-stroke-primary px-20 py-16 last:border-0"
              >
                {/* Asset */}
                <div className="flex items-center gap-10">
                  <div className="flex h-32 w-32 items-center justify-center rounded-full bg-slate-700 text-12 font-bold text-white">
                    {h.symbol.slice(0, 2)}
                  </div>
                  <span className="text-14 font-semibold text-white">{h.symbol}</span>
                </div>

                {/* Balancer */}
                <div className="pr-16">
                  {hasPosition ? (
                    <BalancerBar lpUsd={lpUsd} shortUsd={shortUsd} />
                  ) : (
                    <span className="text-12 text-slate-500">—</span>
                  )}
                </div>

                {/* Spread = Yield + Funding (from short's perspective) */}
                <div className={`text-right text-13 font-semibold ${apyColor(spread)}`}>{fmtApy(spread)}</div>

                {/* Status */}
                <div className="text-right">
                  {hasPosition ? (
                    <span className="rounded-full bg-green-900/40 px-8 py-2 text-11 text-green-400">{t`Active`}</span>
                  ) : (
                    <span className="text-11 text-slate-500">—</span>
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
      <h2 className="mb-12 text-14 font-semibold text-white">{t`Trading Positions`}</h2>
      <div className="bg-cold-blue-950 overflow-hidden rounded-4 border border-stroke-primary">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-0 border-b border-stroke-primary px-20 py-10 text-11 text-slate-500">
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
            return (
              <div
                key={p.key}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-0 border-b border-stroke-primary px-20 py-14 last:border-0"
              >
                {/* Asset */}
                <div className="flex items-center gap-10">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-700 text-11 font-bold text-white">
                    {p.indexToken.slice(2, 4).toUpperCase()}
                  </div>
                  <span className="text-13 font-medium text-white">
                    {p.indexToken.slice(0, 6)}…{p.indexToken.slice(-4)}
                  </span>
                </div>
                {/* Side */}
                <div className="text-right">
                  <span
                    className={`rounded-full px-8 py-2 text-11 font-semibold ${
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
                {/* PnL */}
                <div className={`text-right text-13 font-semibold ${pnl.cls}`}>{pnl.text}</div>
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
  return (
    <div className="mb-24">
      <h2 className="mb-12 text-14 font-semibold text-white">{t`Vault LP`}</h2>
      <div className="bg-cold-blue-950 overflow-hidden rounded-4 border border-stroke-primary">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center gap-0 border-b border-stroke-primary px-20 py-10 text-11 text-slate-500">
          <div>{t`Vault`}</div>
          <div className="text-right">{t`My Liquidity`}</div>
          <div className="text-right">{t`APY`}</div>
          <div className="text-right">{t`Vault AUM`}</div>
        </div>

        {items.map((v) => (
          <div
            key={v.key}
            className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center gap-0 border-b border-stroke-primary px-20 py-14 last:border-0"
          >
            {/* Vault */}
            <div className="flex items-center gap-10">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-slate-700 text-12 font-bold text-white">
                {v.symbol.slice(0, 2)}
              </div>
              <div>
                <div className="text-13 font-semibold text-white">{v.symbol}</div>
                <div className="text-11 text-slate-500">{v.name}</div>
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
                  <div className="text-11 text-slate-500">{parseFloat(formatEther(v.vlpBalance)).toFixed(4)} VLP</div>
                </div>
              ) : (
                <span className="text-13 text-slate-500">—</span>
              )}
            </div>

            {/* APY */}
            <div className={`text-right text-13 font-semibold ${apyColor(v.apy)}`}>{fmtApy(v.apy)}</div>

            {/* AUM */}
            <div className="text-right text-13 text-white">{v.isLoading ? "…" : fmtUsdWad(v.aum)}</div>
          </div>
        ))}
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

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-stroke-primary px-16 py-8">
        <AppHeader leftContent={<AppNav />} />
      </div>

      <div className="mt-24 px-16 pb-40">
        {/* Title */}
        <div className="mb-24">
          <h1 className="text-h1">{t`Portfolio`}</h1>
          <p className="text-body-medium mt-4 text-slate-400">
            {t`Your delta-neutral positions, trade history, and LP status across all vaults.`}
          </p>
        </div>

        {/* ① Hero: Global Stats */}
        <HeroSection
          totalNetWorthUsd={globalStats.totalNetWorthUsd}
          totalProtectionUsd={globalStats.totalProtectionUsd}
          avgHedgeRatio={globalStats.avgHedgeRatio}
          netYieldApy={globalStats.netYieldApy}
        />

        {/* ② Hedge Positions */}
        <HedgeSection items={hedgeItems} hasAccount={!!account} />

        {/* ③ Trading Terminal */}
        <TradingSection positions={allPositions} hasAccount={!!account} />

        {/* ④ Vault LP Status */}
        <VaultLpSection items={vaultLpItems} hasAccount={!!account} />

        {/* Disclaimer */}
        <p className="mt-8 text-center text-11 text-slate-600">
          {t`Wallet balances are not included in Total Net Worth. Net Yield is annualized; past rates are not indicative of future returns.`}
        </p>
      </div>
    </div>
  );
}
