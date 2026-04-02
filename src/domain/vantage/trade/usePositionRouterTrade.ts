/**
 * usePositionRouterTrade.ts
 *
 * Submits open/close requests through PositionRouter (2-step async flow).
 * Returns the requestKey emitted by the contract so callers can track status.
 *
 * Flow:
 *   createIncreasePosition / createDecreasePosition
 *     → Keeper executes after block delay
 *     → ExecuteIncreasePosition / ExecuteDecreasePosition event emitted
 */

import { t } from "@lingui/macro";
import { parseEther } from "ethers";
import { useCallback, useEffect, useMemo, useState } from "react";

import { usePositionRouter } from "hooks/useVantageContracts";
import { useChainId } from "lib/chains";
import { helperToast } from "lib/helperToast";
import { getProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";

import { calcAcceptablePrice } from "./utils";

export const DEFAULT_SLIPPAGE_BPS = 30; // 0.3%

export type IncreaseRequest = {
  collateralToken: string;
  indexToken: string;
  amountIn: bigint;
  sizeDelta: bigint;
  isLong: boolean;
  markPrice: bigint;
  slippageBps?: number;
  useNativeEth?: boolean;
};

export type DecreaseRequest = {
  collateralToken: string;
  indexToken: string;
  collateralDelta: bigint;
  sizeDelta: bigint;
  isLong: boolean;
  receiver: string;
  markPrice: bigint;
  slippageBps?: number;
};

export type PositionRouterTradeResult = {
  /** Opens a new position via PositionRouter. Returns requestKey on success. */
  createIncreasePosition: (req: IncreaseRequest) => Promise<string | null>;
  /** Closes / reduces a position via PositionRouter. Returns requestKey on success. */
  createDecreasePosition: (req: DecreaseRequest) => Promise<string | null>;
  /** Cancels a pending increase request by key. */
  cancelIncreasePosition: (requestKey: string) => Promise<void>;
  /** Cancels a pending decrease request by key. */
  cancelDecreasePosition: (requestKey: string) => Promise<void>;
  /** Minimum execution fee (in wei) required by PositionRouter. */
  minExecutionFee: bigint;
  /** Maximum time delay (in seconds) before a request expires. */
  maxTimeDelay: number;
  isReady: boolean;
};

export function usePositionRouterTrade(): PositionRouterTradeResult {
  const { account, signer } = useWallet();
  const { chainId } = useChainId();
  const provider = useMemo(() => getProvider(undefined, chainId), [chainId]);

  const positionRouterRead = usePositionRouter(provider, chainId);
  const positionRouterWrite = usePositionRouter(signer ?? undefined, chainId);

  const [minExecutionFee, setMinExecutionFee] = useState<bigint>(parseEther("0.001"));
  const [maxTimeDelay, setMaxTimeDelay] = useState<number>(0);

  // Fetch contract parameters once on mount / chainId change
  useEffect(() => {
    positionRouterRead
      .minExecutionFee()
      .then((v) => setMinExecutionFee(v))
      .catch((_e) => {
        /* ignore */
      });
    positionRouterRead
      .maxTimeDelay()
      .then((v) => setMaxTimeDelay(Number(v)))
      .catch((_e) => {
        /* ignore */
      });
  }, [positionRouterRead, chainId]);

  const createIncreasePosition = useCallback(
    async (req: IncreaseRequest): Promise<string | null> => {
      if (!account || !signer) {
        helperToast.error(t`Wallet not connected`);
        return null;
      }
      const slippageBps = req.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
      const acceptablePrice = calcAcceptablePrice(req.markPrice, slippageBps, req.isLong, true);

      try {
        let tx;
        if (req.useNativeEth) {
          // ETH collateral: msg.value = collateralAmount + executionFee
          const totalValue = req.amountIn + minExecutionFee;
          tx = await positionRouterWrite.increasePositionETH(
            req.indexToken,
            req.sizeDelta,
            req.isLong,
            acceptablePrice,
            minExecutionFee,
            { value: totalValue }
          );
        } else {
          tx = await positionRouterWrite.createIncreasePosition(
            req.collateralToken,
            req.indexToken,
            req.amountIn,
            req.sizeDelta,
            req.isLong,
            acceptablePrice,
            { value: minExecutionFee }
          );
        }

        helperToast.info(t`Request submitted — waiting for Keeper execution`);
        const receipt = await tx.wait();

        // Extract requestKey from CreateIncreasePosition event
        const iface = positionRouterWrite.interface;
        for (const log of receipt?.logs ?? []) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed?.name === "CreateIncreasePosition") {
              return parsed.args.requestKey as string;
            }
          } catch {
            // skip unparseable logs
          }
        }
        return null;
      } catch (err: unknown) {
        helperToast.error(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [account, signer, positionRouterWrite, minExecutionFee]
  );

  const createDecreasePosition = useCallback(
    async (req: DecreaseRequest): Promise<string | null> => {
      if (!account || !signer) {
        helperToast.error(t`Wallet not connected`);
        return null;
      }
      const slippageBps = req.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
      const acceptablePrice = calcAcceptablePrice(req.markPrice, slippageBps, req.isLong, false);

      try {
        const tx = await positionRouterWrite.createDecreasePosition(
          req.collateralToken,
          req.indexToken,
          req.collateralDelta,
          req.sizeDelta,
          req.isLong,
          req.receiver,
          acceptablePrice,
          { value: minExecutionFee }
        );

        helperToast.info(t`Close request submitted — waiting for Keeper execution`);
        const receipt = await tx.wait();

        const iface = positionRouterWrite.interface;
        for (const log of receipt?.logs ?? []) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed?.name === "CreateDecreasePosition") {
              return parsed.args.requestKey as string;
            }
          } catch {
            // skip unparseable logs
          }
        }
        return null;
      } catch (err: unknown) {
        helperToast.error(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    [account, signer, positionRouterWrite, minExecutionFee]
  );

  const cancelIncreasePosition = useCallback(
    async (requestKey: string): Promise<void> => {
      if (!signer) return;
      try {
        const tx = await positionRouterWrite.cancelIncreasePosition(requestKey);
        await tx.wait();
        helperToast.success(t`Increase request cancelled`);
      } catch (err: unknown) {
        helperToast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [signer, positionRouterWrite]
  );

  const cancelDecreasePosition = useCallback(
    async (requestKey: string): Promise<void> => {
      if (!signer) return;
      try {
        const tx = await positionRouterWrite.cancelDecreasePosition(requestKey);
        await tx.wait();
        helperToast.success(t`Decrease request cancelled`);
      } catch (err: unknown) {
        helperToast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [signer, positionRouterWrite]
  );

  return {
    createIncreasePosition,
    createDecreasePosition,
    cancelIncreasePosition,
    cancelDecreasePosition,
    minExecutionFee,
    maxTimeDelay,
    isReady: Boolean(account && signer),
  };
}
