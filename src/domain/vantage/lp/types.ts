export type VantageLPData = {
  /** Current VLP share price in USD, WAD (1e18 = $1.00) */
  sharePrice: bigint;
  /** Total AUM of the Vault in USD, WAD */
  totalAum: bigint;
  /** Total VLP token supply, WAD */
  vlpTotalSupply: bigint;
  /** User's VLP token balance, WAD */
  vlpBalance: bigint;
  /** User's LP position value in USD, WAD */
  usdValue: bigint;
  /** Weekend buffer basis points from Vault (0 = no weekend lock) */
  weekendBufferBps: bigint;
  /** True when withdrawals are restricted (UTC Sat/Sun AND weekendBufferBps > 0) */
  isWeekendLocked: boolean;
};
