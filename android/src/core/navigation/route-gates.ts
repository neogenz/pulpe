import type { SessionStatus } from "@/core/auth/session-store";
import type { VaultStatus } from "@/core/vault/vault-store";

/** The four top-level groups the root navigator can mount. */
export type RouteGroup = "(onboarding)" | "(main)" | "(vault)" | "(auth)";

/** Everything both halves of the landing contract are decided from. */
export interface GateState {
  status: SessionStatus;
  vaultStatus: VaultStatus;
  /** A run of the onboarding flow is under way. */
  isOnboarding: boolean;
  hasCompletedOnboarding: boolean;
  hasSeenHandoff: boolean;
  /** The door the user asked for, or `null` to let the device's history decide. */
  prefersSignIn: boolean | null;
}

/**
 * Where `/` sends the user, or `null` while there is nothing to decide from.
 *
 * `Stack.Protected` removes a screen from the navigator rather than redirecting
 * away from it, so sending the user into a group that is closed leaves the
 * router on a route that no longer exists — a blank screen, with no error
 * anywhere. This function and `openGroups` are the two halves of that contract,
 * and the spec beside them is what keeps the two from drifting apart.
 */
export function landingRoute(state: GateState): string | null {
  const { status, vaultStatus, isOnboarding, hasCompletedOnboarding } = state;

  if (status === "loading") return null;
  if (status === "unauthenticated") {
    if (isOnboarding) return "/(onboarding)";
    // A device that has never been through the flow gets the pitch; one that
    // has gets the sign-in form it is coming back to. That is only the default,
    // though: the two screens send the user at each other, and this decision is
    // re-stated every time `/` regains focus — so an ask that is not answered
    // here is an ask this function undoes on arrival.
    return (state.prefersSignIn ?? hasCompletedOnboarding)
      ? "/sign-in"
      : "/(onboarding)";
  }

  // The authenticated server vault outranks a local draft. In particular, a
  // configured vault must be unlocked before an interrupted run can resume.
  if (vaultStatus === "unknown") return null;
  if (vaultStatus === "locked") return "/vault-unlock";
  if (isOnboarding) return "/(onboarding)";

  switch (vaultStatus) {
    case "setupRequired":
      return "/vault-setup";
    case "unlocked":
      // The handoff is the first thing a freshly onboarded user sees, and the
      // only thing that ever explains the pointing ritual from scratch.
      return state.hasSeenHandoff ? "/home" : "/post-onboarding";
  }
}

/** Which groups the root navigator mounts for a given state. */
export function openGroups(state: GateState): RouteGroup[] {
  const { status, vaultStatus, isOnboarding } = state;
  const groups: RouteGroup[] = [];

  // The pitch is the first thing a new device sees, and it is also what starts
  // the run — so this group has to be open before `isOnboarding` is ever true.
  if (status === "unauthenticated") {
    groups.push("(onboarding)");
    if (!isOnboarding) groups.push("(auth)");
  }
  if (status === "authenticated" && vaultStatus !== "unknown") {
    if (vaultStatus === "locked") groups.push("(vault)");
    else if (isOnboarding) groups.push("(onboarding)");
    else if (vaultStatus === "unlocked") groups.push("(main)");
    else groups.push("(vault)");
  }

  return groups;
}

/** The group each landing route lives in, by the folder it sits under. */
const GROUP_OF_ROUTE: Record<string, RouteGroup> = {
  "/(onboarding)": "(onboarding)",
  "/sign-in": "(auth)",
  "/vault-setup": "(vault)",
  "/vault-unlock": "(vault)",
  "/home": "(main)",
  "/post-onboarding": "(main)",
};

export function groupOfRoute(route: string): RouteGroup | undefined {
  return GROUP_OF_ROUTE[route];
}
