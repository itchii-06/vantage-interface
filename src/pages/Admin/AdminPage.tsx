/**
 * AdminPage.tsx
 *
 * Route: /admin
 *
 * AUM Allocation Dashboard (Issue #183)
 *
 * Per-vault panels showing:
 *   - Real-time hedge OI utilization bar
 *   - Real-time trade OI utilization bar
 *   - Sliders to update hedgeCapBps / tradeCapBps
 *   - Submit button to call Vault.setAumCaps()
 *
 * Cap semantics: 0 = no restriction, 1–10000 = percentage of AUM (bps).
 */

import { t } from "@lingui/macro";
import { formatEther } from "ethers";
import React, { useMemo, useState } from "react";

import { useAumAllocation } from "domain/vantage/admin/useAumAllocation";
import { VAULT_CONFIGS, type VaultConfig } from "domain/vantage/vaults/vaultConfig";

import { AppHeader } from "components/AppHeader/AppHeader";
import { AppNav } from "components/AppNav/AppNav";
import Button from "components/Button/Button";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUsd(wad: bigint): string {
  const n = parseFloat(formatEther(wad));
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Percentage utilization (0–100) given current OI and max. Returns 0 if max=0 (disabled). */
function utilizationPct(current: bigint, max: bigint): number {
  if (max === 0n) return 0;
  const pct = Number((current * 10_000n) / max) / 100;
  return Math.min(pct, 100);
}

// ---------------------------------------------------------------------------
// UtilizationBar
// ---------------------------------------------------------------------------

function UtilizationBar({
  label,
  current,
  max,
  disabled,
  color,
}: {
  label: string;
  current: bigint;
  max: bigint;
  disabled: boolean;
  color: "blue" | "green";
}) {
  const pct = disabled ? 0 : utilizationPct(current, max);
  const barColor = color === "blue" ? "bg-blue-500" : "bg-green-500";
  const warningColor = pct >= 90 ? "text-red-400" : pct >= 70 ? "text-yellow-400" : "text-slate-300";
  const barStyle = useMemo<React.CSSProperties>(() => ({ width: `${pct}%` }), [pct]);

  return (
    <div>
      <div className="mb-4 flex justify-between text-12">
        <span className="text-slate-400">{label}</span>
        {disabled ? (
          <span className="text-slate-500">{t`Unlimited`}</span>
        ) : (
          <span className={warningColor}>
            ${formatUsd(current)} / ${formatUsd(max)} ({pct.toFixed(1)}%)
          </span>
        )}
      </div>
      <div className="h-8 overflow-hidden rounded-full bg-slate-700">
        {!disabled && <div className={`h-full rounded-full transition-all ${barColor}`} style={barStyle} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VaultAllocationPanel
// ---------------------------------------------------------------------------

function VaultAllocationPanel({ config }: { config: VaultConfig }) {
  const { status, isLoading, isSetting, setAumCaps } = useAumAllocation(config);

  // Local slider state (bps, 0–10000)
  const [hedgeBps, setHedgeBps] = useState<number | null>(null);
  const [tradeBps, setTradeBps] = useState<number | null>(null);

  // Initialise sliders from on-chain values once loaded
  const resolvedHedgeBps = hedgeBps ?? (status ? Number(status.hedgeCapBps) : 0);
  const resolvedTradeBps = tradeBps ?? (status ? Number(status.tradeCapBps) : 0);

  async function handleSubmit() {
    await setAumCaps(BigInt(resolvedHedgeBps), BigInt(resolvedTradeBps));
    setHedgeBps(null); // reset to server value
    setTradeBps(null);
  }

  const hedgeDisabled = resolvedHedgeBps === 0;
  const tradeDisabled = resolvedTradeBps === 0;
  const isDirty =
    status !== null &&
    (resolvedHedgeBps !== Number(status.hedgeCapBps) || resolvedTradeBps !== Number(status.tradeCapBps));

  // Near-cap warning: utilization ≥ 95% means an oracle price move could push the TX over the cap.
  const NEAR_CAP_THRESHOLD = 95;
  const hedgeUtilPct = !hedgeDisabled && status ? utilizationPct(status.currentHedgeOI, status.maxHedgeOI) : 0;
  const tradeUtilPct = !tradeDisabled && status ? utilizationPct(status.currentTradeOI, status.maxTradeOI) : 0;
  const hedgeNearCap = hedgeUtilPct >= NEAR_CAP_THRESHOLD;
  const tradeNearCap = tradeUtilPct >= NEAR_CAP_THRESHOLD;

  return (
    <div className="bg-cold-blue-950 rounded-4 border border-stroke-primary p-16">
      {/* Header */}
      <div className="mb-14 flex items-center justify-between">
        <h2 className="text-15 font-semibold text-white">{config.symbol}</h2>
        <span className="text-12 text-slate-500">{config.vaultAddress.slice(0, 10)}…</span>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-13 text-slate-500">{t`Loading…`}</div>
      ) : (
        <div className="flex flex-col gap-14">
          {/* Utilization bars */}
          <UtilizationBar
            label={t`Hedge OI`}
            current={status?.currentHedgeOI ?? 0n}
            max={status?.maxHedgeOI ?? 0n}
            disabled={hedgeDisabled}
            color="blue"
          />
          <UtilizationBar
            label={t`Trade OI`}
            current={status?.currentTradeOI ?? 0n}
            max={status?.maxTradeOI ?? 0n}
            disabled={tradeDisabled}
            color="green"
          />

          {/* Near-cap warnings */}
          {(hedgeNearCap || tradeNearCap) && (
            <div className="border-yellow-600/40 rounded-4 border bg-yellow-900/20 px-12 py-10 text-12 text-yellow-300">
              {hedgeNearCap && tradeNearCap
                ? t`Hedge and trade OI are both near cap (≥95%). Oracle price movements at TX time may trigger HedgeCapExceeded or TradeCapExceeded.`
                : hedgeNearCap
                  ? t`Hedge OI is near cap (≥95%). Oracle price movements at TX time may trigger HedgeCapExceeded.`
                  : t`Trade OI is near cap (≥95%). Oracle price movements at TX time may trigger TradeCapExceeded.`}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-stroke-primary" />

          {/* Hedge cap slider */}
          <div>
            <div className="mb-6 flex justify-between text-12">
              <label className="text-slate-400">{t`Hedge Cap`}</label>
              <span className="font-medium text-white">
                {resolvedHedgeBps === 0 ? t`Unlimited` : `${(resolvedHedgeBps / 100).toFixed(0)}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10000}
              step={100}
              value={resolvedHedgeBps}
              onChange={(e) => setHedgeBps(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="text-10 mt-2 flex justify-between text-slate-600">
              <span>{t`Off`}</span>
              <span>100%</span>
            </div>
          </div>

          {/* Trade cap slider */}
          <div>
            <div className="mb-6 flex justify-between text-12">
              <label className="text-slate-400">{t`Trade Cap`}</label>
              <span className="font-medium text-white">
                {resolvedTradeBps === 0 ? t`Unlimited` : `${(resolvedTradeBps / 100).toFixed(0)}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10000}
              step={100}
              value={resolvedTradeBps}
              onChange={(e) => setTradeBps(Number(e.target.value))}
              className="w-full accent-green-500"
            />
            <div className="text-10 mt-2 flex justify-between text-slate-600">
              <span>{t`Off`}</span>
              <span>100%</span>
            </div>
          </div>

          {/* Submit */}
          <Button
            variant="primary"
            size="medium"
            disabled={!isDirty || isSetting}
            onClick={handleSubmit}
            className="w-full"
          >
            {isSetting ? t`Saving…` : t`Apply Caps`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminPage
// ---------------------------------------------------------------------------

export default function AdminPage() {
  // Only show vaults with a valid vault address
  const activeVaults = VAULT_CONFIGS.filter((v) => v.vaultAddress);

  return (
    <div className="w-full">
      <div className="border-b border-stroke-primary px-16 py-8">
        <AppHeader leftContent={<AppNav />} />
      </div>

      <div className="mt-24 px-16">
        <div className="mx-auto max-w-[960px]">
          {/* Page header */}
          <div className="mb-20">
            <h1 className="text-h1">{t`Admin Dashboard`}</h1>
            <p className="text-body-medium mt-4 text-slate-400">
              {t`Set AUM allocation caps for hedge and trade OI per vault. Cap = 0 (Unlimited) means no restriction.`}
            </p>
          </div>

          {/* Vault grid */}
          <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
            {activeVaults.map((config) => (
              <VaultAllocationPanel key={config.key} config={config} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
