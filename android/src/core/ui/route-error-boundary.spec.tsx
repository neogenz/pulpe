import { Stack } from "expo-router";
import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import { Text } from "react-native";

import { RouteErrorBoundary } from "./route-error-boundary";

const mockCaptureException = jest.fn();

jest.mock("@/core/observability/analytics", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));

let shouldThrow = true;

function FlakyScreen() {
  if (shouldThrow) throw new Error("render failed");
  return <Text>budget</Text>;
}

function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

beforeEach(() => {
  shouldThrow = true;
  mockCaptureException.mockClear();
  // React logs the caught error on purpose; the test asserts what replaces it.
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

/**
 * A render error used to close the app in a release build. Exported as a
 * route's `ErrorBoundary`, it becomes a screen with a way to try again.
 */
it("replaces a screen that throws with a retry instead of closing the app", async () => {
  await renderRouter(
    {
      _layout: { default: Layout, ErrorBoundary: RouteErrorBoundary },
      index: FlakyScreen,
    },
    { initialUrl: "/" },
  );

  expect(screen.getByText("common.screenError.title")).toBeTruthy();
  expect(mockCaptureException).toHaveBeenCalledWith(
    expect.objectContaining({ message: "render failed" }),
    { source: "route_error_boundary" },
  );

  shouldThrow = false;
  await fireEvent.press(screen.getByText("common.retry"));

  expect(await screen.findByText("budget")).toBeTruthy();
});
