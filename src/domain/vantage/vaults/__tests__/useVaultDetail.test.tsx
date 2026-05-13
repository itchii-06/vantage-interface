/**
 * useVaultDetail.test.tsx
 *
 * Tests for the useVaultDetail hook.
 *
 * Coverage:
 *   - Initial loading state
 *   - AUM and share price after fetch
 *   - User shortfall debt (Issue #124)
 *   - Token price from MockPriceFeed (PriceShare vaults)
 *   - Redemption epoch: pending request, executed epoch price, pendingUsdValue
 *   - AUM history accumulates over multiple polls
 *   - Graceful fallback when vault is not seeded (getAUM throws)
 *   - refresh() re-fetches data
 *
 * Note: Uses createRoot (React 18 API) directly to avoid the ReactDOM.render
 *       deprecation warning from @testing-library/react v11.
 */

import { act } from "@testing-library/react";
import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVaultDetail, type VaultDetailData } from "../useVaultDetail";
import type { VaultConfig } from "../vaultConfig";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("lib/wallets/useWallet", () => ({
  default: vi.fn(),
}));

vi.mock("lib/rpc", () => ({
  getProvider: vi.fn().mockReturnValue({}),
}));

// Keep MockPriceFeed empty so prices() branch is skipped by default.
// Individual tests override contractMock.prices if needed.
vi.mock("vantage/deployments/frontend-localhost.json", () => ({
  default: {
    addresses: {
      MockPriceFeed: "0xMockPriceFeed",
    },
  },
}));

const WAD = 10n ** 18n;

const contractMock = {
  getAUM: vi.fn().mockResolvedValue(100_000n * WAD),
  getSharePrice: vi.fn().mockResolvedValue(WAD),
  balanceOf: vi.fn().mockResolvedValue(200n * WAD),
  userShortfallDebt: vi.fn().mockResolvedValue(5n * WAD),
  prices: vi.fn().mockResolvedValue(3_000n * WAD),
  lastEpochTimestamp: vi.fn().mockResolvedValue(1_700_000_000n),
  redemptionCycleDuration: vi.fn().mockResolvedValue(30n * 24n * 3600n),
  redemptionRequests: vi.fn().mockResolvedValue({ shares: 0n, epochId: 0n }),
  epochPricePerShare: vi.fn().mockResolvedValue(0n),
};

vi.mock("ethers", async (importOriginal) => {
  const ethers = await importOriginal<typeof import("ethers")>();
  return {
    ...ethers,
    Contract: vi.fn().mockImplementation(() => contractMock),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHAIN_ID = 31337;
const ACCOUNT = "0xUserWallet";

async function getUseWalletMock() {
  const mod = await import("lib/wallets/useWallet");
  return vi.mocked(mod.default);
}

function makeConfig(assetType: 0 | 1 | 2 | "stable" = 2): VaultConfig {
  return {
    key: "mUSDY",
    name: "mUSDY Vault",
    symbol: "mUSDY",
    assetType,
    trancheType: "senior",
    vaultAddress: "0xVault",
    tokenAddress: "0xToken",
    lpManagerAddress: "0xLPManager",
    lpTokenAddress: "0xLPToken",
    tokenDecimals: 18,
    isMock: true,
    tvSymbol: "BINANCE:ETHUSD",
  };
}

/**
 * Renders useVaultDetail inside a React 18 root and exposes a getter for the
 * latest result.  Returns an unmount function for afterEach cleanup.
 */
function renderVaultDetail(cfg: VaultConfig = makeConfig()): {
  getData: () => VaultDetailData;
  unmount: () => void;
} {
  let data: VaultDetailData | null = null;

  function Capture() {
    data = useVaultDetail(cfg, CHAIN_ID);
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(Capture));
  });

  return {
    getData: () => data as VaultDetailData,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      document.body.removeChild(container);
    },
  };
}

/** Poll until `pred` returns true (or throw if it throws consistently). */
async function waitUntil(pred: () => void, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  let lastErr: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      await act(async () => {
        await new Promise<void>((r) => setTimeout(r, 50));
      });
      pred();
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useVaultDetail", () => {
  const unmounts: Array<() => void> = [];

  beforeEach(async () => {
    vi.clearAllMocks();

    contractMock.getAUM.mockResolvedValue(100_000n * WAD);
    contractMock.getSharePrice.mockResolvedValue(WAD);
    contractMock.balanceOf.mockResolvedValue(200n * WAD);
    contractMock.userShortfallDebt.mockResolvedValue(5n * WAD);
    contractMock.prices.mockResolvedValue(3_000n * WAD);
    contractMock.lastEpochTimestamp.mockResolvedValue(1_700_000_000n);
    contractMock.redemptionCycleDuration.mockResolvedValue(30n * 24n * 3600n);
    contractMock.redemptionRequests.mockResolvedValue({ shares: 0n, epochId: 0n });
    contractMock.epochPricePerShare.mockResolvedValue(0n);

    const useWalletMock = await getUseWalletMock();
    useWalletMock.mockReturnValue({
      account: ACCOUNT,
      active: true,
      signer: {} as any,
      chainId: CHAIN_ID,
      status: "connected",
      connector: undefined as any,
      connectorClient: undefined,
      walletClient: undefined,
    });
  });

  afterEach(() => {
    // Always restore real timers so a failing fake-timer test doesn't leak.
    vi.useRealTimers();
    // Unmount all rendered trees to prevent state leaking between tests.
    while (unmounts.length) unmounts.pop()!();
  });

  function render(cfg?: VaultConfig) {
    const ctx = renderVaultDetail(cfg);
    unmounts.push(ctx.unmount);
    return ctx;
  }

  // ── Synchronous initial state ─────────────────────────────────────────────

  it("starts with isLoading: true and aum: 0n before first fetch", () => {
    const { getData } = render();
    // First render (synchronous) exposes initial hook state.
    expect(getData().isLoading).toBe(true);
    expect(getData().aum).toBe(0n);
    expect(getData().sharePrice).toBe(WAD);
  });

  // ── Vault state ───────────────────────────────────────────────────────────

  it("populates aum and sharePrice after fetch", async () => {
    const { getData } = render();
    await waitUntil(() => expect(getData().isLoading).toBe(false));
    expect(getData().aum).toBe(100_000n * WAD);
    expect(getData().sharePrice).toBe(WAD);
  });

  it("populates vlpBalance, usdValue, and shortfall debt", async () => {
    const { getData } = render();
    await waitUntil(() => expect(getData().isLoading).toBe(false));
    expect(getData().vlpBalance).toBe(200n * WAD);
    expect(getData().usdValue).toBe(200n * WAD);
    expect(getData().shortfall).toBe(5n * WAD);
  });

  // ── Token price ───────────────────────────────────────────────────────────

  it("fetches tokenPrice from MockPriceFeed for PriceShare (assetType 2)", async () => {
    const { getData } = render(makeConfig(2));
    await waitUntil(() => expect(getData().isLoading).toBe(false));
    expect(getData().tokenPrice).toBe(3_000n * WAD);
  });

  it("uses WAD as tokenPrice for Rebasing (assetType 1) — no MockPriceFeed branch", async () => {
    const { getData } = render(makeConfig(1));
    await waitUntil(() => expect(getData().isLoading).toBe(false));
    // assetType 1 skips the MockPriceFeed branch → falls back to WAD
    expect(getData().tokenPrice).toBe(WAD);
  });

  // ── Disconnected wallet ───────────────────────────────────────────────────

  it("returns zero user balances when wallet is not connected", async () => {
    const useWalletMock = await getUseWalletMock();
    useWalletMock.mockReturnValue({
      account: undefined,
      active: false,
      signer: undefined as any,
      chainId: undefined,
      status: "disconnected",
      connector: undefined as any,
      connectorClient: undefined,
      walletClient: undefined,
    });

    const { getData } = render();
    await waitUntil(() => expect(getData().isLoading).toBe(false));
    expect(getData().vlpBalance).toBe(0n);
    expect(getData().tokenBalance).toBe(0n);
    expect(getData().shortfall).toBe(0n);
  });

  // ── Unseeded vault ────────────────────────────────────────────────────────

  it("keeps aum=0 and sharePrice=WAD when vault is not seeded (getAUM/getSharePrice throw)", async () => {
    contractMock.getAUM.mockRejectedValue(new Error("no liquidity"));
    contractMock.getSharePrice.mockRejectedValue(new Error("no liquidity"));

    const { getData } = render();
    await waitUntil(() => expect(getData().isLoading).toBe(false));
    expect(getData().aum).toBe(0n);
    expect(getData().sharePrice).toBe(WAD);
    // User balances still load independently
    expect(getData().vlpBalance).toBe(200n * WAD);
  });

  // ── AUM history ───────────────────────────────────────────────────────────

  it("accumulates AUM history with each fetch call", async () => {
    const { getData } = render();
    await waitUntil(() => expect(getData().aumHistory).toHaveLength(1));
    expect(getData().aumHistory[0].aum).toBe(100_000n * WAD);

    // Trigger a second fetch via refresh() — same code path as the poll timer.
    contractMock.getAUM.mockResolvedValue(120_000n * WAD);
    await act(async () => {
      await getData().refresh();
    });

    expect(getData().aumHistory).toHaveLength(2);
    expect(getData().aumHistory[1].aum).toBe(120_000n * WAD);
  });

  // ── Redemption epoch ──────────────────────────────────────────────────────

  it("computes nextEpochTimestamp = lastEpochTimestamp + cycleDuration", async () => {
    const lastTs = 1_700_000_000n;
    const cycle = 30n * 24n * 3600n;
    contractMock.lastEpochTimestamp.mockResolvedValue(lastTs);
    contractMock.redemptionCycleDuration.mockResolvedValue(cycle);

    const { getData } = render();
    await waitUntil(() => expect(getData().isLoading).toBe(false));
    expect(getData().nextEpochTimestamp).toBe(lastTs + cycle);
  });

  it("computes pendingUsdValue using epochPricePerShare when epoch is executed", async () => {
    const shares = 50n * WAD;
    const epochId = 3n;
    const epochPrice = (110n * WAD) / 100n; // 1.10

    contractMock.redemptionRequests.mockResolvedValue({ shares, epochId });
    contractMock.epochPricePerShare.mockResolvedValue(epochPrice);

    const { getData } = render();
    await waitUntil(() => expect(getData().isLoading).toBe(false));

    expect(getData().pendingShares).toBe(shares);
    expect(getData().pendingEpochId).toBe(epochId);
    expect(getData().pendingEpochPricePerShare).toBe(epochPrice);
    expect(getData().pendingUsdValue).toBe((shares * epochPrice) / WAD); // 55 WAD
  });

  it("falls back to current sharePrice for pendingUsdValue when epoch not yet executed", async () => {
    const shares = 50n * WAD;
    const epochId = 3n;
    contractMock.getSharePrice.mockResolvedValue(WAD);
    contractMock.redemptionRequests.mockResolvedValue({ shares, epochId });
    contractMock.epochPricePerShare.mockResolvedValue(0n); // not executed

    const { getData } = render();
    await waitUntil(() => expect(getData().isLoading).toBe(false));

    expect(getData().pendingEpochPricePerShare).toBe(0n);
    expect(getData().pendingUsdValue).toBe(50n * WAD); // shares * sharePrice / WAD
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  it("refresh() triggers a re-fetch and updates aum", async () => {
    const { getData } = render();
    await waitUntil(() => expect(getData().isLoading).toBe(false));
    expect(getData().aum).toBe(100_000n * WAD);

    contractMock.getAUM.mockResolvedValue(999n * WAD);

    await act(async () => {
      await getData().refresh();
    });

    expect(getData().aum).toBe(999n * WAD);
  });
});
