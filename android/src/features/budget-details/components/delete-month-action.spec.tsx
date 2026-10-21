import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import type { BudgetDeletionImpact } from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

import { DeleteMonthAction } from "./delete-month-action";

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
// Paper's Menu and Dialog animate and measure through portals; the behaviour
// under test is which content they show and what their buttons send.
jest.mock("react-native-paper", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <View>{children}</View>
  );
  return {
    ActivityIndicator: ({
      accessibilityLabel,
    }: {
      accessibilityLabel: string;
    }) => <Text>{accessibilityLabel}</Text>,
    Button: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled === true }}
        disabled={disabled}
        onPress={onPress}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
    Dialog: Object.assign(
      ({
        visible,
        children,
      }: {
        visible: boolean;
        children: React.ReactNode;
      }) => (visible ? <View>{children}</View> : null),
      {
        Title: ({ children }: { children: React.ReactNode }) => (
          <Text>{children}</Text>
        ),
        Content: Passthrough,
        Actions: Passthrough,
      },
    ),
    HelperText: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
    Menu: Object.assign(
      ({
        visible,
        anchor,
        children,
      }: {
        visible: boolean;
        anchor: React.ReactNode;
        children: React.ReactNode;
      }) => (
        <View>
          {anchor}
          {visible ? children : null}
        </View>
      ),
      {
        Item: ({ title, onPress }: { title: string; onPress: () => void }) => (
          <Pressable onPress={onPress}>
            <Text>{title}</Text>
          </Pressable>
        ),
      },
    ),
    Portal: Passthrough,
    Text,
  };
});
jest.mock("@/core/ui/hero", () => {
  const { Pressable } = jest.requireActual("react-native");
  return {
    HeroAppBarAction: ({
      onPress,
      accessibilityLabel,
    }: {
      onPress: () => void;
      accessibilityLabel: string;
    }) => (
      <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} />
    ),
  };
});
jest.mock("@/core/ui/scheme-colors", () => ({
  useFinancialColors: () => ({ destructive: "red" }),
}));
jest.mock("@/core/api/api", () => ({
  api: { get: jest.fn(), deleteVoid: jest.fn() },
}));
// The key factories are the real ones; the vault store only drags in native crypto.
jest.mock("@/core/vault/vault-store", () => ({ useVaultStore: jest.fn() }));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string, options?: Record<string, unknown>) =>
      options === undefined
        ? key
        : `${key} ${Object.entries(options)
            .map(([name, value]) => `${name}=${String(value)}`)
            .join(" ")}`,
  }),
}));

const mockedGet = jest.mocked(api.get);
const mockedDeleteVoid = jest.mocked(api.deleteVoid);

const PREFIX = "budgets.detail.deleteMonth";

function impact(
  overrides: Partial<BudgetDeletionImpact["links"]> = {},
): BudgetDeletionImpact {
  return {
    forecastCount: 3,
    movementCount: 1,
    links: {
      spreadForecasts: 0,
      savingsGoalForecasts: 0,
      savingsWithdrawalForecasts: 0,
      savingsWithdrawalMovements: 0,
      ...overrides,
    },
  };
}

let client: QueryClient;

async function renderAction() {
  client = new QueryClient({
    // The app's own 30s stale window: the impact read has to opt out of it.
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: 30_000 },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <DeleteMonthAction budgetId="budget-1" monthTitle="Novembre 2026" />
    </QueryClientProvider>,
  );
}

type View = Awaited<ReturnType<typeof renderAction>>;

async function openDialog(view: View) {
  await fireEvent.press(view.getByLabelText("common.moreOptions"));
  await fireEvent.press(view.getByText(`${PREFIX}.action`));
}

const confirmButton = (view: View) =>
  view.getByRole("button", { name: `${PREFIX}.confirm` });

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockResolvedValue({ success: true, data: impact() });
  mockedDeleteVoid.mockResolvedValue(undefined);
});

afterEach(() => client.clear());

it("lists the counts, then deletes without confirming links and leaves the screen", async () => {
  const view = await renderAction();

  await openDialog(view);

  expect(view.getByText(`${PREFIX}.title month=Novembre 2026`)).toBeTruthy();
  expect(
    await view.findByText(`${PREFIX}.body forecastCount=3 movementCount=1`),
  ).toBeTruthy();
  expect(view.queryByText(new RegExp(`^${PREFIX}\\.links `))).toBeNull();
  expect(mockedGet).toHaveBeenCalledWith(
    ENDPOINTS.budgetDeletionImpact("budget-1"),
    expect.anything(),
  );

  await fireEvent.press(confirmButton(view));

  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  expect(mockedDeleteVoid).toHaveBeenCalledWith(ENDPOINTS.budget("budget-1"), {
    confirmLinks: false,
  });
});

it("names the links that are present, adds forecasts to movements for a withdrawal, and confirms them", async () => {
  mockedGet.mockResolvedValue({
    success: true,
    data: impact({
      spreadForecasts: 2,
      savingsWithdrawalForecasts: 1,
      savingsWithdrawalMovements: 2,
    }),
  });
  const view = await renderAction();

  await openDialog(view);

  expect(
    await view.findByText(
      `${PREFIX}.links links=${PREFIX}.linkSpread count=2, ${PREFIX}.linkWithdrawal count=3`,
    ),
  ).toBeTruthy();

  await fireEvent.press(confirmButton(view));

  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  expect(mockedDeleteVoid).toHaveBeenCalledWith(ENDPOINTS.budget("budget-1"), {
    confirmLinks: true,
  });
});

it("closes on cancel without deleting, and reads the impact again on the next opening", async () => {
  const view = await renderAction();
  await openDialog(view);
  await view.findByText(`${PREFIX}.body forecastCount=3 movementCount=1`);

  await fireEvent.press(view.getByText("common.cancel"));

  await waitFor(() =>
    expect(view.queryByText(`${PREFIX}.title month=Novembre 2026`)).toBeNull(),
  );
  expect(mockedDeleteVoid).not.toHaveBeenCalled();
  expect(router.back).not.toHaveBeenCalled();

  await openDialog(view);

  await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
});

it("keeps confirm disabled and says so when the impact cannot be loaded", async () => {
  mockedGet.mockRejectedValue(new Error("offline"));
  const view = await renderAction();

  await openDialog(view);

  expect(await view.findByText(`${PREFIX}.loadError`)).toBeTruthy();
  expect(confirmButton(view)).toBeDisabled();
  expect(mockedDeleteVoid).not.toHaveBeenCalled();
});

it("keeps the dialog open with an error line when the delete fails", async () => {
  mockedDeleteVoid.mockRejectedValue(new Error("409"));
  const view = await renderAction();
  await openDialog(view);
  await view.findByText(`${PREFIX}.body forecastCount=3 movementCount=1`);

  await fireEvent.press(confirmButton(view));

  expect(await view.findByText(`${PREFIX}.failure`)).toBeTruthy();
  expect(router.back).not.toHaveBeenCalled();
  expect(view.getByText(`${PREFIX}.title month=Novembre 2026`)).toBeTruthy();
});

it("reads the impact again after a failed delete, so the retry confirms the links now present", async () => {
  mockedDeleteVoid.mockRejectedValueOnce(new Error("409"));
  const view = await renderAction();
  await openDialog(view);
  await view.findByText(`${PREFIX}.body forecastCount=3 movementCount=1`);
  expect(view.queryByText(new RegExp(`^${PREFIX}\\.links `))).toBeNull();
  mockedGet.mockResolvedValue({
    success: true,
    data: impact({ spreadForecasts: 1 }),
  });

  await fireEvent.press(confirmButton(view));

  await view.findByText(`${PREFIX}.failure`);
  await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
  expect(
    await view.findByText(`${PREFIX}.links links=${PREFIX}.linkSpread count=1`),
  ).toBeTruthy();

  await fireEvent.press(confirmButton(view));

  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  expect(mockedDeleteVoid).toHaveBeenLastCalledWith(
    ENDPOINTS.budget("budget-1"),
    { confirmLinks: true },
  );
});
