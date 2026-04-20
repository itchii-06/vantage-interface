/**
 * vaultConfig.ts
 *
 * Static configuration for the 4 supported Vaults:
 *   USDC (stable), mBUIDL (Rebasing), mUSDY (PriceShare), mRWA (Direct)
 *
 * Addresses are resolved from the deployment JSON at runtime so this file
 * remains network-agnostic. For localhost these come from frontend-localhost.json.
 */

import localhostDeployment from "vantage/deployments/frontend-localhost.json";

// ---------------------------------------------------------------------------
// Asset type IDs (mirrors Solidity assetType())
// ---------------------------------------------------------------------------

export type AssetTypeId = 0 | 1 | 2 | "stable";

export interface VaultConfig {
  /** Unique key used in URLs and as React key */
  key: string;
  /** Display name */
  name: string;
  /** Token symbol shown in the UI */
  symbol: string;
  /** Asset type: 1=Rebasing, 2=PriceShare, 0=Direct, "stable"=USDC */
  assetType: AssetTypeId;
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
}

// ---------------------------------------------------------------------------
// Build vault list from deployment JSON
// ---------------------------------------------------------------------------

const d = localhostDeployment.addresses as {
  Vault?: string;
  LPManager?: string;
  LPToken?: string;
  tokens?: Record<string, string>;
  mockRWA?: Record<string, string>;
  mockRWAVaults?: Record<string, string>;
  mockRWALPManagers?: Record<string, string>;
  mockRWALPTokens?: Record<string, string>;
};

export const VAULT_CONFIGS: VaultConfig[] = [
  // ── USDC (stable) ────────────────────────────────────────────────────────
  {
    key: "usdc",
    name: "USDC Vault",
    symbol: "USDC",
    assetType: "stable",
    vaultAddress: d.Vault ?? "",
    tokenAddress: d.tokens?.USDC ?? "",
    lpManagerAddress: d.LPManager ?? "",
    lpTokenAddress: d.LPToken ?? "",
    tokenDecimals: 6,
    isMock: false,
    tvSymbol: "BINANCE:BTCUSDT",
  },
  // ── mBUIDL (Rebasing) ────────────────────────────────────────────────────
  {
    key: "mBUIDL",
    name: "mBUIDL Vault",
    symbol: "mBUIDL",
    assetType: 1,
    vaultAddress: d.mockRWAVaults?.Rebasing ?? "",
    tokenAddress: d.mockRWA?.Rebasing ?? "",
    lpManagerAddress: d.mockRWALPManagers?.Rebasing ?? "",
    lpTokenAddress: d.mockRWALPTokens?.Rebasing ?? "",
    tokenDecimals: 18,
    isMock: true,
    tvSymbol: "BINANCE:BTCUSDT",
  },
  // ── mUSDY (PriceShare) ───────────────────────────────────────────────────
  {
    key: "mUSDY",
    name: "mUSDY Vault",
    symbol: "mUSDY",
    assetType: 2,
    vaultAddress: d.mockRWAVaults?.PriceShare ?? "",
    tokenAddress: d.mockRWA?.PriceShare ?? "",
    lpManagerAddress: d.mockRWALPManagers?.PriceShare ?? "",
    lpTokenAddress: d.mockRWALPTokens?.PriceShare ?? "",
    tokenDecimals: 18,
    isMock: true,
    tvSymbol: "BINANCE:ETHUSD",
  },
  // ── mRWA (Direct) ────────────────────────────────────────────────────────
  {
    key: "mRWA",
    name: "mRWA Vault",
    symbol: "mRWA",
    assetType: 0,
    vaultAddress: d.mockRWAVaults?.Direct ?? "",
    tokenAddress: d.mockRWA?.Direct ?? "",
    lpManagerAddress: d.mockRWALPManagers?.Direct ?? "",
    lpTokenAddress: d.mockRWALPTokens?.Direct ?? "",
    tokenDecimals: 18,
    isMock: true,
    tvSymbol: "BINANCE:BTCUSDT",
  },
];

/** Returns the VaultConfig for a given vault address (case-insensitive). */
export function getVaultConfigByAddress(address: string): VaultConfig | undefined {
  return VAULT_CONFIGS.find((v) => v.vaultAddress.toLowerCase() === address.toLowerCase());
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
