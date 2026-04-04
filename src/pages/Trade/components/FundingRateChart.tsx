/**
 * FundingRateChart.tsx
 *
 * Annual funding rate (%) over time — line chart.
 * Positive = longs pay shorts, negative = shorts pay longs.
 */

import { t } from "@lingui/macro";
import { ColorType, LineSeries, createChart } from "lightweight-charts";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { buildFundingRateData } from "domain/vantage/chart/candleUtils";
import type { FundingRateEvent } from "domain/vantage/chart/types";

const CHART_HEIGHT = 200;
const CHART_STYLE = { height: CHART_HEIGHT } as const;

type Props = {
  events: FundingRateEvent[];
  isLoading: boolean;
};

export function FundingRateChart({ events, isLoading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const lineData = useMemo(() => buildFundingRateData(events), [events]);

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

    const series = chart.addSeries(LineSeries, {
      color: "#60a5fa", // blue-400
      lineWidth: 2,
      title: "Annual %",
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

  useEffect(() => {
    seriesRef.current?.setData(lineData);
    if (lineData.length > 0) {
      chartRef.current?.timeScale().fitContent();
    }
  }, [lineData]);

  const isEmpty = !isLoading && events.length === 0;
  const latestRate = events.length > 0 ? events[events.length - 1].annualRateBps / 100 : null;

  return (
    <div>
      {/* Current rate badge */}
      <div className="mb-6 flex items-center gap-8 text-11">
        <span className="text-slate-400">{t`Annual Funding Rate`}</span>
        {latestRate !== null && (
          <span className={`font-medium ${latestRate >= 0 ? "text-green-400" : "text-red-400"}`}>
            {latestRate >= 0 ? "+" : ""}
            {latestRate.toFixed(2)}%
          </span>
        )}
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
            {t`No funding rate data yet`}
          </div>
        )}
      </div>
    </div>
  );
}
