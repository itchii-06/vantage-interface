/**
 * PriceChart.tsx
 *
 * Candlestick price chart powered by TradingView Lightweight Charts.
 * Renders OHLCV bars aggregated from trade events.
 */

import { t } from "@lingui/macro";
import { CandlestickSeries, ColorType, CrosshairMode, createChart } from "lightweight-charts";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { buildCandles } from "domain/vantage/chart/candleUtils";
import type { TimeFrame, TradeEvent } from "domain/vantage/chart/types";
import { TIME_FRAMES } from "domain/vantage/chart/types";

const CHART_HEIGHT = 280;
const CHART_STYLE = { height: CHART_HEIGHT } as const;

type Props = {
  events: TradeEvent[];
  timeFrame: TimeFrame;
  onTimeFrameChange: (tf: TimeFrame) => void;
  isLoading: boolean;
};

export function PriceChart({ events, timeFrame, onTimeFrameChange, isLoading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const candles = useMemo(() => buildCandles(events, timeFrame), [events, timeFrame]);

  // Initialize chart once on mount
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1e293b" },
        horzLines: { color: "#1e293b" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1e293b" },
      timeScale: { borderColor: "#1e293b", timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth,
      height: CHART_HEIGHT,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#4ade80",
      downColor: "#f87171",
      borderUpColor: "#4ade80",
      borderDownColor: "#f87171",
      wickUpColor: "#4ade80",
      wickDownColor: "#f87171",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const observer = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update series data whenever candles change
  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(candles);
    if (candles.length > 0) {
      chartRef.current?.timeScale().fitContent();
    }
  }, [candles]);

  const isEmpty = !isLoading && events.length === 0;

  return (
    <div>
      {/* Time frame selector */}
      <div className="mb-8 flex gap-4">
        {TIME_FRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeFrameChange(tf)}
            className={`rounded-4 px-8 py-3 text-11 font-medium transition-colors ${
              timeFrame === tf ? "bg-blue-600 text-white" : "bg-cold-blue-900 text-slate-400 hover:text-white"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div className="relative">
        <div ref={containerRef} className="w-full" style={CHART_STYLE} />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-13 text-slate-400" style={CHART_STYLE}>
            {t`Loading chart data…`}
          </div>
        )}
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center text-13 text-slate-500" style={CHART_STYLE}>
            {t`No trade data yet. Open a position to see the chart.`}
          </div>
        )}
      </div>
    </div>
  );
}
