/**
 * useHubHealth.ts
 *
 * Polls SharedPayoutHub.getHubHealth() to derive the Hub cover ratio.
 * Used to display ADL risk warnings in the trade UI.
 *
 * Cover ratio thresholds:
 *   ≥ 130% (13000 bps) → healthy (no warning)
 *   110–130% (11000–13000 bps) → warning (ADL may trigger)
 *   < 110% (11000 bps) → danger (ADL actively running)
 */

import { useEffect, useState } from "react";

import { getProvider } from "lib/rpc";
import { getVantageContractAddress } from "vantage/contracts";
import { SharedPayoutHub__factory } from "vantage/types";

const POLL_INTERVAL_MS = 30_000;
const ZERO = "0x0000000000000000000000000000000000000000";

export type HubHealthStatus = "healthy" | "warning" | "danger";

export type HubHealth = {
  usdcBalance: bigint;
  totalDebt: bigint;
  /** Cover ratio in bps: e.g. 11000 = 110%. 99999 when totalDebt = 0. */
  coverRatioBps: number;
  status: HubHealthStatus;
};

function deriveStatus(coverRatioBps: number): HubHealthStatus {
  if (coverRatioBps >= 13_000) return "healthy";
  if (coverRatioBps >= 11_000) return "warning";
  return "danger";
}

/**
 * Polls SharedPayoutHub health for the given vault address.
 * Returns null when the Hub contract is not configured (zero address).
 */
export function useHubHealth(chainId: number, vaultAddress: string): HubHealth | null {
  const [health, setHealth] = useState<HubHealth | null>(null);

  useEffect(() => {
    const hubAddr = getVantageContractAddress(chainId, "SharedPayoutHub");
    if (!hubAddr || hubAddr === ZERO || !vaultAddress || vaultAddress === ZERO) {
      setHealth(null);
      return;
    }

    const provider = getProvider(undefined, chainId);
    const hub = SharedPayoutHub__factory.connect(hubAddr, provider);

    let cancelled = false;

    async function poll() {
      try {
        const [usdcBalance, totalDebt] = await hub.getHubHealth([vaultAddress]);
        const coverRatioBps = totalDebt === 0n ? 99_999 : Number((usdcBalance * 10_000n) / totalDebt);

        if (!cancelled) {
          setHealth({ usdcBalance, totalDebt, coverRatioBps, status: deriveStatus(coverRatioBps) });
        }
      } catch {
        // Hub not reachable — leave health as null (hide the widget)
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [chainId, vaultAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  return health;
}
