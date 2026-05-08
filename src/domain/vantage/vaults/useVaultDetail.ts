/**
 * useVaultDetail.ts
 *
 * Fetches on-chain state for a single vault detail page:
 *   - AUM, share price
 *   - Token price from MockPriceFeed (for PriceShare / Direct)
 *   - User's VLP balance and USD value
 *   - User's shortfall debt (Issue #124 solvency framework)
 *   - User's token balance (for Rebasing: polls every 5s for real-time update)
 *   - Historical AUM data points (stored in-memory, reset on mount)
 *
 * For Rebasing vaults, token balance is polled every 5 s to show live updates.
 * For all other vaults, the shared 15 s poll is used.
 */

import { Contract } from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";
import LPManagerAbi from "vantage/abis/LPManager.json";
import LPTokenAbi from "vantage/abis/LPToken.json";
import MockERC20Abi from "vantage/abis/MockERC20.json";
import MockPriceFeedAbi from "vantage/abis/MockPriceFeed.json";
import VaultAbi from "vantage/abis/Vault.json";
import localhostDeployment from "vantage/deployments/frontend-localhost.json";

import type { VaultConfig } from "./vaultConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AumDataPoint {
  timestamp: number; // ms epoch
  aum: bigint;
}

export interface VaultDetailData {
  aum: bigint;
  sharePrice: bigint;
  tokenPrice: bigint; // 1e18 — current price from MockPriceFeed
  vlpBalance: bigint; // user's LP token balance
  usdValue: bigint; // user's position in USD WAD
  tokenBalance: bigint; // user's underlying token balance
  shortfall: bigint; // user's shortfall debt for this token
  aumHistory: AumDataPoint[];
  isLoading: boolean;
  refresh: () => Promise<void>; // manually trigger a data refetch
  /** Pending redemption request shares (0 = no active request) */
  pendingShares: bigint;
  /** Epoch ID at which the pending redemption was registered */
  pendingEpochId: bigint;
  /** Unix timestamp (seconds) of the next scheduled epoch execution */
  nextEpochTimestamp: bigint;
  /**
   * Share price set when the user's epoch was executed (0 = not yet executed).
   * When > 0, the user can call claimRedeemedFunds().
   */
  pendingEpochPricePerShare: bigint;
  /** USD value of the pending redemption at current (or epoch) share price, WAD */
  pendingUsdValue: bigint;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const WAD = BigInt("1000000000000000000");
const POLL_INTERVAL_MS = 15_000;
const REBASING_POLL_MS = 5_000;
const MAX_HISTORY_POINTS = 50;

const d = localhostDeployment.addresses as { MockPriceFeed?: string };
const MOCK_PRICE_FEED = d.MockPriceFeed ?? "";

type VaultDetailState = Omit<VaultDetailData, "refresh">;

export function useVaultDetail(cfg: VaultConfig, chainId: number): VaultDetailData {
  const { account } = useWallet();
  const provider = useMemo(() => getProvider(undefined, chainId), [chainId]);

  const [data, setData] = useState<VaultDetailState>({
    aum: 0n,
    sharePrice: WAD,
    tokenPrice: WAD,
    vlpBalance: 0n,
    usdValue: 0n,
    tokenBalance: 0n,
    shortfall: 0n,
    aumHistory: [],
    isLoading: true,
    pendingShares: 0n,
    pendingEpochId: 0n,
    nextEpochTimestamp: 0n,
    pendingEpochPricePerShare: 0n,
    pendingUsdValue: 0n,
  });

  const aumHistoryRef = useRef<AumDataPoint[]>([]);

  const fetch = useCallback(async () => {
    const vault = new Contract(cfg.vaultAddress, VaultAbi, provider);
    const lpManager = new Contract(cfg.lpManagerAddress, LPManagerAbi, provider);
    const lpToken = new Contract(cfg.lpTokenAddress, LPTokenAbi, provider);
    const token = new Contract(cfg.tokenAddress, MockERC20Abi, provider);

    // --- User balances: fetch independently so they always display ---
    const [vlpBalance, tokenBalance, shortfall] = await Promise.all([
      account ? (lpToken.balanceOf(account) as Promise<bigint>).catch(() => 0n) : Promise.resolve(0n),
      account ? (token.balanceOf(account) as Promise<bigint>).catch(() => 0n) : Promise.resolve(0n),
      account
        ? (vault.userShortfallDebt(account, cfg.tokenAddress) as Promise<bigint>).catch(() => 0n)
        : Promise.resolve(0n),
    ]);

    // --- Vault state: may fail if no liquidity yet ---
    let aum = 0n;
    let sharePrice = WAD;
    try {
      [aum, sharePrice] = (await Promise.all([vault.getAUM(), lpManager.getSharePrice()])) as bigint[];
    } catch {
      // Keep defaults when vault is not yet seeded
    }

    // --- Token price from MockPriceFeed (PriceShare / Direct) ---
    let tokenPrice: bigint = WAD;
    if (MOCK_PRICE_FEED && (cfg.assetType === 0 || cfg.assetType === 2)) {
      const feed = new Contract(MOCK_PRICE_FEED, MockPriceFeedAbi, provider);
      try {
        tokenPrice = (await feed.prices(cfg.tokenAddress)) as bigint;
        if (tokenPrice === 0n) tokenPrice = WAD;
      } catch {
        tokenPrice = WAD;
      }
    }

    const usdValue = (vlpBalance * sharePrice) / WAD;

    // --- Redemption epoch state (skip for Prism configs without a real LPManager) ---
    let pendingShares = 0n;
    let pendingEpochId = 0n;
    let nextEpochTimestamp = 0n;
    let pendingEpochPricePerShare = 0n;
    let pendingUsdValue = 0n;

    if (cfg.lpManagerAddress) {
      try {
        const [lastEpochTs, cycleDuration, pendingReq] = await Promise.all([
          lpManager.lastEpochTimestamp() as Promise<bigint>,
          lpManager.redemptionCycleDuration() as Promise<bigint>,
          account
            ? (lpManager.redemptionRequests(account) as Promise<{ shares: bigint; epochId: bigint }>)
            : Promise.resolve({ shares: 0n, epochId: 0n }),
        ]);
        pendingShares = pendingReq.shares;
        pendingEpochId = pendingReq.epochId;
        // When no epoch has been executed yet, lastEpochTimestamp is 0.
        // Use current time as the base so the displayed date is meaningful.
        const baseTs = lastEpochTs > 0n ? lastEpochTs : BigInt(Math.floor(Date.now() / 1000));
        nextEpochTimestamp = baseTs + cycleDuration;

        if (pendingShares > 0n && pendingEpochId > 0n) {
          pendingEpochPricePerShare = (await lpManager.epochPricePerShare(pendingEpochId)) as bigint;
          const priceForValue = pendingEpochPricePerShare > 0n ? pendingEpochPricePerShare : sharePrice;
          pendingUsdValue = (pendingShares * priceForValue) / WAD;
        }
      } catch {
        // Older deployment without redemption epoch methods — skip gracefully
      }
    }

    // Append AUM to history
    const point: AumDataPoint = { timestamp: Date.now(), aum };
    aumHistoryRef.current = [...aumHistoryRef.current.slice(-MAX_HISTORY_POINTS + 1), point];

    setData({
      aum,
      sharePrice,
      tokenPrice,
      vlpBalance,
      usdValue,
      tokenBalance,
      shortfall,
      aumHistory: [...aumHistoryRef.current],
      isLoading: false,
      pendingShares,
      pendingEpochId,
      nextEpochTimestamp,
      pendingEpochPricePerShare,
      pendingUsdValue,
    });
  }, [cfg, account, provider]);

  useEffect(() => {
    aumHistoryRef.current = [];
    fetch();
    const interval = cfg.assetType === 1 ? REBASING_POLL_MS : POLL_INTERVAL_MS;
    const timer = setInterval(fetch, interval);
    return () => clearInterval(timer);
  }, [fetch, cfg.assetType]);

  return { ...data, refresh: fetch };
}
