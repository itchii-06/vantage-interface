/**
 * HedgeDetailPage.tsx
 *
 * Delta-neutral hedge detail & execution page.
 * Route: /hedge/:key
 *
 * Layout (4 sections):
 *   1. HedgeStatusBar  — AUM protected, remaining capacity, current price, health badge
 *   2. Left  — Price chart (TradingView candlestick, same data as Trade page)
 *   3. Right — Delta Neutral explanation + Yield Meter + Form
 *   4. Bottom — Current on-chain position (if any)
 */

import { t } from "@lingui/macro";
import { Contract, formatEther, parseEther, parseUnits } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { useHistory, useParams } from "react-router-dom";

import type { TimeFrame } from "domain/vantage/chart/types";
import { usePriceTicker } from "domain/vantage/chart/usePriceTicker";
import { useHedgeActions } from "domain/vantage/hedge/useHedgeActions";
import type { HedgeMarginToken, HedgeMode } from "domain/vantage/hedge/useHedgeActions";
import { useHedgePageData } from "domain/vantage/hedge/useHedgePageData";
import { VAULT_CONFIGS } from "domain/vantage/vaults/vaultConfig";
import { useChainId } from "lib/chains";
import { getProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";
import { PriceChart } from "pages/Trade/components/PriceChart";
import MockPriceFeedAbi from "vantage/abis/MockPriceFeed.json";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";

import { AppHeader } from "components/AppHeader/AppHeader";
import { AppNav } from "components/AppNav/AppNav";
import NumberInput from "components/NumberInput/NumberInput";
import Tooltip from "components/Tooltip/Tooltip";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ETH_PRICE_USD = 2000;

const MOCK_PRICE_FEED = (localhostDeployment.addresses as { MockPriceFeed?: string }).MockPriceFeed ?? "";
const USDC_ADDRESS = (localhostDeployment.addresses as { tokens?: { USDC?: string } }).tokens?.USDC ?? "";
const POLL_MS = 15_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtUsd(n: number | null, decimals = 2): string {
  if (n === null) return "—";
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function fmtBps(bps: number | null): string {
  if (bps === null) return "—";
  const sign = bps >= 0 ? "+" : "";
  return sign + (bps / 100).toFixed(2) + "%";
}

// ---------------------------------------------------------------------------
// useRwaSpotPrice — fetches oracle price from MockPriceFeed
// ---------------------------------------------------------------------------

function useRwaSpotPrice(tokenAddress: string | undefined): number | null {
  const { chainId } = useChainId();
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!tokenAddress || !MOCK_PRICE_FEED) return;

    const provider = getProvider(undefined, chainId);
    const feed = new Contract(MOCK_PRICE_FEED, MockPriceFeedAbi, provider);
    let cancelled = false;

    async function poll() {
      try {
        const raw: bigint = await feed.prices(tokenAddress);
        if (!cancelled && raw > 0n) setPrice(parseFloat(formatEther(raw)));
      } catch {
        // leave null
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [chainId, tokenAddress]);

  return price;
}

// ---------------------------------------------------------------------------
// HedgeStatusBar — Section 1
// ---------------------------------------------------------------------------

type StatusBarProps = {
  symbol: string;
  spotPriceUsd: number | null;
  vaultAumUsd: number | null;
  maxShortCapacityUsd: number | null;
  remainingCapacityUsd: number | null;
  netApyBps: number | null;
  isHedgeDisabled: boolean;
  hedgeCapacityPct: number | null;
  /** Base safety buffer (safetyBufferBps). Equals requiredBufferBps during stable markets. */
  safetyBufferBps: number | null;
  /** Current dynamic buffer in effect (Issue #179). Rises above safetyBufferBps during FR spikes. */
  requiredBufferBps: number | null;
};

function HedgeStatusBar({
  symbol,
  spotPriceUsd,
  vaultAumUsd,
  maxShortCapacityUsd,
  remainingCapacityUsd,
  netApyBps,
  isHedgeDisabled,
  hedgeCapacityPct,
  safetyBufferBps,
  requiredBufferBps,
}: StatusBarProps) {
  const usedPct =
    maxShortCapacityUsd && remainingCapacityUsd !== null
      ? Math.min(100, ((maxShortCapacityUsd - remainingCapacityUsd) / maxShortCapacityUsd) * 100)
      : null;
  const progressBarStyle = usedPct !== null ? { width: `${usedPct}%` } : undefined;

  // System status derived from Safety Buffer Lock
  const systemStatus: "paused" | "congested" | "healthy" = isHedgeDisabled
    ? "paused"
    : hedgeCapacityPct !== null && hedgeCapacityPct >= 80
      ? "congested"
      : "healthy";

  const SYSTEM_STATUS_CONFIG = {
    paused: { bg: "bg-red-900/30", text: "text-red-400", dot: "bg-red-400", label: t`Paused`, bar: "bg-red-500" },
    congested: {
      bg: "bg-yellow-900/30",
      text: "text-yellow-400",
      dot: "bg-yellow-400",
      label: t`Congested`,
      bar: "bg-yellow-500",
    },
    healthy: {
      bg: "bg-green-900/30",
      text: "text-green-400",
      dot: "bg-green-400",
      label: t`Healthy`,
      bar: "bg-green-500",
    },
  };

  const sc = SYSTEM_STATUS_CONFIG[systemStatus];
  const capacityBarStyle = hedgeCapacityPct !== null ? { width: `${Math.min(100, hedgeCapacityPct)}%` } : undefined;

  return (
    <div className="bg-cold-blue-950 mb-24 rounded-4 border border-stroke-primary p-20">
      <div className="grid grid-cols-2 gap-16 sm:grid-cols-4">
        {/* Current price */}
        <div>
          <div className="text-11 text-slate-500">
            {symbol} {t`Price`}
          </div>
          <div className="mt-4 text-15 font-semibold text-white">
            {spotPriceUsd !== null ? `$${spotPriceUsd.toFixed(4)}` : "—"}
          </div>
          <div className="mt-2 text-11 text-slate-500">{t`Oracle price`}</div>
        </div>

        {/* TVL Protected */}
        <div>
          <div className="text-11 text-slate-500">{t`TVL Protected`}</div>
          <div className="mt-4 text-15 font-semibold text-white">{fmtUsd(vaultAumUsd, 0)}</div>
          <div className="mt-2 text-11 text-slate-500">{t`Vault AUM`}</div>
        </div>

        {/* Remaining hedge capacity */}
        <div>
          <div className="text-11 text-slate-500">{t`Remaining Capacity`}</div>
          <div className="mt-4 text-15 font-semibold text-white">{fmtUsd(remainingCapacityUsd, 0)}</div>
          {usedPct !== null && (
            <div className="mt-6">
              <div className="text-10 mb-2 flex justify-between text-slate-500">
                <span>{t`Used`}</span>
                <span>{usedPct.toFixed(1)}%</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-700">
                <div className="bg-indigo-500 h-full rounded-full transition-all" style={progressBarStyle} />
              </div>
            </div>
          )}
        </div>

        {/* System Status (Safety Buffer Lock) */}
        <div className="flex flex-col">
          <div className="text-11 text-slate-500">{t`System Status`}</div>
          <div className="mt-4">
            <span
              className={`inline-flex items-center gap-5 rounded-full px-8 py-3 text-12 font-semibold ${sc.bg} ${sc.text}`}
            >
              <span className={`h-6 w-6 rounded-full ${sc.dot}`} />
              {sc.label}
            </span>
          </div>
          {hedgeCapacityPct !== null && (
            <div className="mt-6">
              <div className="text-10 mb-2 flex justify-between text-slate-500">
                <span>{t`FR / Buffered Yield`}</span>
                <span>{hedgeCapacityPct.toFixed(0)}%</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-700">
                <div className={`h-full rounded-full transition-all ${sc.bar}`} style={capacityBarStyle} />
              </div>
            </div>
          )}
          {systemStatus === "healthy" && netApyBps !== null && netApyBps > 0 && (
            <div className="mt-4 text-11 text-green-500">{t`You are being paid to hedge`}</div>
          )}

          {/* Dynamic Buffer indicator (Issue #179) */}
          {safetyBufferBps !== null &&
            requiredBufferBps !== null &&
            (() => {
              const basePct = (safetyBufferBps / 100).toFixed(1);
              const curPct = (requiredBufferBps / 100).toFixed(1);
              const isSpiked = requiredBufferBps > safetyBufferBps;

              return (
                <div className="mt-8">
                  <Tooltip
                    position="bottom-end"
                    content={
                      isSpiked
                        ? t`FR spike detected. Safety buffer has been automatically raised from ${basePct}% to ${curPct}% to protect LP assets. New hedge capacity is tighter until the market stabilises.`
                        : t`Safety buffer is at its base level (${basePct}%). Market conditions are stable — no FR spike adjustment active.`
                    }
                    handle={
                      <div
                        className={`inline-flex cursor-help items-center gap-5 rounded-full px-8 py-3 text-11 font-medium ${
                          isSpiked ? "bg-orange-900/30 text-orange-300" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {isSpiked ? (
                          <>
                            <span className="bg-orange-400 h-5 w-5 rounded-full" />
                            {t`Buffer`}: {basePct}% → {curPct}% ↑
                          </>
                        ) : (
                          <>
                            <span className="h-5 w-5 rounded-full bg-slate-500" />
                            {t`Buffer`}: {curPct}%
                          </>
                        )}
                      </div>
                    }
                  />
                </div>
              );
            })()}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// YieldMeter — horizontal stacked bar (Section 3)
// ---------------------------------------------------------------------------

type YieldMeterProps = {
  yieldAprBps: number | null;
  fundingRateBps: number | null;
  netApyBps: number | null;
};

function YieldMeter({ yieldAprBps, fundingRateBps, netApyBps }: YieldMeterProps) {
  const isLoading = yieldAprBps === null && fundingRateBps === null;

  const yA = yieldAprBps ?? 0;
  const fB = fundingRateBps ?? 0;
  const fundingCostBps = -fB; // positive = cost to short
  const maxScale = Math.max(Math.abs(yA), Math.abs(fB), 100);

  const yieldPct = Math.min(100, (yA / maxScale) * 100);
  const fundingPct = Math.min(100, (Math.abs(fB) / maxScale) * 100);

  const netPositive = (netApyBps ?? 0) >= 0;
  const yieldBarStyle = useMemo(() => ({ width: `${yieldPct}%` }), [yieldPct]);
  const fundingBarStyle = useMemo(() => ({ width: `${fundingPct}%` }), [fundingPct]);

  if (isLoading) {
    return <div className="text-12 text-slate-500">{t`Loading yield data…`}</div>;
  }

  return (
    <div className="space-y-10">
      {/* Yield row */}
      <div className="flex items-center gap-10">
        <div className="w-[70px] text-right text-11 text-slate-400">{t`Yield`}</div>
        <div className="relative h-16 flex-1 overflow-hidden rounded-full bg-slate-700/50">
          <div className="h-full rounded-full bg-green-500 transition-all duration-300" style={yieldBarStyle} />
        </div>
        <div className="w-[56px] text-right text-12 font-semibold text-green-400">{fmtBps(yieldAprBps)}</div>
      </div>

      {/* Funding row */}
      <div className="flex items-center gap-10">
        <div className="w-[70px] text-right text-11 text-slate-400">{t`Funding`}</div>
        <div className="relative h-16 flex-1 overflow-hidden rounded-full bg-slate-700/50">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              fundingCostBps <= 0 ? "bg-green-500" : "bg-red-500"
            }`}
            style={fundingBarStyle}
          />
        </div>
        <div
          className={`w-[56px] text-right text-12 font-semibold ${fundingCostBps <= 0 ? "text-green-400" : "text-red-400"}`}
        >
          {/* Display from short's perspective: positive fundingRateBps = received */}
          {fmtBps(fundingRateBps)}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700/60 pt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-11 text-slate-400">{t`Net APY`}</span>
            {netPositive && (
              <span className="text-10 rounded-full bg-green-900/40 px-8 py-2 text-green-400">{t`Paid to you`}</span>
            )}
          </div>
          <span className={`text-16 font-bold ${netPositive ? "text-green-400" : "text-red-400"}`}>
            {fmtBps(netApyBps)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeltaNeutralBox — explanation (Section 3)
// ---------------------------------------------------------------------------

type DeltaNeutralBoxProps = {
  symbol: string;
  rwaAmount: number;
  spotPriceUsd: number | null;
  sizeDeltaUsd: number;
};

function DeltaNeutralBox({ symbol, rwaAmount, spotPriceUsd, sizeDeltaUsd }: DeltaNeutralBoxProps) {
  const spotValue = rwaAmount * (spotPriceUsd ?? 0);

  return (
    <div className="rounded-4 border border-slate-700/60 bg-slate-800/40 p-14 text-12">
      <div className="mb-10 text-11 font-semibold uppercase tracking-wide text-slate-400">
        {t`Why your assets don't decrease`}
      </div>
      <div className="space-y-6">
        <div className="flex justify-between">
          <span className="text-slate-400">{t`Spot (LP)`}</span>
          <span className="text-white">
            {rwaAmount > 0 ? `${rwaAmount} ${symbol}` : `— ${symbol}`}
            {spotValue > 0 && <span className="ml-6 text-slate-400">(${spotValue.toFixed(2)})</span>}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">{t`Short`}</span>
          <span className="text-red-300">{sizeDeltaUsd > 0 ? `−$${sizeDeltaUsd.toFixed(2)}` : "—"}</span>
        </div>
        <div className="flex justify-between border-t border-slate-700/60 pt-6 font-semibold">
          <span className="text-slate-400">{t`Net Value`}</span>
          <span className="text-green-400">
            {rwaAmount > 0 ? "$0.00" : "—"}
            {rwaAmount > 0 && <span className="ml-6 text-11 font-normal text-green-500">{t`Delta Neutral`}</span>}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CurrentPositionPanel — Section 4
// ---------------------------------------------------------------------------

type PositionPanelProps = {
  symbol: string;
  spotPriceUsd: number | null;
  sizeUsd: number;
  collateralUsd: number;
  averagePrice: number;
  collateralToken: "USDC" | "ETH";
  shouldConvertOnADL: boolean;
};

function CurrentPositionPanel({
  symbol,
  spotPriceUsd,
  sizeUsd,
  collateralUsd,
  averagePrice,
  collateralToken,
  shouldConvertOnADL,
}: PositionPanelProps) {
  const tokenAmount = averagePrice > 0 ? sizeUsd / averagePrice : 0;
  const currentPrice = spotPriceUsd ?? averagePrice;
  const pnl = sizeUsd - (currentPrice > 0 ? tokenAmount * currentPrice : sizeUsd);

  return (
    <>
      <div className="mb-12 flex items-center justify-between">
        <div className="text-12 font-medium text-slate-400">{t`Position`}</div>
        <div className="flex gap-8">
          <button className="hover:border-indigo-500 rounded-4 border border-stroke-primary px-12 py-6 text-12 text-slate-400 transition-colors hover:text-white">
            {t`Increase`}
          </button>
          <button className="border-red-800/50 rounded-4 border px-12 py-6 text-12 text-red-400 transition-colors hover:bg-red-900/20">
            {t`Close`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-16 sm:grid-cols-4">
        <div>
          <div className="text-11 text-slate-500">{t`Short Size`}</div>
          <div className="mt-4 text-15 font-semibold text-white">
            ${sizeUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </div>
          <div className="text-11 text-slate-500">
            ~{tokenAmount.toFixed(4)} {symbol}
          </div>
        </div>
        <div>
          <div className="text-11 text-slate-500">{t`Collateral`}</div>
          <div className="mt-4 text-15 font-semibold text-white">
            ${collateralUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </div>
          <div className="text-11 text-slate-500">{collateralToken}</div>
        </div>
        <div>
          <div className="text-11 text-slate-500">{t`Entry Price`}</div>
          <div className="mt-4 text-15 font-semibold text-white">
            {averagePrice > 0 ? `$${averagePrice.toFixed(4)}` : "—"}
          </div>
        </div>
        <div>
          <div className="text-11 text-slate-500">{t`Unrealised PnL`}</div>
          <div className={`mt-4 text-15 font-semibold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
          </div>
        </div>
      </div>

      {/* ADL mode badge */}
      <div className="mt-14 flex items-center gap-8">
        <span className="text-11 text-slate-500">{t`ADL Mode:`}</span>
        {shouldConvertOnADL ? (
          <span className="bg-blue-900/40 rounded-full px-10 py-3 text-11 font-medium text-blue-300">
            {t`Mode B — Convert to Paid-Short`}
          </span>
        ) : (
          <span className="rounded-full bg-slate-700/60 px-10 py-3 text-11 font-medium text-slate-400">
            {t`Mode A — Auto-Terminate`}
          </span>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function HedgeDetailPage() {
  const { key } = useParams<{ key: string }>();
  const history = useHistory();
  const { account } = useWallet();
  const { chainId } = useChainId();

  const cfg = VAULT_CONFIGS.find((v) => v.key === key);

  const mode: HedgeMode = "managed";
  const [marginToken, setMarginToken] = useState<HedgeMarginToken>("usdc");
  const [rwaAmountStr, setRwaAmountStr] = useState("");
  const [leverageStr, setLeverageStr] = useState("1");
  const [convertOnADL, setConvertOnADL] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1h");

  const { isSubmitting, error: actionError, txHash, validate, execute } = useHedgeActions();

  // Oracle spot price
  const spotPriceUsd = useRwaSpotPrice(cfg?.tokenAddress);

  // Price ticks for chart
  const priceTicks = usePriceTicker(chainId, cfg?.tokenAddress ?? "", cfg?.vaultAddress);

  // All on-chain stats
  const pageData = useHedgePageData(chainId, cfg, account ?? undefined);

  const rwaAmount = parseFloat(rwaAmountStr) || 0;
  const leverage = Math.max(1, parseFloat(leverageStr) || 1);

  const price = spotPriceUsd ?? 0;
  const sizeDeltaUsd = rwaAmount * price;
  const requiredCollateralUsd = sizeDeltaUsd / leverage;
  const requiredCollateralEth = requiredCollateralUsd / ETH_PRICE_USD;

  useEffect(() => {
    setValidationError(null);
  }, [rwaAmountStr, leverageStr, marginToken]);

  // ── Not found ──────────────────────────────────────────────────────────────

  if (!cfg || !cfg.tokenAddress || !cfg.vaultAddress) {
    return (
      <div className="w-full">
        <div className="border-b border-stroke-primary px-16 py-8">
          <AppHeader leftContent={<AppNav />} />
        </div>
        <div className="mt-48 text-center text-slate-400">
          <p>{t`Asset not found.`}</p>
          <button onClick={() => history.push("/hedge")} className="text-indigo-400 mt-8 text-14 underline">
            {t`Back to Hedge`}
          </button>
        </div>
      </div>
    );
  }

  // ── Execute ────────────────────────────────────────────────────────────────

  async function handleExecute() {
    if (!account || !cfg) return;

    const rwaAmountWad = parseEther(rwaAmountStr || "0");
    const sizeDeltaWad = parseEther(sizeDeltaUsd.toFixed(18));

    let collateralAmount: bigint;
    if (marginToken === "usdc") {
      collateralAmount = parseUnits(requiredCollateralUsd.toFixed(6), 6);
    } else {
      collateralAmount = parseEther(requiredCollateralEth.toFixed(18));
    }

    const params = {
      rwaToken: cfg.tokenAddress,
      rwaAmount: rwaAmountWad,
      collateralToken: USDC_ADDRESS,
      collateralAmount,
      indexToken: cfg.tokenAddress,
      sizeDelta: sizeDeltaWad,
    };

    const err = await validate(mode, marginToken, params);
    if (err) {
      setValidationError(err);
      return;
    }
    await execute(mode, marginToken, params, convertOnADL);
  }

  const canExecute = account && !isSubmitting && rwaAmount > 0 && !pageData.isHedgeDisabled;

  // Compute display values for Safety Buffer warning banner
  const frPct = pageData.fundingRateBps !== null ? (Math.abs(pageData.fundingRateBps) / 100).toFixed(2) : null;
  const bufferedYieldBps =
    pageData.yieldAprBps !== null && pageData.safetyBufferBps !== null
      ? pageData.yieldAprBps * (1 - pageData.safetyBufferBps / 10_000)
      : null;
  const bufferedYieldPct = bufferedYieldBps !== null ? (bufferedYieldBps / 100).toFixed(2) : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-stroke-primary px-16 py-8">
        <AppHeader leftContent={<AppNav />} />
      </div>

      <div className="mt-24 px-16 pb-40">
        {/* Back link + title */}
        <button
          onClick={() => history.push("/hedge")}
          className="mb-16 flex items-center gap-6 text-13 text-slate-400 hover:text-white"
        >
          ← {t`Hedge`}
        </button>

        <div className="mb-20 flex items-center gap-12">
          <div className="flex h-40 w-40 items-center justify-center rounded-full bg-slate-700 text-16 font-bold text-white">
            {cfg.symbol.slice(0, 2)}
          </div>
          <div>
            <h1 className="text-h1">
              {cfg.symbol} {t`Hedge`}
            </h1>
            <p className="text-13 text-slate-400">{cfg.name}</p>
          </div>
        </div>

        {/* ── Section 1: Status Bar ─────────────────────────────────────────── */}
        <HedgeStatusBar
          symbol={cfg.symbol}
          spotPriceUsd={spotPriceUsd}
          vaultAumUsd={pageData.vaultAumUsd}
          maxShortCapacityUsd={pageData.maxShortCapacityUsd}
          remainingCapacityUsd={pageData.remainingCapacityUsd}
          netApyBps={pageData.netApyBps}
          isHedgeDisabled={pageData.isHedgeDisabled}
          hedgeCapacityPct={pageData.hedgeCapacityPct}
          safetyBufferBps={pageData.safetyBufferBps}
          requiredBufferBps={pageData.requiredBufferBps}
        />

        {/* ── Section 2 + 3: Chart (left) + Action panel (right) ───────────── */}
        <div className="grid grid-cols-1 gap-24 lg:grid-cols-[1fr_420px]">
          {/* Left column: Price Chart + Summary + Current Position */}
          <div className="flex flex-col gap-24">
            {/* Price Chart */}
            <div className="bg-cold-blue-950 rounded-4 border border-stroke-primary p-24">
              <div className="mb-16">
                <h2 className="text-16 font-semibold text-white">
                  {cfg.symbol} {t`Price`}
                </h2>
                <p className="mt-2 text-12 text-slate-400">
                  {t`This is the price you're hedging against. A short position offsets any drop.`}
                </p>
              </div>

              <PriceChart
                events={priceTicks}
                timeFrame={timeFrame}
                onTimeFrameChange={setTimeFrame}
                isLoading={false}
              />
            </div>

            {/* Current Position (includes Status) */}
            <div className="bg-cold-blue-950 rounded-4 border border-stroke-primary p-24">
              <h3 className="mb-16 text-15 font-semibold text-white">{t`Current Position`}</h3>

              {/* Status: Yield vs Funding */}
              <div className="mb-20 border-b border-stroke-primary pb-20">
                <div className="mb-12 text-12 font-medium text-slate-400">{t`Status`}</div>
                <YieldMeter
                  yieldAprBps={pageData.yieldAprBps}
                  fundingRateBps={pageData.fundingRateBps}
                  netApyBps={pageData.netApyBps}
                />
              </div>

              {/* Soft-lock warning (Issue #180) */}
              {pageData.isSoftLockedPosition && (
                <div className="border-amber-800/50 bg-amber-900/20 text-amber-300 mb-16 rounded-4 border px-12 py-10 text-12">
                  <div className="mb-4 font-semibold">
                    ⚠️ {t`システム収益保護のため、現在一時的にFR相殺が停止されています`}
                  </div>
                  <div className="leading-relaxed text-amber-400/80">
                    {t`プロトコルのソルベンシー比率が低下したため、このポジションのファンディングレート相殺が一時的に停止されました。ソルベンシーが回復次第、自動的に復元されます。コラテラルおよびポジションは安全に保持されています。`}
                  </div>
                </div>
              )}

              {/* Position details */}
              {pageData.userPosition ? (
                <CurrentPositionPanel
                  symbol={cfg.symbol}
                  spotPriceUsd={spotPriceUsd}
                  sizeUsd={pageData.userPosition.sizeUsd}
                  collateralUsd={pageData.userPosition.collateralUsd}
                  averagePrice={pageData.userPosition.averagePrice}
                  collateralToken={pageData.userPosition.collateralToken}
                  shouldConvertOnADL={pageData.userPosition.shouldConvertOnADL}
                />
              ) : (
                <p className="text-13 text-slate-500">{t`No open short position. Use the form above to open one.`}</p>
              )}
            </div>
          </div>

          {/* Right: Action Panel */}
          <div className="bg-cold-blue-950 rounded-4 border border-stroke-primary p-24">
            {/* Mode badge */}
            <div className="mb-20 flex items-center gap-8">
              <span className="bg-indigo-600 rounded-full py-4 pl-0 pr-12 text-15 font-semibold text-white">
                {t`Open New Hedge`}
              </span>
              <p className="text-12 text-slate-500">{t`LP Deposit + Short in one transaction`}</p>
            </div>

            {/* Margin token toggle */}
            <div className="mb-16">
              <div className="mb-8 text-12 text-slate-400">{t`Short Margin`}</div>
              <div className="flex rounded-4 border border-stroke-primary">
                <button
                  onClick={() => setMarginToken("usdc")}
                  className={`flex-1 rounded-l-4 py-8 text-13 font-medium transition-colors ${
                    marginToken === "usdc"
                      ? "bg-slate-600 text-white"
                      : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                  }`}
                >
                  USDC
                </button>
                <button
                  onClick={() => setMarginToken("eth")}
                  className={`flex-1 rounded-r-4 py-8 text-13 font-medium transition-colors ${
                    marginToken === "eth"
                      ? "bg-slate-600 text-white"
                      : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                  }`}
                >
                  ETH
                </button>
              </div>
            </div>

            {/* RWA Amount input */}
            <div className="mb-16">
              <label className="mb-6 block text-12 text-slate-400">
                <span className="rounded bg-indigo-900/60 text-indigo-300 mr-6 px-6 py-1 text-11">
                  ① {t`LP Deposit`}
                </span>
                {cfg.symbol} {t`Amount`}
              </label>
              <NumberInput
                value={rwaAmountStr}
                onValueChange={(e) => setRwaAmountStr(e.target.value)}
                className="focus:border-indigo-500 w-full rounded-4 border border-stroke-primary bg-slate-800/60 px-12 py-10 text-14 text-white focus:outline-none"
                placeholder="0.00"
              />
              <p className="mt-4 text-11 text-slate-500">
                {t`Deposited to the LP Vault. You receive VLP shares in return.`}
              </p>
            </div>

            {/* Leverage input */}
            <div className="mb-16">
              <label className="mb-6 block text-12 text-slate-400">{t`Leverage`}</label>
              <NumberInput
                value={leverageStr}
                onValueChange={(e) => setLeverageStr(e.target.value)}
                className="focus:border-indigo-500 w-full rounded-4 border border-stroke-primary bg-slate-800/60 px-12 py-10 text-14 text-white focus:outline-none"
                placeholder="1"
              />
              <p className="mt-4 text-11 text-slate-500">{t`1× = delta-neutral. Higher = partial hedge.`}</p>
            </div>

            {/* ADL Mode toggle */}
            <div className="mb-16">
              <div className="mb-8 text-12 text-slate-400">{t`Emergency Behavior (ADL)`}</div>
              <div className="flex rounded-4 border border-stroke-primary">
                <button
                  onClick={() => setConvertOnADL(false)}
                  className={`flex-1 rounded-l-4 py-8 text-12 font-medium transition-colors ${
                    !convertOnADL ? "bg-slate-600 text-white" : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                  }`}
                >
                  {t`Close (Recommended)`}
                </button>
                <button
                  onClick={() => setConvertOnADL(true)}
                  className={`flex-1 rounded-r-4 py-8 text-12 font-medium transition-colors ${
                    convertOnADL ? "bg-blue-700 text-white" : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                  }`}
                >
                  {t`Convert to Paid-Short`}
                </button>
              </div>
              <p className="mt-4 text-11 text-slate-500">
                {convertOnADL
                  ? t`Position is kept as a normal short. Funding rate payments apply from ADL moment.`
                  : t`Position is closed and margin is returned when ADL is triggered.`}
              </p>
            </div>

            {/* Calculated amounts */}
            {spotPriceUsd !== null && (
              <div className="mb-16 rounded-4 bg-slate-800/40 p-14 text-13">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t`Oracle Price`}</span>
                  <span className="text-white">${spotPriceUsd.toFixed(4)}</span>
                </div>
                <div className="mt-10 space-y-6 border-t border-slate-700/60 pt-10">
                  <div className="text-11 font-medium uppercase tracking-wide text-slate-500">
                    {t`This transaction sends:`}
                  </div>
                  <div className="bg-indigo-900/20 flex items-center justify-between rounded-4 px-10 py-8">
                    <div className="flex items-center gap-6">
                      <span className="rounded bg-indigo-800/60 text-10 text-indigo-300 px-5 py-1 font-bold">①</span>
                      <span className="text-slate-300">{t`LP Deposit`}</span>
                    </div>
                    <span className="text-indigo-300 font-semibold">
                      {rwaAmount > 0 ? `${rwaAmount} ${cfg.symbol}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-4 bg-slate-700/30 px-10 py-8">
                    <div className="flex items-center gap-6">
                      <span className="rounded text-10 text-slate-300 bg-slate-600/60 px-5 py-1 font-bold">②</span>
                      <span className="text-slate-300">{t`Short Margin`}</span>
                    </div>
                    <span className="font-semibold text-white">
                      {marginToken === "usdc"
                        ? `${requiredCollateralUsd.toFixed(2)} USDC`
                        : `${requiredCollateralEth.toFixed(6)} ETH`}
                    </span>
                  </div>
                </div>

                {/* Delta Neutral explanation — below "This transaction sends:" */}
                <div className="mt-12">
                  <DeltaNeutralBox
                    symbol={cfg.symbol}
                    rwaAmount={rwaAmount}
                    spotPriceUsd={spotPriceUsd}
                    sizeDeltaUsd={sizeDeltaUsd}
                  />
                </div>
              </div>
            )}

            {/* Errors / Success */}
            {(validationError || actionError) && (
              <div className="mb-16 rounded-4 bg-red-900/30 px-12 py-8 text-12 text-red-400">
                {validationError ?? actionError}
              </div>
            )}
            {txHash && (
              <div className="mb-16 rounded-4 bg-green-900/30 px-12 py-8 text-12 text-green-400">
                {t`Transaction submitted:`} {txHash.slice(0, 20)}…
              </div>
            )}

            {/* Safety Buffer Lock warning banner */}
            {pageData.isHedgeDisabled && (
              <div className="border-yellow-800/50 mb-16 rounded-4 border bg-yellow-900/20 px-12 py-10 text-12 text-yellow-300">
                <div className="mb-4 font-semibold">⚠ {t`New Hedges Temporarily Paused`}</div>
                <div className="leading-relaxed text-yellow-400/80">
                  {frPct !== null && bufferedYieldPct !== null
                    ? `${t`The current funding rate`} (${frPct}%) ${t`exceeds the buffered RWA yield`} (${bufferedYieldPct}%), ${t`risking insolvency. New hedge positions are blocked. Trade mode remains available.`}`
                    : t`New hedge positions are temporarily blocked due to the Safety Buffer Lock. Trade mode remains available.`}
                </div>
              </div>
            )}

            {/* Execute button */}
            {!account ? (
              <div className="rounded-4 bg-slate-700/50 py-14 text-center text-14 text-slate-400">
                {t`Connect wallet to hedge`}
              </div>
            ) : (
              <button
                onClick={handleExecute}
                disabled={!canExecute}
                className={`w-full rounded-4 py-14 text-15 font-semibold transition-colors ${
                  canExecute
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                    : "cursor-not-allowed bg-slate-700 text-slate-500"
                }`}
              >
                {isSubmitting ? t`Submitting…` : t`Deposit ${cfg.symbol} + Open Short`}
              </button>
            )}

            <p className="mt-12 text-center text-11 text-slate-600">
              {t`Short position requests are executed by Keepers (GMX V1 two-step flow).`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
