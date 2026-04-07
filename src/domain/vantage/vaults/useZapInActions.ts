/**
 * useZapInActions.ts
 *
 * Transaction hook for LPZapper (Route 2 deposit):
 *   - zapIn    : USDC → Uniswap V3 swap → RWA token → LP shares
 *   - zapInETH : native ETH → WETH → Uniswap V3 swap → RWA token → LP shares
 *
 * Flow:
 *   1. Validate: check sender balance for input token
 *   2. zapIn only: approve USDC to LPZapper if allowance insufficient
 *   3. Call LPZapper.zapIn or LPZapper.zapInETH
 *   4. Return tx hash
 */

import { Contract } from "ethers";
import { parseEther, parseUnits } from "ethers";
import { useCallback, useState } from "react";

import { useChainId } from "lib/chains";
import { useEthersSigner } from "lib/wallets/useEthersSigner";
import useWallet from "lib/wallets/useWallet";
import LPZapperAbi from "vantage/abis/LPZapper.json";
import ERC20Abi from "vantage/abis/MockERC20.json";
import type { ZapTokenConfig } from "vantage/config/zapTokens";
import { getVantageContractAddress } from "vantage/contracts";

import type { VaultConfig } from "./vaultConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ZapInParams {
  /** Amount string entered by user (in input token units, e.g. "100" USDC) */
  amountIn: string;
  /** Minimum RWA token out (0n = accept any; set based on quoted output) */
  minTokenOut: bigint;
  /** USDC token address (needed for approval on USDC route) */
  usdcAddress: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useZapInActions(cfg: VaultConfig, zapToken: ZapTokenConfig, chainId?: number) {
  const { chainId: walletChainId } = useChainId();
  const resolvedChainId = chainId ?? walletChainId;
  const { account } = useWallet();
  const signer = useEthersSigner();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Validate
  // ---------------------------------------------------------------------------

  const validate = useCallback(
    async (params: ZapInParams): Promise<string | null> => {
      if (!account || !signer) return "Wallet not connected";
      if (!params.amountIn || Number(params.amountIn) <= 0) return "Enter an amount";

      try {
        if (zapToken.isNative) {
          const ethBal = await signer.provider!.getBalance(account);
          const needed = parseEther(params.amountIn);
          if (ethBal < needed) return "Insufficient ETH balance";
        } else {
          const token = new Contract(params.usdcAddress, ERC20Abi, signer.provider!);
          const bal: bigint = await token.balanceOf(account);
          const needed = parseUnits(params.amountIn, zapToken.decimals);
          if (bal < needed) return `Insufficient ${zapToken.symbol} balance`;
        }
      } catch {
        return "Balance check failed";
      }

      return null;
    },
    [account, signer, zapToken]
  );

  // ---------------------------------------------------------------------------
  // Execute
  // ---------------------------------------------------------------------------

  const execute = useCallback(
    async (params: ZapInParams): Promise<string | null> => {
      if (!account || !signer) return null;

      const zapperAddress = getVantageContractAddress(resolvedChainId, "LPZapper");
      if (!zapperAddress || zapperAddress === "0x0000000000000000000000000000000000000000") {
        throw new Error("LPZapper not deployed on this network");
      }

      const zapper = new Contract(zapperAddress, LPZapperAbi, signer);

      setIsSubmitting(true);
      try {
        let tx;

        if (zapToken.isNative) {
          // ETH route: no approve needed
          const ethAmount = parseEther(params.amountIn);
          tx = await zapper.zapInETH(cfg.tokenAddress, params.minTokenOut, zapToken.poolFee, account, {
            value: ethAmount,
          });
        } else {
          // USDC route: approve if needed
          const usdcAmount = parseUnits(params.amountIn, zapToken.decimals);
          const usdc = new Contract(params.usdcAddress, ERC20Abi, signer);
          const allowance: bigint = await usdc.allowance(account, zapperAddress);
          if (allowance < usdcAmount) {
            const approveTx = await usdc.approve(zapperAddress, usdcAmount);
            await approveTx.wait();
          }
          tx = await zapper.zapIn(cfg.tokenAddress, usdcAmount, params.minTokenOut, zapToken.poolFee, account);
        }

        return tx.hash as string;
      } finally {
        setIsSubmitting(false);
      }
    },
    [account, signer, resolvedChainId, cfg.tokenAddress, zapToken]
  );

  return { validate, execute, isSubmitting };
}
