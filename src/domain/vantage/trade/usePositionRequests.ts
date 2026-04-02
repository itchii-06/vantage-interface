/**
 * usePositionRequests.ts
 *
 * Tracks pending PositionRouter requests for the connected wallet.
 *
 * State machine per request:
 *   pending → executed   (ExecuteIncreasePosition / ExecuteDecreasePosition event)
 *           → cancelled  (CancelIncreasePosition / CancelDecreasePosition event)
 *           → expired    (block.timestamp > createdAt + maxTimeDelay)
 *
 * Persistence: stored in localStorage so requests survive page reloads.
 */

import { Contract } from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useChainId } from "lib/chains";
import { getProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";
import PositionRouterAbi from "vantage/abis/PositionRouter.json";
import { getVantageContractAddress } from "vantage/contracts";

export type RequestStatus = "pending" | "executed" | "cancelled" | "expired";
export type RequestType = "increase" | "decrease";

export type PositionRequest = {
  requestKey: string;
  type: RequestType;
  /** Unix ms when the on-chain request was created (from block.timestamp × 1000) */
  createdAtMs: number;
  /** block.timestamp + maxTimeDelay × 1000 */
  expiresAtMs: number;
  status: RequestStatus;
  // Human-readable metadata
  indexToken: string;
  isLong: boolean;
  sizeDelta: bigint;
};

const STORAGE_KEY_PREFIX = "vantage:positionRequests:";

function storageKey(account: string, chainId: number) {
  return `${STORAGE_KEY_PREFIX}${chainId}:${account.toLowerCase()}`;
}

function loadRequests(account: string, chainId: number): PositionRequest[] {
  try {
    const raw = localStorage.getItem(storageKey(account, chainId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PositionRequest[];
    // Restore bigint fields that JSON stringifies as strings
    return parsed.map((r) => ({ ...r, sizeDelta: BigInt(r.sizeDelta) }));
  } catch {
    return [];
  }
}

function saveRequests(account: string, chainId: number, requests: PositionRequest[]) {
  try {
    // JSON doesn't support bigint — convert to string
    const serializable = requests.map((r) => ({ ...r, sizeDelta: r.sizeDelta.toString() }));
    localStorage.setItem(storageKey(account, chainId), JSON.stringify(serializable));
  } catch {
    // Ignore quota errors
  }
}

export type UsePositionRequestsResult = {
  requests: PositionRequest[];
  /** Add a newly created request (call after createIncreasePosition succeeds). */
  addRequest: (req: Omit<PositionRequest, "status">) => void;
  /** Manually mark a request as cancelled (optimistic UI update). */
  markCancelled: (requestKey: string) => void;
  /** Remove completed (executed / cancelled / expired) requests from the list. */
  clearCompleted: () => void;
};

const POLL_INTERVAL_MS = 8_000;
const BLOCK_LOOKBACK = 50_000;

export function usePositionRequests(): UsePositionRequestsResult {
  const { account } = useWallet();
  const { chainId } = useChainId();
  const provider = useMemo(() => getProvider(undefined, chainId), [chainId]);

  const [requests, setRequests] = useState<PositionRequest[]>([]);
  const requestsRef = useRef<PositionRequest[]>([]);

  // Sync ref, state, and localStorage
  function updateRequests(updated: PositionRequest[]) {
    requestsRef.current = updated;
    setRequests(updated);
    if (account) saveRequests(account, chainId, updated);
  }

  // Load from localStorage on account / chainId change
  useEffect(() => {
    if (!account) {
      updateRequests([]);
      requestsRef.current = [];
      return;
    }
    const stored = loadRequests(account, chainId);
    requestsRef.current = stored;
    updateRequests(stored);
  }, [account, chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expire pending requests whose deadline has passed
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const current = requestsRef.current;
      const updated = current.map((r) =>
        r.status === "pending" && r.expiresAtMs > 0 && now > r.expiresAtMs
          ? { ...r, status: "expired" as RequestStatus }
          : r
      );
      if (updated.some((r, i) => r.status !== current[i].status)) {
        updateRequests(updated);
      }
    }, 5_000);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for Execute / Cancel events to update request statuses
  useEffect(() => {
    if (!account) return;

    const positionRouterAddress = getVantageContractAddress(chainId, "PositionRouter");
    if (!positionRouterAddress) return;

    const contract = new Contract(positionRouterAddress, PositionRouterAbi, provider);

    async function poll() {
      const current = requestsRef.current;
      const pending = current.filter((r) => r.status === "pending");
      if (pending.length === 0) return;

      try {
        const latest = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latest - BLOCK_LOOKBACK);

        // Query all execute/cancel events in one batch
        const [execInc, cancelInc, execDec, cancelDec] = await Promise.all([
          contract.queryFilter(contract.filters.ExecuteIncreasePosition(), fromBlock),
          contract.queryFilter(contract.filters.CancelIncreasePosition(), fromBlock),
          contract.queryFilter(contract.filters.ExecuteDecreasePosition(), fromBlock),
          contract.queryFilter(contract.filters.CancelDecreasePosition(), fromBlock),
        ]);

        const executedKeys = new Set([
          ...execInc.map((l) => {
            const p = contract.interface.parseLog({ topics: [...l.topics], data: l.data });
            return p?.args.requestKey as string;
          }),
          ...execDec.map((l) => {
            const p = contract.interface.parseLog({ topics: [...l.topics], data: l.data });
            return p?.args.requestKey as string;
          }),
        ]);
        const cancelledKeys = new Set([
          ...cancelInc.map((l) => {
            const p = contract.interface.parseLog({ topics: [...l.topics], data: l.data });
            return p?.args.requestKey as string;
          }),
          ...cancelDec.map((l) => {
            const p = contract.interface.parseLog({ topics: [...l.topics], data: l.data });
            return p?.args.requestKey as string;
          }),
        ]);

        const updated = current.map((r) => {
          if (r.status !== "pending") return r;
          if (executedKeys.has(r.requestKey)) return { ...r, status: "executed" as RequestStatus };
          if (cancelledKeys.has(r.requestKey)) return { ...r, status: "cancelled" as RequestStatus };
          return r;
        });

        if (updated.some((r, i) => r.status !== current[i].status)) {
          updateRequests(updated);
        }
      } catch {
        // Silently ignore RPC errors
      }
    }

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [account, chainId, provider]); // eslint-disable-line react-hooks/exhaustive-deps

  const addRequest = useCallback(
    (req: Omit<PositionRequest, "status">) => {
      const newReq: PositionRequest = { ...req, status: "pending" };
      updateRequests([newReq, ...requestsRef.current]);
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const markCancelled = useCallback((requestKey: string) => {
    updateRequests(
      requestsRef.current.map((r) => (r.requestKey === requestKey ? { ...r, status: "cancelled" as RequestStatus } : r))
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearCompleted = useCallback(() => {
    updateRequests(requestsRef.current.filter((r) => r.status === "pending"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { requests, addRequest, markCancelled, clearCompleted };
}
