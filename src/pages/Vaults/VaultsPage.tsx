/**
 * VaultsPage.tsx
 *
 * Vault list page split into Senior (Priority Layer) and Junior (Performance Layer) sections.
 * Route: /vaults
 *
 * Columns: Asset | Type | AUM | APY | My Deposit
 * Interaction: row click → /vaults/:address
 */

import { t } from "@lingui/macro";
import { formatEther } from "ethers";
import { useMemo, useState } from "react";
import { useHistory } from "react-router-dom";

import { useVaultApy } from "domain/vantage/vaults/useVaultApy";
import { type VaultListItem } from "domain/vantage/vaults/useVaultList";
import { useVaultList } from "domain/vantage/vaults/useVaultList";
import {
  ASSET_TYPE_COLOR,
  ASSET_TYPE_LABEL,
  VAULT_CONFIGS,
  getTrancheMeta,
  type TrancheType,
} from "domain/vantage/vaults/vaultConfig";
import useWallet from "lib/wallets/useWallet";
import { COLORS } from "styles/vantageTheme";

import { AppHeader } from "components/AppHeader/AppHeader";
import { AppNav } from "components/AppNav/AppNav";
import { VantagePageContainer } from "components/VantagePageContainer/VantagePageContainer";

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
// Waterfall diagram — shows yield/risk flow between tranches
// ---------------------------------------------------------------------------

function WaterfallDiagram() {
  return (
    <div className="mb-28 rounded-4 border border-vantage-border bg-vantage-base p-20">
      <h2 className="mb-16 text-13 font-semibold text-slate-400">{t`Tranche Structure`}</h2>
      <div className="flex flex-col gap-0 sm:flex-row sm:items-stretch sm:gap-0">
        {/* Protocol Revenue box */}
        <div className="flex flex-1 flex-col items-center justify-center rounded-4 border border-slate-700 bg-slate-800/60 px-16 py-14 text-center">
          <div className="text-slate-300 mb-4 text-16">⬇</div>
          <div className="text-slate-200 text-13 font-semibold">{t`Protocol Revenue`}</div>
          <div className="mt-4 text-12 text-slate-500">{t`RWA yield + Trading fees`}</div>
        </div>

        {/* Arrow right */}
        <div className="flex items-center justify-center px-8 text-slate-600 sm:px-12">→</div>

        {/* Senior box */}
        <div className="border-indigo-700/50 bg-indigo-900/20 flex flex-1 flex-col justify-between rounded-4 border px-16 py-14">
          <div className="mb-8 flex items-center gap-8">
            <span className="text-16">🛡️</span>
            <span className="text-indigo-300 text-14 font-semibold">{t`Senior Vaults`}</span>
            <span className="border-indigo-700 bg-indigo-900/60 text-indigo-300 rounded-full border px-8 py-1 text-11">
              {t`Priority Layer`}
            </span>
          </div>
          <div className="leading-relaxed text-12 text-slate-400">
            {t`Receives yield first. Junior capital cushions any losses.`}
          </div>
          <div className="mt-8 flex items-center gap-6 text-12 text-green-400">
            <span className="h-8 w-8 rounded-full bg-green-500" />
            {t`Lower risk · Stable yield`}
          </div>
        </div>

        {/* Arrow right */}
        <div className="flex items-center justify-center px-8 text-slate-600 sm:px-12">→</div>

        {/* Junior box */}
        <div className="border-amber-700/50 bg-amber-900/20 flex flex-1 flex-col justify-between rounded-4 border px-16 py-14">
          <div className="mb-8 flex items-center gap-8">
            <span className="text-16">🚀</span>
            <span className="text-amber-300 text-14 font-semibold">{t`Junior Vault`}</span>
            <span className="border-amber-700 bg-amber-900/60 text-amber-300 rounded-full border px-8 py-1 text-11">
              {t`Performance Layer`}
            </span>
          </div>
          <div className="leading-relaxed text-12 text-slate-400">
            {t`Captures residual yield after Senior. Absorbs FR deficits first.`}
          </div>
          <div className="text-amber-400 mt-8 flex items-center gap-6 text-12">
            <span className="bg-amber-500 h-8 w-8 rounded-full" />
            {t`Higher APY · First-loss layer`}
          </div>
        </div>
      </div>

      {/* Tooltip hint */}
      <p className="mt-12 text-12 text-slate-600">
        💡{" "}
        {t`Senior: "Always gets served first at the buffet." Junior: "Gets whatever is left — but more of it, faster."`}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VaultTable — shared table component used by each tranche section
// ---------------------------------------------------------------------------

type VaultTableProps = {
  items: VaultListItem[];
  apyByKey: Record<string, number | null>;
  account: string | null | undefined;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onRowClick: (item: VaultListItem) => void;
};

function VaultTable({ items, apyByKey, account, sortKey, sortDir, onSort, onRowClick }: VaultTableProps) {
  const sorted = [...items].sort((a, b) => {
    if (sortKey === "aum") return sortDir === "desc" ? Number(b.aum - a.aum) : Number(a.aum - b.aum);
    if (sortKey === "apy") {
      const apyA = apyByKey[a.key] ?? -Infinity;
      const apyB = apyByKey[b.key] ?? -Infinity;
      return sortDir === "desc" ? apyB - apyA : apyA - apyB;
    }
    return 0;
  });

  return (
    <div className="overflow-hidden rounded-4 border-b border-b-vantage-border bg-vantage-base">
      {/* Table header */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-0 border-b border-b-vantage-border px-20 py-12 text-12 text-vantage-text-secondary">
        <div>{t`Asset`}</div>
        <div
          className={`cursor-pointer select-none text-right transition-colors hover:text-white ${sortKey === "aum" ? "text-white" : ""}`}
          onClick={() => onSort("aum")}
        >
          {t`AUM`} {sortKey === "aum" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
        </div>
        <div
          className={`cursor-pointer select-none text-right transition-colors hover:text-white ${sortKey === "apy" ? "text-white" : ""}`}
          onClick={() => onSort("apy")}
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
            onClick={() => onRowClick(item)}
            className="grid cursor-pointer grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-0 border-b border-b-vantage-border px-20 py-16 transition-colors last:border-0 hover:bg-slate-800/40"
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = COLORS.baseHover)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            {/* Asset */}
            <div className="flex items-center gap-12">
              <div className="flex h-56 w-56 items-center justify-center rounded-full bg-slate-700 text-14 font-bold text-white">
                {item.symbol.slice(0, 2)}
              </div>
              <div>
                <div className="flex items-center gap-8">
                  <div className="text-16 font-semibold text-white">{item.symbol}</div>
                  <span
                    className={`rounded-full px-8 py-1 text-11 font-medium ${getTrancheMeta()[item.trancheType].badgeClass}`}
                  >
                    {getTrancheMeta()[item.trancheType].shortLabel} · {getTrancheMeta()[item.trancheType].riskLabel}
                  </span>
                </div>
                <div className="text-14 text-vantage-text-secondary">{item.name}</div>
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

            {/* Asset Type badge */}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrancheSection — heading + description + table for one tranche
// ---------------------------------------------------------------------------

type TrancheSectionProps = {
  tranche: TrancheType;
  items: VaultListItem[];
  apyByKey: Record<string, number | null>;
  account: string | null | undefined;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onRowClick: (item: VaultListItem) => void;
};

function TrancheSection({
  tranche,
  items,
  apyByKey,
  account,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
}: TrancheSectionProps) {
  const meta = getTrancheMeta()[tranche];
  const icon = tranche === "senior" ? "🛡️" : "🚀";

  return (
    <div className="mb-28">
      {/* Section header */}
      <div className={`mb-12 pl-12`}>
        <div className="flex items-center gap-10">
          <span className="text-20">{icon}</span>
          <div>
            <h2 className="text-16 font-bold text-white">
              {meta.labelPlural} <span className="ml-4 text-14 font-normal text-slate-400">({meta.riskLabel})</span>
            </h2>
            <p className="leading-relaxed mt-2 text-13 text-slate-400">{meta.description}</p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-4 border border-vantage-border bg-vantage-base py-32 text-center text-14 text-slate-500">
          {t`No vaults in this category.`}
        </div>
      ) : (
        <VaultTable
          items={items}
          apyByKey={apyByKey}
          account={account}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          onRowClick={onRowClick}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function VaultsPage() {
  const { account } = useWallet();
  const history = useHistory();
  const items = useVaultList();

  // APY per vault — hooks must be called unconditionally in fixed order
  // VAULT_CONFIGS[0..4]: usdc, mBUIDL, mUSDY, mRWA, sUSDe (non-prism)
  const apy0 = useVaultApy(VAULT_CONFIGS[0]);
  const apy1 = useVaultApy(VAULT_CONFIGS[1]);
  const apy2 = useVaultApy(VAULT_CONFIGS[2]);
  const apy3 = useVaultApy(VAULT_CONFIGS[3]);
  const apy4 = useVaultApy(VAULT_CONFIGS[4]);
  const apyByKey: Record<string, number | null> = useMemo(
    () => ({
      [VAULT_CONFIGS[0].key]: apy0,
      [VAULT_CONFIGS[1].key]: apy1,
      [VAULT_CONFIGS[2].key]: apy2,
      [VAULT_CONFIGS[3].key]: apy3,
      [VAULT_CONFIGS[4].key]: apy4,
    }),
    [apy0, apy1, apy2, apy3, apy4]
  );

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

  const seniorItems = items.filter((v) => v.trancheType === "senior");
  const juniorItems = items.filter((v) => v.trancheType === "junior");

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-b-vantage-border px-16 py-8">
        <AppHeader leftContent={<AppNav />} />
      </div>

      <VantagePageContainer
        title={t`Vaults`}
        description={t`Choose your risk-return profile: Senior vaults offer stability, Junior captures higher yield.`}
      >
        {/* Waterfall structure diagram */}
        <WaterfallDiagram />

        {/* Senior Vaults section */}
        <TrancheSection
          tranche="senior"
          items={seniorItems}
          apyByKey={apyByKey}
          account={account}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={(item) => history.push(`/vaults/${item.vaultAddress || item.key}`)}
        />

        {/* Junior Vault section */}
        <TrancheSection
          tranche="junior"
          items={juniorItems}
          apyByKey={apyByKey}
          account={account}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={(item) => history.push(`/vaults/${item.vaultAddress || item.key}`)}
        />

        {/* Footer hint */}
        {!account && (
          <p className="mt-8 text-center text-13 text-slate-500">{t`Connect your wallet to see your deposits.`}</p>
        )}
      </VantagePageContainer>
    </div>
  );
}
