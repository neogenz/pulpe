import { render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { DeepLinkRouter } from "./deep-link-router";
import { useDeepLinkStore } from "./deep-links";

const mockLink = { url: null as string | null };
const mockSession = { status: "unauthenticated" };
const mockVault = { status: "locked" };

jest.mock("expo-linking", () => ({ useLinkingURL: () => mockLink.url }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/core/auth/session-store", () => ({
  useSessionStore: (selector: (state: typeof mockSession) => unknown) =>
    selector(mockSession),
}));
jest.mock("@/core/vault/vault-store", () => ({
  useVaultStore: (selector: (state: typeof mockVault) => unknown) =>
    selector(mockVault),
}));

const mockedPush = jest.mocked(router.push);

beforeEach(() => {
  jest.clearAllMocks();
  mockLink.url = null;
  mockSession.status = "unauthenticated";
  mockVault.status = "locked";
  useDeepLinkStore.setState({ isAddExpenseRequested: false });
});

it("holds a protected link until unlock and delivers it once", async () => {
  mockLink.url = "pulpe://budget?id=budget-1";
  const view = await render(<DeepLinkRouter />);
  expect(mockedPush).not.toHaveBeenCalled();

  mockSession.status = "authenticated";
  mockVault.status = "unlocked";
  await view.rerender(<DeepLinkRouter />);
  await waitFor(() =>
    expect(mockedPush).toHaveBeenCalledWith("/budget/budget-1"),
  );

  await view.rerender(<DeepLinkRouter />);
  expect(mockedPush).toHaveBeenCalledTimes(1);
});

it("does not let an unrelated URL erase a pending link", async () => {
  mockLink.url = "pulpe://budget?id=budget-2";
  const view = await render(<DeepLinkRouter />);
  mockLink.url = "pulpe://reset-password";
  await view.rerender(<DeepLinkRouter />);

  mockSession.status = "authenticated";
  mockVault.status = "unlocked";
  await view.rerender(<DeepLinkRouter />);

  await waitFor(() =>
    expect(mockedPush).toHaveBeenCalledWith("/budget/budget-2"),
  );
});

it("opens the expense form request after unlock", async () => {
  mockLink.url = "pulpe://add-expense";
  mockSession.status = "authenticated";
  mockVault.status = "unlocked";
  await render(<DeepLinkRouter />);

  await waitFor(() => expect(mockedPush).toHaveBeenCalledWith("/home"));
  expect(useDeepLinkStore.getState().isAddExpenseRequested).toBe(true);
});
