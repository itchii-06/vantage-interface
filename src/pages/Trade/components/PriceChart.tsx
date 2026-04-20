/**
 * PriceChart.tsx
 *
 * Candlestick price chart powered by TradingView Lightweight Charts.
 * Renders OHLCV bars aggregated from oracle price tick events.
 *
 * Features:
 *   - Last price + 24h change header
 *   - OHLC row (updates live on crosshair move)
 *   - Current price dashed line with axis label
 *   - Timeframe selector (right-aligned in header)
 */

import { t } from "@lingui/macro";
import {
  CandlestickData,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  IPriceLine,
  LineStyle,
  MouseEventParams,
  createChart,
} from "lightweight-charts";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { buildCandles } from "domain/vantage/chart/candleUtils";
import type { TimeFrame, TradeEvent } from "domain/vantage/chart/types";
import { TIME_FRAMES } from "domain/vantage/chart/types";
import { ACCENT, COLORS } from "styles/vantageTheme";

const CHART_HEIGHT = 480;
const OHLC_ROW_STYLE = { minHeight: 20 } as const;
const CHART_CONTAINER_STYLE = { height: CHART_HEIGHT } as const;

type OhlcInfo = { open: number; high: number; low: number; close: number } | null;

type Props = {
  events: TradeEvent[];
  timeFrame: TimeFrame;
  onTimeFrameChange: (tf: TimeFrame) => void;
  isLoading: boolean;
};

function fmtPrice(n: number): string {
  if (n >= 10_000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}

export function PriceChart({ events, timeFrame, onTimeFrameChange, isLoading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLineRef = useRef<IPriceLine | null>(null);

  const [hoveredOhlc, setHoveredOhlc] = useState<OhlcInfo>(null);

  const candles = useMemo(() => buildCandles(events, timeFrame), [events, timeFrame]);

  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;

  // 24h change: compare latest close against the candle closest to 24h ago
  const change24h = useMemo(() => {
    if (candles.length < 2) return null;
    const last = candles[candles.length - 1];
    const dayAgoTs = (last.time as number) - 86_400;
    const ref = candles.reduce((best, c) =>
      Math.abs((c.time as number) - dayAgoTs) < Math.abs((best.time as number) - dayAgoTs) ? c : best
    );
    if (ref === last) return null;
    return ((last.close - ref.open) / ref.open) * 100;
  }, [candles]);

  // OHLC shown: hovered candle or last candle
  const displayOhlc: OhlcInfo = hoveredOhlc ?? lastCandle ?? null;

  // ── Initialize chart (once) ─────────────────────────────────────────────
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: COLORS.textSecondary,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: COLORS.border },
        horzLines: { color: COLORS.border },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: COLORS.border },
      timeScale: { borderColor: COLORS.border, timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth,
      height: CHART_HEIGHT,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: ACCENT,
      downColor: "#f87171",
      borderUpColor: ACCENT,
      borderDownColor: "#f87171",
      wickUpColor: ACCENT,
      wickDownColor: "#f87171",
    });

    // Update OHLC overlay on crosshair move
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.point || !param.time) {
        setHoveredOhlc(null);
        return;
      }
      const data = param.seriesData.get(series) as CandlestickData | undefined;
      if (data) {
        setHoveredOhlc({ open: data.open, high: data.high, low: data.low, close: data.close });
      } else {
        setHoveredOhlc(null);
      }
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
      priceLineRef.current = null;
    };
  }, []);

  // ── Update candles + price line whenever data changes ──────────────────
  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(candles);

    if (candles.length === 0) return;

    chartRef.current?.timeScale().fitContent();

    // Remove old price line, add new one at latest close
    if (priceLineRef.current) {
      seriesRef.current.removePriceLine(priceLineRef.current);
    }
    priceLineRef.current = seriesRef.current.createPriceLine({
      price: candles[candles.length - 1].close,
      color: ACCENT,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "",
    });
  }, [candles]);

  const isEmpty = !isLoading && events.length === 0;

  return (
    <div>
      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div className="mb-10 flex items-start justify-between gap-8">
        {/* Last price + 24h change */}
        <div>
          {lastCandle ? (
            <div className="flex items-baseline gap-10">
              <span className="text-20 font-bold text-white">${fmtPrice(lastCandle.close)}</span>
              {change24h !== null && (
                <span className={`text-13 font-semibold ${change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {change24h >= 0 ? "+" : ""}
                  {change24h.toFixed(2)}%
                </span>
              )}
            </div>
          ) : (
            <div className="text-20 font-bold text-slate-600">—</div>
          )}
        </div>

        {/* Timeframe buttons */}
        <div className="flex gap-4">
          {TIME_FRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeFrameChange(tf)}
              className={`rounded-4 px-8 py-3 text-11 font-medium transition-colors ${timeFrame === tf ? "bg-vantage-accent text-black" : "bg-vantage-input text-vantage-text-secondary"}`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* ── OHLC row ────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-center gap-10 text-12" style={OHLC_ROW_STYLE}>
        {displayOhlc ? (
          <>
            <span className="text-slate-500">{t`Open`}</span>
            <span className="text-white">{fmtPrice(displayOhlc.open)}</span>
            <span className="ml-4 text-slate-500">{t`High`}</span>
            <span className="text-green-400">{fmtPrice(displayOhlc.high)}</span>
            <span className="ml-4 text-slate-500">{t`Low`}</span>
            <span className="text-red-400">{fmtPrice(displayOhlc.low)}</span>
            <span className="ml-4 text-slate-500">{t`Close`}</span>
            <span className="text-white">{fmtPrice(displayOhlc.close)}</span>
          </>
        ) : (
          <span className="text-11 text-slate-600">{t`Hover over the chart to see candle details`}</span>
        )}
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────── */}
      <div className="relative">
        <div ref={containerRef} className="w-full" style={CHART_CONTAINER_STYLE} />
        {isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center text-13 text-slate-400"
            style={CHART_CONTAINER_STYLE}
          >
            {t`Loading chart data…`}
          </div>
        )}
        {isEmpty && (
          <div
            className="absolute inset-0 flex items-center justify-center text-13 text-slate-500"
            style={CHART_CONTAINER_STYLE}
          >
            {t`Fetching price data…`}
          </div>
        )}
      </div>
    </div>
  );
}
