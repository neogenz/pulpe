const { AndroidConfig } = require("expo/config-plugins");

const { withBlockedPermissions } = AndroidConfig.Permissions;

/**
 * Permissions the app must not ship with, however it was generated.
 *
 * `SYSTEM_ALERT_WINDOW` — "Display over other apps" — is written into the main
 * manifest by the prebuild template, for the development menu's overlay. It is
 * a sensitive permission on Play: it carries its own policy declaration, it is
 * one of the strongest signals in a permissions review, and Pulpe draws over
 * nothing. The debug variant declares it again in `android/app/src/debug/`,
 * where it belongs and where a release build never looks.
 *
 * A plugin rather than an edit to `android/`: the native project is generated,
 * and `prebuild` would take the edit back out with it — same reason
 * `with-brand-colors.js` exists.
 */
const BLOCKED = ["android.permission.SYSTEM_ALERT_WINDOW"];

module.exports = function withReleasePermissions(config) {
  return withBlockedPermissions(config, BLOCKED);
};
