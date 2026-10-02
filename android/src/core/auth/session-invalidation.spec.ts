import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";

import { ApiError } from "@/core/api/api-error";
import { queryClient } from "@/core/query/query-client";

import { observeSessionRejection } from "./session-invalidation";
import { useSessionStore } from "./session-store";
import { supabase } from "./supabase";

const mockSignOut = jest.fn();

jest.mock("./session-store", () => ({
  useSessionStore: { getState: jest.fn() },
}));
jest.mock("./supabase", () => ({
  supabase: { auth: { refreshSession: jest.fn() } },
}));

const mockedGetState = jest.mocked(useSessionStore.getState);
const mockedRefresh = jest.mocked(supabase.auth.refreshSession);

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

function apiError(status: number, code?: string): ApiError {
  return new ApiError("refusé", code, status, undefined);
}

function sessionState(status: "authenticated" | "unauthenticated") {
  return { status, signOut: mockSignOut } as never;
}

function refreshAnswer(hasSession: boolean) {
  return {
    data: { session: hasSession ? { access_token: "t" } : null, user: null },
    error: null,
  } as never;
}

let stopObserving: () => void;

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetState.mockReturnValue(sessionState("authenticated"));
  mockSignOut.mockResolvedValue(undefined);
  queryClient.clear();
  stopObserving = observeSessionRejection();
});

afterEach(() => {
  stopObserving();
  // Each cached query arms a garbage-collection timer jest would wait on.
  queryClient.clear();
});

function failQuery(error: unknown, key = ["probe", Math.random()]) {
  return queryClient
    .fetchQuery({
      queryKey: key,
      queryFn: () => Promise.reject(error),
      retry: false,
      gcTime: 0,
    })
    .catch(() => undefined);
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

it("refetches the failed query with the new token and keeps the session", async () => {
  mockedRefresh.mockResolvedValue(refreshAnswer(true));
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  const key = ["budgets", "list"];

  await failQuery(apiError(HTTP_UNAUTHORIZED), key);
  await settle();

  expect(mockedRefresh).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
  expect(mockSignOut).not.toHaveBeenCalled();
});

it("refreshes once for a query the fresh token did not unlock", async () => {
  mockedRefresh.mockResolvedValue(refreshAnswer(true));
  const key = ["budgets", "list"];

  await failQuery(apiError(HTTP_UNAUTHORIZED), key);
  await settle();
  await failQuery(apiError(HTTP_UNAUTHORIZED), key);
  await settle();

  expect(mockedRefresh).toHaveBeenCalledTimes(1);
  expect(mockSignOut).not.toHaveBeenCalled();

  await queryClient.fetchQuery({
    queryKey: key,
    queryFn: () => "ok",
    gcTime: 0,
  });
  await settle();
  await failQuery(apiError(HTTP_UNAUTHORIZED), key);
  await settle();

  expect(mockedRefresh).toHaveBeenCalledTimes(2);
});

it("signs this device out when the refresh yields no session", async () => {
  mockedRefresh.mockResolvedValue(refreshAnswer(false));

  await failQuery(apiError(HTTP_UNAUTHORIZED));
  await settle();

  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

function refreshRefused(error: unknown) {
  return { data: { session: null, user: null }, error } as never;
}

it("refreshes once and signs out at most once for a burst of 401s", async () => {
  mockedRefresh.mockResolvedValue(
    refreshRefused(
      new AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found"),
    ),
  );

  await Promise.all([
    failQuery(apiError(HTTP_UNAUTHORIZED)),
    failQuery(apiError(HTTP_UNAUTHORIZED)),
    failQuery(apiError(HTTP_UNAUTHORIZED)),
  ]);
  await settle();

  expect(mockedRefresh).toHaveBeenCalledTimes(1);
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

/**
 * A refresh that could not reach the auth server says nothing about the
 * session. Signing out on it wiped the keys — biometric unlock included — of
 * every user on a data screen during a Supabase incident or in a tunnel.
 */
it.each([
  [
    "a network failure",
    refreshRefused(new AuthRetryableFetchError("Failed to fetch", 0)),
  ],
  [
    "an auth server error",
    refreshRefused(
      new AuthApiError("Internal error", 500, "unexpected_failure"),
    ),
  ],
])("keeps the session when the refresh meets %s", async (_label, answer) => {
  mockedRefresh.mockResolvedValue(answer);

  await failQuery(apiError(HTTP_UNAUTHORIZED));
  await settle();

  expect(mockedRefresh).toHaveBeenCalledTimes(1);
  expect(mockSignOut).not.toHaveBeenCalled();
});

it("keeps the session when the refresh itself throws", async () => {
  mockedRefresh.mockRejectedValue(new Error("unexpected"));

  await failQuery(apiError(HTTP_UNAUTHORIZED));
  await settle();

  expect(mockSignOut).not.toHaveBeenCalled();
});

it("leaves 403 and key rejections to their own observers", async () => {
  await failQuery(apiError(HTTP_FORBIDDEN));
  await failQuery(apiError(HTTP_UNAUTHORIZED, "ERR_AUTH_CLIENT_KEY_MISSING"));
  await settle();

  expect(mockedRefresh).not.toHaveBeenCalled();
  expect(mockSignOut).not.toHaveBeenCalled();
});

it("stops watching once torn down", async () => {
  mockedRefresh.mockResolvedValue(refreshAnswer(false));
  stopObserving();

  await failQuery(apiError(HTTP_UNAUTHORIZED));
  await settle();

  expect(mockedRefresh).not.toHaveBeenCalled();
  stopObserving = () => undefined;
});
