import { createMMKV } from "react-native-mmkv";

const SEEN_KEY = "pulpe-net-worth-intro-seen";

const storage = createMMKV({ id: "pulpe-net-worth" });

/**
 * The « Mon patrimoine » explainer opens by itself once per device, mirroring
 * `NetWorthIntroGate` on iOS; the « ? » of the tab reopens it at will. A plain
 * function, so the answer is settled before the first render.
 */
export function hasSeenNetWorthIntro(): boolean {
  return storage.getBoolean(SEEN_KEY) ?? false;
}

export function markNetWorthIntroSeen(): void {
  storage.set(SEEN_KEY, true);
}
