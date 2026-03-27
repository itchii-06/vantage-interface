/**
 * VantageLPPage.tsx
 *
 * LP deposit / withdraw UI for the Vantage protocol.
 * Route: /vantage-lp
 *
 * Features:
 *   - Deposit tab: approve USDC → addLiquidity → receive VLP
 *   - Withdraw tab: input VLP shares → removeLiquidity → receive USDC
 *   - Share Price, AUM, VLP balance, estimated USD value display
 *   - Weekend lock warning (UTC Sat/Sun when weekendBufferBps > 0)
 */

import { t } from "@lingui/macro";
import { formatEther, parseUnits } from "ethers";
import { ChangeEvent, useState } from "react";

import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";
import { useVantageLPData } from "domain/vantage/lp/useVantageLPData";
import { useVantageLPActions } from "domain/vantage/lp/useVantageLPActions";

import Button from "components/Button/Button";
import NumberInput from "components/NumberInput/NumberInput";

import localhostDeployment from "vantage/deployments/frontend-localhost.json";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// USDC token address — loaded from local deployment JSON for Localhost.
// For other chains this would come from a token config per chainId.
const USDC_ADDRESS: string = localhostDeployment.addresses.tokens?.USDC ?? "";
const USDC_DECIMALS = 6;
const WAD = BigInt("1000000000000000000"); // 1e18

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUsd(wad: bigint): string {
  const n = parseFloat(formatEther(wad));
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function formatVlp(wad: bigint): string {
  const n = parseFloat(formatEther(wad));
  return n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

// ---------------------------------------------------------------------------
// Tab
// ---------------------------------------------------------------------------

type Tab = "deposit" | "withdraw";

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function VantageLPPage() {
  const { chainId } = useChainId();
  const { account } = useWallet();

  const lpData = useVantageLPData();
  const actions = useVantageLPActions(chainId);

  const [activeTab, setActiveTab] = useState<Tab>("deposit");
  const [depositInput, setDepositInput] = useState("");
  const [withdrawInput, setWithdrawInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  // Deposit: estimate VLP output
  const depositAmountUSDC: bigint = (() => {
    try {
      if (!depositInput || parseFloat(depositInput) <= 0) return 0n;
      return parseUnits(depositInput, USDC_DECIMALS);
    } catch {
      return 0n;
    }
  })();

  // Convert USDC amount to WAD for share price estimation
  const depositWad = depositAmountUSDC * BigInt(10 ** (18 - USDC_DECIMALS));
  const estimatedVlpOut =
    lpData.sharePrice > 0n ? (depositWad * WAD) / lpData.sharePrice : 0n;

  // Withdraw: parse VLP input (WAD)
  const withdrawShares: bigint = (() => {
    try {
      if (!withdrawInput || parseFloat(withdrawInput) <= 0) return 0n;
      return parseUnits(withdrawInput, 18);
    } catch {
      return 0n;
    }
  })();

  // Estimate USDC out from VLP shares
  const estimatedUsdcOut: bigint =
    withdrawShares > 0n && lpData.sharePrice > 0n
      ? (withdrawShares * lpData.sharePrice) / WAD / BigInt(10 ** (18 - USDC_DECIMALS))
      : 0n;

  // Approval check for deposit
  const needsApproval = depositAmountUSDC > 0n && actions.isApprovalNeeded(USDC_ADDRESS, depositAmountUSDC);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleDeposit() {
    if (!depositAmountUSDC) return;
    setIsSubmitting(true);
    try {
      await actions.deposit(USDC_ADDRESS, depositAmountUSDC);
      setDepositInput("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWithdraw() {
    if (!withdrawShares) return;
    setIsSubmitting(true);
    try {
      await actions.withdraw(withdrawShares, USDC_ADDRESS);
      setWithdrawInput("");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSetMaxWithdraw() {
    if (lpData.vlpBalance > 0n) {
      setWithdrawInput(formatEther(lpData.vlpBalance));
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="default-container page-layout">
      <div className="max-w-[480px] mx-auto mt-24">
        {/* ------------------------------------------------------------------ */}
        {/* Header                                                              */}
        {/* ------------------------------------------------------------------ */}
        <div className="mb-16">
          <h1 className="text-h1">Vantage LP</h1>
          <p className="text-body-medium text-slate-400 mt-4">
            {t`Provide liquidity to earn yield from trades and RWA assets.`}
          </p>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Stats row                                                           */}
        {/* ------------------------------------------------------------------ */}
        <div className="grid grid-cols-3 gap-8 mb-20 rounded-4 border border-stroke-primary bg-cold-blue-950 p-16">
          <div>
            <div className="text-slate-400 text-12 mb-4">{t`Share Price`}</div>
            <div className="font-bold text-16">
              {lpData.isLoading ? "—" : `$${formatUsd(lpData.sharePrice)}`}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-12 mb-4">{t`Total AUM`}</div>
            <div className="font-bold text-16">
              {lpData.isLoading ? "—" : `$${formatUsd(lpData.totalAum)}`}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-12 mb-4">{t`My VLP`}</div>
            <div className="font-bold text-16">
              {!account
                ? "—"
                : lpData.isLoading
                ? "…"
                : `${formatVlp(lpData.vlpBalance)} VLP`}
            </div>
            {account && lpData.vlpBalance > 0n && (
              <div className="text-slate-400 text-12">
                ≈ ${formatUsd(lpData.usdValue)}
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Weekend lock warning                                                */}
        {/* ------------------------------------------------------------------ */}
        {lpData.isWeekendLocked && (
          <div className="mb-16 rounded-4 bg-amber-900/40 border border-amber-700 px-16 py-12 text-amber-300 text-13">
            ⚠️{" "}
            {t`Withdrawals are restricted on weekends due to RWA liquidity protection. Please try again on Monday UTC.`}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Tabs                                                                */}
        {/* ------------------------------------------------------------------ */}
        <div className="rounded-4 border border-stroke-primary bg-cold-blue-950 overflow-hidden">
          {/* Tab header */}
          <div className="flex border-b border-stroke-primary">
            {(["deposit", "withdraw"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-12 text-14 font-medium transition-colors ${
                  activeTab === tab
                    ? "text-white border-b-2 border-blue-400"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab === "deposit" ? t`Deposit` : t`Withdraw`}
              </button>
            ))}
          </div>

          <div className="p-20">
            {/* ---------------------------------------------------------------- */}
            {/* Deposit tab                                                       */}
            {/* ---------------------------------------------------------------- */}
            {activeTab === "deposit" && (
              <div className="flex flex-col gap-16">
                <div>
                  <label className="text-12 text-slate-400 mb-6 block">{t`Amount (USDC)`}</label>
                  <div className="flex items-center gap-8 rounded-4 border border-stroke-primary bg-slate-800 px-12 py-10">
                    <NumberInput
                      value={depositInput}
                      onValueChange={(e: ChangeEvent<HTMLInputElement>) => setDepositInput(e.target.value)}
                      placeholder="0.00"
                      maxDecimals={USDC_DECIMALS}
                      className="flex-1 bg-transparent text-white text-16 outline-none"
                    />
                    <span className="text-slate-400 text-14 font-medium">USDC</span>
                  </div>
                </div>

                {/* Preview */}
                {depositAmountUSDC > 0n && (
                  <div className="text-13 text-slate-400 space-y-4">
                    <div className="flex justify-between">
                      <span>{t`Estimated VLP received`}</span>
                      <span className="text-white">{formatVlp(estimatedVlpOut)} VLP</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t`Share price`}</span>
                      <span className="text-white">${formatUsd(lpData.sharePrice)}</span>
                    </div>
                  </div>
                )}

                {/* Approve or Deposit button */}
                {!account ? (
                  <div className="text-center text-slate-400 text-14 py-8">
                    {t`Connect wallet to deposit`}
                  </div>
                ) : needsApproval ? (
                  <Button
                    variant="primary"
                    size="medium"
                    disabled={!depositAmountUSDC || isSubmitting || actions.isApproving}
                    onClick={() => actions.approve(USDC_ADDRESS)}
                    className="w-full"
                  >
                    {actions.isApproving ? t`Approving…` : t`Approve USDC`}
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="medium"
                    disabled={!depositAmountUSDC || isSubmitting}
                    onClick={handleDeposit}
                    className="w-full"
                  >
                    {isSubmitting ? t`Depositing…` : t`Deposit`}
                  </Button>
                )}
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* Withdraw tab                                                      */}
            {/* ---------------------------------------------------------------- */}
            {activeTab === "withdraw" && (
              <div className="flex flex-col gap-16">
                <div>
                  <div className="flex justify-between mb-6">
                    <label className="text-12 text-slate-400">{t`VLP Amount`}</label>
                    {account && lpData.vlpBalance > 0n && (
                      <button
                        onClick={handleSetMaxWithdraw}
                        className="text-12 text-blue-400 hover:text-blue-300"
                      >
                        {t`Max`}: {formatVlp(lpData.vlpBalance)}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-8 rounded-4 border border-stroke-primary bg-slate-800 px-12 py-10">
                    <NumberInput
                      value={withdrawInput}
                      onValueChange={(e: ChangeEvent<HTMLInputElement>) => setWithdrawInput(e.target.value)}
                      placeholder="0.000000"
                      maxDecimals={18}
                      className="flex-1 bg-transparent text-white text-16 outline-none"
                    />
                    <span className="text-slate-400 text-14 font-medium">VLP</span>
                  </div>
                </div>

                {/* Preview */}
                {withdrawShares > 0n && (
                  <div className="text-13 text-slate-400 space-y-4">
                    <div className="flex justify-between">
                      <span>{t`Estimated USDC received`}</span>
                      <span className="text-white">
                        {estimatedUsdcOut.toLocaleString()} USDC
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t`USD value`}</span>
                      <span className="text-white">
                        ${formatUsd((withdrawShares * lpData.sharePrice) / WAD)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Withdraw button */}
                {!account ? (
                  <div className="text-center text-slate-400 text-14 py-8">
                    {t`Connect wallet to withdraw`}
                  </div>
                ) : (
                  <Button
                    variant="primary"
                    size="medium"
                    disabled={
                      !withdrawShares ||
                      isSubmitting ||
                      lpData.isWeekendLocked ||
                      withdrawShares > lpData.vlpBalance
                    }
                    onClick={handleWithdraw}
                    className="w-full"
                  >
                    {lpData.isWeekendLocked
                      ? t`Withdrawals restricted (weekend)`
                      : isSubmitting
                      ? t`Withdrawing…`
                      : t`Withdraw`}
                  </Button>
                )}

                {withdrawShares > lpData.vlpBalance && lpData.vlpBalance > 0n && (
                  <div className="text-red-400 text-12">
                    {t`Amount exceeds your VLP balance`}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
