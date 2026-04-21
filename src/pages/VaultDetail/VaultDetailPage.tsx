/**
 * VaultDetailPage.tsx
 *
 * Uniswap-style vault detail page.
 * Route: /vaults/:address
 *
 * Layout: left column (stats + chart) | right column (deposit/withdraw + debug)
 */

import { t } from "@lingui/macro";
import { formatEther, formatUnits, parseUnits } from "ethers";
import { ChangeEvent, useMemo, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";

import { useVaultActions } from "domain/vantage/vaults/useVaultActions";
import { useVaultApy } from "domain/vantage/vaults/useVaultApy";
import { useVaultDetail } from "domain/vantage/vaults/useVaultDetail";
import { useVaultTxHistory } from "domain/vantage/vaults/useVaultTxHistory";
import { useZapInActions } from "domain/vantage/vaults/useZapInActions";
import { ASSET_TYPE_COLOR, ASSET_TYPE_LABEL, getVaultConfigByAddress } from "domain/vantage/vaults/vaultConfig";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";
import { ZAP_TOKENS, ZapTokenConfig, resolvePoolFee } from "vantage/config/zapTokens";

import { AppHeader } from "components/AppHeader/AppHeader";
import { AppNav } from "components/AppNav/AppNav";
import Button from "components/Button/Button";
import NumberInput from "components/NumberInput/NumberInput";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WAD = BigInt("1000000000000000000");
const MAINNET_CHAIN_IDS = new Set([1, 42161, 8453]); // Ethereum, Arbitrum One, Base

function formatUsd(wad: bigint): string {
  const n = parseFloat(formatEther(wad));
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function formatToken(amount: bigint, symbol: string, decimals = 18): string {
  const n = parseFloat(formatUnits(amount, decimals));
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${symbol}`;
}

function formatPrice(wad: bigint): string {
  const n = parseFloat(formatEther(wad));
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

// ---------------------------------------------------------------------------
// Mini AUM sparkline (SVG)
// ---------------------------------------------------------------------------

function AumSparkline({ history }: { history: { aum: bigint }[] }) {
  if (history.length < 2) {
    return (
      <div className="flex h-[120px] items-center justify-center text-13 text-slate-500">{t`Collecting data…`}</div>
    );
  }

  const values = history.map((p) => Number(formatEther(p.aum)));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 400;
  const H = 120;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 20) - 10;
    return `${x},${y}`;
  });

  const isPositive = values[values.length - 1] >= values[0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <polyline points={pts.join(" ")} fill="none" stroke={isPositive ? "#ecff3e" : "#f87171"} strokeWidth="1" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type Tab = "deposit" | "zap" | "withdraw";

export default function VaultDetailPage() {
  const { address } = useParams<{ address: string }>();
  const history = useHistory();
  const location = useLocation<{ tab?: Tab }>();
  const { account } = useWallet();
  const { chainId } = useChainId();

  const cfg = getVaultConfigByAddress(address);

  const [activeTab, setActiveTab] = useState<Tab>(location.state?.tab ?? "deposit");
  const [depositInput, setDepositInput] = useState("");
  const [withdrawInput, setWithdrawInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zapToken, setZapToken] = useState<ZapTokenConfig>(ZAP_TOKENS[0]);
  const [zapInput, setZapInput] = useState("");
  const [zapError, setZapError] = useState<string | null>(null);

  const data = useVaultDetail(cfg!, chainId);
  const actions = useVaultActions(cfg!, chainId);
  const zapActions = useZapInActions(cfg!, zapToken, chainId);
  const { txs } = useVaultTxHistory(cfg!);
  const apy = useVaultApy(cfg!);

  const isTestnet = !MAINNET_CHAIN_IDS.has(chainId);

  // ── Button styles (must be before any early return) ─────────────────────────
  const approveBtnStyle = useMemo(
    () =>
      isSubmitting || actions.isApproving
        ? { background: "#334155", color: "#64748b" }
        : { background: "#ecff3e", color: "#000000" },
    [isSubmitting, actions.isApproving]
  );
  const depositBtnStyle = useMemo(() => {
    let amt = 0n;
    if (cfg && depositInput && parseFloat(depositInput) > 0) {
      try {
        amt = parseUnits(depositInput, cfg.tokenDecimals);
      } catch {
        /* leave 0n */
      }
    }
    return amt === 0n || isSubmitting
      ? { background: "#334155", color: "#64748b" }
      : { background: "#ecff3e", color: "#000000" };
  }, [cfg, depositInput, isSubmitting]);
  const zapBtnStyle = useMemo(
    () =>
      !zapInput || parseFloat(zapInput) <= 0 || zapActions.isSubmitting
        ? { background: "#334155", color: "#64748b" }
        : { background: "#ecff3e", color: "#000000" },
    [zapInput, zapActions.isSubmitting]
  );
  const withdrawBtnStyle = useMemo(() => {
    let shares = 0n;
    if (withdrawInput && parseFloat(withdrawInput) > 0) {
      try {
        shares = parseUnits(withdrawInput, 18);
      } catch {
        /* leave 0n */
      }
    }
    return shares === 0n || isSubmitting || shares > data.vlpBalance
      ? { background: "#334155", color: "#64748b" }
      : { background: "#ecff3e", color: "#000000" };
  }, [withdrawInput, isSubmitting, data.vlpBalance]);

  // ── Config missing guard ────────────────────────────────────────────────────
  if (!cfg) {
    return (
      <div className="min-h-screen w-full bg-vantage-bg">
        <div className="border-b border-b-vantage-border px-16 py-8">
          <AppHeader leftContent={<AppNav />} />
        </div>
        <div className="mx-auto mt-40 max-w-[600px] px-16 text-center">
          <p className="text-16 text-slate-400">{t`Vault not found: ${address}`}</p>
          <button
            className="mt-16 rounded-4 border border-vantage-border bg-vantage-base px-20 py-10 text-14 font-medium text-vantage-text-primary transition-colors"
            onClick={() => history.push("/vaults")}
          >
            {t`← Back to Vaults`}
          </button>
        </div>
      </div>
    );
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const depositAmount: bigint = (() => {
    try {
      if (!depositInput || parseFloat(depositInput) <= 0) return 0n;
      return parseUnits(depositInput, cfg.tokenDecimals);
    } catch {
      return 0n;
    }
  })();

  const depositWad = cfg.tokenDecimals < 18 ? depositAmount * BigInt(10 ** (18 - cfg.tokenDecimals)) : depositAmount;
  const estimatedShares = data.sharePrice > 0n ? (depositWad * WAD) / data.sharePrice : 0n;

  const withdrawShares: bigint = (() => {
    try {
      if (!withdrawInput || parseFloat(withdrawInput) <= 0) return 0n;
      return parseUnits(withdrawInput, 18);
    } catch {
      return 0n;
    }
  })();

  const estimatedTokenOut: bigint =
    withdrawShares > 0n && data.sharePrice > 0n && data.tokenPrice > 0n
      ? (((withdrawShares * data.sharePrice) / WAD) * WAD) / data.tokenPrice
      : 0n;

  // Show Approve button only after allowance is fetched (avoids flash on page load).
  // If no allowance at all: show Approve even before amount is entered.
  // If allowance < entered amount: show Approve.
  const needsApproval =
    Boolean(account) &&
    actions.isAllowanceLoaded &&
    (depositAmount > 0n ? actions.isApprovalNeeded(depositAmount) : actions.allowance === 0n);

  // Below-AUM warning for Direct vault
  const showDirectWarning = cfg.assetType === 0 && data.usdValue > 0n && data.aum < data.usdValue;

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleDeposit() {
    if (depositAmount === 0n) return;
    setIsSubmitting(true);
    try {
      await actions.deposit(depositAmount);
      setDepositInput("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWithdraw() {
    if (withdrawShares === 0n) return;
    setIsSubmitting(true);
    try {
      await actions.withdraw(withdrawShares);
      setWithdrawInput("");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSetMaxWithdraw() {
    if (data.vlpBalance > 0n) {
      setWithdrawInput(formatEther(data.vlpBalance));
    }
  }

  async function handleZap() {
    if (!cfg || !zapInput || parseFloat(zapInput) <= 0) return;
    // For the USDC route we need the USDC token address.
    // cfg.tokenAddress is the RWA token; USDC address comes from the stable vault config.
    const { VAULT_CONFIGS } = await import("domain/vantage/vaults/vaultConfig");
    const stableVault = VAULT_CONFIGS.find((v) => v.assetType === "stable");
    const params = {
      amountIn: zapInput,
      minTokenOut: 0n,
      usdcAddress: stableVault?.tokenAddress ?? "",
    };
    const err = await zapActions.validate(params);
    if (err) {
      setZapError(err);
      return;
    }
    setZapError(null);
    try {
      await zapActions.execute(params);
      setZapInput("");
    } catch (e: any) {
      setZapError((e as Error)?.message ?? "Transaction failed");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen w-full bg-vantage-bg">
      {/* Header */}
      <div className="border-b border-b-vantage-border px-16 py-8">
        <AppHeader leftContent={<AppNav />} />
      </div>

      <div className="mt-24 px-16">
        {/* Back link */}
        <button
          onClick={() => history.push("/vaults")}
          className="mb-16 text-13 text-slate-400 transition-colors hover:text-white"
        >
          ← {t`Vaults`}
        </button>

        <div className="grid grid-cols-[1fr_360px] gap-20">
          {/* ================================================================ */}
          {/* Left column                                                       */}
          {/* ================================================================ */}
          <div className="space-y-20">
            {/* Header */}
            <div className="mb-4 flex items-center gap-12">
              <div className="flex h-40 w-40 items-center justify-center rounded-full bg-slate-700 text-16 font-bold text-white">
                {cfg.symbol.slice(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-8">
                  <h1 className="text-h1">{cfg.symbol}</h1>
                  <span className={`rounded-full px-8 py-2 text-11 font-medium ${ASSET_TYPE_COLOR[cfg.assetType]}`}>
                    {ASSET_TYPE_LABEL[cfg.assetType]}
                  </span>
                  {cfg.assetType === 1 && (
                    <span className="bg-emerald-900/40 text-emerald-400 animate-pulse rounded-full px-8 py-2 text-11">
                      {t`Auto-growing`}
                    </span>
                  )}
                </div>
                <p className="text-13 text-slate-400">{cfg.name}</p>
              </div>
            </div>

            {/* AUM Chart */}
            <div className="rounded-4 border border-vantage-border bg-vantage-base p-20">
              <div className="mb-12 flex items-center justify-between">
                <h2 className="text-14 font-semibold text-white">{t`AUM`}</h2>
                <span className="text-13 text-slate-400">{t`Live (15s poll)`}</span>
              </div>
              <AumSparkline history={data.aumHistory} />
            </div>

            {/* Stats */}
            <div className="rounded-4 border border-vantage-border bg-vantage-base p-20">
              <h2 className="mb-16 text-16 font-semibold text-white">{t`Stats`}</h2>
              <div className="grid grid-cols-2 gap-16">
                <StatRow label={t`Total AUM`} value={data.isLoading ? "—" : formatUsd(data.aum)} />
                <StatRow
                  label={t`APY`}
                  value={apy === null ? "—" : `${(apy * 100).toFixed(2)}%`}
                  highlight={apy !== null ? "green" : undefined}
                />
                <StatRow label={t`Share Price`} value={data.isLoading ? "—" : formatPrice(data.sharePrice)} />
                {account && (
                  <StatRow label={t`My Deposit (USD)`} value={data.isLoading ? "—" : formatUsd(data.usdValue)} />
                )}
                {account && data.shortfall > 0n && (
                  <StatRow
                    label={t`Shortfall Debt`}
                    value={formatToken(data.shortfall, cfg.symbol, cfg.tokenDecimals)}
                    highlight="red"
                  />
                )}
              </div>
            </div>

            {/* Transactions */}
            {account && txs.length > 0 && (
              <div className="rounded-4 border border-vantage-border bg-vantage-base p-20">
                <h2 className="mb-12 text-14 font-semibold text-white">{t`Transactions`}</h2>
                <div className="space-y-8">
                  {txs.map((tx) => (
                    <div key={tx.txHash} className="flex items-center justify-between text-13">
                      <div className="flex items-center gap-8">
                        <span
                          className={`rounded-full px-8 py-2 text-11 font-medium ${
                            tx.type === "deposit"
                              ? "bg-emerald-900/60 text-emerald-300"
                              : "bg-orange-900/60 text-orange-300"
                          }`}
                        >
                          {tx.type === "deposit" ? t`Deposit` : t`Withdraw`}
                        </span>
                        <span className="text-white">{formatToken(tx.tokenAmount, cfg.symbol, cfg.tokenDecimals)}</span>
                      </div>
                      <span className="font-mono text-12 text-slate-500">#{tx.blockNumber}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* Right column                                                      */}
          {/* ================================================================ */}
          <div className="space-y-16">
            {/* Direct vault warning */}
            {showDirectWarning && (
              <div className="text-red-300 rounded-4 border border-red-700 bg-red-900/30 px-16 py-12 text-13">
                ⚠️ {t`Warning: Your position value exceeds current vault AUM. Withdrawal may be partially settled.`}
              </div>
            )}

            {/* Shortfall warning */}
            {data.shortfall > 0n && (
              <div className="border-amber-700 bg-amber-900/30 text-amber-300 rounded-4 border px-16 py-12 text-13">
                ⚠️{" "}
                {t`You have a shortfall debt of ${formatToken(data.shortfall, cfg.symbol, cfg.tokenDecimals)}. This will be settled when the insurance fund is sufficient.`}
              </div>
            )}

            {/* Deposit / Withdraw panel */}
            <div className="overflow-hidden rounded-4 border border-vantage-border bg-vantage-base">
              {/* Tab header */}
              <div className="flex border-b border-b-vantage-border">
                {(["deposit", "zap", "withdraw"] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-12 text-14 font-medium transition-colors ${activeTab === tab ? "border-b-2 border-b-vantage-accent text-vantage-text-primary" : "text-vantage-text-secondary"}`}
                  >
                    {tab === "deposit" ? t`Deposit` : tab === "zap" ? t`Zap In` : t`Withdraw`}
                  </button>
                ))}
              </div>

              <div className="p-20">
                {/* ── Deposit tab ─────────────────────────────────────────── */}
                {activeTab === "deposit" && (
                  <div className="flex flex-col gap-16">
                    <div>
                      <div className="rounded-4 border border-vantage-border bg-vantage-input px-12 py-12">
                        <div className="mb-2 flex items-center justify-between text-12 text-slate-400">
                          <span>{t`Amount`}</span>
                          <span>{cfg.symbol}</span>
                        </div>
                        <NumberInput
                          value={depositInput}
                          onValueChange={(e: ChangeEvent<HTMLInputElement>) => setDepositInput(e.target.value)}
                          placeholder="0.00"
                          maxDecimals={cfg.tokenDecimals}
                          className="bg-transparent w-full text-[36px] font-semibold text-white outline-none placeholder:text-slate-600"
                        />
                      </div>
                      {account && (
                        <div className="mt-4 text-12 text-slate-500">
                          {t`Balance`}:{" "}
                          {data.isLoading ? "…" : formatToken(data.tokenBalance, cfg.symbol, cfg.tokenDecimals)}
                        </div>
                      )}
                    </div>

                    {/* Preview */}
                    {depositAmount > 0n && (
                      <div className="space-y-4 text-13 text-slate-400">
                        <div className="flex justify-between">
                          <span>{t`Estimated VLP`}</span>
                          <span className="text-white">{formatToken(estimatedShares, "VLP")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t`Share price`}</span>
                          <span className="text-white">{formatPrice(data.sharePrice)}</span>
                        </div>
                      </div>
                    )}

                    {!account ? (
                      <button
                        disabled
                        className="w-full cursor-not-allowed rounded-4 border border-vantage-border py-14 text-15 font-semibold text-slate-500"
                      >{t`Connect wallet to deposit`}</button>
                    ) : needsApproval ? (
                      <button
                        disabled={isSubmitting || actions.isApproving}
                        onClick={() => actions.approve()}
                        className="w-full rounded-4 py-14 text-15 font-semibold transition-colors disabled:cursor-not-allowed"
                        style={approveBtnStyle}
                      >
                        {actions.isApproving ? t`Approving…` : t`Approve ${cfg.symbol}`}
                      </button>
                    ) : (
                      <button
                        disabled={depositAmount === 0n || isSubmitting}
                        onClick={handleDeposit}
                        className="w-full rounded-4 py-14 text-15 font-semibold transition-colors disabled:cursor-not-allowed"
                        style={depositBtnStyle}
                      >
                        {isSubmitting ? t`Depositing…` : t`Deposit`}
                      </button>
                    )}
                  </div>
                )}

                {/* ── Zap In tab ───────────────────────────────────────────── */}
                {activeTab === "zap" && (
                  <div className="flex flex-col gap-16">
                    {/* Token selector */}
                    <div className="flex gap-8">
                      {ZAP_TOKENS.map((zt) => (
                        <button
                          key={zt.key}
                          onClick={() => {
                            setZapToken(zt);
                            setZapInput("");
                            setZapError(null);
                          }}
                          className={`rounded-4 px-12 py-6 text-12 font-medium transition-colors ${zapToken.key === zt.key ? "bg-vantage-accent text-black" : "bg-vantage-input text-vantage-text-secondary"}`}
                        >
                          {zt.label}
                        </button>
                      ))}
                    </div>

                    {/* Amount input */}
                    <div>
                      <div className="rounded-4 border border-vantage-border bg-vantage-input px-12 py-12">
                        <div className="mb-2 flex items-center justify-between text-12 text-slate-400">
                          <span>{t`Amount`}</span>
                          <span>{zapToken.symbol}</span>
                        </div>
                        <NumberInput
                          value={zapInput}
                          onValueChange={(e: ChangeEvent<HTMLInputElement>) => {
                            setZapInput(e.target.value);
                            setZapError(null);
                          }}
                          placeholder="0.00"
                          maxDecimals={zapToken.decimals}
                          className="bg-transparent w-full text-[36px] font-semibold text-white outline-none placeholder:text-slate-600"
                        />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="space-y-4 rounded-4 bg-vantage-input p-12 text-12 text-slate-400">
                      <div className="flex justify-between">
                        <span>{t`Route`}</span>
                        <span className="text-white">
                          {zapToken.symbol} → {cfg.symbol} → VLP
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t`DEX`}</span>
                        <span className="text-white">
                          Uniswap V3 ({resolvePoolFee(zapToken.isNative ? "eth" : "usdc", cfg.symbol) / 100}% fee)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t`Slippage guard`}</span>
                        <span className="text-white">Oracle ±3%</span>
                      </div>
                    </div>

                    {zapError && (
                      <div className="rounded-4 bg-red-900/40 px-12 py-8 text-13 text-red-400">{zapError}</div>
                    )}

                    {!account ? (
                      <button
                        disabled
                        className="w-full cursor-not-allowed rounded-4 border border-vantage-border py-14 text-15 font-semibold text-slate-500"
                      >{t`Connect wallet to zap in`}</button>
                    ) : (
                      <button
                        disabled={!zapInput || parseFloat(zapInput) <= 0 || zapActions.isSubmitting}
                        onClick={handleZap}
                        className="w-full rounded-4 py-14 text-15 font-semibold transition-colors disabled:cursor-not-allowed"
                        style={zapBtnStyle}
                      >
                        {zapActions.isSubmitting ? t`Zapping…` : t`Zap In`}
                      </button>
                    )}
                  </div>
                )}

                {/* ── Withdraw tab ─────────────────────────────────────────── */}
                {activeTab === "withdraw" && (
                  <div className="flex flex-col gap-16">
                    <div>
                      <div className="rounded-4 border border-vantage-border bg-vantage-input px-12 py-12">
                        <div className="mb-2 flex items-center justify-between text-12 text-slate-400">
                          <span>{t`VLP Amount`}</span>
                          {account && data.vlpBalance > 0n && (
                            <button onClick={handleSetMaxWithdraw} className="text-12 text-vantage-accent">
                              {t`Max`}: {parseFloat(formatEther(data.vlpBalance)).toFixed(4)} VLP
                            </button>
                          )}
                        </div>
                        <NumberInput
                          value={withdrawInput}
                          onValueChange={(e: ChangeEvent<HTMLInputElement>) => setWithdrawInput(e.target.value)}
                          placeholder="0.000000"
                          maxDecimals={18}
                          className="bg-transparent w-full text-[36px] font-semibold text-white outline-none placeholder:text-slate-600"
                        />
                      </div>
                      {account && (
                        <div className="mt-4 text-12 text-slate-500">
                          {t`Balance`}: {data.isLoading ? "…" : formatToken(data.vlpBalance, "VLP")}
                        </div>
                      )}
                    </div>

                    {/* Preview */}
                    {withdrawShares > 0n && (
                      <div className="space-y-4 text-13 text-slate-400">
                        <div className="flex justify-between">
                          <span>{t`Estimated ${cfg.symbol}`}</span>
                          <span className="text-white">
                            {formatToken(estimatedTokenOut, cfg.symbol, cfg.tokenDecimals)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t`USD value`}</span>
                          <span className="text-white">{formatUsd((withdrawShares * data.sharePrice) / WAD)}</span>
                        </div>
                      </div>
                    )}

                    {!account ? (
                      <button
                        disabled
                        className="w-full cursor-not-allowed rounded-4 border border-vantage-border py-14 text-15 font-semibold text-slate-500"
                      >{t`Connect wallet to withdraw`}</button>
                    ) : (
                      <button
                        disabled={withdrawShares === 0n || isSubmitting || withdrawShares > data.vlpBalance}
                        onClick={handleWithdraw}
                        className="w-full rounded-4 py-14 text-15 font-semibold transition-colors disabled:cursor-not-allowed"
                        style={withdrawBtnStyle}
                      >
                        {isSubmitting ? t`Withdrawing…` : t`Withdraw`}
                      </button>
                    )}

                    {withdrawShares > data.vlpBalance && data.vlpBalance > 0n && (
                      <div className="text-12 text-red-400">{t`Amount exceeds your VLP balance`}</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* My Position */}
            {account && data.vlpBalance > 0n && (
              <div className="rounded-4 border border-vantage-border bg-vantage-base p-20">
                <h2 className="mb-12 text-14 font-semibold text-white">{t`My Position`}</h2>
                <div className="space-y-8 text-13">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t`VLP Balance`}</span>
                    <span className="text-white">{formatToken(data.vlpBalance, "VLP")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t`USD Value`}</span>
                    <span className="text-white">{formatUsd(data.usdValue)}</span>
                  </div>
                  {cfg.assetType === 1 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t`Token Balance`}</span>
                      <span className="text-emerald-400">
                        {formatToken(data.tokenBalance, cfg.symbol, cfg.tokenDecimals)}
                      </span>
                    </div>
                  )}
                  {cfg.assetType === 2 && data.tokenPrice > WAD && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t`Price Yield`}</span>
                      <span className="text-vantage-accent">
                        +{((parseFloat(formatEther(data.tokenPrice)) - 1) * 100).toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Debug panel (testnet only) */}
            {isTestnet && cfg.isMock && (
              <div className="rounded-4 border border-vantage-border bg-vantage-base p-20">
                <h2 className="text-slate-300 mb-12 text-13 font-semibold">{t`Debug Panel`}</h2>
                <div className="flex flex-col gap-8">
                  {/* Mint tokens */}
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => actions.debugMint(parseUnits("1000", cfg.tokenDecimals))}
                    className="w-full text-12"
                  >
                    {t`Mint 1,000 ${cfg.symbol} to wallet`}
                  </Button>

                  {/* Rebasing-specific */}
                  {cfg.assetType === 1 && (
                    <>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => actions.debugRebase(500)}
                        className="w-full text-12"
                      >
                        {t`+5% Rebase`}
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={async () => {
                          await actions.debugSyncRebasingBalance();
                          await data.refresh();
                        }}
                        className="w-full text-12"
                      >
                        {t`Sync Rebasing Balance`}
                      </Button>
                    </>
                  )}

                  {/* PriceShare / Direct price controls */}
                  {(cfg.assetType === 2 || cfg.assetType === 0) && (
                    <>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => actions.debugSetPrice((data.tokenPrice * 110n) / 100n)}
                        className="w-full text-12"
                      >
                        {t`Price +10%`}
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => actions.debugSetPrice((data.tokenPrice * 80n) / 100n)}
                        className="text-orange-400 hover:text-orange-300 w-full text-12"
                      >
                        {t`Price -20%`} {cfg.assetType === 0 ? "(liquidation test)" : ""}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatRow helper
// ---------------------------------------------------------------------------

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: "red" | "green" }) {
  const color = highlight === "red" ? "text-red-400" : highlight === "green" ? "text-emerald-400" : "text-white";
  return (
    <div>
      <div className="mb-2 text-14 text-vantage-text-secondary">{label}</div>
      <div className={`text-16 font-semibold ${color}`}>{value}</div>
    </div>
  );
}
