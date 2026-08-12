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

function everyState(): GateState[] {
  const states: GateState[] = [];
  for (const status of SESSION_STATUSES) {
    for (const vaultStatus of VAULT_STATUSES) {
      for (const isOnboarding of BOOLEANS) {
        for (const hasCompletedOnboarding of BOOLEANS) {
          for (const hasSeenHandoff of BOOLEANS) {
            states.push({
              status,
              vaultStatus,
              isOnboarding,
              hasCompletedOnboarding,
              hasSeenHandoff,
            });
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
      }),
    ).toBeNull();
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
    };

    expect(landingRoute(midFlow)).toBe("/(onboarding)");
    expect(openGroups(midFlow)).toEqual(["(onboarding)"]);
  });
});
