import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import type { BudgetDeletionImpact } from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

import { DeleteMonthAction } from "./delete-month-action";

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), dismissTo: jest.fn() },
}));
// Paper's Menu animates and measures through portals; the behaviour under
// test is which content it shows and what its entries send.
jest.mock("react-native-paper", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
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
        <>
          {anchor}
          {visible ? children : null}
        </>
      ),
      {
        Item: ({
          title,
          onPress,
          disabled,
        }: {
          title: React.ReactNode;
          onPress: () => void;
          disabled?: boolean;
        }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled === true }}
            disabled={disabled}
            onPress={onPress}
          >
            {typeof title === "string" ? <Text>{title}</Text> : title}
          </Pressable>
        ),
      },
    ),
    Text,
  };
});
// The sheet itself is tested on its own; here it is what the action asks it to say.
jest.mock("./impact-confirm-sheet", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    ImpactConfirmSheet: ({
      isVisible,
      title,
      message,
      note,
      error,
      isLoading,
      loadingLabel,
      confirmLabel,
      confirmDisabled,
      isBusy,
      onConfirm,
      onDismiss,
    }: {
      isVisible: boolean;
      title: string;
      message?: string;
      note?: string;
      error: string | null;
      isLoading: boolean;
      loadingLabel: string;
      confirmLabel: string;
      confirmDisabled: boolean;
      isBusy: boolean;
      onConfirm: () => void;
      onDismiss: () => void;
    }) =>
      isVisible ? (
        <View>
          <Text>{title}</Text>
          {isLoading && <Text>{loadingLabel}</Text>}
          {message?.split("\n").map((paragraph) => (
            <Text key={paragraph}>{paragraph}</Text>
          ))}
          <Text>{note}</Text>
          {error !== null && <Text>{error}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: confirmDisabled || isBusy }}
            disabled={confirmDisabled || isBusy}
            onPress={onConfirm}
          >
            <Text>{confirmLabel}</Text>
          </Pressable>
          <Pressable onPress={onDismiss}>
            <Text>common.cancel</Text>
          </Pressable>
        </View>
      ) : null,
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
const DELETED_MONTH_HREF = {
  pathname: "/budgets",
  params: { deletedMonth: "1" },
};

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

async function renderAction(isAllowed = true) {
  client = new QueryClient({
    // The app's own 30s stale window: the impact read has to opt out of it.
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false, staleTime: 30_000 },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <DeleteMonthAction
        budgetId="budget-1"
        monthTitle="Novembre 2026"
        currency="CHF"
        isAllowed={isAllowed}
        liveMonthName="octobre"
      />
    </QueryClientProvider>,
  );
}

type View = Awaited<ReturnType<typeof renderAction>>;

async function openDialog(view: View) {
  await fireEvent.press(view.getByLabelText("common.moreOptions"));
  await fireEvent.press(view.getByText(`${PREFIX}.action`));
}

const confirmButton = (view: View) =>
  view.getByRole("button", { name: `${PREFIX}.confirm month=Novembre 2026` });

const COUNTS = `${PREFIX}.forecasts count=3 ${PREFIX}.movements count=1`;

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
  expect(await view.findByText(COUNTS)).toBeTruthy();
  expect(view.getByText(`${PREFIX}.finalityElided month=octobre`)).toBeTruthy();
  expect(view.queryByText(new RegExp(`^${PREFIX}\\.links `))).toBeNull();
  expect(mockedGet).toHaveBeenCalledWith(
    ENDPOINTS.budgetDeletionImpact("budget-1"),
    expect.anything(),
  );

  await fireEvent.press(confirmButton(view));

  await waitFor(() =>
    expect(router.dismissTo).toHaveBeenCalledWith(DELETED_MONTH_HREF),
  );
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

  await waitFor(() =>
    expect(router.dismissTo).toHaveBeenCalledWith(DELETED_MONTH_HREF),
  );
  expect(mockedDeleteVoid).toHaveBeenCalledWith(ENDPOINTS.budget("budget-1"), {
    confirmLinks: true,
  });
});

it("closes on cancel without deleting, and reads the impact again on the next opening", async () => {
  const view = await renderAction();
  await openDialog(view);
  await view.findByText(COUNTS);

  await fireEvent.press(view.getByText("common.cancel"));

  await waitFor(() =>
    expect(view.queryByText(`${PREFIX}.title month=Novembre 2026`)).toBeNull(),
  );
  expect(mockedDeleteVoid).not.toHaveBeenCalled();
  expect(router.dismissTo).not.toHaveBeenCalled();

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
  await view.findByText(COUNTS);

  await fireEvent.press(confirmButton(view));

  expect(await view.findByText(`${PREFIX}.failure`)).toBeTruthy();
  expect(router.dismissTo).not.toHaveBeenCalled();
  expect(view.getByText(`${PREFIX}.title month=Novembre 2026`)).toBeTruthy();
});

it("reads the impact again after a failed delete, so the retry confirms the links now present", async () => {
  mockedDeleteVoid.mockRejectedValueOnce(new Error("409"));
  const view = await renderAction();
  await openDialog(view);
  await view.findByText(COUNTS);
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

  await waitFor(() =>
    expect(router.dismissTo).toHaveBeenCalledWith(DELETED_MONTH_HREF),
  );
  expect(mockedDeleteVoid).toHaveBeenLastCalledWith(
    ENDPOINTS.budget("budget-1"),
    { confirmLinks: true },
  );
});

it("keeps the entry visible but disabled, with its reason, on a month that already started", async () => {
  const view = await renderAction(false);
  await fireEvent.press(view.getByLabelText("common.moreOptions"));

  expect(view.getByText(`${PREFIX}.onlyUpcoming`)).toBeTruthy();
  expect(
    view.getByRole("button", { name: new RegExp(`${PREFIX}.action`) }),
  ).toBeDisabled();
  expect(mockedGet).not.toHaveBeenCalled();
});

it("says there is no movement yet instead of counting zero", async () => {
  mockedGet.mockResolvedValue({
    success: true,
    data: { ...impact(), movementCount: 0 },
  });
  const view = await renderAction();
  await openDialog(view);

  expect(
    await view.findByText(
      `${PREFIX}.forecasts count=3 ${PREFIX}.movementsNone`,
    ),
  ).toBeTruthy();
});
