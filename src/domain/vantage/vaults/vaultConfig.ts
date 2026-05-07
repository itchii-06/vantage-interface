/**
 * vaultConfig.ts
 *
 * Static configuration for the 4 supported Vaults:
 *   USDC (stable), mBUIDL (Rebasing), mUSDY (PriceShare), mRWA (Direct)
 *
 * Also includes 3 Interest Prism display configs (no real vault — chart-only):
 *   sUSDe_Price (raw market price), sUSDe_Yield (rate→price), sUSDe_Total (return index)
 *
 * Addresses are resolved from the deployment JSON at runtime so this file
 * remains network-agnostic. For localhost these come from frontend-localhost.json.
 */

import { t } from "@lingui/macro";

import localhostDeployment from "vantage/deployments/frontend-localhost.json";

// ---------------------------------------------------------------------------
// Asset type IDs (mirrors Solidity assetType())
// ---------------------------------------------------------------------------

export type AssetTypeId = 0 | 1 | 2 | "stable";

// ---------------------------------------------------------------------------
// Tranche types
// ---------------------------------------------------------------------------

export type TrancheType = "senior" | "junior";

export interface TrancheMeta {
  label: string;
  labelPlural: string;
  shortLabel: string;
  riskLabel: string;
  badgeClass: string;
  description: string;
}

/** Returns tranche display metadata with all strings translated via Lingui. */
export function getTrancheMeta(): Record<TrancheType, TrancheMeta> {
  return {
    senior: {
      label: t`Senior Vault`,
      labelPlural: t`Senior Vaults`,
      shortLabel: t`Senior`,
      riskLabel: t`Low Risk`,
      badgeClass: "bg-indigo-900/60 text-indigo-300 border border-indigo-700",
      description: t`Receives priority yield distribution from protocol revenue. In the event of a loss, Junior capital absorbs the deficit first, providing a higher safety cushion.`,
    },
    junior: {
      label: t`Junior Vault`,
      labelPlural: t`Junior Vaults`,
      shortLabel: t`Junior`,
      riskLabel: t`High Reward`,
      badgeClass: "bg-amber-900/60 text-amber-300 border border-amber-700",
      description: t`Captures all residual yield after Senior allocations, enabling higher APY potential. Acts as the first-loss layer — absorbs FR deficits before Senior LPs are affected.`,
    },
  };
}

export interface VaultConfig {
  /** Unique key used in URLs and as React key */
  key: string;
  /** Display name */
  name: string;
  /** Token symbol shown in the UI */
  symbol: string;
  /** Asset type: 1=Rebasing, 2=PriceShare, 0=Direct, "stable"=USDC */
  assetType: AssetTypeId;
  /**
   * Tranche classification:
   *   senior — RWA vaults receiving priority yield distribution.
   *   junior — USDC vault acting as first-loss layer for FR deficit.
   */
  trancheType: TrancheType;
  /** Vault contract address */
  vaultAddress: string;
  /** Underlying token address */
  tokenAddress: string;
  /** LPManager address for this vault */
  lpManagerAddress: string;
  /** LPToken (VLP) address for this vault */
  lpTokenAddress: string;
  /** Token decimals (18 for Mock RWAs, 6 for USDC) */
  tokenDecimals: number;
  /** Whether this vault is a mock (testnet only) */
  isMock: boolean;
  /** TradingView symbol used for the price chart (e.g. "BINANCE:BTCUSDT") */
  tvSymbol: string;
  /**
   * Interest Prism axis (display-only configs; no real vault or LPManager).
   *   "price" — raw market price via MockPriceFeed / price oracle
   *   "yield" — interest rate → price via InterestRateAdapter
   *   "total" — cumulative total return index via TotalReturnAccumulatorAdapter
   * When set, vaultAddress / lpManagerAddress / lpTokenAddress are empty strings.
   */
  prismAxis?: "price" | "yield" | "total";
  /**
   * Price adapter address for per-index skew tracking (Issue #225/#227).
   * Set on Prism axis configs to route increasePositionWithAdapter calls.
   * Undefined on standard configs (no adapter binding).
   */
  adapterAddress?: string;
  /**
   * Real ERC20 token address for LP deposit (Prism axis configs only).
   * Prism `tokenAddress` is a virtual index token used for oracle/perp routing;
   * the actual collateral deposited into the vault is a different token (e.g. sUSDe).
   * Falls back to `tokenAddress` when absent.
   */
  collateralTokenAddress?: string;
  /**
   * Display symbol for the LP deposit token (Prism axis configs only).
   * Falls back to `symbol` when absent.
   */
  collateralSymbol?: string;

  /** Image URL for the token */
  imageUrl?: string;
}

// ---------------------------------------------------------------------------
// Build vault list from deployment JSON
// ---------------------------------------------------------------------------

const d = localhostDeployment.addresses as {
  JuniorTrancheVault?: string;
  LPManager?: string;
  LPToken?: string;
  tokens?: Record<string, string>;
  mockRWA?: Record<string, string>;
  mockRWAVaults?: Record<string, string>;
  mockRWALPManagers?: Record<string, string>;
  mockRWALPTokens?: Record<string, string>;
  /** sUSDe Senior Vault (Step 17e-3b) */
  sUSDeVault?: string;
  sUSDeLPToken?: string;
  sUSDeLPManager?: string;
  sUSDeToken?: string;
  /** Interest Prism virtual index token addresses (localhost only) */
  prismTokens?: { Price?: string; Yield?: string; Total?: string };
  /** Interest Prism adapter addresses (localhost only) */
  prismAdapters?: {
    benchmarkOracle?: string;
    interestRateAdapter?: string;
    totalReturnAdapter?: string;
  };
  /** Exchange rate adapters for yield-bearing tokens */
  exchangeRateAdapters?: {
    sUSDe?: { mockVault?: string; adapter?: string };
  };
};

export const VAULT_CONFIGS: VaultConfig[] = [
  // ── USDC (stable / Junior) ───────────────────────────────────────────────
  {
    key: "usdc",
    name: "USDC Vault",
    symbol: "USDC",
    assetType: "stable",
    trancheType: "junior",
    vaultAddress: d.JuniorTrancheVault ?? "",
    tokenAddress: d.tokens?.USDC ?? "",
    lpManagerAddress: d.LPManager ?? "",
    lpTokenAddress: d.LPToken ?? "",
    tokenDecimals: 6,
    isMock: false,
    tvSymbol: "BINANCE:BTCUSDT",
    imageUrl: "/coins/usdc.png",
  },
  // ── mBUIDL (Rebasing / Senior) ───────────────────────────────────────────
  {
    key: "mBUIDL",
    name: "mBUIDL Vault",
    symbol: "mBUIDL",
    assetType: 1,
    trancheType: "senior",
    vaultAddress: d.mockRWAVaults?.Rebasing ?? "",
    tokenAddress: d.mockRWA?.Rebasing ?? "",
    lpManagerAddress: d.mockRWALPManagers?.Rebasing ?? "",
    lpTokenAddress: d.mockRWALPTokens?.Rebasing ?? "",
    tokenDecimals: 18,
    isMock: true,
    tvSymbol: "BINANCE:BTCUSDT",
  },
  // ── mUSDY (PriceShare / Senior) ──────────────────────────────────────────
  {
    key: "mUSDY",
    name: "mUSDY Vault",
    symbol: "mUSDY",
    assetType: 2,
    trancheType: "senior",
    vaultAddress: d.mockRWAVaults?.PriceShare ?? "",
    tokenAddress: d.mockRWA?.PriceShare ?? "",
    lpManagerAddress: d.mockRWALPManagers?.PriceShare ?? "",
    lpTokenAddress: d.mockRWALPTokens?.PriceShare ?? "",
    tokenDecimals: 18,
    isMock: true,
    tvSymbol: "BINANCE:ETHUSD",
  },
  // ── mRWA (Direct / Senior) ───────────────────────────────────────────────
  {
    key: "mRWA",
    name: "mRWA Vault",
    symbol: "mRWA",
    assetType: 0,
    trancheType: "senior",
    vaultAddress: d.mockRWAVaults?.Direct ?? "",
    tokenAddress: d.mockRWA?.Direct ?? "",
    lpManagerAddress: d.mockRWALPManagers?.Direct ?? "",
    lpTokenAddress: d.mockRWALPTokens?.Direct ?? "",
    tokenDecimals: 18,
    isMock: true,
    tvSymbol: "BINANCE:BTCUSDT",
  },

  // ── sUSDe (PriceShare / Senior) ──────────────────────────────────────────
  // LP deposit vault for sUSDe. Shown once on the Vaults page.
  // Trading / hedging uses the three Prism axis configs below.
  {
    key: "sUSDe",
    name: "sUSDe Vault",
    symbol: "sUSDe",
    assetType: 2,
    trancheType: "senior",
    vaultAddress: d.sUSDeVault ?? "",
    tokenAddress: d.sUSDeToken ?? "",
    lpManagerAddress: d.sUSDeLPManager ?? "",
    lpTokenAddress: d.sUSDeLPToken ?? "",
    tokenDecimals: 18,
    isMock: true,
    tvSymbol: "BINANCE:ETHUSD",
    imageUrl: "/coins/susde.png",
  },

  // ── Interest Prism (display-only; no real vault or LPManager) ────────────
  //
  // Three views of the same sUSDe asset across different axes:
  //   Price — raw oracle market price
  //   Yield — InterestRateAdapter: (benchmarkRate + margin) × scalingFactor
  //   Total — TotalReturnAccumulatorAdapter: compounding return index
  //
  // These configs are only meaningful on localhost where the Prism adapters are
  // deployed. On other networks prismTokens is absent and tokenAddress will be
  // an empty string, causing the chart to skip data loading gracefully.

  {
    key: "sUSDe_Price",
    name: "sUSDe Market Price",
    symbol: "sUSDe",
    assetType: 2,
    trancheType: "senior",
    vaultAddress: d.sUSDeVault ?? "",
    tokenAddress: d.prismTokens?.Price ?? "",
    lpManagerAddress: "",
    lpTokenAddress: "",
    tokenDecimals: 18,
    isMock: true,
    tvSymbol: "BINANCE:BTCUSDT",
    prismAxis: "price",
    adapterAddress: d.prismAdapters?.benchmarkOracle ?? "",
    collateralTokenAddress: d.sUSDeToken ?? "",
    collateralSymbol: "sUSDe",
    imageUrl: "/coins/susde.png",
  },
  {
    key: "sUSDe_Yield",
    name: "sUSDe Yield Rate",
    symbol: "sUSDe",
    assetType: 2,
    trancheType: "senior",
    vaultAddress: d.sUSDeVault ?? "",
    tokenAddress: d.prismTokens?.Yield ?? "",
    lpManagerAddress: "",
    lpTokenAddress: "",
    tokenDecimals: 18,
    isMock: true,
    tvSymbol: "BINANCE:BTCUSDT",
    prismAxis: "yield",
    adapterAddress: d.prismAdapters?.interestRateAdapter ?? "",
    collateralTokenAddress: d.sUSDeToken ?? "",
    collateralSymbol: "sUSDe",
    imageUrl: "/coins/susde.png",
  },
  {
    key: "sUSDe_Total",
    name: "sUSDe Total Return Index",
    symbol: "sUSDe",
    assetType: 2,
    trancheType: "senior",
    vaultAddress: d.sUSDeVault ?? "",
    tokenAddress: d.prismTokens?.Total ?? "",
    lpManagerAddress: "",
    lpTokenAddress: "",
    tokenDecimals: 18,
    isMock: true,
    tvSymbol: "BINANCE:BTCUSDT",
    prismAxis: "total",
    adapterAddress: d.prismAdapters?.totalReturnAdapter ?? "",
    collateralTokenAddress: d.sUSDeToken ?? "",
    collateralSymbol: "sUSDe",
    imageUrl: "/coins/susde.png",
  },
];

/** Returns the VaultConfig for a given vault address (case-insensitive). */
export function getVaultConfigByAddress(address: string): VaultConfig | undefined {
  return VAULT_CONFIGS.find((v) => v.vaultAddress.toLowerCase() === address.toLowerCase());
}

/** Returns the VaultConfig for a given key. */
export function getVaultConfigByKey(key: string): VaultConfig | undefined {
  return VAULT_CONFIGS.find((v) => v.key === key);
}

/** Returns the VaultConfig for a given token address (case-insensitive). */
export function getVaultConfigByToken(tokenAddress: string): VaultConfig | undefined {
  return VAULT_CONFIGS.find((v) => v.tokenAddress.toLowerCase() === tokenAddress.toLowerCase());
}

// ---------------------------------------------------------------------------
// Type badge colors
// ---------------------------------------------------------------------------

export const ASSET_TYPE_LABEL: Record<AssetTypeId, string> = {
  1: "Rebasing",
  2: "PriceShare",
  0: "Direct",
  stable: "Stable",
};

export const ASSET_TYPE_COLOR: Record<AssetTypeId, string> = {
  1: "bg-emerald-900/60 text-emerald-300 border border-emerald-700",
  2: "bg-blue-900/60 text-blue-300 border border-blue-700",
  0: "bg-orange-900/60 text-orange-300 border border-orange-700",
  stable: "bg-slate-700/60 text-slate-300 border border-slate-600",
};
