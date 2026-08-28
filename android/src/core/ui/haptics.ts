import * as Haptics from "expo-haptics";

/**
 * The four things the app is allowed to say through the vibrator.
 *
 * Expo's palette is the iOS one — Soft, Light, Medium, Heavy, Rigid — and the
 * call sites had picked five of them by feel, so a PIN key and a confirmed
 * transfer felt about the same. Android does not have five: the actuator gets a
 * short pulse either way, and the difference the names promise is not one a
 * hand can find. What a hand can find is *when* it buzzes, so these are named
 * for the moment rather than the waveform.
 *
 * `void`, always: a haptic is a courtesy, and a screen that awaits one is a
 * screen that stutters when the device has no vibrator.
 */

/** A choice changed under the finger — a key, a toggle, a chip, a value. */
export function hapticSelection(): void {
  void Haptics.selectionAsync();
}

/** The user committed: work is starting, or a step has been accepted. */
export function hapticCommit(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Work finished and the app kept what was asked of it. */
export function hapticSuccess(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Work finished and it did not take — the one buzz that means "look up". */
export function hapticFailure(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
