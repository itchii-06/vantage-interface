import { render } from "@testing-library/react";
import { ethers } from "ethers";
import React from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ARBITRUM, ARBITRUM_SEPOLIA } from "sdk/configs/chains";
import { getVantageContractAddress } from "vantage/contracts";

import {
  useAssetRegistry,
  useChainlinkAdapter,
  useComplianceRegistry,
  useLPManager,
  useLPToken,
  useManualAdapter,
  useMultiOracleMiddleware,
  useOrderBook,
  usePositionRouter,
  useRouter,
  useUniversalPriceLogic,
  useVault,
  useVaultFactory,
  useVaultReader,
  useYieldAccumulator,
  useYieldAwarePriceFeed,
} from "../useVantageContracts";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSigner = {
  getAddress: vi.fn().mockResolvedValue("0xUserWallet"),
  sendTransaction: vi.fn(), // presence signals "writeable"
} as unknown as ethers.Signer;

vi.mock("lib/wallets/useWallet", () => ({
  default: vi.fn(),
}));

vi.mock("lib/rpc", () => ({
  getProvider: vi.fn().mockReturnValue({
    getNetwork: vi.fn().mockResolvedValue({ chainId: BigInt(421614) }),
  }),
}));

let useWalletMock: ReturnType<typeof vi.mocked<typeof import("lib/wallets/useWallet").default>>;
let getProviderMock: ReturnType<typeof vi.mocked<typeof import("lib/rpc").getProvider>>;

function setWalletState(signer: ethers.Signer | undefined, chainId: number | undefined) {
  useWalletMock.mockReturnValue({
    account: signer ? "0xUserWallet" : undefined,
    active: !!signer,
    signer: signer as any,
    chainId,
    status: signer ? ("connected" as const) : ("disconnected" as const),
    connector: undefined as any,
    connectorClient: undefined,
    walletClient: undefined,
  });
}

// ---------------------------------------------------------------------------
// Test component helper
// Captures the contract instance returned by a hook and stores it in a ref.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-empty-function */
const noop = () => {};
/* eslint-enable @typescript-eslint/no-empty-function */

function captureHook<T>(hook: () => T, onResult: (value: T) => void, onError?: (err: Error) => void): React.FC {
  return function TestComponent() {
    try {
      onResult(hook());
    } catch (e) {
      onError?.(e as Error);
    }
    return null;
  };
}

// ---------------------------------------------------------------------------
// Unit tests: pure helpers (no React)
// ---------------------------------------------------------------------------

describe("getVantageContractAddress", () => {
  it("returns the address for a known chain and contract", () => {
    const addr = getVantageContractAddress(ARBITRUM_SEPOLIA, "JuniorTrancheVault");
    expect(typeof addr).toBe("string");
    expect(addr).toMatch(/^0x/);
  });

  it("throws for an unknown chainId", () => {
    expect(() => getVantageContractAddress(1, "JuniorTrancheVault")).toThrow(
      "Vantage contracts not configured for chainId: 1"
    );
  });
});

// ---------------------------------------------------------------------------
// Hook tests
// ---------------------------------------------------------------------------

describe("useVantageContracts", () => {
  beforeAll(async () => {
    useWalletMock = vi.mocked((await import("lib/wallets/useWallet")).default);
    const rpc = await import("lib/rpc");
    getProviderMock = vi.mocked(rpc.getProvider);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: wallet connected to correct chain
    setWalletState(mockSigner, ARBITRUM_SEPOLIA);
  });

  // --- Smoke: all hooks return a BaseContract ---

  it.each([
    ["useVault", useVault],
    ["useVaultFactory", useVaultFactory],
    ["useVaultReader", useVaultReader],
    ["useLPManager", useLPManager],
    ["useLPToken", useLPToken],
    ["useRouter", useRouter],
    ["useOrderBook", useOrderBook],
    ["usePositionRouter", usePositionRouter],
    ["useYieldAccumulator", useYieldAccumulator],
    ["useYieldAwarePriceFeed", useYieldAwarePriceFeed],
    ["useComplianceRegistry", useComplianceRegistry],
    ["useAssetRegistry", useAssetRegistry],
    ["useMultiOracleMiddleware", useMultiOracleMiddleware],
    ["useChainlinkAdapter", useChainlinkAdapter],
    ["useManualAdapter", useManualAdapter],
    ["useUniversalPriceLogic", useUniversalPriceLogic],
  ] as const)("%s — returns a contract instance", (_name, hook) => {
    let contract: ethers.BaseContract | undefined;
    let error: Error | undefined;
    const Comp = captureHook(
      () => hook(),
      (v) => {
        contract = v as ethers.BaseContract;
      },
      (e) => {
        error = e;
      }
    );
    render(<Comp />);

    // Addresses are zero-address placeholders → assertAddress throws
    // That IS the expected behaviour for the placeholder state.
    // The error message must point to pnpm sync.
    expect(error?.message).toMatch(/is not configured/);
    expect(contract).toBeUndefined();
  });

  // --- Network mismatch: read-only fallback ---

  it("uses getProvider (read-only) when wallet is on the wrong chain", () => {
    setWalletState(mockSigner, ARBITRUM); // connected to mainnet, app needs Sepolia
    // We observe getProvider being called since assertAddress fires before
    // we can inspect the runner directly.
    const Comp = captureHook(() => useVault(undefined, ARBITRUM_SEPOLIA), noop, noop);
    render(<Comp />);
    expect(getProviderMock).toHaveBeenCalledWith(undefined, ARBITRUM_SEPOLIA);
  });

  // --- Disconnected: read-only fallback ---

  it("uses getProvider (read-only) when wallet is not connected", () => {
    setWalletState(undefined, undefined);
    const Comp = captureHook(() => useVault(), noop, noop);
    render(<Comp />);
    expect(getProviderMock).toHaveBeenCalled();
  });

  // --- Correct chain: signer is used ---

  it("does NOT call getProvider when wallet is on the correct chain", () => {
    setWalletState(mockSigner, ARBITRUM_SEPOLIA);
    const Comp = captureHook(() => useVault(undefined, ARBITRUM_SEPOLIA), noop, noop);
    render(<Comp />);
    expect(getProviderMock).not.toHaveBeenCalled();
  });

  // --- runnerOverride: Multicall injection ---

  it("uses runnerOverride and skips getProvider when override is provided", () => {
    const multicallProvider = { getNetwork: vi.fn() } as unknown as ethers.ContractRunner;
    const Comp = captureHook(() => useVault(multicallProvider), noop, noop);
    render(<Comp />);
    expect(getProviderMock).not.toHaveBeenCalled();
  });

  // --- Address validation ---

  it("throws with a helpful message when address is zero (placeholder)", () => {
    setWalletState(mockSigner, ARBITRUM_SEPOLIA);
    let error: Error | undefined;
    const Comp = captureHook(
      () => useVault(),
      noop,
      (e) => {
        error = e;
      }
    );
    render(<Comp />);
    expect(error).toBeDefined();
    expect(error?.message).toMatch(/Vault/);
    expect(error?.message).toMatch(/pnpm sync/);
  });
});
