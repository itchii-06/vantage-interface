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
 *   const vault = useVault();
 *   const price = await vault.getMaxPrice(tokenAddress);  // typed ✅
 *
 *   // With Multicall override (future use):
 *   const vault = useVault(multicallProvider);
 */

import type { ContractRunner } from "ethers";
import { useMemo } from "react";

import { DEFAULT_SETTLEMENT_CHAIN_ID } from "config/chains";
import { getProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";
import { getVantageContractAddress, VantageContractName } from "vantage/contracts";
import {
  AssetRegistry__factory,
  ChainlinkAdapter__factory,
  ComplianceRegistry__factory,
  LPManager__factory,
  LPToken__factory,
  ManualAdapter__factory,
  MultiOracleMiddleware__factory,
  OrderBook__factory,
  PositionRouter__factory,
  Router__factory,
  UniversalPriceLogic__factory,
  VaultFactory__factory,
  VaultReader__factory,
  Vault__factory,
  YieldAccumulator__factory,
  YieldAwarePriceFeed__factory,
} from "vantage/types";
import type {
  AssetRegistry,
  ChainlinkAdapter,
  ComplianceRegistry,
  LPManager,
  LPToken,
  ManualAdapter,
  MultiOracleMiddleware,
  OrderBook,
  PositionRouter,
  Router,
  UniversalPriceLogic,
  Vault,
  VaultFactory,
  VaultReader,
  YieldAccumulator,
  YieldAwarePriceFeed,
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

/** Typed hook for Vault contract. */
export function useVault(runnerOverride?: ContractRunner, chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID): Vault {
  return useVantageContract(Vault__factory, "JuniorTrancheVault", chainId, runnerOverride);
}

/** Typed hook for VaultFactory contract. */
export function useVaultFactory(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): VaultFactory {
  return useVantageContract(VaultFactory__factory, "VaultFactory", chainId, runnerOverride);
}

/** Typed hook for VaultReader contract. */
export function useVaultReader(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): VaultReader {
  return useVantageContract(VaultReader__factory, "VaultReader", chainId, runnerOverride);
}

/** Typed hook for LPManager contract. */
export function useLPManager(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): LPManager {
  return useVantageContract(LPManager__factory, "LPManager", chainId, runnerOverride);
}

/** Typed hook for LPToken contract. */
export function useLPToken(runnerOverride?: ContractRunner, chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID): LPToken {
  return useVantageContract(LPToken__factory, "LPToken", chainId, runnerOverride);
}

/** Typed hook for Router contract. */
export function useRouter(runnerOverride?: ContractRunner, chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID): Router {
  return useVantageContract(Router__factory, "Router", chainId, runnerOverride);
}

/** Typed hook for OrderBook contract. */
export function useOrderBook(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): OrderBook {
  return useVantageContract(OrderBook__factory, "OrderBook", chainId, runnerOverride);
}

/** Typed hook for PositionRouter contract. */
export function usePositionRouter(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): PositionRouter {
  return useVantageContract(PositionRouter__factory, "PositionRouter", chainId, runnerOverride);
}

/** Typed hook for YieldAccumulator contract. */
export function useYieldAccumulator(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): YieldAccumulator {
  return useVantageContract(YieldAccumulator__factory, "YieldAccumulator", chainId, runnerOverride);
}

/** Typed hook for YieldAwarePriceFeed contract. */
export function useYieldAwarePriceFeed(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): YieldAwarePriceFeed {
  return useVantageContract(YieldAwarePriceFeed__factory, "YieldAwarePriceFeed", chainId, runnerOverride);
}

/** Typed hook for ComplianceRegistry contract. */
export function useComplianceRegistry(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): ComplianceRegistry {
  return useVantageContract(ComplianceRegistry__factory, "ComplianceRegistry", chainId, runnerOverride);
}

/** Typed hook for AssetRegistry contract. */
export function useAssetRegistry(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): AssetRegistry {
  return useVantageContract(AssetRegistry__factory, "AssetRegistry", chainId, runnerOverride);
}

/** Typed hook for MultiOracleMiddleware contract. */
export function useMultiOracleMiddleware(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): MultiOracleMiddleware {
  return useVantageContract(MultiOracleMiddleware__factory, "MultiOracleMiddleware", chainId, runnerOverride);
}

/** Typed hook for ChainlinkAdapter contract. */
export function useChainlinkAdapter(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): ChainlinkAdapter {
  return useVantageContract(ChainlinkAdapter__factory, "ChainlinkAdapter", chainId, runnerOverride);
}

/** Typed hook for ManualAdapter contract. */
export function useManualAdapter(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): ManualAdapter {
  return useVantageContract(ManualAdapter__factory, "ManualAdapter", chainId, runnerOverride);
}

/** Typed hook for UniversalPriceLogic contract. */
export function useUniversalPriceLogic(
  runnerOverride?: ContractRunner,
  chainId: number = DEFAULT_SETTLEMENT_CHAIN_ID
): UniversalPriceLogic {
  return useVantageContract(UniversalPriceLogic__factory, "UniversalPriceLogic", chainId, runnerOverride);
}
