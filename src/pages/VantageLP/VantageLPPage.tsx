/**
 * VantageLPPage.tsx
 *
 * Route: /vantage-lp
 *
 * LP deposit / withdraw UI for the Vantage protocol.
 *
 * Features:
 *   - Share Price / AUM / VLP balance stats
 *   - Monthly redemption countdown (Issue #181)
 *   - Pending redemption status (Issue #181)
 *   - Deposit tab: approve USDC → addLiquidity → receive VLP
 *   - Withdraw tab: input VLP shares → removeLiquidity → receive USDC
 *   - Weekend lock warning
 */

import { t } from "@lingui/macro";
import { formatEther, formatUnits, parseUnits } from "ethers";
import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { useVantageLPActions } from "domain/vantage/lp/useVantageLPActions";
import { useVantageLPData } from "domain/vantage/lp/useVantageLPData";
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
  const [countdown, setCountdown] = useState("");

  // ---------------------------------------------------------------------------
  // Redemption countdown (ticks every second)
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const depositAmountUSDC: bigint = useMemo(() => {
    try {
      if (!depositInput || parseFloat(depositInput) <= 0) return 0n;
      return parseUnits(depositInput, USDC_DECIMALS);
    } catch {
      return 0n;
    }
  }, [depositInput]);

  const depositWad = depositAmountUSDC * BigInt(10 ** (18 - USDC_DECIMALS));
  const estimatedVlpOut = lpData.sharePrice > 0n ? (depositWad * WAD) / lpData.sharePrice : 0n;

  const withdrawShares: bigint = useMemo(() => {
    try {
      if (!withdrawInput || parseFloat(withdrawInput) <= 0) return 0n;
      return parseUnits(withdrawInput, 18);
    } catch {
      return 0n;
    }
  }, [withdrawInput]);

  const estimatedUsdcOut: bigint =
    withdrawShares > 0n && lpData.sharePrice > 0n
      ? (withdrawShares * lpData.sharePrice) / WAD / BigInt(10 ** (18 - USDC_DECIMALS))
      : 0n;

  const needsApproval = depositAmountUSDC > 0n && actions.isApprovalNeeded(USDC_ADDRESS, depositAmountUSDC);

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

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleDeposit() {
    if (depositAmountUSDC === 0n) return;
    setIsSubmitting(true);
    try {
      await actions.deposit(USDC_ADDRESS, depositAmountUSDC);
      setDepositInput("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWithdraw() {
    if (withdrawShares === 0n) return;
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
    <div className="w-full">
      <div className="border-b border-stroke-primary px-16 py-8">
        <AppHeader leftContent={<AppNav />} />
      </div>

      <div className="mt-24 px-16">
        <div className="mx-auto max-w-[480px]">
          {/* Header */}
          <div className="mb-16">
            <h1 className="text-h1">Portfolio</h1>
            <p className="text-body-medium mt-4 text-slate-400">
              {t`Provide liquidity to earn yield from trades and RWA assets.`}
            </p>
          </div>

          {/* Stats row */}
          <div className="bg-cold-blue-950 mb-20 grid grid-cols-3 gap-8 rounded-4 border border-stroke-primary p-16">
            <div>
              <div className="mb-4 text-12 text-slate-400">{t`Share Price`}</div>
              <div className="text-16 font-bold">{lpData.isLoading ? "—" : `$${formatUsd(lpData.sharePrice)}`}</div>
            </div>
            <div>
              <div className="mb-4 text-12 text-slate-400">{t`Total AUM`}</div>
              <div className="text-16 font-bold">{lpData.isLoading ? "—" : `$${formatUsd(lpData.totalAum)}`}</div>
            </div>
            <div>
              <div className="mb-4 text-12 text-slate-400">{t`My VLP`}</div>
              <div className="text-16 font-bold">
                {!account ? "—" : lpData.isLoading ? "…" : `${formatVlp(lpData.vlpBalance)} VLP`}
              </div>
              {account && lpData.vlpBalance > 0n && (
                <div className="text-12 text-slate-400">≈ ${formatUsd(lpData.usdValue)}</div>
              )}
            </div>
          </div>

          {/* Redemption countdown */}
          {!lpData.isLoading && lpData.nextEpochTimestamp > 0n && (
            <div className="text-slate-300 mb-16 rounded-4 border border-slate-600/40 bg-slate-800/30 px-16 py-12 text-13">
              <span className="text-slate-400">{t`Next redemption execution:`}</span>{" "}
              <span className="font-semibold tabular-nums text-white">{countdown}</span>
            </div>
          )}

          {/* Pending redemption status */}
          {account && lpData.pendingShares > 0n && (
            <div className="bg-blue-900/20 mb-16 rounded-4 border border-blue-600/40 px-16 py-12 text-13">
              <div className="font-semibold text-blue-300">{t`Redemption pending — yield continues to accrue`}</div>
              <div className="mt-4 text-12 text-blue-400">
                {formatVlp(lpData.pendingShares)} VLP ≈ ${pendingUsdFormatted}
              </div>
            </div>
          )}

          {/* Weekend lock warning */}
          {lpData.isWeekendLocked && (
            <div className="bg-amber-900/40 border-amber-700 text-amber-300 mb-16 rounded-4 border px-16 py-12 text-13">
              ⚠️{" "}
              {t`Withdrawals are restricted on weekends due to RWA liquidity protection. Please try again on Monday UTC.`}
            </div>
          )}

          {/* Tabs */}
          <div className="bg-cold-blue-950 overflow-hidden rounded-4 border border-stroke-primary">
            <div className="flex border-b border-stroke-primary">
              {(["deposit", "withdraw"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-12 text-14 font-medium transition-colors ${
                    activeTab === tab ? "border-b-2 border-blue-400 text-white" : "hover:text-slate-200 text-slate-400"
                  }`}
                >
                  {tab === "deposit" ? t`Deposit` : t`Withdraw`}
                </button>
              ))}
            </div>

            <div className="p-20">
              {/* Deposit tab */}
              {activeTab === "deposit" && (
                <div className="flex flex-col gap-16">
                  <div>
                    <label className="mb-6 block text-12 text-slate-400">{t`Amount (USDC)`}</label>
                    <div className="flex items-center gap-8 rounded-4 border border-stroke-primary bg-slate-800 px-12 py-10">
                      <NumberInput
                        value={depositInput}
                        onValueChange={(e: ChangeEvent<HTMLInputElement>) => setDepositInput(e.target.value)}
                        placeholder="0.00"
                        maxDecimals={USDC_DECIMALS}
                        className="bg-transparent flex-1 text-16 text-white outline-none"
                      />
                      <span className="text-14 font-medium text-slate-400">USDC</span>
                    </div>
                  </div>

                  {depositAmountUSDC > 0n && (
                    <div className="space-y-4 text-13 text-slate-400">
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

                  {!account ? (
                    <div className="py-8 text-center text-14 text-slate-400">{t`Connect wallet to deposit`}</div>
                  ) : needsApproval ? (
                    <Button
                      variant="primary"
                      size="medium"
                      disabled={depositAmountUSDC === 0n || isSubmitting || actions.isApproving}
                      onClick={() => actions.approve(USDC_ADDRESS)}
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
              )}

              {/* Withdraw tab */}
              {activeTab === "withdraw" && (
                <div className="flex flex-col gap-16">
                  <div>
                    <div className="mb-6 flex justify-between">
                      <label className="text-12 text-slate-400">{t`VLP Amount`}</label>
                      {account && lpData.vlpBalance > 0n && (
                        <button onClick={handleSetMaxWithdraw} className="text-12 text-blue-400 hover:text-blue-300">
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
                        className="bg-transparent flex-1 text-16 text-white outline-none"
                      />
                      <span className="text-14 font-medium text-slate-400">VLP</span>
                    </div>
                  </div>

                  {withdrawShares > 0n && (
                    <div className="space-y-4 text-13 text-slate-400">
                      <div className="flex justify-between">
                        <span>{t`Estimated USDC received`}</span>
                        <span className="text-white">
                          {parseFloat(formatUnits(estimatedUsdcOut, USDC_DECIMALS)).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          USDC
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t`USD value`}</span>
                        <span className="text-white">${formatUsd((withdrawShares * lpData.sharePrice) / WAD)}</span>
                      </div>
                    </div>
                  )}

                  {!account ? (
                    <div className="py-8 text-center text-14 text-slate-400">{t`Connect wallet to withdraw`}</div>
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
                      {lpData.isWeekendLocked
                        ? t`Withdrawals restricted (weekend)`
                        : isSubmitting
                          ? t`Withdrawing…`
                          : t`Withdraw`}
                    </Button>
                  )}

                  {withdrawShares > lpData.vlpBalance && lpData.vlpBalance > 0n && (
                    <div className="text-12 text-red-400">{t`Amount exceeds your VLP balance`}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
