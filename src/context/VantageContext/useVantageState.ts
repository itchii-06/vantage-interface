import { useContext } from "react";

import { VantageContext, type VantageState } from "./VantageContext";

/**
 * Access the global Vantage state.
 * Must be used inside a <VantageContextProvider>.
 *
 * Example:
 *   const { positions, isPositionsLoading, summary } = useVantageState();
 */
export function useVantageState(): VantageState {
  return useContext(VantageContext);
}
