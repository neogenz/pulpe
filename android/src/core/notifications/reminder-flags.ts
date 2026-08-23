import { createMMKV } from "react-native-mmkv";

/**
 * Whether the priming sheet has been offered. Its own key rather than a
 * permission read: the system status is the same "undetermined" whether the
 * user declined our sheet or never saw it, and asking again would be nagging.
 */
const PRIMED_KEY = "pulpe-reminders-primed";

/**
 * What the user asked for, which is not what the system grants: a revoked
 * permission must be able to turn the reminder off without the preference
 * forgetting that it was ever wanted.
 */
const ENABLED_KEY = "pulpe-reminders-enabled";

const storage = createMMKV({ id: "pulpe-notifications" });

export function readRemindersPrimed(): boolean {
  return storage.getBoolean(PRIMED_KEY) === true;
}

export function writeRemindersPrimed(): void {
  storage.set(PRIMED_KEY, true);
}

export function readRemindersEnabled(): boolean {
  return storage.getBoolean(ENABLED_KEY) === true;
}

export function writeRemindersEnabled(isEnabled: boolean): void {
  storage.set(ENABLED_KEY, isEnabled);
}
