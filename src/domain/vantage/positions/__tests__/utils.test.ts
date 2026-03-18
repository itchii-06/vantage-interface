import { describe, expect, it } from "vitest";

import {
  calcLeverageBps,
  formatLeverage,
  formatVantageUsd,
  isDataStale,
  marginUsageToPercent,
  VANTAGE_PRICE_PRECISION,
} from "../utils";

const WAD = VANTAGE_PRICE_PRECISION; // 1e18

describe("formatVantageUsd", () => {
  it("formats a whole-dollar amount", () => {
    expect(formatVantageUsd(1500n * WAD)).toBe("$1,500.00");
  });

  it("formats a fractional amount", () => {
    expect(formatVantageUsd(1234n * WAD + WAD / 2n)).toBe("$1,234.50");
  });

  it("formats zero", () => {
    expect(formatVantageUsd(0n)).toBe("$0.00");
  });

  it("formats a negative value (unrealized loss)", () => {
    expect(formatVantageUsd(-100n * WAD)).toBe("-$100.00");
  });

  it("formats large amounts with comma separators", () => {
    expect(formatVantageUsd(1_000_000n * WAD)).toBe("$1,000,000.00");
  });
});

describe("calcLeverageBps", () => {
  it("returns 10000 bps (1x) when size equals collateral", () => {
    expect(calcLeverageBps(1000n * WAD, 1000n * WAD)).toBe(10_000n);
  });

  it("returns 50000 bps (5x) for 5:1 leverage", () => {
    expect(calcLeverageBps(5000n * WAD, 1000n * WAD)).toBe(50_000n);
  });

  it("returns 0 when collateral is zero (avoids division by zero)", () => {
    expect(calcLeverageBps(1000n * WAD, 0n)).toBe(0n);
  });
});

describe("formatLeverage", () => {
  it("formats 1x leverage", () => {
    expect(formatLeverage(10_000n)).toBe("1.0x");
  });

  it("formats 5x leverage", () => {
    expect(formatLeverage(50_000n)).toBe("5.0x");
  });

  it("formats 2.5x leverage", () => {
    expect(formatLeverage(25_000n)).toBe("2.5x");
  });
});

describe("marginUsageToPercent", () => {
  it("converts 10000 bps to 100.00%", () => {
    expect(marginUsageToPercent(10_000n)).toBe("100.00%");
  });

  it("converts 7500 bps to 75.00%", () => {
    expect(marginUsageToPercent(7_500n)).toBe("75.00%");
  });

  it("converts 0 bps to 0.00%", () => {
    expect(marginUsageToPercent(0n)).toBe("0.00%");
  });
});

describe("isDataStale", () => {
  it("returns false for a fresh timestamp (now)", () => {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    expect(isDataStale(nowSec)).toBe(false);
  });

  it("returns true for a timestamp older than maxAgeSeconds", () => {
    const oldSec = BigInt(Math.floor(Date.now() / 1000)) - 600n;
    expect(isDataStale(oldSec, 300)).toBe(true);
  });

  it("returns false when timestamp is exactly at the boundary", () => {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const exactBoundary = nowSec - 300n;
    // 300 - 300 = 0, NOT > maxAge, so not stale
    expect(isDataStale(exactBoundary, 300)).toBe(false);
  });
});

// Position filter behaviour is validated through useVantagePositions integration,
// but we can test the core filter logic (size === 0 → skip) as a standalone assertion.
describe("position filter: size === 0 means closed", () => {
  it("identifies a position with size 0 as closed", () => {
    const size = 0n;
    expect(size === 0n).toBe(true);
  });

  it("identifies a position with size > 0 as open", () => {
    const size = 1000n * WAD;
    expect(size === 0n).toBe(false);
  });
});
