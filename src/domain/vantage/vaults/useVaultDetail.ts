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
import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_SETTLEMENT_CHAIN_ID } from "config/chains";
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

export function useVaultDetail(cfg: VaultConfig): VaultDetailData {
  const { account } = useWallet();
  const provider = getProvider(undefined, DEFAULT_SETTLEMENT_CHAIN_ID);

  const [data, setData] = useState<VaultDetailData>({
    aum: 0n,
    sharePrice: WAD,
    tokenPrice: WAD,
    vlpBalance: 0n,
    usdValue: 0n,
    tokenBalance: 0n,
    shortfall: 0n,
    aumHistory: [],
    isLoading: true,
  });

  const aumHistoryRef = useRef<AumDataPoint[]>([]);

  const fetch = useCallback(async () => {
    try {
      const vault = new Contract(cfg.vaultAddress, VaultAbi, provider);
      const lpManager = new Contract(cfg.lpManagerAddress, LPManagerAbi, provider);
      const lpToken = new Contract(cfg.lpTokenAddress, LPTokenAbi, provider);
      const token = new Contract(cfg.tokenAddress, MockERC20Abi, provider);

      const fetchPromises: Promise<unknown>[] = [
        vault.getAUM(),
        lpManager.getSharePrice(),
        account ? lpToken.balanceOf(account) : Promise.resolve(0n),
        account ? token.balanceOf(account) : Promise.resolve(0n),
        account ? vault.userShortfallDebt(account, cfg.tokenAddress) : Promise.resolve(0n),
      ];

      // Fetch token price from MockPriceFeed for PriceShare / Direct vaults
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

      const [aum, sharePrice, vlpBalance, tokenBalance, shortfall] = (await Promise.all(fetchPromises)) as bigint[];

      const usdValue = (vlpBalance * sharePrice) / WAD;

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
      });
    } catch {
      setData((prev) => ({ ...prev, isLoading: false }));
    }
  }, [cfg, account, provider]);

  useEffect(() => {
    aumHistoryRef.current = [];
    fetch();
    const interval = cfg.assetType === 1 ? REBASING_POLL_MS : POLL_INTERVAL_MS;
    const timer = setInterval(fetch, interval);
    return () => clearInterval(timer);
  }, [fetch, cfg.assetType]);

  return data;
}
