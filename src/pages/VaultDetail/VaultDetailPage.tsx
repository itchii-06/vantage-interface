/**
 * VaultDetailPage.tsx
 *
 * Uniswap-style vault detail page.
 * Route: /vaults/:address
 *
 * Layout: left column (stats + chart) | right column (deposit/withdraw + debug)
 */

import { t } from "@lingui/macro";
import { formatEther, parseUnits } from "ethers";
import { ChangeEvent, useState } from "react";
import { useHistory, useParams } from "react-router-dom";

import { useVaultActions } from "domain/vantage/vaults/useVaultActions";
import { useVaultDetail } from "domain/vantage/vaults/useVaultDetail";
import { ASSET_TYPE_COLOR, ASSET_TYPE_LABEL, getVaultConfigByAddress } from "domain/vantage/vaults/vaultConfig";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";

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

function formatToken(wad: bigint, symbol: string): string {
  const n = parseFloat(formatEther(wad));
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
      <polyline points={pts.join(" ")} fill="none" stroke={isPositive ? "#34d399" : "#f87171"} strokeWidth="2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

type Tab = "deposit" | "withdraw";

export default function VaultDetailPage() {
  const { address } = useParams<{ address: string }>();
  const history = useHistory();
  const { account } = useWallet();
  const { chainId } = useChainId();

  const cfg = getVaultConfigByAddress(address);

  const data = useVaultDetail(cfg!);
  const actions = useVaultActions(cfg!, chainId);

  const [activeTab, setActiveTab] = useState<Tab>("deposit");
  const [depositInput, setDepositInput] = useState("");
  const [withdrawInput, setWithdrawInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTestnet = !MAINNET_CHAIN_IDS.has(chainId);

  // ── Config missing guard ────────────────────────────────────────────────────
  if (!cfg) {
    return (
      <div className="default-container page-layout">
        <div className="mx-auto mt-40 max-w-[600px] text-center">
          <p className="text-16 text-slate-400">{t`Vault not found: ${address}`}</p>
          <Button variant="secondary" size="medium" className="mt-16" onClick={() => history.push("/vaults")}>
            {t`← Back to Vaults`}
          </Button>
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

  // Show Approve button if:
  //   - wallet connected, AND
  //   - no allowance at all (amount not yet entered), OR allowance < entered amount
  const needsApproval =
    Boolean(account) && (depositAmount > 0n ? actions.isApprovalNeeded(depositAmount) : actions.allowance === 0n);

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="default-container page-layout">
      <div className="mx-auto mt-24 max-w-[1100px]">
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
            <div className="bg-cold-blue-950 rounded-4 border border-stroke-primary p-20">
              <div className="mb-8 flex items-center gap-12">
                <div className="flex h-40 w-40 items-center justify-center rounded-full bg-slate-700 text-16 font-bold text-white">
                  {cfg.symbol.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-8">
                    <h1 className="text-20 font-bold text-white">{cfg.symbol}</h1>
                    <span className={`rounded-full px-8 py-2 text-11 font-medium ${ASSET_TYPE_COLOR[cfg.assetType]}`}>
                      {ASSET_TYPE_LABEL[cfg.assetType]}
                    </span>
                    {cfg.assetType === 1 && (
                      <span className="bg-emerald-900/40 text-emerald-400 animate-pulse rounded-full px-8 py-2 text-11">
                        {t`Auto-growing`}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-13 text-slate-400">{cfg.name}</div>
                </div>
              </div>

              {/* Price row */}
              <div className="mt-12 flex items-baseline gap-8">
                <span className="text-28 font-bold text-white">{formatPrice(data.tokenPrice)}</span>
                <span className="text-14 text-slate-400">{t`per token`}</span>
              </div>
            </div>

            {/* AUM Chart */}
            <div className="bg-cold-blue-950 rounded-4 border border-stroke-primary p-20">
              <div className="mb-12 flex items-center justify-between">
                <h2 className="text-14 font-semibold text-white">{t`AUM`}</h2>
                <span className="text-13 text-slate-400">{t`Live (15s poll)`}</span>
              </div>
              <AumSparkline history={data.aumHistory} />
            </div>

            {/* Stats */}
            <div className="bg-cold-blue-950 rounded-4 border border-stroke-primary p-20">
              <h2 className="mb-16 text-14 font-semibold text-white">{t`Stats`}</h2>
              <div className="grid grid-cols-2 gap-16">
                <StatRow label={t`Total AUM`} value={data.isLoading ? "—" : formatUsd(data.aum)} />
                <StatRow label={t`Share Price`} value={data.isLoading ? "—" : formatPrice(data.sharePrice)} />
                {account && (
                  <StatRow label={t`My Deposit (USD)`} value={data.isLoading ? "—" : formatUsd(data.usdValue)} />
                )}
                {account && data.shortfall > 0n && (
                  <StatRow label={t`Shortfall Debt`} value={formatToken(data.shortfall, cfg.symbol)} highlight="red" />
                )}
              </div>
            </div>
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
                {t`You have a shortfall debt of ${formatToken(data.shortfall, cfg.symbol)}. This will be settled when the insurance fund is sufficient.`}
              </div>
            )}

            {/* Deposit / Withdraw panel */}
            <div className="bg-cold-blue-950 overflow-hidden rounded-4 border border-stroke-primary">
              {/* Tab header */}
              <div className="flex border-b border-stroke-primary">
                {(["deposit", "withdraw"] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-12 text-14 font-medium transition-colors ${
                      activeTab === tab
                        ? "border-b-2 border-blue-400 text-white"
                        : "hover:text-slate-200 text-slate-400"
                    }`}
                  >
                    {tab === "deposit" ? t`Deposit` : t`Withdraw`}
                  </button>
                ))}
              </div>

              <div className="p-20">
                {/* ── Deposit tab ─────────────────────────────────────────── */}
                {activeTab === "deposit" && (
                  <div className="flex flex-col gap-16">
                    <div>
                      <label className="mb-6 block text-12 text-slate-400">
                        {t`Amount`} ({cfg.symbol})
                      </label>
                      <div className="flex items-center gap-8 rounded-4 border border-stroke-primary bg-slate-800 px-12 py-10">
                        <NumberInput
                          value={depositInput}
                          onValueChange={(e: ChangeEvent<HTMLInputElement>) => setDepositInput(e.target.value)}
                          placeholder="0.00"
                          maxDecimals={cfg.tokenDecimals}
                          className="bg-transparent flex-1 text-16 text-white outline-none"
                        />
                        <span className="text-14 font-medium text-slate-400">{cfg.symbol}</span>
                      </div>
                      {account && data.tokenBalance > 0n && (
                        <div className="mt-4 text-12 text-slate-500">
                          {t`Balance`}: {formatToken(data.tokenBalance, cfg.symbol)}
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
                      <div className="py-8 text-center text-14 text-slate-400">{t`Connect wallet to deposit`}</div>
                    ) : needsApproval ? (
                      <Button
                        variant="primary"
                        size="medium"
                        disabled={isSubmitting || actions.isApproving}
                        onClick={() => actions.approve()}
                        className="w-full"
                      >
                        {actions.isApproving ? t`Approving…` : t`Approve ${cfg.symbol}`}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="medium"
                        disabled={depositAmount === 0n || isSubmitting}
                        onClick={handleDeposit}
                        className="w-full"
                      >
                        {isSubmitting ? t`Depositing…` : t`Deposit`}
                      </Button>
                    )}
                  </div>
                )}

                {/* ── Withdraw tab ─────────────────────────────────────────── */}
                {activeTab === "withdraw" && (
                  <div className="flex flex-col gap-16">
                    <div>
                      <div className="mb-6 flex justify-between">
                        <label className="text-12 text-slate-400">{t`VLP Amount`}</label>
                        {account && data.vlpBalance > 0n && (
                          <button onClick={handleSetMaxWithdraw} className="text-12 text-blue-400 hover:text-blue-300">
                            {t`Max`}: {parseFloat(formatEther(data.vlpBalance)).toFixed(4)} VLP
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-8 rounded-4 border border-stroke-primary bg-slate-800 px-12 py-10">
                        <NumberInput
                          value={withdrawInput}
                          onValueChange={(e: ChangeEvent<HTMLInputElement>) => setWithdrawInput(e.target.value)}
                          placeholder="0.000000"
                          maxDecimals={18}
                          className="bg-transparent flex-1 text-16 text-white outline-none"
                        />
                        <span className="text-14 font-medium text-slate-400">VLP</span>
                      </div>
                    </div>

                    {/* Preview */}
                    {withdrawShares > 0n && (
                      <div className="space-y-4 text-13 text-slate-400">
                        <div className="flex justify-between">
                          <span>{t`Estimated ${cfg.symbol}`}</span>
                          <span className="text-white">{formatToken(estimatedTokenOut, cfg.symbol)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t`USD value`}</span>
                          <span className="text-white">{formatUsd((withdrawShares * data.sharePrice) / WAD)}</span>
                        </div>
                      </div>
                    )}

                    {!account ? (
                      <div className="py-8 text-center text-14 text-slate-400">{t`Connect wallet to withdraw`}</div>
                    ) : (
                      <Button
                        variant="primary"
                        size="medium"
                        disabled={withdrawShares === 0n || isSubmitting || withdrawShares > data.vlpBalance}
                        onClick={handleWithdraw}
                        className="w-full"
                      >
                        {isSubmitting ? t`Withdrawing…` : t`Withdraw`}
                      </Button>
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
              <div className="bg-cold-blue-950 rounded-4 border border-stroke-primary p-20">
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
                      <span className="text-emerald-400">{formatToken(data.tokenBalance, cfg.symbol)}</span>
                    </div>
                  )}
                  {cfg.assetType === 2 && data.tokenPrice > WAD && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t`Price Yield`}</span>
                      <span className="text-blue-400">
                        +{((parseFloat(formatEther(data.tokenPrice)) - 1) * 100).toFixed(2)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Debug panel (testnet only) */}
            {isTestnet && cfg.isMock && (
              <div className="bg-cold-blue-950 rounded-4 border border-stroke-primary p-20">
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
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => actions.debugRebase(500)}
                      className="w-full text-12"
                    >
                      {t`+5% Rebase`}
                    </Button>
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

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: "red" }) {
  return (
    <div>
      <div className="mb-2 text-12 text-slate-400">{label}</div>
      <div className={`text-14 font-semibold ${highlight === "red" ? "text-red-400" : "text-white"}`}>{value}</div>
    </div>
  );
}
