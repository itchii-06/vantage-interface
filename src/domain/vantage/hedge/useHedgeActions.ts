/**
 * useHedgeActions.ts
 *
 * Provides contract call hooks for HedgeController actions:
 *   - createManagedHedge   (USDC margin)
 *   - createManagedHedgeETH (ETH margin)
 *   - createSelfCustodyHedge (USDC margin)
 *   - createSelfCustodyHedgeETH (ETH margin)
 *
 * Each function:
 *   1. Validates balances (returns an error string or null)
 *   2. Calls ERC-20 approve if needed
 *   3. Sends the tx and returns the tx hash
 *
 * Execution fee is currently hardcoded to 0 for local testing.
 * Set EXECUTION_FEE_WEI for production use.
 */

import { Contract } from "ethers";
import { useCallback, useState } from "react";

import { useChainId } from "lib/chains";
import { useEthersSigner } from "lib/wallets/useEthersSigner";
import HedgeControllerAbi from "vantage/abis/HedgeController.json";
import ERC20Abi from "vantage/abis/MockERC20.json";
import { getVantageContractAddress } from "vantage/contracts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Set to a non-zero value for production (e.g. parseEther("0.001")) */
const EXECUTION_FEE_WEI = 0n;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HedgeMode = "managed" | "selfCustody";
export type HedgeMarginToken = "usdc" | "eth";

export type HedgeParams = {
  /** RWA token address */
  rwaToken: string;
  /** Amount of RWA tokens to deposit (WAD, only for managed) */
  rwaAmount: bigint;
  /** Collateral token address (USDC address, only for USDC margin) */
  collateralToken: string;
  /** Collateral amount (in token decimals) */
  collateralAmount: bigint;
  /** Perp index token address */
  indexToken: string;
  /** Short position notional (WAD) */
  sizeDelta: bigint;
  /** Maximum acceptable entry price (0 = accept any) */
  acceptablePrice: bigint;
};

export type HedgeActionResult = {
  isSubmitting: boolean;
  error: string | null;
  txHash: string | null;
  /** Validates inputs and returns an error message or null */
  validate: (
    mode: HedgeMode,
    marginToken: HedgeMarginToken,
    params: Omit<HedgeParams, "acceptablePrice">
  ) => Promise<string | null>;
  /** Executes the hedge transaction */
  execute: (
    mode: HedgeMode,
    marginToken: HedgeMarginToken,
    params: Omit<HedgeParams, "acceptablePrice">
  ) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHedgeActions(): HedgeActionResult {
  const { chainId } = useChainId();
  const signer = useEthersSigner({ chainId });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // ── Balance / allowance validation ────────────────────────────────────────

  const validate = useCallback(
    async (
      mode: HedgeMode,
      marginToken: HedgeMarginToken,
      params: Omit<HedgeParams, "acceptablePrice">
    ): Promise<string | null> => {
      if (!signer) return "Wallet not connected";

      const account = await signer.getAddress();

      try {
        // Managed mode: check RWA balance
        if (mode === "managed" && params.rwaAmount > 0n) {
          const rwa = new Contract(params.rwaToken, ERC20Abi, signer);
          const rwaBalance: bigint = await rwa.balanceOf(account);
          if (rwaBalance < params.rwaAmount) {
            return `Insufficient RWA balance (have ${rwaBalance}, need ${params.rwaAmount})`;
          }
        }

        // USDC margin: check USDC balance
        if (marginToken === "usdc" && params.collateralAmount > 0n) {
          const usdc = new Contract(params.collateralToken, ERC20Abi, signer);
          const usdcBalance: bigint = await usdc.balanceOf(account);
          if (usdcBalance < params.collateralAmount) {
            return `Insufficient USDC balance`;
          }
        }

        // ETH margin: check ETH balance (collateral + execution fee)
        if (marginToken === "eth") {
          const ethBalance: bigint = await signer.provider!.getBalance(account);
          const required = params.collateralAmount + EXECUTION_FEE_WEI;
          if (ethBalance < required) {
            return `Insufficient ETH balance`;
          }
        }
      } catch {
        return "Failed to check balances";
      }

      return null;
    },
    [signer]
  );

  // ── Execute ───────────────────────────────────────────────────────────────

  const execute = useCallback(
    async (
      mode: HedgeMode,
      marginToken: HedgeMarginToken,
      params: Omit<HedgeParams, "acceptablePrice">
    ): Promise<void> => {
      if (!signer) {
        setError("Wallet not connected");
        return;
      }

      setIsSubmitting(true);
      setError(null);
      setTxHash(null);

      try {
        const hedgeControllerAddress = getVantageContractAddress(chainId, "HedgeController");
        const controller = new Contract(hedgeControllerAddress, HedgeControllerAbi, signer);

        const acceptablePrice = 0n; // accept any price for now
        const executionFee = EXECUTION_FEE_WEI;

        if (mode === "managed") {
          // Approve RWA
          const rwa = new Contract(params.rwaToken, ERC20Abi, signer);
          const rwaAllowance: bigint = await rwa.allowance(await signer.getAddress(), hedgeControllerAddress);
          if (rwaAllowance < params.rwaAmount) {
            const approveTx = await rwa.approve(hedgeControllerAddress, params.rwaAmount);
            await approveTx.wait();
          }

          if (marginToken === "usdc") {
            // Approve USDC
            const usdc = new Contract(params.collateralToken, ERC20Abi, signer);
            const usdcAllowance: bigint = await usdc.allowance(await signer.getAddress(), hedgeControllerAddress);
            if (usdcAllowance < params.collateralAmount) {
              const approveTx = await usdc.approve(hedgeControllerAddress, params.collateralAmount);
              await approveTx.wait();
            }

            const tx = await controller.createManagedHedge(
              params.rwaToken,
              params.rwaAmount,
              params.collateralToken,
              params.collateralAmount,
              params.indexToken,
              params.sizeDelta,
              acceptablePrice,
              executionFee,
              { value: executionFee }
            );
            const receipt = await tx.wait();
            setTxHash(receipt.hash);
          } else {
            // ETH margin: collateralAmount is in wei, send as msg.value
            const msgValue = params.collateralAmount + executionFee;
            const tx = await controller.createManagedHedgeETH(
              params.rwaToken,
              params.rwaAmount,
              params.indexToken,
              params.sizeDelta,
              acceptablePrice,
              executionFee,
              { value: msgValue }
            );
            const receipt = await tx.wait();
            setTxHash(receipt.hash);
          }
        } else {
          // Self-custody mode
          if (marginToken === "usdc") {
            // Approve USDC
            const usdc = new Contract(params.collateralToken, ERC20Abi, signer);
            const usdcAllowance: bigint = await usdc.allowance(await signer.getAddress(), hedgeControllerAddress);
            if (usdcAllowance < params.collateralAmount) {
              const approveTx = await usdc.approve(hedgeControllerAddress, params.collateralAmount);
              await approveTx.wait();
            }

            const tx = await controller.createSelfCustodyHedge(
              params.collateralToken,
              params.collateralAmount,
              params.indexToken,
              params.sizeDelta,
              acceptablePrice,
              executionFee,
              { value: executionFee }
            );
            const receipt = await tx.wait();
            setTxHash(receipt.hash);
          } else {
            const msgValue = params.collateralAmount + executionFee;
            const tx = await controller.createSelfCustodyHedgeETH(
              params.indexToken,
              params.sizeDelta,
              acceptablePrice,
              executionFee,
              { value: msgValue }
            );
            const receipt = await tx.wait();
            setTxHash(receipt.hash);
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        // Surface readable reason from revert
        const match = msg.match(/reason="([^"]+)"/);
        setError(match ? match[1] : msg.slice(0, 120));
      } finally {
        setIsSubmitting(false);
      }
    },
    [signer, chainId]
  );

  return { isSubmitting, error, txHash, validate, execute };
}
