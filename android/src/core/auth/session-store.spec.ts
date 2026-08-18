import { clearAllKeys } from "@/core/crypto/client-key-manager";
import { forgetLandingPreference } from "@/core/navigation/landing-preference";
import { queryClient } from "@/core/query/query-client";
import { resetVault } from "@/core/vault/vault-store";

import { signOutEverywhere, signOutThisDevice } from "./supabase";
import { endRecoverySession, useSessionStore } from "./session-store";

const events: string[] = [];

jest.mock("./supabase", () => ({
  signOutThisDevice: jest.fn(async () => events.push("signed-out")),
  signOutEverywhere: jest.fn(async () => events.push("sessions-revoked")),
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
    },
  },
}));
jest.mock("@/core/query/query-client", () => ({
  queryClient: { clear: jest.fn(() => events.push("cache-cleared")) },
}));
jest.mock("@/core/vault/vault-store", () => ({
  resetVault: jest.fn(() => events.push("vault-reset")),
}));
jest.mock("@/core/navigation/landing-preference", () => ({
  forgetLandingPreference: jest.fn(() => events.push("landing-reset")),
}));
jest.mock("@/core/crypto/client-key-manager", () => ({
  clearAllKeys: jest.fn(async () => events.push("keys-cleared")),
}));

describe("session sign-out", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    events.length = 0;
    useSessionStore.setState({
      status: "authenticated",
      session: {} as never,
      user: {} as never,
    });
  });

  it("publishes the anonymous session only after all local account data is purged", async () => {
    const unsubscribe = useSessionStore.subscribe((state) => {
      if (state.status === "unauthenticated") events.push("anonymous");
    });

    await useSessionStore.getState().signOut();
    unsubscribe();

    expect(events).toEqual([
      "signed-out",
      "signed-out",
      "cache-cleared",
      "vault-reset",
      "landing-reset",
      "keys-cleared",
      "anonymous",
    ]);
    expect(signOutThisDevice).toHaveBeenCalled();
    expect(queryClient.clear).toHaveBeenCalled();
    expect(resetVault).toHaveBeenCalled();
    expect(forgetLandingPreference).toHaveBeenCalled();
    expect(clearAllKeys).toHaveBeenCalled();
  });

  it("purges the recovery session locally even when global revocation fails", async () => {
    const revocationError = new Error("revocation failed");
    jest.mocked(signOutEverywhere).mockRejectedValueOnce(revocationError);

    await expect(endRecoverySession()).resolves.toEqual({
      providerError: revocationError,
    });

    expect(events).toEqual([
      "signed-out",
      "cache-cleared",
      "vault-reset",
      "landing-reset",
      "keys-cleared",
    ]);
    expect(useSessionStore.getState()).toMatchObject({
      status: "unauthenticated",
      session: null,
      user: null,
    });
  });

  it("keeps the provider error while completing every local cleanup", async () => {
    const providerError = new Error("provider failed");
    jest.mocked(signOutThisDevice).mockRejectedValueOnce(providerError);
    jest.mocked(clearAllKeys).mockRejectedValueOnce(new Error("key failed"));

    await expect(useSessionStore.getState().signOut()).rejects.toBe(
      providerError,
    );

    expect(queryClient.clear).toHaveBeenCalled();
    expect(resetVault).toHaveBeenCalled();
    expect(forgetLandingPreference).toHaveBeenCalled();
    expect(clearAllKeys).toHaveBeenCalled();
    expect(useSessionStore.getState().status).toBe("unauthenticated");
  });
});
