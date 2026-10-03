import { focusManager, QueryObserver } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";

import type { queryClient as QueryClientSingleton } from "./query-client";

const appStateHandlers: ((state: AppStateStatus) => void)[] = [];

function emitAppState(state: AppStateStatus) {
  for (const handler of appStateHandlers) handler(state);
}

async function settle() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

let queryClient: typeof QueryClientSingleton;

beforeAll(() => {
  jest.spyOn(AppState, "addEventListener").mockImplementation((_, handler) => {
    appStateHandlers.push(handler as (state: AppStateStatus) => void);
    return { remove: jest.fn() } as never;
  });
  // Loaded after the spy: the listener is wired when the module is evaluated.
  ({ queryClient } =
    jest.requireActual<typeof import("./query-client")>("./query-client"));
});

afterAll(() => jest.restoreAllMocks());

/**
 * TanStack listens for the document's `visibilitychange`, which React Native
 * does not have: without this, nothing ever told it the app had come back.
 */
it("reads the app leaving and returning to the foreground as focus", () => {
  emitAppState("background");
  expect(focusManager.isFocused()).toBe(false);

  emitAppState("active");
  expect(focusManager.isFocused()).toBe(true);
});

it("refetches a stale query when the app comes back", async () => {
  queryClient.mount();
  const queryFn = jest.fn(async () => "figures");
  const observer = new QueryObserver(queryClient, {
    queryKey: ["foreground-refetch"],
    queryFn,
    staleTime: 0,
    gcTime: Infinity,
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await settle();
  expect(queryFn).toHaveBeenCalledTimes(1);

  emitAppState("background");
  emitAppState("active");
  await settle();

  expect(queryFn).toHaveBeenCalledTimes(2);
  unsubscribe();
  queryClient.unmount();
  queryClient.clear();
});
