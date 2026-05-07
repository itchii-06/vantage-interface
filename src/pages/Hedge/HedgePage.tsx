/**
 * HedgePage.tsx
 *
 * Delta-Neutral Strategy list view.
 * Route: /hedge
 *
 * Columns: Asset | Vault APY | Managed Net APY | Self-Custody APY | AUM | Action
 * Interaction: "Hedge" button → /hedge/:key
 */

import { t } from "@lingui/macro";
import { formatEther } from "ethers";
import { useHistory } from "react-router-dom";

import { useHedgeList } from "domain/vantage/hedge/useHedgeList";
import type { VaultConfig } from "domain/vantage/vaults/vaultConfig";
import { ASSET_TYPE_COLOR, ASSET_TYPE_LABEL } from "domain/vantage/vaults/vaultConfig";
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

function _formatApy(apy: number | null): string {
  if (apy === null) return "—";
  const sign = apy >= 0 ? "+" : "";
  return `${sign}${(apy * 100).toFixed(2)}%`;
}

function _apyColor(apy: number | null): string {
  if (apy === null) return "text-slate-500";
  return apy >= 0 ? "text-green-400" : "text-red-400";
}

// ---------------------------------------------------------------------------
// Prism axis label helpers
// ---------------------------------------------------------------------------

const PRISM_AXIS_LABEL: Record<NonNullable<VaultConfig["prismAxis"]>, string> = {
  price: "価格ヘッジ",
  yield: "利回りヘッジ",
  total: "全体ヘッジ",
};

const PRISM_AXIS_COLOR: Record<NonNullable<VaultConfig["prismAxis"]>, string> = {
  price: "bg-blue-900/50 text-blue-300",
  yield: "bg-green-900/50 text-green-300",
  total: "bg-purple-900/50 text-purple-300",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HedgePage() {
  const history = useHistory();
  const items = useHedgeList();

  return (
    <div className="min-h-screen w-full bg-vantage-bg">
      {/* Header */}
      <div className="border-b border-b-vantage-border px-16 py-8">
        <AppHeader leftContent={<AppNav />} />
      </div>

      <VantagePageContainer
        title={t`Hedge`}
        description={t`Delta-neutral strategy: earn RWA yield + short funding rate with zero price exposure.`}
      >
        {/* Table */}
        <div className="overflow-hidden rounded-4 border border-vantage-border bg-vantage-base">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-0 border-b border-b-vantage-border px-20 py-12 text-14 text-vantage-text-secondary">
            <div>{t`Asset`}</div>
            <div className="text-right">{t`Vault APY`}</div>
            <div className="text-right">{t`AUM`}</div>
          </div>

          {/* Rows */}
          {items.map((item) => (
            <div
              key={item.key}
              onClick={() => history.push(`/hedge/${item.key}`)}
              className="grid cursor-pointer grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-0 border-b border-b-vantage-border px-20 py-16 transition-colors last:border-0"
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = COLORS.baseHover)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
            >
              {/* Asset */}
              <div className="flex items-center gap-12">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="h-56 w-56 rounded-full object-cover" />
                ) : (
                  <div className="flex h-56 w-56 items-center justify-center rounded-full bg-slate-700 text-14 font-bold text-white">
                    {item.symbol.slice(0, 2)}
                  </div>
                )}
                <div>
                  <div className="text-16 font-black text-white">{item.name}</div>
                  <div className="mt-4 flex items-center gap-6">
                    <span className={`text-xs rounded-full px-8 py-1 ${ASSET_TYPE_COLOR[item.assetType]}`}>
                      {ASSET_TYPE_LABEL[item.assetType]}
                    </span>
                    {item.prismAxis && (
                      <span
                        className={`text-xs rounded-full px-8 py-1 font-medium ${PRISM_AXIS_COLOR[item.prismAxis]}`}
                      >
                        {PRISM_AXIS_LABEL[item.prismAxis]}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Vault APY */}
              <div className="text-right">
                <span className={`text-15 font-medium ${_apyColor(item.vaultApy)}`}>{_formatApy(item.vaultApy)}</span>
              </div>

              {/* AUM */}
              <div className="text-right">
                {item.isLoading ? (
                  <span className="text-slate-500">—</span>
                ) : (
                  <span className="text-15 font-medium text-white">{formatUsd(item.aum)}</span>
                )}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {items.length === 0 && (
            <div className="py-40 text-center text-14 text-slate-400">
              {t`No hedgeable vaults configured. Deploy contracts first.`}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <p className="mt-16 text-center text-12 text-slate-500">
          {t`Managed Net APY = Vault APY + Short Funding Rate. Past rates are not indicative of future returns.`}
        </p>
      </VantagePageContainer>
    </div>
  );
}
