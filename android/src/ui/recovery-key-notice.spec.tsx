import { act, fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import { RecoveryKeyNotice } from "./recovery-key-notice";

let mockClipboard = "";

jest.mock("expo-clipboard", () => ({
  getStringAsync: async () => mockClipboard,
  setStringAsync: async (text: string) => {
    mockClipboard = text;
    return true;
  },
}));
jest.mock("@/core/ui/haptics", () => ({ hapticSuccess: jest.fn() }));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/vault/vault-store", () => {
  const { create } = jest.requireActual<typeof import("zustand")>("zustand");
  const useVaultStore = create(() => ({
    pendingRecoveryNotice: {
      kind: "minted",
      recoveryKey: "AAAABBBBCCCCDDDD",
    } as { kind: "minted"; recoveryKey: string } | null,
  }));
  return {
    useVaultStore,
    acknowledgeRecoveryNotice: () =>
      useVaultStore.setState({ pendingRecoveryNotice: null }),
  };
});

const RECOVERY_KEY = "AAAABBBBCCCCDDDD";

async function renderNotice() {
  const view = await render(
    <PaperProvider>
      <RecoveryKeyNotice />
    </PaperProvider>,
  );
  await fireEvent.press(view.getByText("vault.notice.copy"));
  expect(mockClipboard).toBe(RECOVERY_KEY);
  return view;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockClipboard = "";
  const { useVaultStore } = jest.requireMock<
    typeof import("@/core/vault/vault-store")
  >("@/core/vault/vault-store");
  useVaultStore.setState({
    pendingRecoveryNotice: { kind: "minted", recoveryKey: RECOVERY_KEY },
  });
});

afterEach(() => {
  jest.useRealTimers();
});

it("takes the key back off the clipboard after two minutes", async () => {
  await renderNotice();

  await act(() => jest.advanceTimersByTimeAsync(119_000));
  expect(mockClipboard).toBe(RECOVERY_KEY);
  await act(() => jest.advanceTimersByTimeAsync(1_000));

  expect(mockClipboard).toBe("");
});

it("leaves alone whatever was copied after it", async () => {
  await renderNotice();
  mockClipboard = "something else";

  await act(() => jest.advanceTimersByTimeAsync(120_000));

  expect(mockClipboard).toBe("something else");
});

it("takes the key back once the notice is acknowledged", async () => {
  const view = await renderNotice();

  await fireEvent.press(view.getByText("vault.notice.acknowledge"));
  await act(() => jest.advanceTimersByTimeAsync(0));

  expect(view.queryByText("vault.notice.copy")).toBeNull();
  expect(mockClipboard).toBe("");
});
