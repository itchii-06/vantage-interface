import { createContext } from "react";

import type { VantageAccountSummary, VantagePosition } from "domain/vantage/positions/types";

export type VantageState = {
  positions: VantagePosition[];
  /** Granular loading flag: true while position list is being fetched */
  isPositionsLoading: boolean;
  summary: VantageAccountSummary | undefined;
  /** Granular loading flag: true while account summary is being fetched */
  isSummaryLoading: boolean;
  positionsError: Error | undefined;
  summaryError: Error | undefined;
  refetchPositions: () => void;
  refetchSummary: () => void;
};

export const VANTAGE_CONTEXT_INITIAL_STATE: VantageState = {
  positions: [],
  isPositionsLoading: false,
  summary: undefined,
  isSummaryLoading: false,
  positionsError: undefined,
  summaryError: undefined,
  refetchPositions: () => undefined,
  refetchSummary: () => undefined,
};

export const VantageContext = createContext<VantageState>(VANTAGE_CONTEXT_INITIAL_STATE);
