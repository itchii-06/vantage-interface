/**
 * TradePage.tsx
 *
 * Route: /trade
 *
 * Layout:
 *   Left  — TradeBox (Long / Short tabs → OpenPositionPanel)
 *            When a position is selected: ClosePositionPanel replaces the open form
 *   Right — PositionListPanel + PendingRequestsPanel
 */

import { t } from "@lingui/macro";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { useVantagePositions } from "domain/vantage/positions/useVantagePositions";
import { usePositionRequests } from "domain/vantage/trade/usePositionRequests";
import { usePositionRouterTrade } from "domain/vantage/trade/usePositionRouterTrade";
import { useSpread } from "domain/vantage/trade/useSpread";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";

import { ClosePositionPanel } from "./components/ClosePositionPanel";
import { OpenPositionPanel } from "./components/OpenPositionPanel";
import { PendingRequestsPanel } from "./components/PendingRequestsPanel";
import { PositionListPanel } from "./components/PositionListPanel";

// Default tokens for localhost
const d = localhostDeployment.addresses as {
  tokens?: { USDC?: string; ETH?: string; WETH?: string };
};
const USDC_ADDRESS = d.tokens?.USDC ?? "";
const WETH_ADDRESS = d.tokens?.WETH ?? "";

export default function TradePage() {
  const { account } = useWallet();
  const { chainId } = useChainId();
  const { tradeType } = useParams<{ tradeType?: string }>();

  const [activeTab, setActiveTab] = useState<"long" | "short">(tradeType === "short" ? "short" : "long");
  const [selectedPositionKey, setSelectedPositionKey] = useState<string | null>(null);

  // Pass known collateral tokens so positions opened with USDC collateral are found.
  const {
    positions,
    isLoading: positionsLoading,
    refetch,
  } = useVantagePositions(account, chainId, USDC_ADDRESS ? [USDC_ADDRESS] : undefined);
  const trade = usePositionRouterTrade();
  const requests = usePositionRequests();
  const spread = useSpread(WETH_ADDRESS || undefined);

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
    <div className="default-container page-layout">
      <div className="mx-auto mt-24 max-w-[1100px]">
        {/* Header */}
        <div className="mb-20">
          <h1 className="text-h1">{t`Trade`}</h1>
          <p className="text-body-medium mt-4 text-slate-400">{t`Open Long / Short positions via PositionRouter.`}</p>
        </div>

        <div className="flex gap-16 lg:items-start">
          {/* ── Left: TradeBox ─────────────────────────────────────────────────── */}
          <div className="w-full max-w-[360px] flex-shrink-0">
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
                    indexToken={WETH_ADDRESS}
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

          {/* ── Right: Positions + Pending ──────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col gap-16">
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
                  onSelect={(key) => {
                    setSelectedPositionKey(key);
                  }}
                />
              )}
            </div>

            {/* Pending requests */}
            <div>
              <h2 className="mb-10 text-14 font-semibold text-white">{t`Pending Orders`}</h2>
              <PendingRequestsPanel requests={requests} onCancel={handleCancelRequest} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
