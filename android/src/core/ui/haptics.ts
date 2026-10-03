import * as Haptics from "expo-haptics";

const { AndroidHaptics } = Haptics;
type AndroidHaptic = Haptics.AndroidHaptics;

/**
 * The four things the app is allowed to say through the actuator.
 *
 * Expo's `impactAsync` / `notificationAsync` palette is the iOS one, played on
 * Android as hand-drawn `Vibrator` waveforms: buzzier than anything the system
 * itself does, and blind to the user's "touch feedback" setting. These go
 * through `View.performHapticFeedback` instead, with the constants Android's
 * own controls use, so a key, a toggle and a confirmation feel the way they
 * feel everywhere else on the phone — and stay silent when the user turned
 * haptics off.
 *
 * Named for the moment rather than the waveform. `void`, always: a haptic is a
 * courtesy, and a screen that awaits one is a screen that stutters.
 */

/**
 * Plays `preferred`, or `fallback` on a system too old to know it — the
 * confirm and reject constants arrived with Android 11, the segment tick with
 * Android 14. A haptic that fails is dropped, never thrown.
 */
function perform(preferred: AndroidHaptic, fallback?: AndroidHaptic): void {
  void Haptics.performAndroidHapticsAsync(preferred).catch(() =>
    fallback === undefined
      ? undefined
      : Haptics.performAndroidHapticsAsync(fallback).catch(() => undefined),
  );
}

/** A choice changed under the finger — a key, a toggle, a chip, a value. */
export function hapticSelection(): void {
  perform(AndroidHaptics.Segment_Tick, AndroidHaptics.Clock_Tick);
}

/** The user committed: work is starting, or a step has been accepted. */
export function hapticCommit(): void {
  perform(AndroidHaptics.Virtual_Key);
}

/** Work finished and the app kept what was asked of it. */
export function hapticSuccess(): void {
  perform(AndroidHaptics.Confirm, AndroidHaptics.Virtual_Key);
}

/** Work finished and it did not take — the one buzz that means "look up". */
export function hapticFailure(): void {
  perform(AndroidHaptics.Reject, AndroidHaptics.Long_Press);
}
