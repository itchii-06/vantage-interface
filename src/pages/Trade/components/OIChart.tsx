/**
 * OIChart.tsx
 *
 * Open Interest chart: Long OI (green) and Short OI (red) as two line series.
 */

import { t } from "@lingui/macro";
import { ColorType, LineSeries, createChart } from "lightweight-charts";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { buildOIData } from "domain/vantage/chart/candleUtils";
import type { TradeEvent } from "domain/vantage/chart/types";

const CHART_HEIGHT = 200;
const CHART_STYLE = { height: CHART_HEIGHT } as const;

type Props = {
  events: TradeEvent[];
  isLoading: boolean;
};

export function OIChart({ events, isLoading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const longSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const shortSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const { longOI, shortOI } = useMemo(() => buildOIData(events), [events]);

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
      rightPriceScale: { borderColor: "#1e293b" },
      timeScale: { borderColor: "#1e293b", timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth,
      height: CHART_HEIGHT,
    });

    const longSeries = chart.addSeries(LineSeries, {
      color: "#4ade80",
      lineWidth: 2,
      title: "Long OI",
    });

    const shortSeries = chart.addSeries(LineSeries, {
      color: "#f87171",
      lineWidth: 2,
      title: "Short OI",
    });

    chartRef.current = chart;
    longSeriesRef.current = longSeries;
    shortSeriesRef.current = shortSeries;

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
      longSeriesRef.current = null;
      shortSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    longSeriesRef.current?.setData(longOI);
    shortSeriesRef.current?.setData(shortOI);
    if (longOI.length > 0 || shortOI.length > 0) {
      chartRef.current?.timeScale().fitContent();
    }
  }, [longOI, shortOI]);

  const isEmpty = !isLoading && events.length === 0;

  return (
    <div className="relative">
      {/* Legend */}
      <div className="mb-6 flex items-center gap-12 text-11">
        <span className="flex items-center gap-4 text-green-400">
          <span className="rounded inline-block h-2 w-12 bg-green-400" />
          {t`Long OI`}
        </span>
        <span className="flex items-center gap-4 text-red-400">
          <span className="rounded inline-block h-2 w-12 bg-red-400" />
          {t`Short OI`}
        </span>
      </div>

      <div className="relative">
        <div ref={containerRef} className="w-full" style={CHART_STYLE} />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-13 text-slate-400" style={CHART_STYLE}>
            {t`Loading…`}
          </div>
        )}
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center text-13 text-slate-500" style={CHART_STYLE}>
            {t`No position data yet`}
          </div>
        )}
      </div>
    </div>
  );
}
