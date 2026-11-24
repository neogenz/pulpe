export const netWorthKeys = {
  all: ["net-worth"] as const,
  /** Under `all`: every write that moves a value marks the history stale too. */
  history: (assetId: string) =>
    [...netWorthKeys.all, "history", assetId] as const,
};
