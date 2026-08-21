const mockClient = {
  identify: jest.fn(),
  register: jest.fn(),
  reset: jest.fn(),
  optIn: jest.fn(),
  optOut: jest.fn(),
  captureException: jest.fn(),
};
const mockPostHog = jest.fn(() => mockClient);
const mockStopListening = jest.fn();
const mockSubscribe = jest.fn();
const mockStopSessionListening = jest.fn();
const mockSessionSubscribe = jest.fn();
const mockStopLocaleListening = jest.fn();
const mockLocaleSubscribe = jest.fn();

let mockConfig: { apiKey: string; host: string } | null;
let mockIsSharingEnabled: boolean;
let mockSessionState: {
  status: "loading" | "error" | "unauthenticated" | "authenticated";
  user: Record<string, unknown> | null;
};
let mockConsentListener:
  | ((state: { isDiagnosticSharingEnabled: boolean }) => void)
  | null;
let mockSessionListener: (() => void) | null;
let mockLocaleListener: (() => void) | null;

jest.mock("posthog-react-native", () => ({ PostHog: mockPostHog }));
jest.mock("expo-application", () => ({
  nativeApplicationVersion: "1.2.3",
  nativeBuildVersion: "42",
}));
jest.mock("expo-router", () => ({ useSegments: () => [] }));
jest.mock("@/core/auth/session-store", () => ({
  useSessionStore: {
    getState: () => mockSessionState,
    subscribe: mockSessionSubscribe,
  },
}));
jest.mock("@/core/config/env", () => ({
  ENV: {
    environment: "production",
    get posthog() {
      return mockConfig;
    },
  },
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useLocaleStore: {
    getState: () => ({ locale: "de" }),
    subscribe: mockLocaleSubscribe,
  },
}));
jest.mock("./diagnostics-consent", () => ({
  isDiagnosticSharingEnabled: () => mockIsSharingEnabled,
  useDiagnosticsConsent: { subscribe: mockSubscribe },
}));

function loadAnalytics(): typeof import("./analytics") {
  let analytics: typeof import("./analytics") | undefined;
  jest.isolateModules(() => {
    analytics = jest.requireActual<typeof import("./analytics")>("./analytics");
  });
  return analytics!;
}

function loadStartAnalytics(): typeof import("./analytics").startAnalytics {
  return loadAnalytics().startAnalytics;
}

describe("PostHog startup", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockConfig = { apiKey: "ph_test", host: "https://eu.i.posthog.com" };
    mockIsSharingEnabled = true;
    mockSessionState = { status: "unauthenticated", user: null };
    mockConsentListener = null;
    mockSessionListener = null;
    mockLocaleListener = null;
    mockSubscribe.mockImplementation((listener) => {
      mockConsentListener = listener;
      return mockStopListening;
    });
    mockSessionSubscribe.mockImplementation((listener) => {
      mockSessionListener = listener;
      return mockStopSessionListening;
    });
    mockLocaleSubscribe.mockImplementation((listener) => {
      mockLocaleListener = listener;
      return mockStopLocaleListening;
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
      locale: "de",
    });
    stop();
    expect(mockStopListening).toHaveBeenCalledTimes(1);
    expect(mockStopSessionListening).toHaveBeenCalledTimes(1);
    expect(mockStopLocaleListening).toHaveBeenCalledTimes(1);
  });

  it("does not create or subscribe a client outside production", () => {
    mockConfig = null;

    const stop = loadStartAnalytics()();

    expect(mockPostHog).not.toHaveBeenCalled();
    expect(mockSubscribe).not.toHaveBeenCalled();
    expect(stop()).toBeUndefined();
  });

  it("registers only the normalized supported locale when it changes", () => {
    loadStartAnalytics()();
    mockClient.register.mockClear();

    mockLocaleListener?.();

    expect(mockClient.register).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "de" }),
    );
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

  it("captures handled exceptions only with consent and sanitized properties", () => {
    const analytics = loadAnalytics();
    analytics.startAnalytics();
    mockIsSharingEnabled = false;

    analytics.captureException(new Error("technical"), {
      request_id: "request-42",
      message: "backend message",
    });
    expect(mockClient.captureException).not.toHaveBeenCalled();

    mockIsSharingEnabled = true;
    analytics.captureException(new Error("technical"), {
      request_id: "request-42",
      message: "backend message",
    });
    expect(mockClient.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      { request_id: "request-42" },
    );
  });

  it("identifies a restored session with the shared Supabase identity", () => {
    mockSessionState = {
      status: "authenticated",
      user: {
        id: "supabase-user-id",
        email: " ismael@example.com ",
        app_metadata: { early_adopter: true },
        user_metadata: { firstName: " Ismael " },
      },
    };

    loadStartAnalytics()();
    mockSessionListener?.();

    expect(mockClient.identify).toHaveBeenCalledTimes(1);
    expect(mockClient.identify).toHaveBeenCalledWith("supabase-user-id", {
      supabase_user_id: "supabase-user-id",
      early_adopter: true,
    });
  });

  it("resets PostHog when the authenticated session signs out", () => {
    mockSessionState = {
      status: "authenticated",
      user: {
        id: "user-a",
        email: "a@example.com",
        app_metadata: {},
        user_metadata: {},
      },
    };
    loadStartAnalytics()();

    mockSessionState = { status: "unauthenticated", user: null };
    mockSessionListener?.();

    expect(mockClient.reset).toHaveBeenCalledTimes(1);
    expect(mockClient.register).toHaveBeenCalledTimes(2);
  });

  it("resets before identifying a different account on the same device", () => {
    mockSessionState = {
      status: "authenticated",
      user: {
        id: "user-a",
        email: "a@example.com",
        app_metadata: {},
        user_metadata: {},
      },
    };
    loadStartAnalytics()();

    mockSessionState = {
      status: "authenticated",
      user: {
        id: "user-b",
        email: "b@example.com",
        app_metadata: {},
        user_metadata: {},
      },
    };
    mockSessionListener?.();

    expect(mockClient.identify).toHaveBeenCalledTimes(2);
    expect(mockClient.identify).toHaveBeenLastCalledWith(
      "user-b",
      expect.objectContaining({ supabase_user_id: "user-b" }),
    );
    expect(mockClient.reset.mock.invocationCallOrder[0]).toBeLessThan(
      mockClient.identify.mock.invocationCallOrder[1],
    );
  });
});
