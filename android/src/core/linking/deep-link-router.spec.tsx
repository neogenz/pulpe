import { render, waitFor } from "@testing-library/react-native";

import { DeepLinkRouter } from "./deep-link-router";
import { useDeepLinkStore } from "./deep-links";

const mockLink = { url: null as string | null };
const mockSession = { status: "unauthenticated" };
const mockVault = { status: "locked" };

jest.mock("expo-linking", () => ({ useLinkingURL: () => mockLink.url }));
// Where a link lands is the router's business, covered on the real router
// in `core/navigation/tab-stacks.spec.tsx`.
const mockOpenLinkedMonth = jest.fn();
jest.mock("@/features/budgets/month-navigation", () => ({
  useOpenLinkedMonth: () => mockOpenLinkedMonth,
}));
const mockShowTabRoot = jest.fn();
jest.mock("@/core/navigation/tab-route", () => ({
  useShowTabRoot: () => mockShowTabRoot,
}));
jest.mock("@/core/auth/session-store", () => ({
  useSessionStore: (selector: (state: typeof mockSession) => unknown) =>
    selector(mockSession),
}));
jest.mock("@/core/vault/vault-store", () => ({
  useVaultStore: (selector: (state: typeof mockVault) => unknown) =>
    selector(mockVault),
}));

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
  expect(mockOpenLinkedMonth).not.toHaveBeenCalled();

  mockSession.status = "authenticated";
  mockVault.status = "unlocked";
  await view.rerender(<DeepLinkRouter />);
  await waitFor(() =>
    expect(mockOpenLinkedMonth).toHaveBeenCalledWith("budget-1"),
  );

  await view.rerender(<DeepLinkRouter />);
  expect(mockOpenLinkedMonth).toHaveBeenCalledTimes(1);
});

it("does not follow the same link again after the vault locks and unlocks", async () => {
  mockLink.url = "pulpe://budget?id=budget-1";
  mockSession.status = "authenticated";
  mockVault.status = "unlocked";
  const view = await render(<DeepLinkRouter />);
  await waitFor(() => expect(mockOpenLinkedMonth).toHaveBeenCalledTimes(1));

  mockVault.status = "locked";
  await view.rerender(<DeepLinkRouter />);
  mockVault.status = "unlocked";
  await view.rerender(<DeepLinkRouter />);

  expect(mockOpenLinkedMonth).toHaveBeenCalledTimes(1);
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
    expect(mockOpenLinkedMonth).toHaveBeenCalledWith("budget-2"),
  );
});

it("opens the expense form request after unlock", async () => {
  mockLink.url = "pulpe://add-expense";
  mockSession.status = "authenticated";
  mockVault.status = "unlocked";
  await render(<DeepLinkRouter />);

  await waitFor(() => expect(mockShowTabRoot).toHaveBeenCalledWith("home"));
  expect(useDeepLinkStore.getState().isAddExpenseRequested).toBe(true);
});
