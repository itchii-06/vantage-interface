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
 */

import { t } from "@lingui/macro";
import { Contract, MaxUint256, formatEther, parseUnits } from "ethers";
import { useEffect, useMemo, useState } from "react";

import type { UsePositionRequestsResult } from "domain/vantage/trade/usePositionRequests";
import type { PositionRouterTradeResult } from "domain/vantage/trade/usePositionRouterTrade";
import { DEFAULT_SLIPPAGE_BPS } from "domain/vantage/trade/usePositionRouterTrade";
import type { SpreadData } from "domain/vantage/trade/useSpread";
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

  // Dynamic OI cap: read from Vault + AssetRegistry
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
        indexToken,
        amountIn,
        sizeDelta,
        isLong,
        markPrice,
        slippageBps,
        useNativeEth,
      });

      if (requestKey) {
        requests.addRequest({
          requestKey,
          type: "increase",
          createdAtMs: now,
          expiresAtMs,
          indexToken,
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
