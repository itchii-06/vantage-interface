/**
 * ChartPanel.tsx
 *
 * Full-width chart container for the Trade page.
 * Manages a single WebSocket connection shared across all chart tabs.
 *
 * Tabs:
 *   Price    — Candlestick chart with time frame selector
 *   OI       — Long / Short Open Interest line chart
 *   Funding  — Annual funding rate line chart
 */

import { t } from "@lingui/macro";
import { useCallback, useMemo, useState } from "react";

import type { FundingRateEvent, TimeFrame, TradeEvent } from "domain/vantage/chart/types";
import { usePriceTicker } from "domain/vantage/chart/usePriceTicker";
import { useTradeHistory } from "domain/vantage/chart/useTradeHistory";
import { useVaultEvents } from "domain/vantage/chart/useVaultEvents";

import { FundingRateChart } from "./FundingRateChart";
import { OIChart } from "./OIChart";
import { PriceChart } from "./PriceChart";

type Tab = "price" | "oi" | "funding";

type Props = {
  chainId: number;
  indexToken: string;
  vaultAddress?: string;
};

export function ChartPanel({ chainId, indexToken, vaultAddress }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("price");
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("1h");

  // Historical data (one-time fetch on mount)
  const {
    tradeEvents: historicalTrades,
    fundingRateEvents: historicalFunding,
    isLoading,
  } = useTradeHistory(chainId, indexToken, vaultAddress);

  // Realtime events accumulated in state
  const [realtimeTrades, setRealtimeTrades] = useState<TradeEvent[]>([]);
  const [realtimeFunding, setRealtimeFunding] = useState<FundingRateEvent[]>([]);

  const handleTradeEvent = useCallback((e: TradeEvent) => {
    setRealtimeTrades((prev) => [...prev, e]);
  }, []);

  const handleFundingRateEvent = useCallback((e: FundingRateEvent) => {
    setRealtimeFunding((prev) => [...prev, e]);
  }, []);

  // Single WebSocket connection shared by all chart tabs
  useVaultEvents(
    chainId,
    indexToken,
    {
      onTradeEvent: handleTradeEvent,
      onFundingRateEvent: handleFundingRateEvent,
    },
    vaultAddress
  );

  // Oracle price ticks — sole data source for the Price chart.
  // Trade events are NOT used for price because the price is determined by the oracle,
  // not by user trades. Separating the data sources makes the architecture explicit.
  const priceTicks = usePriceTicker(chainId, indexToken, vaultAddress);

  // Trade events are used only for OI and Funding Rate charts
  const allTrades = useMemo(() => [...historicalTrades, ...realtimeTrades], [historicalTrades, realtimeTrades]);
  const allFunding = useMemo(() => [...historicalFunding, ...realtimeFunding], [historicalFunding, realtimeFunding]);

  return (
    <div className="bg-cold-blue-950 overflow-hidden rounded-4 border border-stroke-primary p-16">
      {/* Tab bar */}
      <div className="mb-16 flex items-center gap-0 border-b border-stroke-primary">
        <button
          onClick={() => setActiveTab("price")}
          className={`mr-16 pb-10 text-13 font-medium transition-colors ${
            activeTab === "price" ? "border-b-2 border-blue-400 text-blue-400" : "text-slate-400 hover:text-white"
          }`}
        >
          {t`Price`}
        </button>
        <button
          onClick={() => setActiveTab("oi")}
          className={`mr-16 pb-10 text-13 font-medium transition-colors ${
            activeTab === "oi" ? "border-b-2 border-blue-400 text-blue-400" : "text-slate-400 hover:text-white"
          }`}
        >
          {t`OI`}
        </button>
        <button
          onClick={() => setActiveTab("funding")}
          className={`mr-16 pb-10 text-13 font-medium transition-colors ${
            activeTab === "funding" ? "border-b-2 border-blue-400 text-blue-400" : "text-slate-400 hover:text-white"
          }`}
        >
          {t`Funding Rate`}
        </button>

        {/* Realtime indicator */}
        <div className="ml-auto flex items-center gap-6 pb-10 text-11 text-slate-500">
          <span className="inline-block h-6 w-6 animate-pulse rounded-full bg-green-500" />
          {t`Live`}
        </div>
      </div>

      {/* Chart area */}
      {activeTab === "price" && (
        <PriceChart events={priceTicks} timeFrame={timeFrame} onTimeFrameChange={setTimeFrame} isLoading={isLoading} />
      )}
      {activeTab === "oi" && <OIChart events={allTrades} isLoading={isLoading} />}
      {activeTab === "funding" && <FundingRateChart events={allFunding} isLoading={isLoading} />}
    </div>
  );
}
