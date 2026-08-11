import { create } from "zustand";

/** `pulpe://`, `pulpe:///`, `https://` — everything up to the first real segment. */
const SCHEME = /^[a-z][a-z0-9+.-]*:\/{0,3}/i;

/**
 * The two in-app destinations `pulpe://` addresses, in the exact shapes the
 * iOS widget already publishes (`ios/Pulpe/App/Navigation/DeepLinkDestination.swift`).
 * Android has no widget yet, so nothing here emits them — but a URL scheme is a
 * product surface, and two platforms answering the same URL differently is the
 * kind of divergence that only shows up once something depends on it.
 *
 * `reset-password` is deliberately absent: it is a real route, so Expo Router
 * resolves it on its own and the screen reads its own tokens off the URL.
 */
export type DeepLink =
  | { kind: "add-expense" }
  | { kind: "budget"; budgetId: string };

/**
 * Accepts both `pulpe://budget?id=X` (the widget's form, where the target lands
 * in the authority) and `pulpe:///budget?id=X`. Returns null for anything else,
 * including the URLs other screens own.
 *
 * Hand-parsed rather than handed to `Linking.parse`, which reads the Expo
 * manifest and so cannot run outside the app, or to `URL`, whose React Native
 * polyfill does not implement the parts this needs.
 */
export function parseDeepLink(url: string): DeepLink | null {
  const [beforeQuery, query = ""] = url.replace(SCHEME, "").split("?");
  const target = beforeQuery.split("/").filter(Boolean)[0];

  switch (target) {
    case "add-expense":
      return { kind: "add-expense" };
    case "budget": {
      // A budget link naming no budget points at nothing; better to ignore it
      // than to open a detail screen that asks the API for `undefined`.
      const budgetId = queryValue(query, "id");
      return budgetId === null ? null : { kind: "budget", budgetId };
    }
    default:
      return null;
  }
}

function queryValue(query: string, key: string): string | null {
  for (const pair of query.split("&")) {
    const [name, value = ""] = pair.split("=");
    if (name === key && value.length > 0) return decodeURIComponent(value);
  }
  return null;
}

interface DeepLinkState {
  /** Set by `pulpe://add-expense`, consumed by the home screen's sheet. */
  isAddExpenseRequested: boolean;
}

export const useDeepLinkStore = create<DeepLinkState>(() => ({
  isAddExpenseRequested: false,
}));

export function requestAddExpense(): void {
  useDeepLinkStore.setState({ isAddExpenseRequested: true });
}

export function consumeAddExpenseRequest(): void {
  useDeepLinkStore.setState({ isAddExpenseRequested: false });
}
