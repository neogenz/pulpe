import type { SessionStatus } from "@/core/auth/session-store";
import type { VaultStatus } from "@/core/vault/vault-store";

import {
  type GateState,
  groupOfRoute,
  landingRoute,
  openGroups,
} from "./route-gates";

const SESSION_STATUSES: SessionStatus[] = [
  "loading",
  "error",
  "unauthenticated",
  "authenticated",
];
const VAULT_STATUSES: VaultStatus[] = [
  "unknown",
  "setupRequired",
  "locked",
  "unlocked",
];
const BOOLEANS = [false, true];
const PREFERENCES: (boolean | null)[] = [null, false, true];

function everyState(): GateState[] {
  const states: GateState[] = [];
  for (const status of SESSION_STATUSES) {
    for (const vaultStatus of VAULT_STATUSES) {
      for (const isOnboarding of BOOLEANS) {
        for (const hasCompletedOnboarding of BOOLEANS) {
          for (const hasSeenHandoff of BOOLEANS) {
            for (const prefersSignIn of PREFERENCES) {
              states.push({
                status,
                vaultStatus,
                isOnboarding,
                hasCompletedOnboarding,
                hasSeenHandoff,
                prefersSignIn,
              });
            }
          }
        }
      }
    }
  }
  return states;
}

describe("landing contract", () => {
  // The bug this exists for: `/` sent a brand-new device to `(onboarding)`
  // while the navigator only mounted that group once the run had *started*.
  // The redirect pointed at a route that had been removed, so the first screen
  // of a fresh install was blank — no crash, no log, nothing to grep for.
  it("only ever lands on a route whose group is mounted", () => {
    const unreachable = everyState().filter((state) => {
      const route = landingRoute(state);
      if (route === null) return false;
      const group = groupOfRoute(route);
      return group === undefined || !openGroups(state).includes(group);
    });

    expect(unreachable).toEqual([]);
  });

  it("sends a fresh install to the pitch, and mounts it", () => {
    const freshInstall: GateState = {
      status: "unauthenticated",
      vaultStatus: "unknown",
      isOnboarding: false,
      hasCompletedOnboarding: false,
      hasSeenHandoff: false,
      prefersSignIn: null,
    };

    expect(landingRoute(freshInstall)).toBe("/(onboarding)");
    expect(openGroups(freshInstall)).toContain("(onboarding)");
  });

  it("sends a returning signed-out user to sign-in", () => {
    expect(
      landingRoute({
        status: "unauthenticated",
        vaultStatus: "unknown",
        isOnboarding: false,
        hasCompletedOnboarding: true,
        hasSeenHandoff: true,
        prefersSignIn: null,
      }),
    ).toBe("/sign-in");
  });

  // Measured on a device: with the flow already completed, "Créer un compte"
  // moved to the pitch and `/` put the user straight back on sign-in. The two
  // screens send the user at each other, and this decision is what arbitrates.
  it("answers the door the user asked for, over the device's history", () => {
    const signedOut: GateState = {
      status: "unauthenticated",
      vaultStatus: "unknown",
      isOnboarding: false,
      hasCompletedOnboarding: true,
      hasSeenHandoff: true,
      prefersSignIn: null,
    };

    expect(landingRoute({ ...signedOut, prefersSignIn: false })).toBe(
      "/(onboarding)",
    );
    expect(
      landingRoute({
        ...signedOut,
        hasCompletedOnboarding: false,
        prefersSignIn: true,
      }),
    ).toBe("/sign-in");
  });

  it("holds the landing decision while the session is still resolving", () => {
    expect(
      landingRoute({
        status: "loading",
        vaultStatus: "unknown",
        isOnboarding: false,
        hasCompletedOnboarding: false,
        hasSeenHandoff: false,
        prefersSignIn: null,
      }),
    ).toBeNull();
  });

  it("keeps every route group closed after a restore error", () => {
    const failedRestore: GateState = {
      status: "error",
      vaultStatus: "unlocked",
      isOnboarding: true,
      hasCompletedOnboarding: true,
      hasSeenHandoff: true,
      prefersSignIn: true,
    };

    expect(landingRoute(failedRestore)).toBeNull();
    expect(openGroups(failedRestore)).toEqual([]);
  });

  it("keeps the run mounted once the user signs in mid-flow", () => {
    // The user turns authenticated at the registration step, four steps before
    // the vault exists — the run has to outrank both other gates.
    const midFlow: GateState = {
      status: "authenticated",
      vaultStatus: "setupRequired",
      isOnboarding: true,
      hasCompletedOnboarding: false,
      hasSeenHandoff: false,
      prefersSignIn: null,
    };

    expect(landingRoute(midFlow)).toBe("/(onboarding)");
    expect(openGroups(midFlow)).toEqual(["(onboarding)"]);
  });

  it("unlocks a configured vault before resuming an interrupted run", () => {
    const interrupted: GateState = {
      status: "authenticated",
      vaultStatus: "locked",
      isOnboarding: true,
      hasCompletedOnboarding: false,
      hasSeenHandoff: false,
      prefersSignIn: null,
    };

    expect(landingRoute(interrupted)).toBe("/vault-unlock");
    expect(openGroups(interrupted)).toEqual(["(vault)"]);
    expect(landingRoute({ ...interrupted, vaultStatus: "unlocked" })).toBe(
      "/(onboarding)",
    );
  });

  it("waits for the server vault before trusting an authenticated draft", () => {
    const unresolved: GateState = {
      status: "authenticated",
      vaultStatus: "unknown",
      isOnboarding: true,
      hasCompletedOnboarding: false,
      hasSeenHandoff: false,
      prefersSignIn: null,
    };

    expect(landingRoute(unresolved)).toBeNull();
    expect(openGroups(unresolved)).toEqual([]);
  });
});
