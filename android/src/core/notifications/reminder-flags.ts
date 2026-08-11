import { createMMKV } from "react-native-mmkv";

/**
 * Whether the priming sheet has been offered. Its own key rather than a
 * permission read: the system status is the same "undetermined" whether the
 * user declined our sheet or never saw it, and asking again would be nagging.
 */
const PRIMED_KEY = "pulpe-reminders-primed";

const storage = createMMKV({ id: "pulpe-notifications" });

export function readRemindersPrimed(): boolean {
  return storage.getBoolean(PRIMED_KEY) === true;
}

export function writeRemindersPrimed(): void {
  storage.set(PRIMED_KEY, true);
}
