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
import { formatDistanceToNow } from "date-fns";
import { Contract, formatEther, formatUnits, parseEther, parseUnits } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { useHistory, useParams } from "react-router-dom";

import type { TimeFrame } from "domain/vantage/chart/types";
import { usePriceTicker } from "domain/vantage/chart/usePriceTicker";
import { useHedgeActions } from "domain/vantage/hedge/useHedgeActions";
import type { HedgeMarginToken, HedgeMode } from "domain/vantage/hedge/useHedgeActions";
import { useHedgePageData } from "domain/vantage/hedge/useHedgePageData";
import { useJuniorVaultLiquidity } from "domain/vantage/useJuniorVaultLiquidity";
import { VAULT_CONFIGS } from "domain/vantage/vaults/vaultConfig";
import { useChainId } from "lib/chains";
import { getProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";
import { PriceChart } from "pages/Trade/components/PriceChart";
import { getVantageContractAddress } from "vantage/contracts";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";
import { Vault__factory } from "vantage/types";

import { AppHeader } from "components/AppHeader/AppHeader";
import { AppNav } from "components/AppNav/AppNav";
import NumberInput from "components/NumberInput/NumberInput";
import Tooltip from "components/Tooltip/Tooltip";
import { VantageLeverageSlider } from "components/VantageLeverageSlider/VantageLeverageSlider";
import { VantagePageContainer } from "components/VantagePageContainer/VantagePageContainer";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ETH_PRICE_USD = 2000;

const ERC20_BALANCE_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;

const USDC_ADDRESS = (localhostDeployment.addresses as { tokens?: { USDC?: string } }).tokens?.USDC ?? "";
const POLL_MS = 15_000;

// Static style objects (module-level to avoid new objects on each render)
const STYLE_ACCENT_BG_08 = { background: "rgba(236,255,62,0.08)" } as const;
const STYLE_ACCENT_BG_12 = { background: "rgba(236,255,62,0.12)" } as const;
const STYLE_ACCENT_BG_18 = { background: "rgba(236,255,62,0.18)" } as const;

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
// useRwaSpotPrice — fetches oracle price via vault.getMinPrice()
// ---------------------------------------------------------------------------

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

function useRwaSpotPrice(tokenAddress: string | undefined): number | null {
  const { chainId } = useChainId();
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!tokenAddress) return;

    let vaultAddr: string;
    try {
      vaultAddr = getVantageContractAddress(chainId, "JuniorTrancheVault");
    } catch {
      return;
    }
    if (!vaultAddr || vaultAddr === ZERO_ADDR) return;

    const provider = getProvider(undefined, chainId);
    const vault = Vault__factory.connect(vaultAddr, provider);
    let cancelled = false;

    async function poll() {
      try {
        const raw = await vault.getMinPrice(tokenAddress!);
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
// useWalletBalances — fetches RWA, USDC, and native ETH balances
// ---------------------------------------------------------------------------

interface WalletBalances {
  rwaBalance: number | null;
  usdcBalance: number | null;
  ethBalance: number | null;
}

function useWalletBalances(chainId: number, account: string | undefined, rwaToken: string | undefined): WalletBalances {
  const [balances, setBalances] = useState<WalletBalances>({
    rwaBalance: null,
    usdcBalance: null,
    ethBalance: null,
  });

  useEffect(() => {
    if (!account || !rwaToken) return;

    const provider = getProvider(undefined, chainId);
    let cancelled = false;

    async function poll() {
      try {
        const rwaContract = new Contract(rwaToken!, ERC20_BALANCE_ABI, provider);
        const usdcContract = USDC_ADDRESS ? new Contract(USDC_ADDRESS, ERC20_BALANCE_ABI, provider) : null;

        const [rwaRaw, rwaDecimals, ethRaw] = await Promise.all([
          rwaContract.balanceOf(account),
          rwaContract.decimals().catch(() => 18),
          provider.getBalance(account!),
        ]);
        const usdcRaw: bigint = usdcContract ? await usdcContract.balanceOf(account).catch(() => 0n) : 0n;

        if (!cancelled) {
          setBalances({
            rwaBalance: parseFloat(formatUnits(rwaRaw, rwaDecimals)),
            usdcBalance: parseFloat(formatUnits(usdcRaw, 6)),
            ethBalance: parseFloat(formatEther(ethRaw)),
          });
        }
      } catch {
        // leave previous values intact
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [chainId, account, rwaToken]);

  return balances;
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
    <div className="mb-24 rounded-4 border border-vantage-border bg-vantage-base p-20">
      <div className="grid grid-cols-2 gap-16 sm:grid-cols-4">
        {/* Current price */}
        <div>
          <div className="text-14 text-slate-500">
            {symbol} {t`Price`}
          </div>
          <div className="mt-4 text-15 font-semibold text-white">
            {spotPriceUsd !== null ? `$${spotPriceUsd.toFixed(4)}` : "—"}
          </div>
          <div className="mt-2 text-14 text-slate-500">{t`Oracle price`}</div>
        </div>

        {/* TVL Protected */}
        <div>
          <div className="text-14 text-slate-500">{t`Vault AUM`}</div>
          <div className="mt-4 text-15 font-semibold text-white">{fmtUsd(vaultAumUsd, 0)}</div>
        </div>

        {/* Remaining hedge capacity */}
        <div>
          <div className="text-14 text-slate-500">{t`Remaining Capacity`}</div>
          <div className="mt-4 text-15 font-semibold text-white">{fmtUsd(remainingCapacityUsd, 0)}</div>
          {usedPct !== null && (
            <div className="mt-6">
              <div className="mb-2 flex justify-between text-14 text-slate-500">
                <span>{t`Used`}</span>
                <span>{usedPct.toFixed(1)}%</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-700">
                <div className="h-full rounded-full bg-vantage-accent transition-all" style={progressBarStyle} />
              </div>
            </div>
          )}
        </div>

        {/* System Status (Safety Buffer Lock) */}
        <div className="flex flex-col">
          <div className="text-14 text-slate-500">{t`System Status`}</div>
          <div className="mt-4">
            <span
              className={`inline-flex items-center gap-5 rounded-full px-8 py-3 text-14 font-semibold ${sc.bg} ${sc.text}`}
            >
              <span className={`h-6 w-6 rounded-full ${sc.dot}`} />
              {sc.label}
            </span>
          </div>
          {hedgeCapacityPct !== null && (
            <div className="mt-6">
              <div className="mb-2 flex justify-between text-14 text-slate-500">
                <span>{t`FR / Buffered Yield`}</span>
                <span>{hedgeCapacityPct.toFixed(0)}%</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-700">
                <div className={`h-full rounded-full transition-all ${sc.bar}`} style={capacityBarStyle} />
              </div>
            </div>
          )}
          {systemStatus === "healthy" && netApyBps !== null && netApyBps > 0 && (
            <div className="mt-4 text-14 text-green-500">{t`You are being paid to hedge`}</div>
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
                        className={`inline-flex cursor-help items-center gap-5 rounded-full px-8 py-3 text-14 font-medium ${
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
// HedgeSafetyDashboard — ADL protection status for this position
// ---------------------------------------------------------------------------

type HedgeSafetyDashboardProps = {
  sizeUsd: number;
  collateralUsd: number;
  openedAtMs: number;
  shouldConvertOnADL: boolean;
};

function HedgeSafetyDashboard({ sizeUsd, collateralUsd, openedAtMs, shouldConvertOnADL }: HedgeSafetyDashboardProps) {
  const lev = collateralUsd > 0 ? sizeUsd / collateralUsd : 0;
  const ageMs = Date.now() - openedAtMs;
  const ageDays = Math.floor(ageMs / 86_400_000);
  const loyaltyLabel = openedAtMs > 0 ? formatDistanceToNow(new Date(openedAtMs), { addSuffix: false }) : "—";

  const risk: "low" | "warning" | "high" = lev >= 5 ? "high" : lev >= 3 || ageDays < 7 ? "warning" : "low";

  const BADGE: Record<string, string> = {
    low: "bg-green-900/60 text-green-400 border border-green-700",
    warning: "bg-yellow-900/60 text-yellow-400 border border-yellow-700",
    high: "bg-red-900/60 text-red-400 border border-red-700",
  };
  const LABEL: Record<string, string> = { low: "Safe", warning: "Warning", high: "High Risk" };

  return (
    <div className="mb-16 rounded-4 border border-vantage-border bg-vantage-base p-16">
      <div className="mb-12 flex items-center justify-between">
        <span className="text-12 font-medium text-slate-400">{t`Hedge Protection Status (Phase 4 ADL)`}</span>
        <span className={`rounded-full px-10 py-3 text-11 font-medium ${BADGE[risk]}`}>{LABEL[risk]}</span>
      </div>

      <div className="grid grid-cols-3 gap-12 text-center">
        <div>
          <p className="text-10 text-slate-500">{t`Leverage`}</p>
          <p
            className={`text-13 font-medium ${lev >= 5 ? "text-red-400" : lev >= 3 ? "text-yellow-400" : "text-green-400"}`}
          >
            {lev.toFixed(1)}×
          </p>
        </div>
        <div>
          <p className="text-10 text-slate-500">{t`Loyalty Timer`}</p>
          <p
            className={`text-13 font-medium ${ageDays >= 30 ? "text-green-400" : ageDays >= 7 ? "text-yellow-400" : "text-red-400"}`}
          >
            {loyaltyLabel}
          </p>
        </div>
        <div>
          <p className="text-10 text-slate-500">{t`ADL Mode`}</p>
          <p className={`text-13 font-medium ${shouldConvertOnADL ? "text-slate-400" : "text-orange-400"}`}>
            {shouldConvertOnADL ? t`Mode B` : t`Mode A ⚠`}
          </p>
        </div>
      </div>

      {risk === "low" && (
        <p className="mt-10 text-11 text-green-700">{t`Low leverage and long tenure protect you. You are in the loyalty tier.`}</p>
      )}
      {risk === "warning" && (
        <p className="text-yellow-700 mt-10 text-11">{t`Consider reducing leverage to improve your ADL protection ranking.`}</p>
      )}
      {risk === "high" && (
        <p className="mt-10 text-11 text-red-700">{t`High leverage increases ADL priority. Reduce leverage or hold longer to improve protection.`}</p>
      )}
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
          <button className="rounded-4 border border-vantage-border px-12 py-6 text-12 text-vantage-text-secondary transition-colors hover:text-white">
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
          <span className="rounded-full px-10 py-3 text-11 font-medium text-vantage-accent" style={STYLE_ACCENT_BG_12}>
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
  const [leverage, setLeverage] = useState(1);
  const [convertOnADL, setConvertOnADL] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1h");

  const { isSubmitting, error: actionError, txHash, validate, execute } = useHedgeActions();
  const { hasLiquidity } = useJuniorVaultLiquidity(chainId);

  // For Prism axis configs, the LP deposit token differs from the oracle index token.
  // collateralTokenAddress = real ERC20 users hold (e.g. sUSDe ERC4626).
  // tokenAddress           = virtual index token for oracle/perp routing.
  const rwaToken = cfg?.collateralTokenAddress || cfg?.tokenAddress;
  const rwaSymbol = cfg?.collateralSymbol ?? cfg?.symbol ?? "";

  // Oracle spot price (always based on the virtual index token for accurate perp pricing)
  const spotPriceUsd = useRwaSpotPrice(cfg?.tokenAddress);

  // Wallet balances (based on the real collateral token users actually hold)
  const walletBalances = useWalletBalances(chainId, account ?? undefined, rwaToken);

  // Price ticks for chart
  const priceTicks = usePriceTicker(chainId, cfg?.tokenAddress ?? "", cfg?.vaultAddress);

  // All on-chain stats
  const pageData = useHedgePageData(chainId, cfg, account ?? undefined);

  const rwaAmount = parseFloat(rwaAmountStr) || 0;

  const price = spotPriceUsd ?? 0;
  const sizeDeltaUsd = rwaAmount * price;
  const requiredCollateralUsd = sizeDeltaUsd / leverage;
  const requiredCollateralEth = requiredCollateralUsd / ETH_PRICE_USD;

  useEffect(() => {
    setValidationError(null);
  }, [rwaAmountStr, leverage, marginToken]);

  // ── Not found ──────────────────────────────────────────────────────────────

  if (!cfg || !cfg.tokenAddress || !cfg.vaultAddress) {
    return (
      <div className="min-h-screen w-full bg-vantage-bg">
        <div className="border-b border-b-vantage-border px-16 py-8">
          <AppHeader leftContent={<AppNav />} />
        </div>
        <div className="mt-48 text-center text-vantage-text-secondary">
          <p>{t`Asset not found.`}</p>
          <button onClick={() => history.push("/hedge")} className="mt-8 text-14 text-vantage-accent underline">
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
      rwaToken: cfg.collateralTokenAddress || cfg.tokenAddress,
      rwaAmount: rwaAmountWad,
      collateralToken: USDC_ADDRESS,
      collateralAmount,
      indexToken: cfg.tokenAddress,
      sizeDelta: sizeDeltaWad,
      priceAdapter: cfg.adapterAddress ?? "",
    };

    const err = await validate(mode, marginToken, params);
    if (err) {
      setValidationError(err);
      return;
    }
    await execute(mode, marginToken, params, convertOnADL);
  }

  // Balance validation
  const rwaShortfall =
    account && walletBalances.rwaBalance !== null && rwaAmount > 0
      ? Math.max(0, rwaAmount - walletBalances.rwaBalance)
      : 0;
  const marginShortfall =
    account && marginToken === "usdc" && walletBalances.usdcBalance !== null
      ? Math.max(0, requiredCollateralUsd - walletBalances.usdcBalance)
      : account && marginToken === "eth" && walletBalances.ethBalance !== null
        ? Math.max(0, requiredCollateralEth - walletBalances.ethBalance)
        : 0;
  const rwaShortfallUsd = rwaShortfall * price;
  const marginShortfallUsd = marginToken === "usdc" ? marginShortfall : marginShortfall * ETH_PRICE_USD;
  const totalShortfallUsd = rwaShortfallUsd + marginShortfallUsd;
  const hasInsufficientBalance = !!account && rwaAmount > 0 && totalShortfallUsd > 0.001;

  // Also block submit while assetType is loading (Issue #201: prevents mode-ambiguous tx)
  const isModeLoading = pageData.isYieldBearing === undefined;
  // Capacity checks
  // isCapacityFull: remaining is known and exhausted → block new hedges entirely
  const isCapacityFull = pageData.remainingCapacityUsd !== null && pageData.remainingCapacityUsd <= 0;
  // exceedsCapacity: user's requested size exceeds the remaining room
  const exceedsCapacity =
    pageData.remainingCapacityUsd !== null &&
    pageData.remainingCapacityUsd > 0 &&
    sizeDeltaUsd > pageData.remainingCapacityUsd;
  // Maximum hedgeable RWA amount given remaining capacity and current price
  const maxAllowedRwaAmount =
    pageData.remainingCapacityUsd !== null && spotPriceUsd !== null && spotPriceUsd > 0
      ? pageData.remainingCapacityUsd / spotPriceUsd
      : null;

  const canExecute =
    account &&
    !isSubmitting &&
    rwaAmount > 0 &&
    !pageData.isHedgeDisabled &&
    !hasInsufficientBalance &&
    !isModeLoading &&
    hasLiquidity &&
    !isCapacityFull &&
    !exceedsCapacity;

  // Compute display values for Safety Buffer warning banner
  const frPct = pageData.fundingRateBps !== null ? (Math.abs(pageData.fundingRateBps) / 100).toFixed(2) : null;
  const bufferedYieldBps =
    pageData.yieldAprBps !== null && pageData.safetyBufferBps !== null
      ? pageData.yieldAprBps * (1 - pageData.safetyBufferBps / 10_000)
      : null;
  const bufferedYieldPct = bufferedYieldBps !== null ? (bufferedYieldBps / 100).toFixed(2) : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen w-full bg-vantage-bg">
      {/* Header */}
      <div className="border-b border-b-vantage-border px-16 py-8">
        <AppHeader leftContent={<AppNav />} />
      </div>

      <VantagePageContainer>
        {/* Back link + title */}
        <button
          onClick={() => history.push("/hedge")}
          className="mb-16 flex items-center gap-6 text-13 text-slate-400 hover:text-white"
        >
          ← {t`Hedge`}
        </button>

        <div className="mb-20 flex items-center gap-12">
          {cfg.imageUrl ? (
            <img src={cfg.imageUrl} alt={cfg.name} className="h-56 w-56 rounded-full object-cover" />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-full bg-slate-700 text-16 font-bold text-white">
              {cfg.symbol.slice(0, 2)}
            </div>
          )}
          <div>
            <h1 className="text-h1">
              {cfg.name} {t`Hedge`}
            </h1>
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
            <div className="rounded-4 border border-vantage-border bg-vantage-base p-24">
              <div className="mb-16">
                <h2 className="text-16 font-semibold text-white">
                  {cfg.symbol} {t`Price`}
                </h2>
                <p className="mt-2 text-14 text-slate-400">
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
            <div className="rounded-4 border border-vantage-border bg-vantage-base p-24">
              <h3 className="mb-16 text-16 font-semibold text-white">{t`Current Position`}</h3>

              {/* Status: Yield vs Funding */}
              <div className="mb-20 border-b border-b-vantage-border pb-20">
                <div className="mb-12 flex items-center justify-between">
                  <div className="text-12 font-medium text-slate-400">{t`Status`}</div>
                  {/* Mode badge (Issue #201) — derived from AssetRegistry.assetType */}
                  {pageData.isYieldBearing === undefined ? (
                    <span className="animate-pulse rounded-full bg-slate-700 px-10 py-3 text-11 text-slate-500">
                      {t`Loading…`}
                    </span>
                  ) : pageData.isYieldBearing ? (
                    <span className="rounded-full bg-green-900/40 px-10 py-3 text-11 font-medium text-green-400">
                      {t`Mode A — Yield + Premium Offset`}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-700/60 px-10 py-3 text-11 font-medium text-slate-400">
                      {t`Mode B — Premium Only`}
                    </span>
                  )}
                </div>
                <YieldMeter
                  yieldAprBps={pageData.isYieldBearing ? pageData.yieldAprBps : 0}
                  fundingRateBps={pageData.fundingRateBps}
                  netApyBps={pageData.isYieldBearing ? pageData.netApyBps : pageData.fundingRateBps}
                />
                {/* Mode B explanation */}
                {pageData.isYieldBearing === false && (
                  <p className="mt-10 text-11 text-slate-500">
                    {t`This token earns no yield. Hedge cost = funding rate only.`}
                  </p>
                )}
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
                <>
                  <HedgeSafetyDashboard
                    sizeUsd={pageData.userPosition.sizeUsd}
                    collateralUsd={pageData.userPosition.collateralUsd}
                    openedAtMs={0}
                    shouldConvertOnADL={pageData.userPosition.shouldConvertOnADL}
                  />
                  <CurrentPositionPanel
                    symbol={cfg.symbol}
                    spotPriceUsd={spotPriceUsd}
                    sizeUsd={pageData.userPosition.sizeUsd}
                    collateralUsd={pageData.userPosition.collateralUsd}
                    averagePrice={pageData.userPosition.averagePrice}
                    collateralToken={pageData.userPosition.collateralToken}
                    shouldConvertOnADL={pageData.userPosition.shouldConvertOnADL}
                  />
                </>
              ) : (
                <p className="text-13 text-slate-500">{t`No open short position. Use the form above to open one.`}</p>
              )}
            </div>
          </div>

          {/* Right: Action Panel — Step-based Calculator */}
          <div className="rounded-4 border border-vantage-border bg-vantage-base p-24">
            {/* Header */}
            <div className="mb-24">
              <h2 className="text-16 font-semibold text-white">{t`Open New Hedge`}</h2>
              <p className="mt-4 text-12 text-slate-500">{t`LP Deposit + Short in one transaction`}</p>
            </div>

            {/* ── Capacity Full Notice ────────────────────────────────── */}
            {isCapacityFull && (
              <div className="flex flex-col items-center py-40 text-center">
                <h3 className="text-18 mb-10 font-bold text-white">{t`受付停止中`}</h3>
                <p className="leading-relaxed text-slate-300 mb-6 max-w-[300px] text-14">
                  {t`おかげさまで現在のヘッジ枠はすべて埋まっております。`}
                </p>
                <p className="leading-relaxed max-w-[300px] text-13 text-slate-400">
                  {t`空き枠ができ次第、新規受付を再開いたします。次回の受付開始まで今しばらくお待ちください。`}
                </p>
                <div className="mt-24 rounded-4 border border-slate-600/40 bg-slate-800/60 px-20 py-14 text-13">
                  <div className="text-slate-400">{t`Remaining Capacity`}</div>
                  <div className="text-18 mt-4 font-bold text-white">$0</div>
                </div>
                {pageData.maxShortCapacityUsd !== null && (
                  <p className="mt-12 text-12 text-slate-500">
                    {t`Total capacity`}: {fmtUsd(pageData.maxShortCapacityUsd, 0)}
                  </p>
                )}
              </div>
            )}

            {/* ── Step 1: Protection Target ─────────────────────────── */}
            {!isCapacityFull && (
              <>
                <div className="mb-24">
                  <div className="mb-14 flex items-center gap-10">
                    <div className="flex h-22 w-22 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ecff3e] to-[#a3e635] text-11 font-bold text-black">
                      1
                    </div>
                    <div>
                      <div className="text-13 font-semibold text-white">{t`Protection Target`}</div>
                      <div className="text-11 text-slate-500">{t`How much do you want to hedge?`}</div>
                    </div>
                  </div>

                  <div className="rounded-4 border border-vantage-border bg-vantage-input px-16 py-12">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-11 text-slate-400">
                        {rwaSymbol} {t`Amount`}
                      </span>
                      {account && walletBalances.rwaBalance !== null && (
                        <span className={`text-11 ${rwaShortfall > 0 ? "text-red-400" : "text-slate-500"}`}>
                          {t`Balance`}: {walletBalances.rwaBalance.toFixed(4)} {rwaSymbol}
                        </span>
                      )}
                    </div>
                    <NumberInput
                      value={rwaAmountStr}
                      onValueChange={(e) => setRwaAmountStr(e.target.value)}
                      className="bg-transparent w-full text-[36px] font-semibold text-white outline-none placeholder:text-slate-600"
                      placeholder="0.00"
                    />
                    {rwaAmount > 0 && spotPriceUsd !== null && (
                      <div className="mt-6 text-12 text-slate-400">
                        {rwaAmount} {rwaSymbol}{" "}
                        <span className="text-slate-300">
                          (≈ ${(rwaAmount * spotPriceUsd).toLocaleString("en-US", { maximumFractionDigits: 2 })})
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="mt-6 text-11 text-slate-500">
                    {t`Deposited to the LP Vault. You receive VLP shares in return.`}
                  </p>

                  {/* Capacity exceeded alert */}
                  {exceedsCapacity && pageData.remainingCapacityUsd !== null && (
                    <div className="border-orange-700/50 bg-orange-900/20 text-orange-300 mt-10 rounded-4 border px-12 py-10 text-12">
                      <div className="mb-4 font-semibold">⚠ {t`入力サイズが残余容量を超えています`}</div>
                      <div className="leading-relaxed text-orange-400/80">
                        {t`リクエストサイズ`}{" "}
                        <span className="text-orange-200 font-semibold">{fmtUsd(sizeDeltaUsd, 0)}</span> {t`が残余容量`}{" "}
                        <span className="text-orange-200 font-semibold">
                          {fmtUsd(pageData.remainingCapacityUsd, 0)}
                        </span>{" "}
                        {t`を超えています。`}
                        {maxAllowedRwaAmount !== null && (
                          <>
                            <br />
                            {t`最大入力可能量：`}
                            <button
                              onClick={() => setRwaAmountStr(maxAllowedRwaAmount.toFixed(4))}
                              className="text-orange-200 ml-4 font-semibold underline hover:text-white"
                            >
                              {maxAllowedRwaAmount.toFixed(4)} {rwaSymbol}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mode indicator (Issue #201) — auto-detected from AssetRegistry */}
                  <div className="mt-10">
                    {pageData.isYieldBearing === undefined ? (
                      <div className="animate-pulse rounded-4 bg-slate-800/40 px-12 py-8 text-11 text-slate-500">
                        {t`Detecting collateral mode…`}
                      </div>
                    ) : pageData.isYieldBearing ? (
                      <div className="rounded-4 bg-green-900/20 px-12 py-8 text-11 text-green-400">
                        ✦ {t`Mode A — Yield-Bearing`}
                        <span className="ml-6 text-green-600">
                          {t`Your staking yield offsets the hedge premium. Net cost may be positive.`}
                        </span>
                      </div>
                    ) : (
                      <div className="rounded-4 bg-slate-800/40 px-12 py-8 text-11 text-slate-400">
                        ○ {t`Mode B — Stablecoin`}
                        <span className="ml-6 text-slate-500">{t`No yield earned. Hedge cost = funding rate only.`}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="mb-24 border-t border-slate-700/40" />

                {/* ── Step 2: Risk Management ───────────────────────────── */}
                <div
                  className={`mb-24 transition-opacity duration-200 ${rwaAmount === 0 ? "pointer-events-none opacity-35" : ""}`}
                >
                  <div className="mb-14 flex items-center gap-10">
                    <div
                      className={`flex h-22 w-22 shrink-0 items-center justify-center rounded-full text-11 font-bold transition-colors duration-200 ${rwaAmount > 0 ? "bg-gradient-to-br from-[#ecff3e] to-[#a3e635] text-black" : "bg-slate-700 text-slate-400"}`}
                    >
                      2
                    </div>
                    <div>
                      <div
                        className={`text-13 font-semibold transition-colors duration-200 ${rwaAmount > 0 ? "text-white" : "text-slate-500"}`}
                      >{t`Risk Management`}</div>
                      <div className="text-11 text-slate-500">{t`Leverage & Margin`}</div>
                    </div>
                  </div>

                  {/* Margin token selector */}
                  <div className="mb-14">
                    <div className="mb-6 text-11 text-slate-400">{t`Margin Token`}</div>
                    <div className="flex gap-8">
                      {(["usdc", "eth"] as HedgeMarginToken[]).map((token) => (
                        <button
                          key={token}
                          onClick={() => setMarginToken(token)}
                          className={`rounded-4 px-12 py-6 text-12 font-medium transition-colors ${marginToken === token ? "bg-vantage-accent text-black" : "bg-vantage-input text-vantage-text-secondary"}`}
                        >
                          {token.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Leverage slider */}
                  <div className="mb-14">
                    <VantageLeverageSlider value={leverage} onChange={setLeverage} max={10} />
                    <p className="mt-4 text-11 text-slate-500">{t`1× = delta-neutral. Higher = partial hedge.`}</p>
                  </div>

                  {/* Auto-calculated margin */}
                  <div className="rounded-4 border border-slate-700/40 bg-slate-800/30 p-14">
                    <div className="mb-8 text-11 font-medium uppercase tracking-wide text-slate-500">
                      {t`Required Margin (Auto-Calculated)`}
                    </div>
                    <div className="flex items-end justify-between gap-8">
                      <div>
                        <div className="text-22 font-semibold text-white">
                          {marginToken === "usdc"
                            ? `${requiredCollateralUsd > 0 ? requiredCollateralUsd.toFixed(2) : "0.00"} USDC`
                            : `${requiredCollateralEth > 0 ? requiredCollateralEth.toFixed(6) : "0.000000"} ETH`}
                        </div>
                        <div className="mt-2 text-11 text-slate-500">
                          = {cfg.symbol} × {spotPriceUsd !== null ? `$${spotPriceUsd.toFixed(2)}` : "price"} ÷{" "}
                          {leverage}×
                        </div>
                      </div>
                      {account && (
                        <div
                          className={`shrink-0 text-right text-11 ${marginShortfall > 0 ? "text-red-400" : "text-green-400"}`}
                        >
                          <div className="mt-5 text-11 text-slate-500">{t`Token Balance`}</div>
                          {marginToken === "usdc" && walletBalances.usdcBalance !== null && (
                            <>
                              {marginShortfall > 0 ? "✗" : "✓"} ${walletBalances.usdcBalance.toFixed(2)}
                            </>
                          )}
                          {marginToken === "eth" && walletBalances.ethBalance !== null && (
                            <>
                              {marginShortfall > 0 ? "✗" : "✓"} {walletBalances.ethBalance.toFixed(4)} ETH
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Insufficient balance error */}
                    {hasInsufficientBalance && (
                      <div className="mt-10 rounded-4 bg-red-900/30 px-10 py-8 text-12 text-red-400">
                        {t`残高が`} ${totalShortfallUsd.toFixed(2)} {t`不足しています`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="mb-24 border-t border-slate-700/40" />

                {/* ── Step 3: Emergency Behavior (ADL) ─────────────────── */}
                <div
                  className={`mb-20 transition-opacity duration-200 ${rwaAmount === 0 ? "pointer-events-none opacity-35" : ""}`}
                >
                  <div className="mb-14 flex items-center gap-10">
                    <div
                      className={`flex h-22 w-22 shrink-0 items-center justify-center rounded-full text-11 font-bold transition-colors duration-200 ${rwaAmount > 0 ? "bg-gradient-to-br from-[#ecff3e] to-[#a3e635] text-black" : "bg-slate-700 text-slate-400"}`}
                    >
                      3
                    </div>
                    <div>
                      <div
                        className={`text-13 font-semibold transition-colors duration-200 ${rwaAmount > 0 ? "text-white" : "text-slate-500"}`}
                      >{t`FR Payment Response`}</div>
                      <div className="text-11 text-slate-500">{t`What happens when funding rate is triggered?`}</div>
                    </div>
                  </div>

                  <div className="flex rounded-4 border border-vantage-border">
                    <button
                      onClick={() => setConvertOnADL(false)}
                      className={`flex-1 rounded-l-4 py-10 text-12 font-medium transition-colors ${!convertOnADL ? "bg-vantage-accent text-black" : "text-vantage-text-secondary"}`}
                    >
                      {t`Auto-Close`}
                    </button>
                    <button
                      onClick={() => setConvertOnADL(true)}
                      className={`flex-1 rounded-r-4 py-10 text-12 font-medium transition-colors ${convertOnADL ? "bg-vantage-accent text-black" : "text-vantage-text-secondary"}`}
                    >
                      {t`Convert to Paid-Short`}
                    </button>
                  </div>
                  <p className="leading-relaxed mt-8 rounded-4 bg-slate-800/40 px-12 py-8 text-11 text-slate-400">
                    {convertOnADL
                      ? t`Keep position open as a standard short. FR payments will apply from the ADL moment onward.`
                      : t`Position closes automatically and margin is returned when ADL is triggered.`}
                  </p>
                </div>

                {/* Transaction summary */}
                {spotPriceUsd !== null && rwaAmount > 0 && (
                  <div className="mb-16 rounded-4 bg-slate-800/40 p-14 text-13">
                    <div className="mb-8 text-11 font-medium uppercase tracking-wide text-slate-500">
                      {t`This transaction sends:`}
                    </div>
                    <div className="space-y-6">
                      <div
                        className="flex items-center justify-between rounded-4 px-10 py-8"
                        style={STYLE_ACCENT_BG_08}
                      >
                        <div className="flex items-center gap-6">
                          <span
                            className="rounded text-10 px-5 py-1 font-bold text-vantage-accent"
                            style={STYLE_ACCENT_BG_18}
                          >
                            ①
                          </span>
                          <span className="text-slate-300">{t`LP Deposit`}</span>
                        </div>
                        <span className="font-semibold text-vantage-accent">
                          {rwaAmount} {rwaSymbol}
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
                    <div className="mt-12">
                      <DeltaNeutralBox
                        symbol={rwaSymbol}
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

                {/* No liquidity warning */}
                {!hasLiquidity && (
                  <div className="mb-16 rounded-4 border border-slate-600/40 bg-slate-800/60 px-12 py-10 text-12 text-slate-400">
                    <div className="text-slate-300 mb-4 font-semibold">{t`No Payout Liquidity`}</div>
                    <div className="leading-relaxed">
                      {t`The payout vault (Junior) has no USDC deposits. Hedge positions cannot be opened until an LP deposit is made.`}
                    </div>
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
                  <button
                    disabled
                    className="w-full cursor-not-allowed rounded-4 border border-vantage-border py-14 text-15 font-semibold text-slate-500"
                  >
                    {t`Connect wallet to hedge`}
                  </button>
                ) : (
                  <button
                    onClick={handleExecute}
                    disabled={!canExecute}
                    className={`w-full rounded-4 py-14 text-15 font-semibold transition-colors disabled:cursor-not-allowed ${canExecute ? "bg-gradient-to-r from-[#ecff3e] to-[#a3e635] text-black" : "bg-[#334155] text-[#64748b]"}`}
                  >
                    {isSubmitting
                      ? t`Submitting…`
                      : !hasLiquidity
                        ? t`No Liquidity`
                        : isModeLoading
                          ? t`Detecting mode…`
                          : exceedsCapacity
                            ? t`Exceeds Remaining Capacity`
                            : hasInsufficientBalance
                              ? t`Insufficient Balance`
                              : t`Deposit ${rwaSymbol} + Open Short`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </VantagePageContainer>
    </div>
  );
}
