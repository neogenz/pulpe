import { fireEvent, render, waitFor } from "@testing-library/react-native";
import * as SplashScreen from "expo-splash-screen";

import RootLayout from "@/app/_layout";
import IndexRoute from "@/app/index";
import { bootstrapVault } from "@/core/vault/vault-store";

const mockRetrySession = jest.fn();
const mockFonts = { loaded: true, error: null as Error | null };
const mockSession = {
  status: "unauthenticated",
  retrySessionRestore: mockRetrySession,
};
const mockVault = { status: "unknown", hasBootstrapError: false };
const mockOnboarding = {
  isFlowActive: false,
  hasCompletedOnboarding: false,
  hasSeenHandoff: false,
};

jest.mock("expo-font", () => ({
  useFonts: () => [mockFonts.loaded, mockFonts.error],
}));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
jest.mock("expo-router", () => {
  const { Text, View } = jest.requireActual("react-native");
  const Stack = ({ children }: { children: React.ReactNode }) => (
    <View>{children}</View>
  );
  Stack.Protected = function Protected({
    guard,
    children,
  }: {
    guard: boolean;
    children: React.ReactNode;
  }) {
    return guard ? children : null;
  };
  Stack.Screen = function Screen({ name }: { name: string }) {
    return <Text>{`route:${name}`}</Text>;
  };
  return {
    Stack,
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
  };
});
jest.mock("@tanstack/react-query", () => ({
  QueryClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
jest.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: jest.requireActual("react-native").View,
}));
jest.mock("react-native-paper", () => {
  const { ActivityIndicator, Pressable, Text } =
    jest.requireActual("react-native");
  return {
    ActivityIndicator,
    Button: ({
      children,
      onPress,
    }: {
      children: React.ReactNode;
      onPress: () => void;
    }) => (
      <Pressable onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
    PaperProvider: ({ children }: { children: React.ReactNode }) => children,
    Text,
    useTheme: () => ({ colors: { background: "white" } }),
  };
});
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("@/core/auth/session-store", () => ({
  observeSession: jest.fn(),
  useSessionStore: (selector: (state: typeof mockSession) => unknown) =>
    selector(mockSession),
}));
jest.mock("@/core/auth/session-invalidation", () => ({
  observeSessionRejection: jest.fn(() => () => {}),
}));
jest.mock("@/core/auth/supabase", () => ({
  startSupabaseAutoRefresh: jest.fn(),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/i18n/locale-sync", () => ({ LocaleSync: () => null }));
jest.mock("@/core/linking/deep-link-router", () => ({
  DeepLinkRouter: () => null,
}));
jest.mock("@/core/navigation/landing-preference", () => ({
  useLandingPreference: (
    selector: (state: { prefersSignIn: null }) => unknown,
  ) => selector({ prefersSignIn: null }),
}));
jest.mock("@/core/observability/analytics", () => ({
  captureException: jest.fn(),
  startAnalytics: jest.fn(),
  useScreenTracking: jest.fn(),
}));
jest.mock("@/core/query/query-client", () => ({ queryClient: {} }));
jest.mock("@/core/system/foreground-refresh", () => ({
  ForegroundRefresh: () => null,
}));
jest.mock("@/core/system/privacy-shield", () => ({
  armPrivacyShield: jest.fn(),
}));
jest.mock("@/core/system/system-gate-screen", () => ({
  SystemGateScreen: () => null,
}));
jest.mock("@/core/system/whats-new-sheet", () => ({
  WhatsNewSheet: () => null,
}));
jest.mock("@/core/ui/placeholder-screen", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    PlaceholderScreen: ({
      title,
      action,
    }: {
      title: string;
      action: { label: string; loading?: boolean; onPress: () => void };
    }) => (
      <View>
        <Text>{title}</Text>
        <Pressable disabled={action.loading} onPress={action.onPress}>
          <Text>{action.loading ? "session-retry-loading" : action.label}</Text>
        </Pressable>
      </View>
    ),
  };
});
jest.mock("@/core/ui/theme", () => ({
  pulpeDarkTheme: {},
  pulpeLightTheme: {},
  SPACING: { lg: 24, md: 16 },
}));
jest.mock("@/core/vault/auto-lock", () => ({ armAutoLock: jest.fn() }));
jest.mock("@/core/vault/key-invalidation", () => ({
  observeVaultKeyRejection: jest.fn(),
}));
jest.mock("@/core/vault/vault-store", () => ({
  bootstrapVault: jest.fn(),
  useVaultStore: (selector: (state: typeof mockVault) => unknown) =>
    selector(mockVault),
}));
jest.mock("@/features/onboarding/onboarding-store", () => ({
  reconcileOnboardingWithVault: jest.fn(),
  restoreOnboardingDraft: jest.fn(),
  useOnboardingStore: (selector: (state: typeof mockOnboarding) => unknown) =>
    selector(mockOnboarding),
}));
jest.mock("@/ui/recovery-key-notice", () => ({
  RecoveryKeyNotice: () => null,
}));

const mockedHideSplash = jest.mocked(SplashScreen.hideAsync);
const mockedBootstrapVault = jest.mocked(bootstrapVault);

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockFonts, { loaded: true, error: null });
  Object.assign(mockSession, { status: "unauthenticated" });
  Object.assign(mockVault, { status: "unknown", hasBootstrapError: false });
  Object.assign(mockOnboarding, {
    isFlowActive: false,
    hasCompletedOnboarding: false,
    hasSeenHandoff: false,
  });
});

it("renders a usable route when the custom font falls back", async () => {
  Object.assign(mockFonts, { loaded: false, error: new Error("font") });
  Object.assign(mockSession, { status: "authenticated" });
  Object.assign(mockVault, { status: "unlocked" });
  Object.assign(mockOnboarding, {
    hasCompletedOnboarding: true,
    hasSeenHandoff: true,
  });

  const view = await render(<RootLayout />);

  expect(view.getByText("route:(main)")).toBeTruthy();
  await waitFor(() => expect(mockedHideSplash).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockedBootstrapVault).toHaveBeenCalledTimes(1));
});

it("exposes a retry when session restoration fails", async () => {
  Object.assign(mockSession, { status: "error" });
  let finishRetry!: () => void;
  mockRetrySession.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finishRetry = resolve;
    }),
  );
  const view = await render(<RootLayout />);

  await fireEvent.press(view.getByText("common.retry"));

  expect(view.getByText("auth.restore.title")).toBeTruthy();
  expect(mockRetrySession).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(view.getByText("session-retry-loading")).toBeTruthy(),
  );
  finishRetry();
  await waitFor(() => expect(view.getByText("common.retry")).toBeTruthy());
});

it("holds loading and makes a failed vault bootstrap retryable", async () => {
  Object.assign(mockSession, { status: "loading" });
  const loading = await render(<IndexRoute />);
  expect(loading.toJSON()).toBeNull();

  Object.assign(mockSession, { status: "authenticated" });
  Object.assign(mockVault, { hasBootstrapError: true });
  const failed = await render(<IndexRoute />);
  await fireEvent.press(failed.getByText("common.retry"));

  expect(failed.getByText("startup.vaultError")).toBeTruthy();
  expect(mockedBootstrapVault).toHaveBeenCalledTimes(1);
});
