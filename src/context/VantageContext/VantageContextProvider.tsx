import React, { useMemo, type ReactNode } from "react";

import { useVantageAccountSummary } from "domain/vantage/positions/useVantageAccountSummary";
import { useVantagePositions } from "domain/vantage/positions/useVantagePositions";
import useWallet from "lib/wallets/useWallet";

import { VantageContext } from "./VantageContext";

type Props = {
  children: ReactNode;
  /** ChainId to fetch Vantage data from. Defaults to the connected wallet's chainId. */
  chainId: number;
};

/**
 * VantageContextProvider
 *
 * Provides global Vantage position and account summary data to the React tree.
 * Mount this alongside (not inside) the existing SyntheticsStateContextProvider
 * to keep the Vantage data layer independent of GMX's state.
 *
 * Example placement in App.tsx:
 *   <SyntheticsStateContextProvider>
 *     <VantageContextProvider chainId={chainId}>
 *       <AppRoutes />
 *     </VantageContextProvider>
 *   </SyntheticsStateContextProvider>
 */
export function VantageContextProvider({ children, chainId }: Props) {
  const { account } = useWallet();

  const {
    positions,
    isLoading: isPositionsLoading,
    error: positionsError,
    refetch: refetchPositions,
  } = useVantagePositions(account, chainId);

  const {
    summary,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useVantageAccountSummary(account, chainId);

  const value = useMemo(
    () => ({
      positions,
      isPositionsLoading,
      summary,
      isSummaryLoading,
      positionsError,
      summaryError,
      refetchPositions,
      refetchSummary,
    }),
    [
      positions,
      isPositionsLoading,
      summary,
      isSummaryLoading,
      positionsError,
      summaryError,
      refetchPositions,
      refetchSummary,
    ]
  );

  return <VantageContext.Provider value={value}>{children}</VantageContext.Provider>;
}
