/**
 * RedemptionRequestList.tsx
 *
 * Shared component that shows all pending / claimable LP redemption requests
 * across every vault for the connected account, in a table layout.
 *
 * Used in:
 *   - VaultDetailPage (below the withdraw tab panel)
 *   - PortfolioPage   (below the Vault LP section)
 *
 * Columns: Vault | VLP Amount | USD Value | Next Epoch | Status | Action
 */

import { t } from "@lingui/macro";
import { Contract, formatEther, MaxUint256 } from "ethers";
import { useState } from "react";

import { usePendingTxns } from "context/PendingTxnsContext/PendingTxnsContext";
import type { RedemptionRequestItem } from "domain/vantage/lp/useAllRedemptionRequests";
import { pushSuccessNotification } from "lib/contracts/notifications";
import { helperToast } from "lib/helperToast";
import useWallet from "lib/wallets/useWallet";
import LPManagerAbi from "vantage/abis/LPManager.json";
import LPTokenAbi from "vantage/abis/LPToken.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCENT_STYLE = { background: "#ecff3e", color: "#000000" };
const DISABLED_STYLE = { background: "#334155", color: "#64748b" };

function formatUsd(wad: bigint): string {
  const n = parseFloat(formatEther(wad));
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatVlp(shares: bigint): string {
  return `${parseFloat(formatEther(shares)).toFixed(4)} VLP`;
}

function formatDate(ts: bigint): string {
  if (ts === 0n) return "—";
  return new Date(Number(ts) * 1000).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Table row
// ---------------------------------------------------------------------------

type RowProps = {
  item: RedemptionRequestItem;
  chainId: number;
  onDone: () => void;
};

function RedemptionRow({ item, chainId, onDone }: RowProps) {
  const { signer, account } = useWallet();
  const { setPendingTxns } = usePendingTxns();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { cfg, pendingShares, pendingUsdValue, nextEpochTimestamp, isClaimable } = item;

  async function handleClaim() {
    if (!signer) return;
    setIsSubmitting(true);
    try {
      const lpm = new Contract(cfg.lpManagerAddress, LPManagerAbi, signer);
      const tx = await lpm.claimRedeemedFunds();
      helperToast.info(t`Transaction submitted`);
      setPendingTxns((prev) => [...prev, { hash: tx.hash, message: t`Claiming USDC...` }]);
      const receipt = await tx.wait();
      if (receipt) {
        pushSuccessNotification(chainId, t`USDC claimed`, { transactionHash: receipt.hash });
        onDone();
      }
    } catch (err: unknown) {
      helperToast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!signer || !account) return;
    setIsSubmitting(true);
    try {
      const lpToken = new Contract(cfg.lpTokenAddress, LPTokenAbi, signer);
      const allowance = (await lpToken.allowance(account, cfg.lpManagerAddress)) as bigint;
      if (allowance < pendingShares) {
        helperToast.info(t`Approving VLP — waiting for confirmation…`);
        const approveTx = await lpToken.approve(cfg.lpManagerAddress, MaxUint256);
        await approveTx.wait();
      }
      const lpm = new Contract(cfg.lpManagerAddress, LPManagerAbi, signer);
      const tx = await lpm.cancelRedeem(pendingShares);
      helperToast.info(t`Transaction submitted`);
      setPendingTxns((prev) => [...prev, { hash: tx.hash, message: t`Cancelling redemption...` }]);
      const receipt = await tx.wait();
      if (receipt) {
        pushSuccessNotification(chainId, t`Redemption cancelled`, { transactionHash: receipt.hash });
        onDone();
      }
    } catch (err: unknown) {
      helperToast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_120px] items-center gap-0 border-b border-b-vantage-border px-20 py-14 last:border-0">
      {/* Vault */}
      <div className="flex items-center gap-10">
        {cfg.imageUrl ? (
          <img src={cfg.imageUrl} alt={cfg.symbol} className="h-32 w-32 rounded-full object-cover" />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-slate-700 text-13 font-bold text-white">
            {cfg.symbol.slice(0, 2)}
          </div>
        )}
        <span className="text-14 font-semibold text-white">{cfg.symbol}</span>
      </div>

      {/* VLP Amount */}
      <div className="text-right text-13 text-white">{formatVlp(pendingShares)}</div>

      {/* USD Value */}
      <div className={`text-right text-13 font-semibold ${isClaimable ? "text-green-300" : "text-white"}`}>
        {formatUsd(pendingUsdValue)}
      </div>

      {/* Next Epoch */}
      <div className="text-right text-13">
        {isClaimable ? (
          <span className="text-green-400">—</span>
        ) : (
          <span className="text-amber-300">{formatDate(nextEpochTimestamp)}</span>
        )}
      </div>

      {/* Status */}
      <div className="text-right">
        <span
          className={`rounded-full px-8 py-2 text-12 font-semibold ${
            isClaimable ? "bg-green-900/50 text-green-300" : "bg-amber-900/50 text-amber-300"
          }`}
        >
          {isClaimable ? t`Claimable` : t`Pending`}
        </span>
      </div>

      {/* Action */}
      <div className="flex justify-end">
        {isClaimable ? (
          <button
            disabled={isSubmitting}
            onClick={handleClaim}
            className="rounded-4 px-12 py-6 text-12 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={isSubmitting ? DISABLED_STYLE : ACCENT_STYLE}
          >
            {isSubmitting ? t`Claiming…` : t`Claim USDC`}
          </button>
        ) : (
          <button
            disabled={isSubmitting}
            onClick={handleCancel}
            className="rounded-4 border border-red-700/50 px-12 py-6 text-12 font-semibold text-red-400 transition-colors hover:bg-red-900/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? t`Cancelling…` : t`Cancel`}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

type Props = {
  items: RedemptionRequestItem[];
  isLoading: boolean;
  chainId: number;
  /** Called after a successful cancel or claim so the parent can refresh data */
  onRefresh?: () => void;
  /** When true, show a section heading (useful in PortfolioPage) */
  showHeading?: boolean;
};

export function RedemptionRequestList({ items, isLoading, chainId, onRefresh, showHeading = false }: Props) {
  if (isLoading) return null;
  if (items.length === 0) return null;

  return (
    <div className="mt-16">
      {showHeading && <h2 className="mb-12 text-16 font-bold text-white">{t`Redemption Requests`}</h2>}
      <div className="overflow-hidden rounded-4 border border-vantage-border bg-vantage-base">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_120px] items-center gap-0 border-b border-b-vantage-border px-20 py-10 text-13 text-slate-500">
          <div>{t`Vault`}</div>
          <div className="text-right">{t`VLP Amount`}</div>
          <div className="text-right">{t`USD Value`}</div>
          <div className="text-right">{t`Next Epoch`}</div>
          <div className="text-right">{t`Status`}</div>
          <div />
        </div>

        {/* Rows */}
        {items.map((item) => (
          <RedemptionRow key={item.key} item={item} chainId={chainId} onDone={() => onRefresh?.()} />
        ))}
      </div>
    </div>
  );
}
