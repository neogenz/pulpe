import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { BackHandler } from "react-native";

import ResetPasswordScreen from "@/app/reset-password";
import {
  beginPasswordRecovery,
  updatePassword,
} from "@/core/auth/password-recovery";
import { endRecoverySession } from "@/core/auth/session-store";

const mockBackHandlers: Parameters<typeof BackHandler.addEventListener>[1][] =
  [];
const mockRouterReplace = jest.fn();

jest.mock("expo-router", () => ({
  Redirect: () => null,
  useRouter: () => ({ replace: mockRouterReplace }),
}));
jest.mock("expo-linking", () => ({
  useLinkingURL: () =>
    "https://app.pulpe.app/reset-password#access_token=a&refresh_token=b",
}));
jest.mock("@/core/auth/password-recovery", () => ({
  beginPasswordRecovery: jest.fn(),
  parseRecoveryTokens: jest.fn(() => ({ accessToken: "a", refreshToken: "b" })),
  updatePassword: jest.fn(),
}));
jest.mock("@/core/auth/session-store", () => ({
  endRecoverySession: jest.fn(),
  useSessionStore: (selector: (state: { status: string }) => unknown) =>
    selector({ status: "unauthenticated" }),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/ui/keyboard-inset", () => ({ useKeyboardHeight: () => 0 }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const mockedBeginRecovery = jest.mocked(beginPasswordRecovery);
const mockedUpdatePassword = jest.mocked(updatePassword);
const mockedEndRecovery = jest.mocked(endRecoverySession);

async function renderFlow() {
  const view = await render(<ResetPasswordScreen />);
  await waitFor(() => expect(mockedBeginRecovery).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(view.getByText("auth.reset.intro")).toBeTruthy());
  return view;
}

async function submitPassword(
  view: Awaited<
    ReturnType<typeof import("@testing-library/react-native").render>
  >,
) {
  await fireEvent.changeText(
    view.getByPlaceholderText("auth.reset.minimum"),
    "a-long-enough-password-1",
  );
  await fireEvent.changeText(
    view.getByPlaceholderText("auth.reset.confirmPlaceholder"),
    "a-long-enough-password-1",
  );
  await fireEvent.press(view.getByText("auth.reset.submit"));
}

describe("password reset route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBackHandlers.length = 0;
    mockedBeginRecovery.mockResolvedValue(undefined);
    mockedUpdatePassword.mockResolvedValue(undefined);
    mockedEndRecovery.mockResolvedValue({ providerError: null });
    jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, listener) => {
        mockBackHandlers.push(listener);
        return { remove: jest.fn() };
      });
  });

  afterEach(() => jest.restoreAllMocks());

  it("revokes recovery after changing the password, then returns to sign-in", async () => {
    const view = await renderFlow();

    await submitPassword(view);
    await waitFor(() =>
      expect(view.getByText("auth.reset.doneTitle")).toBeTruthy(),
    );

    expect(mockedUpdatePassword.mock.invocationCallOrder[0]).toBeLessThan(
      mockedEndRecovery.mock.invocationCallOrder[0],
    );
    await fireEvent.press(view.getByText("common.backToSignIn"));
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith("/"));
  });

  it("does not submit the changed password twice when teardown fails", async () => {
    mockedEndRecovery.mockResolvedValue({ providerError: new Error("failed") });
    const view = await renderFlow();

    await submitPassword(view);
    await waitFor(() =>
      expect(view.getByText("auth.reset.securityTitle")).toBeTruthy(),
    );

    expect(mockedUpdatePassword).toHaveBeenCalledTimes(1);
  });

  it("routes Android Back through recovery teardown", async () => {
    await renderFlow();

    expect(mockBackHandlers.at(-1)?.({} as never)).toBe(true);
    await waitFor(() => expect(mockedEndRecovery).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith("/"));
  });
});
