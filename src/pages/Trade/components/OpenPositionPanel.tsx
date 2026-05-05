/**
 * OpenPositionPanel.tsx
 *
 * Form for opening a new Long / Short position via PositionRouter.
 *
 * Features:
 *   - Collateral token selection: USDC (ERC-20) or native ETH
 *   - Size input (USD) + Leverage slider (1×–50×)
 *   - Slippage selector (0.1% / 0.3% / 0.5% / custom)
 *   - Bid/Ask spread display
 *   - Approve + Submit buttons with correct state management
 *   - Index selector (Price / Yield / Total) for Interest Prism vaults (Issue #227)
 *   - Skew Fee preview: Base Fee + Skew Adjustment = Total (Issue #225/#227)
 *   - Per-adapter sub-limit capacity bar (Issue #225/#227)
 */

import { t } from "@lingui/macro";
import { Contract, MaxUint256, formatEther, parseUnits } from "ethers";
import { useEffect, useMemo, useState } from "react";

import type { UsePositionRequestsResult } from "domain/vantage/trade/usePositionRequests";
import type { PositionRouterTradeResult } from "domain/vantage/trade/usePositionRouterTrade";
import { DEFAULT_SLIPPAGE_BPS } from "domain/vantage/trade/usePositionRouterTrade";
import type { SpreadData } from "domain/vantage/trade/useSpread";
import { VAULT_CONFIGS, type VaultConfig } from "domain/vantage/vaults/vaultConfig";
import { useChainId } from "lib/chains";
import { helperToast } from "lib/helperToast";
import { getProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";
import TokenAbi from "sdk/abis/Token";
import { getVantageContractAddress } from "vantage/contracts";
import { AssetRegistry__factory, Vault__factory } from "vantage/types";

import { VantageLeverageSlider } from "components/VantageLeverageSlider/VantageLeverageSlider";

import { SpreadBadge } from "./SpreadBadge";

// Tokens available for trade on localhost
const COLLATERAL_OPTIONS = [
  { label: "USDC", decimals: 6, isNative: false },
  { label: "ETH", decimals: 18, isNative: true },
] as const;

const SLIPPAGE_PRESETS = [10, 30, 50] as const; // bps

// Minimal ABI for per-index skew reads (Issue #225)
const SKEW_ABI = [
  "function adapterLongOI(address) view returns (uint256)",
  "function adapterShortOI(address) view returns (uint256)",
  "function adapterMaxOI(address) view returns (uint256)",
  "function skewFeeMultiplier(address) view returns (uint256)",
  "function minFeeRateBps(address) view returns (uint256)",
];

type PrismAxis = "price" | "yield" | "total";

const PRISM_AXIS_LABELS: Record<PrismAxis, string> = {
  price: "Price",
  yield: "Yield",
  total: "Total",
};

type Props = {
  isLong: boolean;
  indexToken: string;
  collateralToken: string;
  spread: SpreadData;
  trade: PositionRouterTradeResult;
  requests: UsePositionRequestsResult;
  onSuccess?: () => void;
  /** True when JuniorTrancheVault has no USDC — trades would revert on-chain. */
  noLiquidity?: boolean;
  /** Full vault config for the selected market. Used to enable Prism axis selector. */
  vaultConfig?: VaultConfig;
};

export function OpenPositionPanel({
  isLong,
  indexToken,
  collateralToken,
  spread,
  trade,
  requests,
  onSuccess,
  noLiquidity,
  vaultConfig,
}: Props) {
  const { account, signer } = useWallet();
  const { chainId } = useChainId();
  const provider = useMemo(() => getProvider(undefined, chainId), [chainId]);

  const [collateralInput, setCollateralInput] = useState("");
  const [leverage, setLeverage] = useState(2); // ×
  const [slippageBps, setSlippageBps] = useState<number>(DEFAULT_SLIPPAGE_BPS);
  const [customSlippage, setCustomSlippage] = useState("");
  const [useNativeEth, setUseNativeEth] = useState(false);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [allowanceLoaded, setAllowanceLoaded] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Prism axis selector (Issue #227) ──────────────────────────────────────

  const isPrismVault = Boolean(vaultConfig?.prismAxis);
  const [selectedAxis, setSelectedAxis] = useState<PrismAxis>((vaultConfig?.prismAxis as PrismAxis) ?? "price");

  // Sync selectedAxis when vaultConfig changes (e.g. user switches market)
  useEffect(() => {
    if (vaultConfig?.prismAxis) {
      setSelectedAxis(vaultConfig.prismAxis as PrismAxis);
    }
  }, [vaultConfig?.prismAxis]);

  // Resolve the active prism config based on the selected axis tab
  const activePrismConfig = useMemo<VaultConfig | undefined>(() => {
    if (!isPrismVault) return undefined;
    return VAULT_CONFIGS.find((v) => v.prismAxis === selectedAxis);
  }, [isPrismVault, selectedAxis]);

  // Effective index token and adapter address for this trade
  const activeIndexToken = activePrismConfig?.tokenAddress ?? indexToken;
  const activeAdapterAddress =
    activePrismConfig?.adapterAddress && activePrismConfig.adapterAddress !== ""
      ? activePrismConfig.adapterAddress
      : undefined;

  // ── Skew Fee State (Issue #225/#227) ─────────────────────────────────────

  type SkewData = {
    longOI: bigint;
    shortOI: bigint;
    maxOI: bigint;
    multiplier: bigint;
    minFeeRate: bigint;
    baseFee: bigint; // marginFeeBps from AssetRegistry
  };
  const [skewData, setSkewData] = useState<SkewData | null>(null);

  useEffect(() => {
    if (!activeAdapterAddress) {
      setSkewData(null);
      return;
    }
    const vaultAddr = getVantageContractAddress(chainId, "JuniorTrancheVault");
    const registryAddr = getVantageContractAddress(chainId, "AssetRegistry");
    const ZERO = "0x0000000000000000000000000000000000000000";
    if (!vaultAddr || vaultAddr === ZERO || !registryAddr || registryAddr === ZERO) return;

    const skewContract = new Contract(vaultAddr, SKEW_ABI, provider);
    const registry = AssetRegistry__factory.connect(registryAddr, provider);

    Promise.all([
      skewContract.adapterLongOI(activeAdapterAddress) as Promise<bigint>,
      skewContract.adapterShortOI(activeAdapterAddress) as Promise<bigint>,
      skewContract.adapterMaxOI(activeAdapterAddress) as Promise<bigint>,
      skewContract.skewFeeMultiplier(activeAdapterAddress) as Promise<bigint>,
      skewContract.minFeeRateBps(activeAdapterAddress) as Promise<bigint>,
      registry.getAssetRiskInfo(activeIndexToken).then((r) => r.marginFeeBps) as Promise<bigint>,
    ])
      .then(([longOI, shortOI, maxOI, multiplier, minFeeRate, baseFee]) => {
        setSkewData({ longOI, shortOI, maxOI, multiplier, minFeeRate, baseFee });
      })
      .catch(() => setSkewData(null));
  }, [activeAdapterAddress, activeIndexToken, chainId, provider]);

  // Compute effective fee bps for current direction
  const { skewBps, effectiveBps, isIncreasingSkew } = useMemo(() => {
    if (!skewData || skewData.maxOI === 0n) {
      return { skewBps: 0n, effectiveBps: skewData?.baseFee ?? 0n, isIncreasingSkew: false };
    }
    const { longOI, shortOI, maxOI, multiplier, minFeeRate, baseFee } = skewData;
    const skew = longOI >= shortOI ? longOI - shortOI : shortOI - longOI;
    const sBps = (multiplier * skew) / maxOI;
    const increasing = (isLong && longOI >= shortOI) || (!isLong && shortOI >= longOI);
    let eBps: bigint;
    if (increasing) {
      eBps = baseFee + sBps;
    } else {
      eBps = baseFee > sBps + minFeeRate ? baseFee - sBps : minFeeRate;
    }
    return { skewBps: sBps, effectiveBps: eBps, isIncreasingSkew: increasing };
  }, [skewData, isLong]);

  // Sub-limit utilization ratio (0–1)
  const subLimitRatio = useMemo(() => {
    if (!skewData || skewData.maxOI === 0n) return 0;
    const totalOI = skewData.longOI + skewData.shortOI;
    return Number((totalOI * 10_000n) / skewData.maxOI) / 10_000;
  }, [skewData]);

  const subLimitBarStyle = useMemo(() => ({ width: `${Math.min(subLimitRatio * 100, 100)}%` }), [subLimitRatio]);

  // ── Dynamic OI cap: read from Vault + AssetRegistry ──────────────────────

  const [oiCapError, setOiCapError] = useState<string | null>(null);

  const collateralDecimals = useNativeEth ? 18 : 6;

  // Parse collateral amount
  const amountIn = useMemo(() => {
    try {
      if (!collateralInput || parseFloat(collateralInput) <= 0) return 0n;
      return parseUnits(collateralInput, collateralDecimals);
    } catch {
      return 0n;
    }
  }, [collateralInput, collateralDecimals]);

  // USD value of collateral (using ask price for long, bid for short)
  const collateralUsd = useMemo(() => {
    const price = isLong ? spread.askPrice : spread.bidPrice;
    if (useNativeEth) {
      return (amountIn * price) / 10n ** 18n;
    }
    // USDC: 1 USDC = $1 (6 decimals → WAD)
    return amountIn * 10n ** 12n; // 6 dec → 18 dec
  }, [amountIn, useNativeEth, spread, isLong]);

  const sizeDelta = collateralUsd * BigInt(leverage);

  // Mark price for acceptablePrice calculation
  const markPrice = isLong ? spread.askPrice : spread.bidPrice;

  // Allowance check (ERC-20 only)
  useMemo(() => {
    if (useNativeEth || !account) {
      setAllowanceLoaded(true);
      return;
    }
    setAllowanceLoaded(false);
    const positionRouterAddr = getVantageContractAddress(chainId, "PositionRouter");
    const token = new Contract(collateralToken, TokenAbi, provider);
    token
      .allowance(account, positionRouterAddr)
      .then((v: bigint) => {
        setAllowance(v);
        setAllowanceLoaded(true);
      })
      .catch(() => setAllowanceLoaded(true));
  }, [account, collateralToken, chainId, provider, useNativeEth]);

  // Check dynamic OI cap whenever sizeDelta changes
  useEffect(() => {
    if (sizeDelta === 0n) {
      setOiCapError(null);
      return;
    }
    const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
    const vaultAddr = getVantageContractAddress(chainId, "JuniorTrancheVault");
    const registryAddr = getVantageContractAddress(chainId, "AssetRegistry");
    if (!vaultAddr || vaultAddr === ZERO_ADDR || !registryAddr || registryAddr === ZERO_ADDR) return;

    const vault = Vault__factory.connect(vaultAddr, provider);
    const registry = AssetRegistry__factory.connect(registryAddr, provider);

    Promise.all([vault.lpManager(), vault.totalGlobalOI(), vault.totalNetAssetValue(), registry.utilizationCapBps()])
      .then(([lpMgr, globalOI, nav, capBps]) => {
        if (lpMgr === ZERO_ADDR || capBps === 0n || nav === 0n) {
          setOiCapError(null);
          return;
        }
        const maxOI = (nav * capBps) / 10_000n;
        const projected = globalOI + sizeDelta;
        if (projected > maxOI) {
          const available = maxOI > globalOI ? maxOI - globalOI : 0n;
          const availableUsd = parseFloat(formatEther(available)).toFixed(0);
          setOiCapError(
            t`Position size exceeds OI cap. Available: $${availableUsd} (LP liquidity is $${parseFloat(formatEther(nav)).toFixed(0)} × ${Number(capBps) / 100}%)`
          );
        } else {
          setOiCapError(null);
        }
      })
      .catch(() => setOiCapError(null)); // fail silently — don't block trading if read fails
  }, [sizeDelta, chainId, provider]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsApproval = !useNativeEth && allowanceLoaded && amountIn > 0n && allowance < amountIn;

  async function handleApprove() {
    if (!signer || !account) return;
    setIsApproving(true);
    try {
      const positionRouterAddr = getVantageContractAddress(chainId, "PositionRouter");
      const token = new Contract(collateralToken, TokenAbi, signer);
      const tx = await token.approve(positionRouterAddr, MaxUint256);
      await tx.wait();
      setAllowance(MaxUint256);
      helperToast.success(t`Approved`);
    } catch (err: unknown) {
      helperToast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsApproving(false);
    }
  }

  async function handleSubmit() {
    if (!account || sizeDelta === 0n) return;
    setIsSubmitting(true);
    try {
      const now = Date.now();
      const expiresAtMs = trade.maxTimeDelay > 0 ? now + trade.maxTimeDelay * 1000 : 0;

      const requestKey = await trade.createIncreasePosition({
        collateralToken,
        indexToken: activeIndexToken,
        amountIn,
        sizeDelta,
        isLong,
        markPrice,
        slippageBps,
        useNativeEth,
        priceAdapter: activeAdapterAddress,
      });

      if (requestKey) {
        requests.addRequest({
          requestKey,
          type: "increase",
          createdAtMs: now,
          expiresAtMs,
          indexToken: activeIndexToken,
          isLong,
          sizeDelta,
        });
        setCollateralInput("");
        onSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeSlippage = customSlippage ? Math.round(parseFloat(customSlippage) * 100) : slippageBps;

  const feeEth = parseFloat(formatEther(trade.minExecutionFee)).toFixed(5);

  const approveBtnCls = isApproving ? "bg-[#334155] text-[#94a3b8]" : "bg-vantage-accent text-black";

  return (
    <div className="flex flex-col gap-12">
      {/* Spread display */}
      <SpreadBadge spread={spread} />

      {/* ── Interest Prism Index Selector (Issue #227) ─────────────────────── */}
      {isPrismVault && (
        <div>
          <div className="mb-6 text-12 text-slate-400">{t`Index`}</div>
          <div className="flex gap-6">
            {(["price", "yield", "total"] as PrismAxis[]).map((axis) => (
              <button
                key={axis}
                onClick={() => setSelectedAxis(axis)}
                className={`rounded-4 px-12 py-6 text-12 font-medium transition-colors ${
                  selectedAxis === axis
                    ? "bg-vantage-accent text-black"
                    : "bg-vantage-input text-vantage-text-secondary hover:text-white"
                }`}
              >
                {PRISM_AXIS_LABELS[axis]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Collateral type toggle */}
      <div className="flex gap-8">
        {COLLATERAL_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => setUseNativeEth(opt.isNative)}
            className={`rounded-4 px-12 py-6 text-12 font-medium transition-colors ${useNativeEth === opt.isNative ? "bg-vantage-accent text-black" : "bg-vantage-input text-vantage-text-secondary"}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Size input */}
      <div className="rounded-4 border border-vantage-border bg-vantage-input px-12 py-12">
        <div className="mb-2 flex items-center justify-between text-12 text-slate-400">
          <span>{t`Size`}</span>
          <span>{useNativeEth ? "ETH" : "USDC"}</span>
        </div>
        <input
          type="number"
          min="0"
          placeholder="0.00"
          value={collateralInput}
          onChange={(e) => setCollateralInput(e.target.value)}
          className="bg-transparent w-full pl-0 pr-12 text-[36px] font-semibold text-white outline-none placeholder:text-slate-600"
        />
        {collateralUsd > 0n && (
          <div className="mt-2 text-12 text-slate-400">≈ ${parseFloat(formatEther(collateralUsd)).toFixed(2)} USD</div>
        )}
      </div>

      {/* Leverage slider */}
      <VantageLeverageSlider value={leverage} onChange={setLeverage} max={50} />

      {/* Slippage */}
      <div>
        <div className="mb-16 mt-8 text-12 text-slate-400">{t`Slippage Tolerance`}</div>
        <div className="flex items-center gap-6">
          {SLIPPAGE_PRESETS.map((bps) => (
            <button
              key={bps}
              onClick={() => {
                setSlippageBps(bps);
                setCustomSlippage("");
              }}
              className={`rounded-4 px-10 py-5 text-12 transition-colors ${!customSlippage && slippageBps === bps ? "bg-vantage-accent text-black" : "bg-vantage-input text-vantage-text-secondary"}`}
            >
              {bps / 100}%
            </button>
          ))}
          <input
            type="number"
            min="0"
            placeholder={t`Custom %`}
            value={customSlippage}
            onChange={(e) => setCustomSlippage(e.target.value)}
            className="w-20 rounded-4 border border-vantage-border bg-vantage-input px-8 py-5 text-12 text-white outline-none placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* Execution fee */}
      <div className="mb-12 mt-8 flex items-center justify-between text-12">
        <span className="text-slate-400">{t`Execution Fee`}</span>
        <span className="text-slate-300">{feeEth} ETH</span>
      </div>

      {/* Accept price */}
      {markPrice > 0n && (
        <div className="flex items-center justify-between text-12">
          <span className="text-slate-400">{t`Acceptable Price`}</span>
          <span className="text-slate-300">
            $
            {parseFloat(
              formatEther(
                isLong
                  ? (markPrice * (10_000n + BigInt(activeSlippage))) / 10_000n
                  : (markPrice * (10_000n - BigInt(activeSlippage))) / 10_000n
              )
            ).toFixed(4)}
          </span>
        </div>
      )}

      {/* ── Skew Fee Preview (Issue #225/#227) ──────────────────────────────── */}
      {skewData && skewData.maxOI > 0n && (
        <div className="rounded-4 border border-vantage-border bg-vantage-input/50 px-12 py-10 text-12">
          <div className="text-slate-300 mb-8 font-medium">{t`Estimated Fee`}</div>
          <div className="flex items-center justify-between text-slate-400">
            <span>{t`Base Fee`}</span>
            <span>{Number(skewData.baseFee) / 100}%</span>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-slate-400">{t`Skew Adjustment`}</span>
            <span className={isIncreasingSkew ? "text-red-400" : "text-green-400"}>
              {isIncreasingSkew ? "+" : "−"}
              {Number(skewBps) / 100}%
            </span>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-vantage-border pt-6 font-semibold text-white">
            <span>{t`Total`}</span>
            <span>{Number(effectiveBps) / 100}%</span>
          </div>

          {/* Sub-limit capacity bar */}
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between text-11 text-slate-500">
              <span>{t`Index Capacity`}</span>
              <span>{(subLimitRatio * 100).toFixed(1)}%</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-slate-700">
              <div
                className={`h-full rounded-full transition-all ${
                  subLimitRatio > 0.9 ? "bg-red-500" : subLimitRatio > 0.7 ? "bg-amber-500" : "bg-green-500"
                }`}
                style={subLimitBarStyle}
              />
            </div>
          </div>
        </div>
      )}

      {/* OI cap error */}
      {oiCapError && (
        <div className="rounded-4 border border-red-500/40 bg-red-500/10 px-12 py-8 text-12 text-red-400">
          {oiCapError}
        </div>
      )}

      {/* No liquidity warning */}
      {noLiquidity && (
        <div className="rounded-4 border border-slate-600/40 bg-slate-800/60 px-12 py-8 text-12 text-slate-400">
          {t`No liquidity in the payout vault. An LP deposit is required before trading can begin.`}
        </div>
      )}

      {/* CTA buttons */}
      {!account ? (
        <div className="py-8 text-center text-13 text-slate-400">{t`Connect wallet to trade`}</div>
      ) : needsApproval ? (
        <button
          onClick={handleApprove}
          disabled={isApproving || !!noLiquidity}
          className={`w-full rounded-8 py-14 text-15 font-semibold transition-colors disabled:cursor-not-allowed ${approveBtnCls}`}
        >
          {isApproving ? t`Approving…` : t`Approve USDC`}
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || sizeDelta === 0n || !trade.isReady || !!oiCapError || !!noLiquidity}
          className={`w-full rounded-8 py-14 text-16 font-semibold transition-colors ${
            isSubmitting || sizeDelta === 0n || !trade.isReady || !!oiCapError || !!noLiquidity
              ? "cursor-not-allowed bg-slate-700 text-slate-500"
              : isLong
                ? "bg-green-600 text-white hover:bg-green-500"
                : "bg-red-600 text-white hover:bg-red-500"
          }`}
        >
          {isSubmitting
            ? t`Submitting…`
            : noLiquidity
              ? t`No Liquidity`
              : sizeDelta === 0n
                ? isLong
                  ? t`Buy`
                  : t`Sell`
                : isLong
                  ? `Buy ${parseFloat(formatEther(sizeDelta))} USDC`
                  : `Sell ${parseFloat(formatEther(sizeDelta))} USDC`}
        </button>
      )}
    </div>
  );
}
