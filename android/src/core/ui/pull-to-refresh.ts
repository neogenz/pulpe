import { useState } from "react";

/**
 * Pull-to-refresh state for the pull alone. Bound to a query's `isRefetching`,
 * the spinner also dropped in for every refetch the app started on its own —
 * after each write, on each return to the foreground — as if the user had
 * pulled. Spread onto `RefreshControl`.
 */
export function usePullToRefresh(refresh: () => Promise<unknown>): {
  refreshing: boolean;
  onRefresh: () => void;
} {
  const [isRefreshing, setRefreshing] = useState(false);

  return {
    refreshing: isRefreshing,
    onRefresh: () => {
      setRefreshing(true);
      const done = () => setRefreshing(false);
      void refresh().then(done, done);
    },
  };
}
