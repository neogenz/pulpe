import Constants from "expo-constants";
import { appVersionResponseSchema } from "pulpe-shared";
import { create } from "zustand";

import { api } from "@/core/api/api";
import { isApiError, isTransientError } from "@/core/api/api-error";
import { ENDPOINTS } from "@/core/api/endpoints";

import { isVersionBelow } from "./semver";

const MAINTENANCE_CODE = "MAINTENANCE";
const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * The check must never hold the app hostage. `ApiClient` retries a read twice
 * with backoff on top of its own 30s ceiling, which is right for a screen the
 * user is waiting on and far too long for a gate that fails open anyway.
 */
const CHECK_TIMEOUT_MS = 3000;

/**
 * What stands between the app and its own screens. `ok` is the normal state;
 * each of the other three owns a full-screen route, and none is dismissable —
 * there is no usable app behind any of them.
 */
export type SystemGate = "ok" | "maintenance" | "forceUpdate" | "offline";

interface SystemState {
  gate: SystemGate;
  /** Where to send someone this build has locked out. */
  storeUrl: string | null;
  isChecking: boolean;
}

export const useSystemStore = create<SystemState>(() => ({
  gate: "ok",
  storeUrl: null,
  isChecking: false,
}));

const setState = useSystemStore.setState;

export const CURRENT_APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

const TIMED_OUT = Symbol("timed-out");

/**
 * Asks the backend whether this build is still welcome, and doubles as the
 * reachability probe: one round trip answers "down for maintenance", "your
 * version is too old" and "no network at all".
 *
 * Fails **open** on the way in and **conservatively** afterwards. A version
 * endpoint outage on a cold launch must never brick a working install, but
 * once a gate is raised a later failure must not lower it — otherwise turning
 * on airplane mode would be enough to walk past a forced update.
 *
 * Never rejects: the router reads this state and has nowhere to send an
 * exception.
 */
export async function checkSystemGate(): Promise<void> {
  setState({ isChecking: true });

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const outcome = await Promise.race([
      api.get(ENDPOINTS.appVersion, appVersionResponseSchema),
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), CHECK_TIMEOUT_MS);
      }),
    ]);

    if (outcome === TIMED_OUT) {
      // No verdict, so no change of verdict. The request keeps running and
      // simply lands too late to matter.
      setState({ isChecking: false });
      return;
    }

    const { minVersion, storeUrl } = outcome.data.android;
    setState({
      gate: isVersionBelow(CURRENT_APP_VERSION, minVersion)
        ? "forceUpdate"
        : "ok",
      storeUrl: storeUrl ?? null,
      isChecking: false,
    });
  } catch (error) {
    setState({ isChecking: false, ...gateForFailure(error) });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function gateForFailure(error: unknown): Partial<SystemState> {
  if (
    isApiError(error) &&
    (error.code === MAINTENANCE_CODE ||
      error.status === HTTP_SERVICE_UNAVAILABLE)
  ) {
    return { gate: "maintenance" };
  }

  // A gate already standing outranks a failed re-check; only `ok` may become
  // `offline`, and only for the failures that really mean "no server reached".
  if (useSystemStore.getState().gate === "ok" && isTransientError(error)) {
    return { gate: "offline" };
  }

  return {};
}
