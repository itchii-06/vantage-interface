/**
 * VaultsPage.tsx
 *
 * Kamino Lend-style table view of all 4 Vaults.
 * Route: /vaults
 *
 * Columns: Asset | Type | AUM | APY | My Deposit
 * Interaction: row click → /vaults/:address
 */

import { t } from "@lingui/macro";
import { formatEther } from "ethers";
import { useState } from "react";
import { useHistory } from "react-router-dom";

import { useVaultApy } from "domain/vantage/vaults/useVaultApy";
import { useVaultList } from "domain/vantage/vaults/useVaultList";
import { ASSET_TYPE_COLOR, ASSET_TYPE_LABEL, VAULT_CONFIGS } from "domain/vantage/vaults/vaultConfig";
import useWallet from "lib/wallets/useWallet";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUsd(wad: bigint): string {
  const n = parseFloat(formatEther(wad));
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Sort types
// ---------------------------------------------------------------------------

type SortKey = "aum" | "apy" | "none";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VaultsPage() {
  const { account } = useWallet();
  const history = useHistory();
  const items = useVaultList();

  // APY per vault — hooks must be called unconditionally in fixed order
  const apy0 = useVaultApy(VAULT_CONFIGS[0]);
  const apy1 = useVaultApy(VAULT_CONFIGS[1]);
  const apy2 = useVaultApy(VAULT_CONFIGS[2]);
  const apy3 = useVaultApy(VAULT_CONFIGS[3]);
  const apyByKey: Record<string, number | null> = {
    [VAULT_CONFIGS[0].key]: apy0,
    [VAULT_CONFIGS[1].key]: apy1,
    [VAULT_CONFIGS[2].key]: apy2,
    [VAULT_CONFIGS[3].key]: apy3,
  };

  const [sortKey, setSortKey] = useState<SortKey>("none");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...items].sort((a, b) => {
    if (sortKey === "aum") {
      return sortDir === "desc" ? Number(b.aum - a.aum) : Number(a.aum - b.aum);
    }
    if (sortKey === "apy") {
      const apyA = apyByKey[a.key] ?? -Infinity;
      const apyB = apyByKey[b.key] ?? -Infinity;
      return sortDir === "desc" ? apyB - apyA : apyA - apyB;
    }
    return 0;
  });

  return (
    <div className="default-container page-layout">
      <div className="mx-auto mt-24 max-w-[900px]">
        {/* Header */}
        <div className="mb-24">
          <h1 className="text-h1">{t`Vaults`}</h1>
          <p className="text-body-medium mt-4 text-slate-400">{t`Provide liquidity to earn yield from RWA assets.`}</p>
        </div>

        {/* Table */}
        <div className="bg-cold-blue-950 overflow-hidden rounded-4 border border-stroke-primary">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-0 border-b border-stroke-primary px-20 py-12 text-12 text-slate-400">
            <div>{t`Asset`}</div>
            <div
              className={`cursor-pointer select-none text-right transition-colors hover:text-white ${sortKey === "aum" ? "text-white" : ""}`}
              onClick={() => handleSort("aum")}
            >
              {t`AUM`} {sortKey === "aum" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
            </div>
            <div
              className={`cursor-pointer select-none text-right transition-colors hover:text-white ${sortKey === "apy" ? "text-white" : ""}`}
              onClick={() => handleSort("apy")}
            >
              {t`APY`} {sortKey === "apy" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
            </div>
            <div className="text-right">{t`Type`}</div>
            <div className="text-right">{account ? t`My Deposit` : ""}</div>
          </div>

          {/* Rows */}
          {sorted.map((item) => {
            const apy = apyByKey[item.key];
            return (
              <div
                key={item.key}
                onClick={() => item.vaultAddress && history.push(`/vaults/${item.vaultAddress}`)}
                className="grid cursor-pointer grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-0 border-b border-stroke-primary px-20 py-16 transition-colors last:border-0 hover:bg-slate-800/40"
              >
                {/* Asset */}
                <div className="flex items-center gap-12">
                  <div className="flex h-36 w-36 items-center justify-center rounded-full bg-slate-700 text-14 font-bold text-white">
                    {item.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-15 font-semibold text-white">{item.symbol}</div>
                    <div className="text-12 text-slate-400">{item.name}</div>
                  </div>
                </div>

                {/* AUM */}
                <div className="text-right">
                  {item.isLoading ? (
                    <span className="text-slate-500">—</span>
                  ) : (
                    <span className="text-15 font-medium text-white">{formatUsd(item.aum)}</span>
                  )}
                </div>

                {/* APY */}
                <div className="text-right">
                  {apy === null ? (
                    <span className="text-14 text-slate-500">—</span>
                  ) : (
                    <span className="text-15 font-medium text-green-400">{(apy * 100).toFixed(2)}%</span>
                  )}
                </div>

                {/* Type badge */}
                <div className="flex justify-end">
                  <span className={`rounded-full px-8 py-2 text-11 font-medium ${ASSET_TYPE_COLOR[item.assetType]}`}>
                    {ASSET_TYPE_LABEL[item.assetType]}
                  </span>
                </div>

                {/* My Deposit */}
                <div className="text-right">
                  {!account ? (
                    <span className="text-14 text-slate-500">—</span>
                  ) : item.isLoading ? (
                    <span className="text-14 text-slate-500">…</span>
                  ) : item.usdValue > 0n ? (
                    <span className="text-15 font-medium text-white">{formatUsd(item.usdValue)}</span>
                  ) : (
                    <span className="text-14 text-slate-500">—</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {items.length === 0 && (
            <div className="py-40 text-center text-14 text-slate-400">
              {t`No vaults configured. Deploy contracts first.`}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {!account && (
          <p className="mt-16 text-center text-13 text-slate-500">{t`Connect your wallet to see your deposits.`}</p>
        )}
      </div>
    </div>
  );
}
