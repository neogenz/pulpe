import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { PaperProvider } from "react-native-paper";

import ConnectionDetailScreen from "@/app/(main)/settings/connection/[id]";
import ConnectionsScreen from "@/app/(main)/settings/connections";

const mockRevoke = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
};
let mockConnections: { data?: unknown[]; isPending: boolean; isError: boolean };
const connection = {
  id: "c1",
  clientName: "Claude",
  mode: "read_write",
  authorizedAt: "2026-11-01T10:00:00.000Z",
};

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ id: "c1" }),
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string, options?: Record<string, string>) =>
      options?.mode === undefined ? key : `${key}|${options.mode}`,
  }),
}));
jest.mock("@/core/ui/screen-app-bar", () => ({
  ScreenAppBar: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/core/ui/pull-to-refresh", () => ({
  usePullToRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));
jest.mock("@/features/connections/connections-queries", () => ({
  useConnections: () => ({ ...mockConnections, refetch: jest.fn() }),
  useConnectionActivity: () => ({
    isPending: false,
    isError: false,
    data: [
      {
        tool: "add_movement",
        outcome: "ok",
        createdAt: "2026-11-01T10:00:00.000Z",
      },
      {
        tool: "mystery_tool",
        outcome: "error",
        createdAt: "2026-11-01T11:00:00.000Z",
      },
    ],
  }),
  useRevokeConnection: () => mockRevoke,
}));

const wrap = (node: React.ReactNode) => <PaperProvider>{node}</PaperProvider>;

beforeEach(() => {
  jest.clearAllMocks();
  mockConnections = { data: [connection], isPending: false, isError: false };
});

it("lists the connected assistants and opens one", async () => {
  const view = await render(wrap(<ConnectionsScreen />));

  await fireEvent.press(view.getByText("Claude"));

  expect(router.push).toHaveBeenCalledWith({
    pathname: "/settings/connection/[id]",
    params: { id: "c1" },
  });
});

it("never shows a failed load as an empty list", async () => {
  mockConnections = { isPending: false, isError: true };
  const view = await render(wrap(<ConnectionsScreen />));

  expect(view.queryByText("settings.connections.emptyTitle")).toBeNull();
  expect(view.getByText("common.retry")).toBeTruthy();
});

it("says no assistant is connected on an empty list", async () => {
  mockConnections = { data: [], isPending: false, isError: false };
  const view = await render(wrap(<ConnectionsScreen />));

  expect(view.getByText("settings.connections.emptyTitle")).toBeTruthy();
});

it("shows the agent's recent actions, raw name when unknown, and revokes after confirming", async () => {
  const view = await render(wrap(<ConnectionDetailScreen />));

  expect(
    view.getByText("settings.connections.tools.add_movement"),
  ).toBeTruthy();
  expect(view.getByText("mystery_tool")).toBeTruthy();

  await fireEvent.press(view.getAllByText("settings.connections.revoke")[0]);
  expect(mockRevoke.mutate).not.toHaveBeenCalled();
  await fireEvent.press(view.getAllByText("settings.connections.revoke")[1]);

  expect(mockRevoke.mutate.mock.calls[0][0]).toBe("c1");
});
