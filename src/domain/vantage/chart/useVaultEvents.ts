/**
 * useVaultEvents.ts
 *
 * Subscribes to Vault contract events via WebSocket for realtime chart updates.
 *
 * Supported networks:
 *   localhost (chainId 31337): ws://localhost:8545  (Hardhat)
 *   other networks:            TODO — set VITE_WS_URL_{CHAIN_ID} env vars
 *
 * Auto-reconnect: if the WebSocket closes unexpectedly, reconnects after 3 seconds.
 */

import { WebSocketProvider, formatEther } from "ethers";
import { useEffect, useRef } from "react";

import { getVantageContractAddress } from "vantage/contracts";
import { Vault__factory } from "vantage/types";

import type { FundingRateEvent, TradeEvent } from "./types";

const LOCALHOST_CHAIN_ID = 31337;

/** Returns a WebSocket URL for the given chainId, or null if not configured. */
function getWsUrl(chainId: number): string | null {
  if (chainId === LOCALHOST_CHAIN_ID) return "ws://localhost:8545";

  // TODO: configure WebSocket URLs for testnet / mainnet via environment variables
  // Example: return import.meta.env[`VITE_WS_URL_${chainId}`] ?? null;
  return null;
}

type VaultEventCallbacks = {
  onTradeEvent: (event: TradeEvent) => void;
  onFundingRateEvent: (event: FundingRateEvent) => void;
};

/**
 * Subscribes to Vault events via WebSocket.
 * Calls the provided callbacks whenever new events arrive.
 * Automatically reconnects if the connection drops.
 */
export function useVaultEvents(chainId: number, indexToken: string, callbacks: VaultEventCallbacks): void {
  // Stable ref for callbacks so reconnect always uses latest handlers
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const wsUrl = getWsUrl(chainId);
    if (!wsUrl || !indexToken) return;

    const vaultAddr = getVantageContractAddress(chainId, "Vault");
    if (!vaultAddr || vaultAddr === "0x0000000000000000000000000000000000000000") return;

    let provider: WebSocketProvider | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;

      try {
        provider = new WebSocketProvider(wsUrl!);
        const vault = Vault__factory.connect(vaultAddr, provider);

        // IncreasePosition: price chart + OI
        vault.on(
          vault.filters.IncreasePosition(undefined, undefined, undefined, indexToken),
          (key, account, _ct, _idx, _cd, sizeDelta, isLong, price) => {
            callbacksRef.current.onTradeEvent({
              price: parseFloat(formatEther(price as bigint)),
              sizeDelta: parseFloat(formatEther(sizeDelta as bigint)),
              isLong: isLong as boolean,
              timestamp: Math.floor(Date.now() / 1000),
              type: "increase",
            });
          }
        );

        // DecreasePosition: price chart + OI
        vault.on(
          vault.filters.DecreasePosition(undefined, undefined, undefined, indexToken),
          (key, account, _ct, _idx, _cd, sizeDelta, isLong, price) => {
            callbacksRef.current.onTradeEvent({
              price: parseFloat(formatEther(price as bigint)),
              sizeDelta: parseFloat(formatEther(sizeDelta as bigint)),
              isLong: isLong as boolean,
              timestamp: Math.floor(Date.now() / 1000),
              type: "decrease",
            });
          }
        );

        // LiquidatePosition: OI reduction
        vault.on(
          vault.filters.LiquidatePosition(undefined, undefined, undefined, indexToken),
          (key, account, _ct, _idx, isLong, size, _col, price) => {
            callbacksRef.current.onTradeEvent({
              price: parseFloat(formatEther(price as bigint)),
              sizeDelta: parseFloat(formatEther(size as bigint)),
              isLong: isLong as boolean,
              timestamp: Math.floor(Date.now() / 1000),
              type: "liquidate",
            });
          }
        );

        // CumulativeFundingUpdated: funding rate chart
        vault.on(vault.filters.CumulativeFundingUpdated(indexToken), (_token, annualRate) => {
          callbacksRef.current.onFundingRateEvent({
            annualRateBps: Number(annualRate as bigint),
            timestamp: Math.floor(Date.now() / 1000),
          });
        });

        // Auto-reconnect on WebSocket close
        const underlyingWs = (provider as unknown as { websocket: WebSocket }).websocket;
        if (underlyingWs && typeof underlyingWs.addEventListener === "function") {
          underlyingWs.addEventListener("close", () => {
            if (!cancelled) {
              reconnectTimer = setTimeout(connect, 3_000);
            }
          });
        }
      } catch {
        // Provider creation failed — retry after 3 s
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 3_000);
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (provider) {
        provider.removeAllListeners();
        provider.destroy();
      }
    };
  }, [chainId, indexToken]); // eslint-disable-line react-hooks/exhaustive-deps
}
