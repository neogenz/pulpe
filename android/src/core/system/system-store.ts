import Constants from "expo-constants";
import { API_ERROR_CODES, appVersionResponseSchema } from "pulpe-shared";
import { create } from "zustand";

import { api } from "@/core/api/api";
import { isApiError } from "@/core/api/api-error";
import { ENDPOINTS } from "@/core/api/endpoints";

import { isVersionBelow } from "./semver";

const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * The check must never hold the app hostage. `ApiClient` retries a read twice
 * with backoff on top of its own 30s ceiling, which is right for a screen the
 * user is waiting on and far too long for a gate that fails open anyway.
 */
const CHECK_TIMEOUT_MS = 3000;

/**
 * What stands between the app and its own screens. `ok` is the normal state;
 * each blocking state owns a full-screen route, and none is dismissable —
 * there is no usable app behind any of them.
 */
export type SystemGate = "ok" | "maintenance" | "forceUpdate";

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

let systemCheck: Promise<void> | null = null;

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
export function checkSystemGate(): Promise<void> {
  if (systemCheck !== null) return systemCheck;
  setState({ isChecking: true });
  const operation = performSystemCheck().finally(() => {
    setState({ isChecking: false });
    if (systemCheck === operation) systemCheck = null;
  });
  systemCheck = operation;
  return operation;
}

async function performSystemCheck(): Promise<void> {
  try {
    const outcome = await api.get(
      ENDPOINTS.appVersion,
      appVersionResponseSchema,
      undefined,
      { timeoutMs: CHECK_TIMEOUT_MS, retryCount: 0 },
    );
    const { minVersion, storeUrl } = outcome.data.android;
    if (isVersionBelow(CURRENT_APP_VERSION, minVersion)) {
      setState({ gate: "forceUpdate", storeUrl: storeUrl ?? null });
    } else if (useSystemStore.getState().gate === "maintenance") {
      setState({ gate: "ok" });
    }
  } catch (error) {
    if (
      useSystemStore.getState().gate === "ok" &&
      isApiError(error) &&
      (error.code === API_ERROR_CODES.MAINTENANCE ||
        error.status === HTTP_SERVICE_UNAVAILABLE)
    ) {
      setState({ gate: "maintenance" });
    }
  }
}
