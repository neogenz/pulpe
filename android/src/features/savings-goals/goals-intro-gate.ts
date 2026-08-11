import { createMMKV } from "react-native-mmkv";

const SEEN_KEY = "pulpe-savings-goals-intro-seen";

const storage = createMMKV({ id: "pulpe-savings-goals" });

/**
 * The Objectifs intro is shown exactly once, ever — mirroring
 * `SavingsGoalsIntroGate` on iOS. Reading it is a plain function rather than a
 * hook so the answer is settled before the first render, not one frame after.
 */
export function hasSeenGoalsIntro(): boolean {
  return storage.getBoolean(SEEN_KEY) ?? false;
}

export function markGoalsIntroSeen(): void {
  storage.set(SEEN_KEY, true);
}
