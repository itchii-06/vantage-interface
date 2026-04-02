/**
 * SpreadBadge.tsx
 *
 * Displays Bid / Ask prices and the spread in basis points.
 */

import { t } from "@lingui/macro";
import { formatEther } from "ethers";

import type { SpreadData } from "domain/vantage/trade/useSpread";

function fmtPrice(wad: bigint): string {
  return `$${parseFloat(formatEther(wad)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

export function SpreadBadge({ spread }: { spread: SpreadData }) {
  if (spread.isLoading || spread.askPrice === 0n) return null;

  const spreadColor =
    spread.spreadBps < 10 ? "text-green-400" : spread.spreadBps < 50 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="flex items-center justify-between rounded-4 border border-stroke-primary bg-cold-blue-900 px-12 py-8 text-12">
      <div className="flex gap-16">
        <span>
          <span className="text-slate-400">{t`Bid`} </span>
          <span className="font-medium text-white">{fmtPrice(spread.bidPrice)}</span>
        </span>
        <span>
          <span className="text-slate-400">{t`Ask`} </span>
          <span className="font-medium text-white">{fmtPrice(spread.askPrice)}</span>
        </span>
      </div>
      <span className={`font-medium ${spreadColor}`}>
        {t`Spread`} {spread.spreadBps} bps
      </span>
    </div>
  );
}
