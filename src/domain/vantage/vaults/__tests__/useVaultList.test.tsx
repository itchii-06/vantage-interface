/**
 * useVaultList.test.tsx
 *
 * Tests for the useVaultList hook.
 *
 * Note: @testing-library/react v11 does not export renderHook.
 *       We use render() with a capturing component instead.
 */

import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useVaultList, type VaultListItem } from "../useVaultList";

// ---------------------------------------------------------------------------
// Mocks (vitest hoists these above the imports above)
// ---------------------------------------------------------------------------

vi.mock("lib/wallets/useWallet", () => ({
  default: vi.fn(),
}));

vi.mock("lib/rpc", () => ({
  getProvider: vi.fn().mockReturnValue({}),
}));

vi.mock("lib/chains", () => ({
  useChainId: vi.fn().mockReturnValue({ chainId: 31337 }),
}));

// Controllable contract mock shared across all tests.
const contractMock = {
  getAUM: vi.fn().mockResolvedValue(50_000n * 10n ** 18n),
  getSharePrice: vi.fn().mockResolvedValue(10n ** 18n),
  balanceOf: vi.fn().mockResolvedValue(100n * 10n ** 18n),
};

vi.mock("ethers", async (importOriginal) => {
  const ethers = await importOriginal<typeof import("ethers")>();
  return {
    ...ethers,
    Contract: vi.fn().mockImplementation(() => contractMock),
  };
});

// Single predictable vault config (no prismAxis → included in VAULT_LIST_CONFIGS).
vi.mock("../vaultConfig", () => ({
  VAULT_CONFIGS: [
    {
      key: "usdc",
      name: "USDC Vault",
      symbol: "USDC",
      assetType: "stable",
      trancheType: "junior",
      vaultAddress: "0xVault",
      tokenAddress: "0xToken",
      lpManagerAddress: "0xLPManager",
      lpTokenAddress: "0xLPToken",
      tokenDecimals: 6,
      isMock: false,
      tvSymbol: "BINANCE:BTCUSDT",
    },
  ],
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WAD = 10n ** 18n;
const ACCOUNT = "0xUserWallet";

async function getUseWalletMock() {
  const mod = await import("lib/wallets/useWallet");
  return vi.mocked(mod.default);
}

/** Renders useVaultList and returns a getter for the latest result. */
function renderVaultList(): { getItems: () => VaultListItem[] } {
  let items: VaultListItem[] = [];

  function Capture() {
    items = useVaultList();
    return null;
  }

  render(React.createElement(Capture));
  return { getItems: () => items };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useVaultList", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    contractMock.getAUM.mockResolvedValue(50_000n * WAD);
    contractMock.getSharePrice.mockResolvedValue(WAD);
    contractMock.balanceOf.mockResolvedValue(100n * WAD);

    const useWalletMock = await getUseWalletMock();
    useWalletMock.mockReturnValue({
      account: ACCOUNT,
      active: true,
      signer: {} as any,
      chainId: 31337,
      status: "connected",
      connector: undefined as any,
      connectorClient: undefined,
      walletClient: undefined,
    });
  });

  it("starts with isLoading: true and aum: 0n before first fetch", () => {
    let initialItems: VaultListItem[] = [];
    let capturedOnce = false;

    function Capture() {
      const items = useVaultList();
      if (!capturedOnce) {
        initialItems = items;
        capturedOnce = true;
      }
      return null;
    }

    act(() => {
      render(React.createElement(Capture));
    });

    expect(initialItems[0].isLoading).toBe(true);
    expect(initialItems[0].aum).toBe(0n);
  });

  it("populates aum and sharePrice after fetch resolves", async () => {
    const { getItems } = renderVaultList();

    await waitFor(() => expect(getItems()[0].isLoading).toBe(false));

    expect(getItems()[0].aum).toBe(50_000n * WAD);
    expect(getItems()[0].sharePrice).toBe(WAD);
  });

  it("computes usdValue = vlpBalance * sharePrice / WAD", async () => {
    const { getItems } = renderVaultList();

    await waitFor(() => expect(getItems()[0].isLoading).toBe(false));

    // vlpBalance = 100 WAD, sharePrice = 1 WAD → usdValue = 100 WAD
    expect(getItems()[0].vlpBalance).toBe(100n * WAD);
    expect(getItems()[0].usdValue).toBe(100n * WAD);
  });

  it("returns vlpBalance = 0n when wallet is not connected", async () => {
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

    const { getItems } = renderVaultList();

    await waitFor(() => expect(getItems()[0].isLoading).toBe(false));

    expect(getItems()[0].vlpBalance).toBe(0n);
    expect(getItems()[0].usdValue).toBe(0n);
  });

  it("falls back to zeros when contract calls throw", async () => {
    contractMock.getAUM.mockRejectedValue(new Error("RPC error"));
    contractMock.getSharePrice.mockRejectedValue(new Error("RPC error"));
    contractMock.balanceOf.mockRejectedValue(new Error("RPC error"));

    const { getItems } = renderVaultList();

    await waitFor(() => expect(getItems()[0].isLoading).toBe(false));

    expect(getItems()[0].aum).toBe(0n);
    expect(getItems()[0].sharePrice).toBe(WAD); // fallback = 1.0
    expect(getItems()[0].vlpBalance).toBe(0n);
    expect(getItems()[0].usdValue).toBe(0n);
  });

  it("reflects config metadata on each item", async () => {
    const { getItems } = renderVaultList();

    await waitFor(() => expect(getItems()[0].isLoading).toBe(false));

    expect(getItems()[0].key).toBe("usdc");
    expect(getItems()[0].symbol).toBe("USDC");
    expect(getItems()[0].trancheType).toBe("junior");
  });
});
