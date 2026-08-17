const mockClient = {
  register: jest.fn(),
  optIn: jest.fn(),
  optOut: jest.fn(),
};
const mockPostHog = jest.fn(() => mockClient);
const mockStopListening = jest.fn();
const mockSubscribe = jest.fn();

let mockConfig: { apiKey: string; host: string } | null;
let mockIsSharingEnabled: boolean;
let mockConsentListener:
  | ((state: { isDiagnosticSharingEnabled: boolean }) => void)
  | null;

jest.mock("posthog-react-native", () => ({ PostHog: mockPostHog }));
jest.mock("expo-application", () => ({
  nativeApplicationVersion: "1.2.3",
  nativeBuildVersion: "42",
}));
jest.mock("expo-router", () => ({ useSegments: () => [] }));
jest.mock("@/core/config/env", () => ({
  ENV: {
    environment: "production",
    get posthog() {
      return mockConfig;
    },
  },
}));
jest.mock("./diagnostics-consent", () => ({
  isDiagnosticSharingEnabled: () => mockIsSharingEnabled,
  useDiagnosticsConsent: { subscribe: mockSubscribe },
}));

function loadStartAnalytics(): typeof import("./analytics").startAnalytics {
  let startAnalytics: typeof import("./analytics").startAnalytics | undefined;
  jest.isolateModules(() => {
    startAnalytics =
      jest.requireActual<typeof import("./analytics")>(
        "./analytics",
      ).startAnalytics;
  });
  return startAnalytics!;
}

describe("PostHog startup", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockConfig = { apiKey: "ph_test", host: "https://eu.i.posthog.com" };
    mockIsSharingEnabled = true;
    mockConsentListener = null;
    mockSubscribe.mockImplementation((listener) => {
      mockConsentListener = listener;
      return mockStopListening;
    });
  });

  it("captures JavaScript errors without console or native crash capture", () => {
    const stop = loadStartAnalytics()();

    expect(mockPostHog).toHaveBeenCalledWith("ph_test", {
      host: "https://eu.i.posthog.com",
      defaultOptIn: true,
      captureAppLifecycleEvents: false,
      enableSessionReplay: false,
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          console: [],
          nativeCrashes: false,
        },
      },
    });
    expect(mockClient.register).toHaveBeenCalledWith({
      platform: "android",
      environment: "production",
      app_version: "1.2.3",
      build_number: "42",
    });
    expect(stop).toBe(mockStopListening);
  });

  it("does not create or subscribe a client outside production", () => {
    mockConfig = null;

    const stop = loadStartAnalytics()();

    expect(mockPostHog).not.toHaveBeenCalled();
    expect(mockSubscribe).not.toHaveBeenCalled();
    expect(stop()).toBeUndefined();
  });

  it("applies the persisted and live diagnostic consent", () => {
    mockIsSharingEnabled = false;

    loadStartAnalytics()();
    expect(mockPostHog).toHaveBeenCalledWith(
      "ph_test",
      expect.objectContaining({ defaultOptIn: false }),
    );

    mockConsentListener?.({ isDiagnosticSharingEnabled: true });
    mockConsentListener?.({ isDiagnosticSharingEnabled: false });

    expect(mockClient.optIn).toHaveBeenCalledTimes(1);
    expect(mockClient.optOut).toHaveBeenCalledTimes(1);
  });
});
