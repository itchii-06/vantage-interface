/**
 * useVantageContracts.ts
 *
 * Typed contract hooks for Vantage protocol contracts.
 *
 * Each hook returns a fully-typed ethers-v6 contract instance:
 * - Wallet connected + correct chain  →  Signer-backed (read + write)
 * - Otherwise                         →  read-only JsonRpcProvider
 *
 * The optional `runnerOverride` parameter allows injecting a custom
 * ContractRunner (e.g. a Multicall provider) without changing hook logic.
 *
 * Usage:
 *   const vault = useVantageNftVault();
 *   const allAssets = await vault.getAllWhitelistedAssets();  // typed ✅
 *
 *   // With Multicall override (future use):
 *   const vault = useVantageNftVault(multicallProvider);
 */

import type { ContractRunner } from "ethers";
import { useMemo } from "react";

import { DEFAULT_SETTLEMENT_CHAIN_ID } from "config/chains";
import { getProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";
import { getVantageContractAddress, VantageContractName } from "vantage/contracts";
import {
  VantageNavOracle__factory,
  VantageNftVault__factory,
  VantagePositionBridge__factory,
  VantagePositionController__factory,
  VantageRewardRouter__factory,
  VantageShopVault__factory,
} from "vantage/types";
import type {
  VantageNavOracle,
  VantageNftVault,
  VantagePositionBridge,
  VantagePositionController,
  VantageRewardRouter,
  VantageShopVault,
} from "vantage/types";

// ---------------------------------------------------------------------------
// Internal: zero address guard
// ---------------------------------------------------------------------------

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function assertAddress(address: string, contractName: VantageContractName): void {
  if (!address || address === ZERO_ADDRESS) {
    throw new Error(
      `[useVantageContracts] Address for "${contractName}" is not configured. ` +
        "Run `pnpm sync` to populate contract addresses from vantage-protocol."
    );
  }
}

// ---------------------------------------------------------------------------
// Internal: generic base hook
//
// Design notes:
//   • runnerOverride: inject a Multicall provider or custom batch provider
//     without modifying per-contract hooks (open for extension).
//   • Network guard: if the wallet is connected to a different chain than
//     targetChainId, silently fall back to a read-only provider for
//     targetChainId so view calls still work regardless of user's network.
// ---------------------------------------------------------------------------

type Factory<T> = { connect: (address: string, runner: ContractRunner) => T };

function useVantageContract<T>(
  Factory: Factory<T>,
  contractName: VantageContractName,
  targetChainId: number = DEFAULT_SETTLEMENT_CHAIN_ID,
  runnerOverride?: ContractRunner
): T {
  const { signer, chainId } = useWallet();

  // Resolve the ContractRunner:
  //   1. runnerOverride takes highest priority (e.g. Multicall)
  //   2. Signer if wallet is connected to the correct chain
  //   3. Read-only JsonRpcProvider for targetChainId (fallback)
  const runner = useMemo<ContractRunner>(() => {
    if (runnerOverride) return runnerOverride;
    if (signer && chainId === targetChainId) return signer;
    return getProvider(undefined, targetChainId);
  }, [runnerOverride, signer, chainId, targetChainId]);

  return useMemo(() => {
    const address = getVantageContractAddress(targetChainId, contractName);
    assertAddress(address, contractName);
    return Factory.connect(address, runner);
  }, [Factory, contractName, targetChainId, runner]);
}

// ---------------------------------------------------------------------------
// Public hooks
// ---------------------------------------------------------------------------

/** Typed hook for VantageNftVault contract. */
export function useVantageNftVault(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): VantageNftVault {
  return useVantageContract(VantageNftVault__factory, "VantageNftVault", chainId, runnerOverride);
}

/** Typed hook for VantageShopVault contract. */
export function useVantageShopVault(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): VantageShopVault {
  return useVantageContract(VantageShopVault__factory, "VantageShopVault", chainId, runnerOverride);
}

/** Typed hook for VantagePositionController contract. */
export function useVantagePositionController(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): VantagePositionController {
  return useVantageContract(VantagePositionController__factory, "VantagePositionController", chainId, runnerOverride);
}

/** Typed hook for VantagePositionBridge contract. */
export function useVantagePositionBridge(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): VantagePositionBridge {
  return useVantageContract(VantagePositionBridge__factory, "VantagePositionBridge", chainId, runnerOverride);
}

/** Typed hook for VantageRewardRouter contract. */
export function useVantageRewardRouter(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): VantageRewardRouter {
  return useVantageContract(VantageRewardRouter__factory, "VantageRewardRouter", chainId, runnerOverride);
}

/** Typed hook for VantageNavOracle contract. */
export function useVantageNavOracle(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): VantageNavOracle {
  return useVantageContract(VantageNavOracle__factory, "VantageNavOracle", chainId, runnerOverride);
}
