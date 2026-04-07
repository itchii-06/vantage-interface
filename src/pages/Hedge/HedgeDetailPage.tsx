/**
 * HedgeDetailPage.tsx
 *
 * Delta-neutral hedge detail & execution page.
 * Route: /hedge/:key
 *
 * Layout:
 *   Left  — ±20% P&L simulator (SVG chart)
 *   Right — Mode toggle (Managed / Self-Custody)
 *           Margin token toggle (USDC / ETH)
 *           Inputs: RWA amount (managed), leverage
 *           Calculated: sizeDelta, required collateral
 *           Execute button
 */

import { t } from "@lingui/macro";
import { Contract, formatEther, parseEther, parseUnits } from "ethers";
import { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";

import { useHedgeActions } from "domain/vantage/hedge/useHedgeActions";
import type { HedgeMarginToken, HedgeMode } from "domain/vantage/hedge/useHedgeActions";
import { buildSvgPath, useHedgeSimulator } from "domain/vantage/hedge/useHedgeSimulator";
import { VAULT_CONFIGS } from "domain/vantage/vaults/vaultConfig";
import { useChainId } from "lib/chains";
import { getProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";
import MockPriceFeedAbi from "vantage/abis/MockPriceFeed.json";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";

import { AppHeader } from "components/AppHeader/AppHeader";
import { AppNav } from "components/AppNav/AppNav";
import NumberInput from "components/NumberInput/NumberInput";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Approximate ETH price in USD used to estimate collateral in ETH */
const ETH_PRICE_USD = 2000;

const MOCK_PRICE_FEED = (localhostDeployment.addresses as { MockPriceFeed?: string }).MockPriceFeed ?? "";
const USDC_ADDRESS = (localhostDeployment.addresses as { tokens?: { USDC?: string } }).tokens?.USDC ?? "";
const POLL_MS = 15_000;

// ---------------------------------------------------------------------------
// useRwaSpotPrice — fetches oracle price for a token from MockPriceFeed
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
        if (!cancelled && raw > 0n) {
          setPrice(parseFloat(formatEther(raw)));
        }
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
// P&L Simulator Chart
// ---------------------------------------------------------------------------

type SimChartProps = {
  spotPriceUsd: number | null;
  rwaAmount: number;
  sizeDelta: number;
};

function SimChart({ spotPriceUsd, rwaAmount, sizeDelta }: SimChartProps) {
  const points = useHedgeSimulator(spotPriceUsd, rwaAmount, sizeDelta);

  const W = 400;
  const H = 160;

  if (points.length < 2) {
    return (
      <div className="flex h-[160px] items-center justify-center text-13 text-slate-500">
        {t`Enter an amount to see the P&L simulation.`}
      </div>
    );
  }

  const spotPath = buildSvgPath(points, "spotPnl", W, H);
  const shortPath = buildSvgPath(points, "shortPnl", W, H);
  const netPath = buildSvgPath(points, "netPnl", W, H);

  // Zero line Y position
  const values = points.flatMap((p) => [p.spotPnl, p.shortPnl, p.netPnl]);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const zeroY = H - ((0 - minV) / range) * H;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        {/* Zero reference line */}
        <line
          x1="0"
          y1={zeroY.toFixed(1)}
          x2={W}
          y2={zeroY.toFixed(1)}
          stroke="#475569"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
        {/* Spot long */}
        <path d={spotPath} fill="none" stroke="#60a5fa" strokeWidth="1.5" />
        {/* Short position */}
        <path d={shortPath} fill="none" stroke="#f87171" strokeWidth="1.5" />
        {/* Net (delta-neutral = ~flat) */}
        <path d={netPath} fill="none" stroke="#34d399" strokeWidth="2" />
      </svg>
      <div className="mt-8 flex gap-16 text-11 text-slate-400">
        <div className="flex items-center gap-4">
          <div className="rounded h-2 w-12 bg-blue-400" /> {t`Spot (long)`}
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded h-2 w-12 bg-red-400" /> {t`Short`}
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded h-2 w-12 bg-green-400" /> {t`Net`}
        </div>
      </div>
      <div className="mt-4 flex justify-between text-11 text-slate-500">
        <span>−20%</span>
        <span>{t`Price change`}</span>
        <span>+20%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HedgeDetailPage() {
  const { key } = useParams<{ key: string }>();
  const history = useHistory();
  const { account } = useWallet();

  const cfg = VAULT_CONFIGS.find((v) => v.key === key);

  const [mode, setMode] = useState<HedgeMode>("managed");
  const [marginToken, setMarginToken] = useState<HedgeMarginToken>("usdc");
  const [rwaAmountStr, setRwaAmountStr] = useState("");
  const [leverageStr, setLeverageStr] = useState("1");
  const [usdcCollateralStr, setUsdcCollateralStr] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { isSubmitting, error: actionError, txHash, validate, execute } = useHedgeActions();

  // Oracle spot price from MockPriceFeed (WAD → number)
  const spotPriceUsd = useRwaSpotPrice(cfg?.tokenAddress);

  const rwaAmount = parseFloat(rwaAmountStr) || 0;
  const leverage = Math.max(1, parseFloat(leverageStr) || 1);

  // Managed: sizeDelta = rwaAmount × spotPrice (delta-neutral)
  // Self-Custody: sizeDelta derived from user's collateral input × leverage
  const price = spotPriceUsd ?? 0;
  const managedSizeDeltaUsd = rwaAmount * price;
  const selfCustodyCollateralInput = parseFloat(usdcCollateralStr) || 0;
  const selfCustodySizeDeltaUsd =
    marginToken === "usdc"
      ? selfCustodyCollateralInput * leverage
      : selfCustodyCollateralInput * ETH_PRICE_USD * leverage;

  const sizeDeltaUsd = mode === "managed" ? managedSizeDeltaUsd : selfCustodySizeDeltaUsd;

  // Required margin = sizeDelta / leverage
  const requiredCollateralUsd = mode === "managed" ? sizeDeltaUsd / leverage : selfCustodyCollateralInput;
  const requiredCollateralEth = mode === "managed" ? requiredCollateralUsd / ETH_PRICE_USD : selfCustodyCollateralInput;

  // Clear validation error when inputs change
  useEffect(() => {
    setValidationError(null);
  }, [rwaAmountStr, leverageStr, usdcCollateralStr, mode, marginToken]);

  // ── Not found ─────────────────────────────────────────────────────────────

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

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleExecute() {
    if (!account || !cfg) return;

    const rwaAmountWad = parseEther(rwaAmountStr || "0");
    const sizeDeltaWad = parseEther(sizeDeltaUsd.toFixed(18));

    let collateralAmount: bigint;
    if (marginToken === "usdc") {
      collateralAmount = parseUnits(requiredCollateralUsd.toFixed(6), 6);
    } else {
      // ETH: convert required USD to wei
      collateralAmount = parseEther(requiredCollateralEth.toFixed(18));
    }

    const params = {
      rwaToken: cfg.tokenAddress,
      rwaAmount: rwaAmountWad,
      // USDC margin uses tokens.USDC; ETH margin ignores this field (collateral sent via msg.value)
      collateralToken: USDC_ADDRESS,
      collateralAmount,
      // Index token = RWA token address (MockPriceFeed has its price)
      indexToken: cfg.tokenAddress,
      sizeDelta: sizeDeltaWad,
    };

    const err = await validate(mode, marginToken, params);
    if (err) {
      setValidationError(err);
      return;
    }

    await execute(mode, marginToken, params);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const canExecute =
    account && !isSubmitting && (mode === "managed" ? rwaAmount > 0 : parseFloat(usdcCollateralStr) > 0);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-stroke-primary px-16 py-8">
        <AppHeader leftContent={<AppNav />} />
      </div>

      <div className="mt-24 px-16">
        {/* Back link */}
        <button
          onClick={() => history.push("/hedge")}
          className="mb-16 flex items-center gap-6 text-13 text-slate-400 hover:text-white"
        >
          ← {t`Hedge`}
        </button>

        {/* Page title */}
        <div className="mb-24 flex items-center gap-12">
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

        {/* Main layout */}
        <div className="grid grid-cols-1 gap-24 lg:grid-cols-[1fr_420px]">
          {/* ── Left: Simulator ─────────────────────────────────────────────── */}
          <div className="bg-cold-blue-950 rounded-4 border border-stroke-primary p-24">
            <h2 className="mb-4 text-16 font-semibold text-white">{t`±20% P&L Simulation`}</h2>
            <p className="mb-16 text-12 text-slate-400">
              {t`Shows spot, short, and net P&L across a ±20% price range. A perfect delta-neutral position (Net) stays flat.`}
            </p>
            <SimChart spotPriceUsd={spotPriceUsd} rwaAmount={rwaAmount} sizeDelta={sizeDeltaUsd} />

            {/* Stats row */}
            <div className="mt-20 grid grid-cols-3 gap-16 border-t border-stroke-primary pt-16">
              <div>
                <div className="text-11 text-slate-500">{t`Spot Value`}</div>
                <div className="mt-4 text-15 font-semibold text-white">
                  ${(rwaAmount * (spotPriceUsd ?? 0)).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-11 text-slate-500">{t`Short Size`}</div>
                <div className="mt-4 text-15 font-semibold text-white">
                  ${sizeDeltaUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-11 text-slate-500">{t`Leverage`}</div>
                <div className="mt-4 text-15 font-semibold text-white">{leverage}×</div>
              </div>
            </div>
          </div>

          {/* ── Right: Action panel ──────────────────────────────────────────── */}
          <div className="bg-cold-blue-950 rounded-4 border border-stroke-primary p-24">
            {/* Mode toggle */}
            <div className="mb-20">
              <div className="mb-8 text-12 text-slate-400">{t`Mode`}</div>
              <div className="flex rounded-4 border border-stroke-primary">
                <button
                  onClick={() => setMode("managed")}
                  className={`flex-1 rounded-l-4 py-8 text-13 font-medium transition-colors ${
                    mode === "managed"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                  }`}
                >
                  {t`Managed`}
                </button>
                <button
                  onClick={() => setMode("selfCustody")}
                  className={`flex-1 rounded-r-4 py-8 text-13 font-medium transition-colors ${
                    mode === "selfCustody"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                  }`}
                >
                  {t`Self-Custody`}
                </button>
              </div>
              <p className="mt-8 text-12 text-slate-500">
                {mode === "managed"
                  ? t`Deposits ${cfg.symbol} to the LP Vault AND opens a short position — both in one transaction.`
                  : t`Keep ${cfg.symbol} in your wallet and open a short position only.`}
              </p>
            </div>

            {/* Margin token toggle */}
            <div className="mb-20">
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

            {/* Inputs */}
            {mode === "managed" && (
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
            )}

            {mode === "selfCustody" && (
              <div className="mb-16">
                <label className="mb-6 block text-12 text-slate-400">
                  {marginToken === "usdc" ? "USDC" : "ETH"} {t`Collateral`}
                </label>
                <NumberInput
                  value={usdcCollateralStr}
                  onValueChange={(e) => setUsdcCollateralStr(e.target.value)}
                  className="focus:border-indigo-500 w-full rounded-4 border border-stroke-primary bg-slate-800/60 px-12 py-10 text-14 text-white focus:outline-none"
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="mb-20">
              <label className="mb-6 block text-12 text-slate-400">{t`Leverage`}</label>
              <NumberInput
                value={leverageStr}
                onValueChange={(e) => setLeverageStr(e.target.value)}
                className="focus:border-indigo-500 w-full rounded-4 border border-stroke-primary bg-slate-800/60 px-12 py-10 text-14 text-white focus:outline-none"
                placeholder="1"
              />
              <p className="mt-4 text-11 text-slate-500">{t`1× = delta-neutral. Higher = partial hedge.`}</p>
            </div>

            {/* Calculated amounts */}
            <div className="mb-20 rounded-4 bg-slate-800/40 p-14 text-13">
              {spotPriceUsd === null ? (
                <div className="text-slate-500">{t`Fetching price…`}</div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t`Oracle Price`}</span>
                    <span className="text-white">${spotPriceUsd.toFixed(4)}</span>
                  </div>
                  <div className="mt-8 flex justify-between">
                    <span className="text-slate-400">{t`Short Size`}</span>
                    <span className="text-white">${sizeDeltaUsd.toFixed(2)}</span>
                  </div>

                  {/* Managed: show both actions clearly */}
                  {mode === "managed" ? (
                    <div className="mt-10 space-y-6 border-t border-slate-700/60 pt-10">
                      <div className="text-11 font-medium uppercase tracking-wide text-slate-500">
                        {t`This transaction sends:`}
                      </div>
                      {/* Action 1: LP Deposit */}
                      <div className="bg-indigo-900/20 flex items-center justify-between rounded-4 px-10 py-8">
                        <div className="flex items-center gap-6">
                          <span className="rounded bg-indigo-800/60 text-10 text-indigo-300 px-5 py-1 font-bold">
                            ①
                          </span>
                          <span className="text-slate-300">{t`LP Deposit`}</span>
                        </div>
                        <span className="text-indigo-300 font-semibold">
                          {rwaAmount > 0 ? `${rwaAmount} ${cfg.symbol}` : "—"}
                        </span>
                      </div>
                      {/* Action 2: Short margin */}
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
                  ) : (
                    <div className="mt-8 flex justify-between border-t border-slate-700/60 pt-8">
                      <span className="text-slate-400">
                        {t`Required`} {marginToken === "usdc" ? "USDC" : "ETH"}
                      </span>
                      <span className="text-indigo-300 font-semibold">
                        {marginToken === "usdc"
                          ? `${requiredCollateralUsd.toFixed(2)} USDC`
                          : `${requiredCollateralEth.toFixed(6)} ETH`}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Errors */}
            {(validationError || actionError) && (
              <div className="mb-16 rounded-4 bg-red-900/30 px-12 py-8 text-12 text-red-400">
                {validationError ?? actionError}
              </div>
            )}

            {/* Success */}
            {txHash && (
              <div className="mb-16 rounded-4 bg-green-900/30 px-12 py-8 text-12 text-green-400">
                {t`Transaction submitted:`} {txHash.slice(0, 20)}…
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
                {isSubmitting
                  ? t`Submitting…`
                  : mode === "managed"
                    ? t`Deposit ${cfg.symbol} + Open Short`
                    : t`Self-Custody Hedge`}
              </button>
            )}

            {/* Keeper note */}
            <p className="mt-12 text-center text-11 text-slate-600">
              {t`Short position requests are executed by Keepers (GMX V1 two-step flow).`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
