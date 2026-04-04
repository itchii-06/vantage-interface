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
import { formatEther } from "ethers";
import { useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { useVantagePositions } from "domain/vantage/positions/useVantagePositions";
import { usePositionRequests } from "domain/vantage/trade/usePositionRequests";
import { usePositionRouterTrade } from "domain/vantage/trade/usePositionRouterTrade";
import { useSpread } from "domain/vantage/trade/useSpread";
import { useHubHealth } from "domain/vantage/useHubHealth";
import { ASSET_TYPE_COLOR, ASSET_TYPE_LABEL, VAULT_CONFIGS } from "domain/vantage/vaults/vaultConfig";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";

import { AppHeader } from "components/AppHeader/AppHeader";

import ChevronDownIcon from "img/ic_chevron_down.svg?react";
import LogoText from "img/logo-text.svg?react";
import logoIcon from "img/logo-w.svg";

import { ChartPanel } from "./components/ChartPanel";
import { ClosePositionPanel } from "./components/ClosePositionPanel";
import { OpenPositionPanel } from "./components/OpenPositionPanel";
import { PendingRequestsPanel } from "./components/PendingRequestsPanel";
import { PositionListPanel } from "./components/PositionListPanel";

const d = localhostDeployment.addresses as {
  tokens?: { USDC?: string; ETH?: string; WETH?: string };
};
const USDC_ADDRESS = d.tokens?.USDC ?? "";

// Vault configs that have a valid tokenAddress (tradeable markets)
const TRADEABLE_VAULTS = VAULT_CONFIGS.filter((v) => v.tokenAddress && v.vaultAddress);

export default function TradePage() {
  const { account } = useWallet();
  const { chainId } = useChainId();
  const { tradeType } = useParams<{ tradeType?: string }>();
  const { pathname } = useLocation();

  // Market selector state
  const [selectedVaultKey, setSelectedVaultKey] = useState(TRADEABLE_VAULTS[0]?.key ?? "");
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedVault = TRADEABLE_VAULTS.find((v) => v.key === selectedVaultKey) ?? TRADEABLE_VAULTS[0];
  const indexToken = selectedVault?.tokenAddress ?? "";
  const vaultAddress = selectedVault?.vaultAddress;

  const NAV_ITEMS = [
    { label: t`Trade`, to: "/trade" },
    { label: t`Vault`, to: "/vaults" },
    { label: t`Portfolio`, to: "/vantage-lp" },
  ] as const;

  const navLeftContent = (
    <div className="flex items-center gap-24">
      <Link to="/" className="flex items-center gap-8 px-4">
        <img src={logoIcon} alt="Logo" className="w-88" />
        <LogoText className="hidden md:block" />
      </Link>
      <nav className="flex items-center">
        {NAV_ITEMS.map(({ label, to }) => {
          const isActive = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              className={`px-14 py-8 text-14 font-medium transition-colors ${
                isActive ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );

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
  const hubHealth = useHubHealth(chainId, vaultAddress);

  const selectedPosition = positions.find((p) => p.key === selectedPositionKey) ?? null;
  const isLong = activeTab === "long";

  const markPrice = spread.bidPrice > 0n ? parseFloat(formatEther(spread.bidPrice)) : null;

  function handleCancelRequest(requestKey: string, type: "increase" | "decrease") {
    if (type === "increase") {
      trade.cancelIncreasePosition(requestKey).then(() => requests.markCancelled(requestKey));
    } else {
      trade.cancelDecreasePosition(requestKey).then(() => requests.markCancelled(requestKey));
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-stroke-primary px-16 py-8">
        <AppHeader leftContent={navLeftContent} />
      </div>
      <div className="mt-16 px-16">
        <div className="flex min-h-0 gap-0 lg:items-start">
          {/* ── Left column ─────────────────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col gap-12">
            {/* Market selector header */}
            <div className="bg-cold-blue-950 flex items-center gap-16 rounded-4 border border-stroke-primary px-16 py-12">
              {/* Dropdown trigger — same style as MarketSelector */}
              <div className="relative" ref={dropdownRef}>
                <div
                  className="group flex cursor-pointer items-center gap-4 whitespace-nowrap tracking-wide hover:text-blue-300"
                  onClick={() => setIsMarketOpen((o) => !o)}
                >
                  <span className="text-20 font-bold text-white group-hover:text-blue-300">
                    {selectedVault?.symbol ?? "—"} / USDC
                  </span>
                  <ChevronDownIcon className="w-16 text-slate-400 group-hover:text-blue-300" />
                </div>

                {/* Dropdown list */}
                {isMarketOpen && (
                  <div className="absolute left-0 top-full z-50 mt-8 w-[280px] overflow-hidden rounded-4 border border-stroke-primary bg-cold-blue-900 shadow-xl">
                    {/* Header */}
                    <div className="border-b border-stroke-primary px-16 py-10 text-12 font-medium text-slate-400">
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
                            <div className="flex h-32 w-32 items-center justify-center rounded-full bg-slate-700 text-12 font-bold text-white">
                              {vault.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <div className="text-14 font-semibold text-white">{vault.symbol} / USDC</div>
                              <div className="text-11 text-slate-400">{vault.name}</div>
                            </div>
                          </div>
                          <span
                            className={`text-10 rounded-full px-8 py-2 font-medium ${ASSET_TYPE_COLOR[vault.assetType]}`}
                          >
                            {ASSET_TYPE_LABEL[vault.assetType]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Current price */}
              {markPrice !== null && (
                <span className="text-18 font-semibold text-white">
                  ${markPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}

              {/* Close dropdown on outside click */}
              {isMarketOpen && <div className="fixed inset-0 z-40" onClick={() => setIsMarketOpen(false)} />}
            </div>

            {/* Chart */}
            {indexToken && <ChartPanel chainId={chainId} indexToken={indexToken} vaultAddress={vaultAddress} />}

            {/* ADL risk banner */}
            {hubHealth && hubHealth.status !== "healthy" && (
              <div
                className={`rounded-4 border px-14 py-10 text-13 ${
                  hubHealth.status === "danger"
                    ? "border-red-500/40 bg-red-500/10 text-red-400"
                    : "text-yellow-400 border-yellow-500/40 bg-yellow-500/10"
                }`}
              >
                {hubHealth.status === "danger"
                  ? t`ADL is active — profitable positions may be force-closed to restore Hub solvency. Cover ratio: ${(hubHealth.coverRatioBps / 100).toFixed(0)}%`
                  : t`Hub balance is low — ADL may trigger soon. Cover ratio: ${(hubHealth.coverRatioBps / 100).toFixed(0)}%`}
              </div>
            )}

            {/* Open positions */}
            <div>
              <div className="mb-10 flex items-center justify-between">
                <h2 className="text-14 font-semibold text-white">{t`Open Positions`}</h2>
                <button onClick={refetch} className="hover:text-slate-300 text-12 text-slate-500">
                  {t`Refresh`}
                </button>
              </div>
              {!account ? (
                <div className="rounded-4 border border-stroke-primary py-24 text-center text-13 text-slate-400">
                  {t`Connect wallet to see positions`}
                </div>
              ) : (
                <PositionListPanel
                  positions={positions}
                  isLoading={positionsLoading}
                  selectedKey={selectedPositionKey}
                  onSelect={(key) => setSelectedPositionKey(key)}
                />
              )}
            </div>

            {/* Pending orders */}
            <div>
              <h2 className="mb-10 text-14 font-semibold text-white">{t`Pending Orders`}</h2>
              <PendingRequestsPanel requests={requests} onCancel={handleCancelRequest} />
            </div>
          </div>

          {/* ── Right column: TradeBox ───────────────────────────────────────────── */}
          <div className="ml-12 w-[448px] flex-shrink-0">
            <div className="bg-cold-blue-950 overflow-hidden rounded-4 border border-stroke-primary">
              {/* Tab header */}
              {!selectedPosition && (
                <div className="flex border-b border-stroke-primary">
                  <button
                    onClick={() => setActiveTab("long")}
                    className={`flex-1 py-14 text-14 font-semibold transition-colors ${
                      activeTab === "long"
                        ? "border-b-2 border-green-400 text-green-400"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t`Long`}
                  </button>
                  <button
                    onClick={() => setActiveTab("short")}
                    className={`flex-1 py-14 text-14 font-semibold transition-colors ${
                      activeTab === "short"
                        ? "border-b-2 border-red-400 text-red-400"
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
