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
 * Two SDKs obey this one answer — PostHog and Sentry — so it lives here rather
 * than inside either of them. Each is told what it says; neither keeps a copy
 * the other could contradict.
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
