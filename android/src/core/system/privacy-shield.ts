import * as ScreenCapture from "expo-screen-capture";

/**
 * Keeps amounts out of the app-switcher thumbnail and out of screenshots.
 *
 * Departure from iOS, which draws a blur over its own window when the app
 * resigns active: Android takes the switcher snapshot as the activity pauses,
 * and a React re-render is not guaranteed to land first — the overlay would be
 * missing from the very frame it exists for. `FLAG_SECURE`, which this sets,
 * is applied by the window manager itself, so there is no frame to lose.
 *
 * The cost is that screenshots are blocked outright rather than only while
 * backgrounded. For an app whose every screen is someone's salary, that is the
 * side to err on, and it is what banking apps do on this platform.
 *
 * Not in development, where the only screens are seeded ones and the flag buys
 * nothing: it blackens `adb screencap` and every screenshot attached to a bug
 * report, so the one thing it protects on a debug build is the app from being
 * looked at.
 */
export function armPrivacyShield(): void {
  if (__DEV__) return;
  void ScreenCapture.preventScreenCaptureAsync();
}
