/**
 * types.ts — Shared types for Vantage realtime chart data.
 */

export type TimeFrame = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export const TIME_FRAMES: TimeFrame[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

export const TIME_FRAME_SECONDS: Record<TimeFrame, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3_600,
  "4h": 14_400,
  "1d": 86_400,
};

/** A single trade event (Increase or Decrease position). */
export type TradeEvent = {
  price: number; // USD (converted from WAD)
  sizeDelta: number; // USD
  isLong: boolean;
  timestamp: number; // Unix seconds
  type: "increase" | "decrease" | "liquidate";
};

/** A single CumulativeFundingUpdated event. */
export type FundingRateEvent = {
  /** Annual funding rate in basis points (signed; negative = longs pay shorts). */
  annualRateBps: number;
  timestamp: number; // Unix seconds
};
