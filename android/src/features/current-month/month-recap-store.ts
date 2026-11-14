import { createMMKV } from "react-native-mmkv";
import { create } from "zustand";

const LAST_SEEN_KEY = "pulpe-last-seen-month-recap";
const storage = createMMKV({ id: "pulpe-month-recap" });

/**
 * The last closed month ("YYYY-MM") whose recap was acknowledged. One value
 * rather than a set: the key moves forward with the calendar, so dismissing
 * October's recap never hides November's.
 */
export const useMonthRecapStore = create<{ lastSeenKey: string | null }>(
  () => ({ lastSeenKey: storage.getString(LAST_SEEN_KEY) ?? null }),
);

export function acknowledgeMonthRecap(key: string): void {
  storage.set(LAST_SEEN_KEY, key);
  useMonthRecapStore.setState({ lastSeenKey: key });
}

/** The acknowledgement belongs to the account that gave it. */
export function resetMonthRecap(): void {
  storage.remove(LAST_SEEN_KEY);
  useMonthRecapStore.setState({ lastSeenKey: null });
}
