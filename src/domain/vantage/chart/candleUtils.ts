/**
 * candleUtils.ts
 *
 * Pure functions for aggregating trade events into chart data structures.
 * All inputs use seconds-precision Unix timestamps.
 */

import type { CandlestickData, LineData, Time } from "lightweight-charts";

import type { FundingRateEvent, TimeFrame, TradeEvent } from "./types";
import { TIME_FRAME_SECONDS } from "./types";

/**
 * Aggregate an array of trade events into OHLCV candlestick bars.
 * Events are bucketed into fixed-width time windows.
 */
export function buildCandles(events: TradeEvent[], timeFrame: TimeFrame): CandlestickData[] {
  const intervalSec = TIME_FRAME_SECONDS[timeFrame];
  // bucket time → { open, high, low, close }
  const buckets = new Map<number, { open: number; high: number; low: number; close: number }>();

  for (const e of events) {
    const bucket = Math.floor(e.timestamp / intervalSec) * intervalSec;
    const existing = buckets.get(bucket);
    if (!existing) {
      buckets.set(bucket, { open: e.price, high: e.price, low: e.price, close: e.price });
    } else {
      existing.high = Math.max(existing.high, e.price);
      existing.low = Math.min(existing.low, e.price);
      existing.close = e.price;
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, bar]) => ({ time: time as Time, ...bar }));
}

/**
 * Derive Long OI and Short OI time series from trade events.
 * Returns two line series: longOI and shortOI (in USD).
 */
export function buildOIData(events: TradeEvent[]): { longOI: LineData[]; shortOI: LineData[] } {
  let longOI = 0;
  let shortOI = 0;
  const longPoints: LineData[] = [];
  const shortPoints: LineData[] = [];

  // Deduplicate timestamps (keep the last value per second)
  const seen = new Set<number>();
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  for (const e of sorted) {
    if (e.type === "increase") {
      if (e.isLong) longOI += e.sizeDelta;
      else shortOI += e.sizeDelta;
    } else {
      // decrease or liquidate
      if (e.isLong) longOI = Math.max(0, longOI - e.sizeDelta);
      else shortOI = Math.max(0, shortOI - e.sizeDelta);
    }

    // Use unique second-precision timestamps to satisfy lightweight-charts requirement
    let t = Math.floor(e.timestamp);
    while (seen.has(t)) t++;
    seen.add(t);

    longPoints.push({ time: t as Time, value: longOI });
    shortPoints.push({ time: t as Time, value: shortOI });
  }

  return { longOI: longPoints, shortOI: shortPoints };
}

/**
 * Convert funding rate events into a line series.
 * Deduplicates on timestamp (last value wins per second).
 */
export function buildFundingRateData(events: FundingRateEvent[]): LineData[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const seen = new Set<number>();
  const result: LineData[] = [];

  for (const e of sorted) {
    let t = Math.floor(e.timestamp);
    while (seen.has(t)) t++;
    seen.add(t);
    result.push({ time: t as Time, value: e.annualRateBps / 100 }); // bps → %
  }

  return result;
}
