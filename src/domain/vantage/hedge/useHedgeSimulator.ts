/**
 * useHedgeSimulator.ts
 *
 * Computes ±20% P&L simulation data for a delta-neutral hedge position.
 *
 * Given:
 *   - spotPrice  : current oracle price per RWA token (USD, WAD)
 *   - rwaAmount  : amount of RWA tokens held (WAD)
 *   - sizeDelta  : notional value of the short position (USD, WAD)
 *
 * For each price change ratio r ∈ [-0.20, +0.20]:
 *   - spotPnl  = rwaAmount × spotPrice × r  (long spot P&L)
 *   - shortPnl = -(sizeDelta × r)           (short position P&L)
 *   - netPnl   = spotPnl + shortPnl         (≈ 0 when sizeDelta = rwaAmount × spotPrice)
 */

import { useMemo } from "react";

export type SimPoint = {
  /** Price change ratio, e.g. -0.20 to +0.20 */
  r: number;
  /** Spot (RWA holding) P&L in USD */
  spotPnl: number;
  /** Short position P&L in USD */
  shortPnl: number;
  /** Net P&L in USD */
  netPnl: number;
};

const STEPS = 41; // -20%, -19%, ..., 0%, ..., +19%, +20%

/**
 * Returns simulation data points.
 *
 * @param spotPriceUsd  Current RWA price in USD (plain number)
 * @param rwaAmount     Number of RWA tokens held (plain number)
 * @param sizeDelta     Notional value of the short in USD (plain number)
 */
export function useHedgeSimulator(
  spotPriceUsd: number | null,
  rwaAmount: number | null,
  sizeDelta: number | null
): SimPoint[] {
  return useMemo(() => {
    if (spotPriceUsd === null || rwaAmount === null || sizeDelta === null) return [];

    const points: SimPoint[] = [];
    for (let i = 0; i < STEPS; i++) {
      const r = -0.2 + i * (0.4 / (STEPS - 1));
      const spotPnl = rwaAmount * spotPriceUsd * r;
      const shortPnl = -(sizeDelta * r);
      const netPnl = spotPnl + shortPnl;
      points.push({ r, spotPnl, shortPnl, netPnl });
    }
    return points;
  }, [spotPriceUsd, rwaAmount, sizeDelta]);
}

/**
 * Returns SVG path data for a P&L series scaled to the given viewport.
 *
 * @param points   SimPoint array from useHedgeSimulator
 * @param key      Which series to plot: "spotPnl" | "shortPnl" | "netPnl"
 * @param width    SVG viewport width in px
 * @param height   SVG viewport height in px
 */
export function buildSvgPath(
  points: SimPoint[],
  key: "spotPnl" | "shortPnl" | "netPnl",
  width: number,
  height: number
): string {
  if (points.length < 2) return "";

  const values = points.map((p) => p[key]);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const toX = (i: number) => (i / (points.length - 1)) * width;
  const toY = (v: number) => height - ((v - minV) / range) * height;

  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p[key]).toFixed(1)}`).join(" ");
}
