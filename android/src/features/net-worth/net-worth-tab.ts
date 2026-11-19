import { tabKey } from "@/core/navigation/tab-route";

export const NET_WORTH_ROUTE = "net-worth";

interface TabState {
  index: number;
  routes: { key: string; name: string }[];
}

/**
 * The navigator keeps every route file, and the bar draws every route it is
 * given: with the flag off the bar is handed the state without « Patrimoine »,
 * so it keeps its four tabs.
 */
export function withoutNetWorthTab<S extends TabState>(state: S): S {
  const focused = state.routes[state.index]?.key;
  const routes = state.routes.filter(
    (route) => tabKey(route.name) !== NET_WORTH_ROUTE,
  );
  return {
    ...state,
    routes,
    index: Math.max(
      routes.findIndex((route) => route.key === focused),
      0,
    ),
  };
}

/** The flag went off under a user standing on the tab: send them home. */
export function shouldLeaveNetWorthTab(
  isEnabled: boolean,
  tab: string | undefined,
): boolean {
  return !isEnabled && tab === NET_WORTH_ROUTE;
}
