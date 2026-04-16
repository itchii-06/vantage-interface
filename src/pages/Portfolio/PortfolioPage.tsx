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
import { formatEther, formatUnits, parseUnits } from "ethers";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { useVantageLPActions } from "domain/vantage/lp/useVantageLPActions";
import { useVantageLPData } from "domain/vantage/lp/useVantageLPData";
import { usePortfolioData } from "domain/vantage/portfolio/usePortfolioData";
import type { HedgePortfolioItem, VaultLpItem } from "domain/vantage/portfolio/usePortfolioData";
import type { VantagePosition } from "domain/vantage/positions/types";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";

import { AppHeader } from "components/AppHeader/AppHeader";
import { AppNav } from "components/AppNav/AppNav";
import Button from "components/Button/Button";
import NumberInput from "components/NumberInput/NumberInput";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LP_USDC_ADDRESS: string = (localhostDeployment.addresses as { tokens?: { USDC?: string } }).tokens?.USDC ?? "";
const LP_USDC_DECIMALS = 6;
const LP_WAD = BigInt("1000000000000000000"); // 1e18

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
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-700 text-11 font-bold text-white">
            {symbol.slice(0, 2)}
          </div>
          <span className="text-13 font-semibold text-white">{symbol}</span>
        </div>
        <div className="flex items-center gap-8">
          {isSoftLocked && (
            <span className="bg-amber-900/50 text-amber-300 rounded-full px-8 py-2 text-11 font-semibold">
              {t`FR相殺停止中`}
            </span>
          )}
          {deficitDuration && (
            <span className="text-11 text-slate-500">
              {deficitDuration}
              {t`前より赤字検知`}
            </span>
          )}
        </div>
      </div>

      {/* Warning */}
      {isSoftLocked && (
        <div className="text-amber-400/90 mb-12 text-12">
          ⚠️ {t`システム収益保護のため、現在一時的にFR相殺が停止されています`}
        </div>
      )}

      {/* Solvency ratio bar */}
      {yieldAprBps !== null && fundingRateBps !== null && (
        <div className="space-y-8">
          {/* Yield */}
          <div className="flex items-center gap-10">
            <div className="w-[60px] text-right text-11 text-slate-400">{t`利回り`}</div>
            <div className="relative h-12 flex-1 overflow-hidden rounded-full bg-slate-700/50">
              <div className="h-full rounded-full bg-green-500 transition-all" style={yieldBarStyle} />
            </div>
            <div className="w-[48px] text-right text-11 font-semibold text-green-400">
              {(yieldBps / 100).toFixed(2)}%
            </div>
          </div>
          {/* FR cost */}
          <div className="flex items-center gap-10">
            <div className="w-[60px] text-right text-11 text-slate-400">{t`FRコスト`}</div>
            <div className="relative h-12 flex-1 overflow-hidden rounded-full bg-slate-700/50">
              <div className="h-full rounded-full bg-red-500 transition-all" style={costBarStyle} />
            </div>
            <div className="w-[48px] text-right text-11 font-semibold text-red-400">
              {costBps !== null ? (costBps / 100).toFixed(2) : "—"}%
            </div>
          </div>
          {/* Ratio */}
          {solvencyRatio !== null && (
            <div className="border-t border-slate-700/60 pt-8">
              <div className="flex items-center justify-between text-12">
                <span className="text-slate-400">{t`ソルベンシー比率`}</span>
                <div className="flex items-center gap-8">
                  <span className={`font-semibold ${solvencyRatio >= 1 ? "text-green-400" : "text-red-400"}`}>
                    {solvencyRatio.toFixed(2)}×
                  </span>
                  <span className={`text-11 ${solvencyRatio >= 1 ? "text-green-500/70" : "text-red-500/70"}`}>
                    {solvencyRatio >= 1 ? t`（健全）` : t`（赤字）`}
                  </span>
                </div>
              </div>
              <div className="mt-6 text-11 text-slate-500">
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
      <h2 className="mb-12 text-14 font-semibold text-white">{t`プロトコル・ソルベンシー`}</h2>
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
                  {h.isSoftLocked ? (
                    <span className="bg-amber-900/40 text-amber-300 rounded-full px-8 py-2 text-11">{t`FR停止中`}</span>
                  ) : hasPosition ? (
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
// LP Management section (Issue #181 — Monthly Redemption)
// ---------------------------------------------------------------------------

function LpManagementSection({ chainId, hasAccount }: { chainId: number; hasAccount: boolean }) {
  const lpData = useVantageLPData();
  const actions = useVantageLPActions(chainId);

  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [depositInput, setDepositInput] = useState("");
  const [withdrawInput, setWithdrawInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (lpData.nextEpochTimestamp === 0n) return;
    function tick() {
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      const remaining = lpData.nextEpochTimestamp > nowSec ? lpData.nextEpochTimestamp - nowSec : 0n;
      if (remaining === 0n) {
        setCountdown(t`Ready to execute`);
        return;
      }
      const days = remaining / 86400n;
      const hours = (remaining % 86400n) / 3600n;
      const mins = (remaining % 3600n) / 60n;
      const secs = remaining % 60n;
      setCountdown(
        `${days}${t`d`} ${String(hours).padStart(2, "0")}${t`h`} ${String(mins).padStart(2, "0")}${t`m`} ${String(secs).padStart(2, "0")}${t`s`}`
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lpData.nextEpochTimestamp]);

  const depositAmountUSDC = useMemo(() => {
    try {
      if (!depositInput || parseFloat(depositInput) <= 0) return 0n;
      return parseUnits(depositInput, LP_USDC_DECIMALS);
    } catch {
      return 0n;
    }
  }, [depositInput]);

  const estimatedVlpOut =
    lpData.sharePrice > 0n
      ? (depositAmountUSDC * BigInt(10 ** (18 - LP_USDC_DECIMALS)) * LP_WAD) / lpData.sharePrice
      : 0n;

  const withdrawShares = useMemo(() => {
    try {
      if (!withdrawInput || parseFloat(withdrawInput) <= 0) return 0n;
      return parseUnits(withdrawInput, 18);
    } catch {
      return 0n;
    }
  }, [withdrawInput]);

  const estimatedUsdcOut =
    withdrawShares > 0n && lpData.sharePrice > 0n
      ? (withdrawShares * lpData.sharePrice) / LP_WAD / BigInt(10 ** (18 - LP_USDC_DECIMALS))
      : 0n;

  const pendingUsdFormatted = useMemo(
    () =>
      lpData.pendingUsdValue > 0n
        ? parseFloat(formatEther(lpData.pendingUsdValue)).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "0.00",
    [lpData.pendingUsdValue]
  );

  const needsApproval = depositAmountUSDC > 0n && actions.isApprovalNeeded(LP_USDC_ADDRESS, depositAmountUSDC);

  async function handleDeposit() {
    if (depositAmountUSDC === 0n) return;
    setIsSubmitting(true);
    try {
      await actions.deposit(LP_USDC_ADDRESS, depositAmountUSDC);
      setDepositInput("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWithdraw() {
    if (withdrawShares === 0n) return;
    setIsSubmitting(true);
    try {
      await actions.withdraw(withdrawShares, LP_USDC_ADDRESS);
      setWithdrawInput("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mb-24">
      <h2 className="mb-12 text-14 font-semibold text-white">{t`LP Management`}</h2>

      {/* Redemption countdown */}
      {!lpData.isLoading && lpData.nextEpochTimestamp > 0n && (
        <div className="text-slate-300 mb-10 rounded-4 border border-slate-600/40 bg-slate-800/30 px-14 py-10 text-13">
          <span className="text-slate-400">{t`Next redemption:`}</span>{" "}
          <span className="font-semibold tabular-nums text-white">{countdown}</span>
        </div>
      )}

      {/* Pending redemption status */}
      {hasAccount && lpData.pendingShares > 0n && (
        <div className="bg-blue-900/20 mb-10 rounded-4 border border-blue-600/40 px-14 py-10 text-13">
          <div className="font-semibold text-blue-300">{t`Redemption pending — yield continues to accrue`}</div>
          <div className="mt-2 text-12 text-blue-400">
            {parseFloat(formatEther(lpData.pendingShares)).toFixed(4)} VLP ≈ ${pendingUsdFormatted}
          </div>
        </div>
      )}

      {/* Deposit / Withdraw form */}
      <div className="bg-cold-blue-950 overflow-hidden rounded-4 border border-stroke-primary">
        {/* Tabs */}
        <div className="flex border-b border-stroke-primary">
          {(["deposit", "withdraw"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-10 text-13 font-medium transition-colors ${
                activeTab === tab ? "border-b-2 border-blue-400 text-white" : "hover:text-slate-200 text-slate-400"
              }`}
            >
              {tab === "deposit" ? t`Deposit` : t`Withdraw`}
            </button>
          ))}
        </div>

        <div className="p-16">
          {activeTab === "deposit" ? (
            <div className="flex flex-col gap-12">
              <div>
                <label className="mb-4 block text-11 text-slate-400">{t`Amount (USDC)`}</label>
                <div className="flex items-center gap-8 rounded-4 border border-stroke-primary bg-slate-800 px-10 py-8">
                  <NumberInput
                    value={depositInput}
                    onValueChange={(e: ChangeEvent<HTMLInputElement>) => setDepositInput(e.target.value)}
                    placeholder="0.00"
                    maxDecimals={LP_USDC_DECIMALS}
                    className="bg-transparent flex-1 text-14 text-white outline-none"
                  />
                  <span className="text-12 text-slate-400">USDC</span>
                </div>
              </div>
              {depositAmountUSDC > 0n && (
                <div className="flex justify-between text-12 text-slate-400">
                  <span>{t`Est. VLP received`}</span>
                  <span className="text-white">{parseFloat(formatEther(estimatedVlpOut)).toFixed(4)} VLP</span>
                </div>
              )}
              {!hasAccount ? (
                <div className="text-center text-12 text-slate-500">{t`Connect wallet to deposit`}</div>
              ) : needsApproval ? (
                <Button
                  variant="primary"
                  size="medium"
                  disabled={depositAmountUSDC === 0n || actions.isApproving}
                  onClick={() => actions.approve(LP_USDC_ADDRESS)}
                  className="w-full"
                >
                  {actions.isApproving ? t`Approving…` : t`Approve USDC`}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="medium"
                  disabled={depositAmountUSDC === 0n || isSubmitting}
                  onClick={handleDeposit}
                  className="w-full"
                >
                  {isSubmitting ? t`Depositing…` : t`Deposit`}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-12">
              <div>
                <div className="mb-4 flex justify-between">
                  <label className="text-11 text-slate-400">{t`VLP Amount`}</label>
                  {hasAccount && lpData.vlpBalance > 0n && (
                    <button
                      onClick={() => setWithdrawInput(formatEther(lpData.vlpBalance))}
                      className="text-11 text-blue-400 hover:text-blue-300"
                    >
                      {t`Max`}: {parseFloat(formatEther(lpData.vlpBalance)).toFixed(4)}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-8 rounded-4 border border-stroke-primary bg-slate-800 px-10 py-8">
                  <NumberInput
                    value={withdrawInput}
                    onValueChange={(e: ChangeEvent<HTMLInputElement>) => setWithdrawInput(e.target.value)}
                    placeholder="0.0000"
                    maxDecimals={18}
                    className="bg-transparent flex-1 text-14 text-white outline-none"
                  />
                  <span className="text-12 text-slate-400">VLP</span>
                </div>
              </div>
              {withdrawShares > 0n && (
                <div className="flex justify-between text-12 text-slate-400">
                  <span>{t`Est. USDC received`}</span>
                  <span className="text-white">
                    {parseFloat(formatUnits(estimatedUsdcOut, LP_USDC_DECIMALS)).toFixed(2)} USDC
                  </span>
                </div>
              )}
              {withdrawShares > lpData.vlpBalance && lpData.vlpBalance > 0n && (
                <div className="text-11 text-red-400">{t`Exceeds your VLP balance`}</div>
              )}
              {!hasAccount ? (
                <div className="text-center text-12 text-slate-500">{t`Connect wallet to withdraw`}</div>
              ) : (
                <Button
                  variant="primary"
                  size="medium"
                  disabled={
                    withdrawShares === 0n ||
                    isSubmitting ||
                    lpData.isWeekendLocked ||
                    withdrawShares > lpData.vlpBalance
                  }
                  onClick={handleWithdraw}
                  className="w-full"
                >
                  {lpData.isWeekendLocked ? t`Restricted (weekend)` : isSubmitting ? t`Withdrawing…` : t`Withdraw`}
                </Button>
              )}
            </div>
          )}
        </div>
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

        {/* ② Solvency Alerts (Issue #180 — shown only when deficit is active) */}
        <SolvencySection items={hedgeItems} />

        {/* ③ Hedge Positions */}
        <HedgeSection items={hedgeItems} hasAccount={!!account} />

        {/* ④ Trading Terminal */}
        <TradingSection positions={allPositions} hasAccount={!!account} />

        {/* ⑤ Vault LP Status */}
        <VaultLpSection items={vaultLpItems} hasAccount={!!account} />

        {/* ⑥ LP Management */}
        <LpManagementSection chainId={chainId} hasAccount={!!account} />

        {/* Disclaimer */}
        <p className="mt-8 text-center text-11 text-slate-600">
          {t`Wallet balances are not included in Total Net Worth. Net Yield is annualized; past rates are not indicative of future returns.`}
        </p>
      </div>
    </div>
  );
}
