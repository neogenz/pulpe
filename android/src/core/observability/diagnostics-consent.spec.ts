import {
  isDiagnosticSharingEnabled,
  setDiagnosticSharing,
  useDiagnosticsConsent,
} from "./diagnostics-consent";

describe("diagnostics consent", () => {
  afterEach(() => setDiagnosticSharing(true));

  // Opt-out, like iOS and the webapp: never having been asked is a yes.
  it("shares until told otherwise", () => {
    expect(isDiagnosticSharingEnabled()).toBe(true);
  });

  it("remembers a refusal", () => {
    setDiagnosticSharing(false);

    expect(isDiagnosticSharingEnabled()).toBe(false);
  });

  // The SDKs are told what changed rather than polling for it, so the toggle
  // is only wired up as long as this fires.
  it("announces every change", () => {
    const listener = jest.fn();
    const stopListening = useDiagnosticsConsent.subscribe(listener);

    setDiagnosticSharing(false);
    setDiagnosticSharing(true);
    stopListening();
    setDiagnosticSharing(false);

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
