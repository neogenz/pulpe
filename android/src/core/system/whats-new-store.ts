import { type WhatsNewEntry, whatsNewResponseSchema } from "pulpe-shared";
import { createMMKV } from "react-native-mmkv";
import { create } from "zustand";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

import { isVersionBelow } from "./semver";
import { CURRENT_APP_VERSION } from "./system-store";

const LAST_SEEN_KEY = "pulpe-whats-new-last-seen";

const storage = createMMKV({ id: "pulpe-whats-new" });

interface WhatsNewState {
  entries: WhatsNewEntry[];
}

export const useWhatsNewStore = create<WhatsNewState>(() => ({
  entries: [],
}));

/**
 * What changed since the version this device last ran — once per upgrade, and
 * never on a fresh install, where "everything is new" is not news.
 *
 * Mirrors `ios/Pulpe/Domain/Store/WhatsNewStore.swift`, against the Android
 * route of the same feed. The corpus carries no Android-tagged release yet, so
 * today every call returns an empty list; that is the same silent path a
 * technical-only release takes, not a special case.
 *
 * Fails open, like the version gate: an outage leaves the marker untouched so
 * the next launch retries, and never holds up a launch.
 */
export async function checkWhatsNew(): Promise<void> {
  const lastSeenVersion = storage.getString(LAST_SEEN_KEY);
  if (lastSeenVersion === undefined) {
    // First run of a version-aware build: record where we are and say nothing.
    storage.set(LAST_SEEN_KEY, CURRENT_APP_VERSION);
    return;
  }

  // A downgrade — a debug build over a release one — is not an upgrade.
  if (!isVersionBelow(lastSeenVersion, CURRENT_APP_VERSION)) return;

  try {
    const response = await api.get(
      ENDPOINTS.whatsNewAndroid,
      whatsNewResponseSchema,
      { currentVersion: CURRENT_APP_VERSION, lastSeenVersion },
    );

    if (response.data.entries.length === 0) {
      // Nothing to say, but the version was still reached: move the marker so
      // the empty answer is not re-fetched on every launch.
      storage.set(LAST_SEEN_KEY, CURRENT_APP_VERSION);
      return;
    }

    useWhatsNewStore.setState({ entries: response.data.entries });
  } catch {
    // Deliberately silent: nothing here is worth interrupting a launch for.
  }
}

/** Dismissing is what marks the version as seen — not showing it. */
export function acknowledgeWhatsNew(): void {
  storage.set(LAST_SEEN_KEY, CURRENT_APP_VERSION);
  useWhatsNewStore.setState({ entries: [] });
}
