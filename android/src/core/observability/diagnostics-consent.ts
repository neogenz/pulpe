import { createMMKV } from "react-native-mmkv";
import { create } from "zustand";

const SHARING_KEY = "pulpe-diagnostic-sharing";

const storage = createMMKV({ id: "pulpe-observability" });

interface DiagnosticsConsentState {
  isDiagnosticSharingEnabled: boolean;
}

/**
 * Opt-out, the same way as `PreferencesView` on iOS and the webapp's settings
 * page: a device that has never been asked counts as a yes, and only a refusal
 * is ever written down.
 *
 * PostHog obeys this answer for analytics and JavaScript error reporting. It
 * lives outside the client so the preference remains available even when the
 * production-only client does not exist.
 */
export const useDiagnosticsConsent = create<DiagnosticsConsentState>(() => ({
  isDiagnosticSharingEnabled: storage.getBoolean(SHARING_KEY) !== false,
}));

export function isDiagnosticSharingEnabled(): boolean {
  return useDiagnosticsConsent.getState().isDiagnosticSharingEnabled;
}

export function setDiagnosticSharing(isEnabled: boolean): void {
  storage.set(SHARING_KEY, isEnabled);
  useDiagnosticsConsent.setState({ isDiagnosticSharingEnabled: isEnabled });
}
