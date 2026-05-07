/**
 * TradePage.tsx
 *
 * Route: /trade
 *
 * Layout (Jupiter-style 2-column):
 *   Left  — Market selector + ChartPanel + PositionListPanel + PendingRequestsPanel
 *   Right — TradeBox (Long / Short tabs → OpenPositionPanel / ClosePositionPanel)
 */

import { t } from "@lingui/macro";
import { useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { useVantagePositions } from "domain/vantage/positions/useVantagePositions";
import { usePositionRequests } from "domain/vantage/trade/usePositionRequests";
import { usePositionRouterTrade } from "domain/vantage/trade/usePositionRouterTrade";
import { useSpread } from "domain/vantage/trade/useSpread";
import { useJuniorVaultLiquidity } from "domain/vantage/useJuniorVaultLiquidity";
import type { VaultConfig } from "domain/vantage/vaults/vaultConfig";
import { ASSET_TYPE_COLOR, ASSET_TYPE_LABEL, VAULT_CONFIGS } from "domain/vantage/vaults/vaultConfig";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";

import { AppHeader } from "components/AppHeader/AppHeader";
import { AppNav } from "components/AppNav/AppNav";

import ChevronDownIcon from "img/ic_chevron_down.svg?react";

import { ChartPanel } from "./components/ChartPanel";
import { ClosePositionPanel } from "./components/ClosePositionPanel";
import { OpenPositionPanel } from "./components/OpenPositionPanel";
import { UnifiedPositionList } from "./components/UnifiedPositionList";

const d = localhostDeployment.addresses as {
  tokens?: { USDC?: string; ETH?: string; WETH?: string };
};
const USDC_ADDRESS = d.tokens?.USDC ?? "";

// Vault configs that have a valid tokenAddress (tradeable markets).
// All 3 Prism axes (price / yield / total) are shown as separate market entries.
const TRADEABLE_VAULTS = VAULT_CONFIGS.filter((v) => v.tokenAddress && v.vaultAddress && v.assetType !== "stable");

const PRISM_AXIS_LABEL: Record<NonNullable<VaultConfig["prismAxis"]>, string> = {
  price: "価格",
  yield: "利回り",
  total: "全体",
};

const PRISM_AXIS_COLOR: Record<NonNullable<VaultConfig["prismAxis"]>, string> = {
  price: "bg-blue-900/50 text-blue-300",
  yield: "bg-green-900/50 text-green-300",
  total: "bg-purple-900/50 text-purple-300",
};

export default function TradePage() {
  const { account } = useWallet();
  const { chainId } = useChainId();
  const { tradeType } = useParams<{ tradeType?: string }>();

  // Market selector state
  const [selectedVaultKey, setSelectedVaultKey] = useState(TRADEABLE_VAULTS[0]?.key ?? "");
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedVault = TRADEABLE_VAULTS.find((v) => v.key === selectedVaultKey) ?? TRADEABLE_VAULTS[0];
  const indexToken = selectedVault?.tokenAddress ?? "";
  const vaultAddress = selectedVault?.vaultAddress;

  const [activeTab, setActiveTab] = useState<"long" | "short">(tradeType === "short" ? "short" : "long");
  const [selectedPositionKey, setSelectedPositionKey] = useState<string | null>(null);

  const {
    positions,
    isLoading: positionsLoading,
    refetch,
  } = useVantagePositions(account, chainId, USDC_ADDRESS ? [USDC_ADDRESS] : undefined, vaultAddress);
  const trade = usePositionRouterTrade();
  const requests = usePositionRequests();
  const spread = useSpread(indexToken || undefined);
  const { hasLiquidity } = useJuniorVaultLiquidity(chainId);
  const selectedPosition = positions.find((p) => p.key === selectedPositionKey) ?? null;
  const isLong = activeTab === "long";

  function handleCancelRequest(requestKey: string, type: "increase" | "decrease") {
    if (type === "increase") {
      trade.cancelIncreasePosition(requestKey).then(() => requests.markCancelled(requestKey));
    } else {
      trade.cancelDecreasePosition(requestKey).then(() => requests.markCancelled(requestKey));
    }
  }

  return (
    <div className="min-h-screen w-full bg-vantage-bg">
      <div className="border-b border-b-vantage-border px-16 py-8">
        <AppHeader leftContent={<AppNav />} />
      </div>
      <div className="mt-16 px-16 pb-[64px]">
        <div className="flex min-h-0 gap-0 lg:items-start">
          {/* ── Left column ─────────────────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col gap-12">
            {/* Market selector header */}
            <div className="flex items-center gap-16 rounded-4 border border-vantage-border bg-vantage-base px-16 py-12">
              {/* Dropdown trigger — same style as MarketSelector */}
              <div className="relative" ref={dropdownRef}>
                <div
                  className="group flex cursor-pointer items-center gap-4 whitespace-nowrap tracking-wide hover:text-vantage-accent"
                  onClick={() => setIsMarketOpen((o) => !o)}
                >
                  <span className="text-24 font-bold text-white group-hover:text-vantage-accent">
                    {selectedVault?.symbol ?? "—"}
                  </span>
                  <ChevronDownIcon className="w-16 text-slate-400 group-hover:text-vantage-accent" />
                </div>

                {/* Dropdown list */}
                {isMarketOpen && (
                  <div className="absolute left-0 top-full z-50 mt-8 w-[280px] overflow-hidden rounded-4 border border-vantage-border bg-vantage-base-hover shadow-xl">
                    {/* Header */}
                    <div className="border-b border-b-vantage-border px-16 py-10 text-12 font-medium text-vantage-text-secondary">
                      {t`Select Market`}
                    </div>
                    {TRADEABLE_VAULTS.map((vault) => {
                      const isSelected = vault.key === selectedVaultKey;
                      return (
                        <div
                          key={vault.key}
                          onClick={() => {
                            setSelectedVaultKey(vault.key);
                            setIsMarketOpen(false);
                          }}
                          className={`flex cursor-pointer items-center justify-between px-16 py-12 transition-colors hover:bg-slate-800/50 ${
                            isSelected ? "bg-slate-800/30" : ""
                          }`}
                        >
                          <div className="flex items-center gap-10">
                            {/* Symbol avatar */}
                            {vault.imageUrl ? (
                              <img
                                src={vault.imageUrl}
                                alt={vault.name}
                                className="h-48 w-48 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-slate-700 text-12 font-bold text-white">
                                {vault.symbol.slice(0, 2)}
                              </div>
                            )}
                            <div>
                              <div className="text-14 font-semibold text-white">{vault.symbol}</div>
                              <div className="text-11 text-slate-400">{vault.name}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {vault.prismAxis && (
                              <span
                                className={`text-10 rounded-full px-8 py-2 font-medium ${PRISM_AXIS_COLOR[vault.prismAxis]}`}
                              >
                                {PRISM_AXIS_LABEL[vault.prismAxis]}
                              </span>
                            )}
                            <span
                              className={`text-10 rounded-full px-8 py-2 font-medium ${ASSET_TYPE_COLOR[vault.assetType]}`}
                            >
                              {ASSET_TYPE_LABEL[vault.assetType]}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Close dropdown on outside click */}
              {isMarketOpen && <div className="fixed inset-0 z-40" onClick={() => setIsMarketOpen(false)} />}
            </div>

            {/* Chart */}
            {indexToken && <ChartPanel chainId={chainId} indexToken={indexToken} vaultAddress={vaultAddress} />}

            {/* Redemption ADL risk notice */}
            <div className="rounded-4 border border-slate-600/30 bg-slate-700/10 px-14 py-10 text-13 text-slate-400">
              {t`LP redemption demand may reduce open positions by up to 5% per day via ADL to fund withdrawals.`}
            </div>

            {/* Unified position list */}
            <div>
              <div className="mb-10 flex items-center justify-between">
                <h2 className="text-14 font-semibold text-white">{t`Current Position`}</h2>
                <button onClick={refetch} className="hover:text-slate-300 text-12 text-slate-500">
                  {t`Refresh`}
                </button>
              </div>
              {!account ? (
                <div className="rounded-4 border-b border-b-vantage-border py-24 text-center text-13 text-slate-400">
                  {t`Connect wallet to see positions`}
                </div>
              ) : (
                <UnifiedPositionList
                  positions={positions}
                  requests={requests}
                  isLoading={positionsLoading}
                  selectedKey={selectedPositionKey}
                  onSelect={(key) => setSelectedPositionKey(key)}
                  onCancel={handleCancelRequest}
                  onRefetch={refetch}
                />
              )}
            </div>
          </div>

          {/* ── Right column: TradeBox ───────────────────────────────────────────── */}
          <div className="ml-12 w-[448px] flex-shrink-0">
            <div className="overflow-hidden rounded-4 border border-vantage-border bg-vantage-base">
              {/* Tab header */}
              {!selectedPosition && (
                <div className="flex border-b border-b-vantage-border">
                  <button
                    onClick={() => setActiveTab("long")}
                    className={`flex-1 py-14 text-14 font-semibold transition-colors ${
                      activeTab === "long"
                        ? "border-b-2 border-vantage-accent text-vantage-accent"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t`Long`}
                  </button>
                  <button
                    onClick={() => setActiveTab("short")}
                    className={`flex-1 py-14 text-14 font-semibold transition-colors ${
                      activeTab === "short"
                        ? "border-b-2 border-vantage-accent text-vantage-accent"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t`Short`}
                  </button>
                </div>
              )}

              <div className="p-16">
                {selectedPosition ? (
                  <>
                    <div className="mb-12 flex items-center gap-8">
                      <button
                        onClick={() => setSelectedPositionKey(null)}
                        className="text-12 text-slate-400 hover:text-white"
                      >
                        ← {t`Back`}
                      </button>
                      <span className="text-14 font-semibold text-white">{t`Close Position`}</span>
                    </div>
                    <ClosePositionPanel
                      position={selectedPosition}
                      spread={spread}
                      trade={trade}
                      requests={requests}
                      account={account ?? ""}
                      onClose={() => {
                        setSelectedPositionKey(null);
                        setTimeout(refetch, 2000);
                      }}
                    />
                  </>
                ) : (
                  <OpenPositionPanel
                    isLong={isLong}
                    indexToken={indexToken}
                    collateralToken={USDC_ADDRESS}
                    spread={spread}
                    trade={trade}
                    requests={requests}
                    onSuccess={() => setTimeout(refetch, 2000)}
                    noLiquidity={!hasLiquidity}
                    vaultConfig={selectedVault}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
