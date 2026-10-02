import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import type { BudgetSparse } from "pulpe-shared";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import BudgetsScreen from "@/app/(main)/(tabs)/budgets";
import { pulpeLightTheme } from "@/core/ui/theme";

import { uniqueBudgets } from "./budget-list-selectors";

const mockInvalidateBudgets = jest.fn(async () => undefined);
const mockRefetchStaleList = jest.fn(async () => undefined);
const mockInvalidateSettings = jest.fn(async () => undefined);
const mockGenerationResult: {
  createdCount?: string;
  skippedCount?: string;
} = {};
const mockBudgets = {
  data: [] as BudgetSparse[],
  isPending: false,
  isError: false,
  isRefetching: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  isFetchNextPageError: false,
  fetchNextPage: jest.fn(async () => undefined),
};
const mockSettings = {
  data: { currency: "CHF", payDayOfMonth: 1 } as {
    currency?: string;
    payDayOfMonth?: number;
  },
  isPending: false,
  isError: false,
};

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  return {
    router: { push: jest.fn(), setParams: jest.fn() },
    useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]),
    useLocalSearchParams: () => mockGenerationResult,
  };
});
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string, params?: Record<string, unknown>) =>
      params === undefined ? key : `${key}:${JSON.stringify(params)}`,
  }),
}));
jest.mock("@/core/user-settings/user-settings-queries", () => ({
  invalidateUserSettings: () => mockInvalidateSettings(),
  useUserSettings: () => mockSettings,
}));
jest.mock("@/features/budgets/budget-queries", () => ({
  invalidateBudgetData: () => mockInvalidateBudgets(),
  refetchStaleBudgetList: () => mockRefetchStaleList(),
  useBudgetList: () => mockBudgets,
}));

/** The clock the screen reads its current period from: October 2026. */
const NOW = new Date(2026, 9, 12, 9, 0);

function budget(year: number, month: number, remaining = 100): BudgetSparse {
  return {
    id: `budget-${year}-${month}`,
    year,
    month,
    remaining,
    totalIncome: 1000,
    totalExpenses: 500,
    rollover: 0,
  };
}

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 400, height: 800 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <PaperProvider theme={pulpeLightTheme}>
        <BudgetsScreen />
      </PaperProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: NOW, advanceTimers: true });
  Object.assign(mockBudgets, {
    data: [],
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
  });
  Object.assign(mockSettings, {
    data: { currency: "CHF", payDayOfMonth: 1 },
    isPending: false,
    isError: false,
  });
  delete mockGenerationResult.createdCount;
  delete mockGenerationResult.skippedCount;
});

afterEach(() => {
  jest.useRealTimers();
});

it("asks once for a stale list when the tab gains focus", async () => {
  await renderScreen();

  expect(mockRefetchStaleList).toHaveBeenCalledTimes(1);
});

it("renders loading, retryable failure and empty creation states", async () => {
  mockBudgets.isPending = true;
  const view = await renderScreen();
  expect(view.getByLabelText("common.loading")).toBeTruthy();

  Object.assign(mockBudgets, { isPending: false, isError: true });
  await view.rerender(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 400, height: 800 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <PaperProvider theme={pulpeLightTheme}>
        <BudgetsScreen />
      </PaperProvider>
    </SafeAreaProvider>,
  );
  await fireEvent.press(view.getByText("common.retry"));
  expect(mockInvalidateSettings).toHaveBeenCalledTimes(1);
  expect(mockInvalidateBudgets).toHaveBeenCalledTimes(1);

  mockBudgets.isError = false;
  await view.rerender(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 400, height: 800 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <PaperProvider theme={pulpeLightTheme}>
        <BudgetsScreen />
      </PaperProvider>
    </SafeAreaProvider>,
  );
  await fireEvent.press(view.getByText("budgets.list.create"));
  expect(router.push).toHaveBeenCalledWith("/budget/create");
});

it("keeps planning in its bar, even when the list failed", async () => {
  mockBudgets.isError = true;
  const view = await renderScreen();

  await fireEvent.press(view.getByLabelText("budgets.list.planAccessibility"));

  expect(router.push).toHaveBeenCalledWith("/budget/plan");
});

it("creates a budget from its FAB, over the list as over the empty state", async () => {
  mockBudgets.data = [budget(2026, 10)];
  const view = await renderScreen();

  await fireEvent.press(view.getByTestId("budgets-create"));
  expect(router.push).toHaveBeenCalledWith("/budget/create");

  mockBudgets.data = [];
  await view.rerender(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 400, height: 800 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <PaperProvider theme={pulpeLightTheme}>
        <BudgetsScreen />
      </PaperProvider>
    </SafeAreaProvider>,
  );
  expect(view.getByTestId("budgets-create")).toBeTruthy();
});

it("reads the year being lived in, January first, and opens a month", async () => {
  mockBudgets.data = [
    budget(2026, 11, 300),
    budget(2025, 12),
    budget(2026, 10, 200),
    budget(2026, 1, 50),
  ];
  const view = await renderScreen();

  const names = view
    .getAllByText(/^(Janvier|Octobre|Novembre|Décembre)$/)
    .map((node) => node.props.children);
  expect(names).toEqual(["Janvier", "Octobre", "Novembre", "Décembre"]);
  // The year closes on its last month's remaining.
  expect(view.getByLabelText(/budgets\.list\.yearBalance \+300/)).toBeTruthy();
  expect(view.getByText("3 / 12")).toBeTruthy();

  await fireEvent.press(view.getByTestId("budget-row-budget-2026-10"));
  expect(router.push).toHaveBeenCalledWith("/budget/budget-2026-10");
});

it("offers to create the next month still missing, with that month", async () => {
  mockBudgets.data = [budget(2026, 10), budget(2026, 11)];
  const view = await renderScreen();

  await fireEvent.press(view.getByTestId("budgets-create-missing"));

  expect(router.push).toHaveBeenCalledWith({
    pathname: "/budget/create",
    params: { month: 12, year: 2026 },
  });
});

it("moves to another year from the picker, which closes as a review", async () => {
  mockBudgets.data = [budget(2025, 6, 40), budget(2026, 10)];
  const view = await renderScreen();

  await fireEvent.press(view.getByRole("tab", { name: "2025" }));

  expect(view.getByText("Juin")).toBeTruthy();
  expect(view.queryByText("Octobre")).toBeNull();
  expect(view.getByLabelText(/budgets\.list\.yearReview/)).toBeTruthy();
  // A year behind us has nothing left to create.
  expect(view.queryByTestId("budgets-create-missing")).toBeNull();
});

it("reads every page, since a year cut at a page boundary closes wrong", async () => {
  Object.assign(mockBudgets, {
    data: [budget(2026, 10)],
    hasNextPage: true,
  });
  await renderScreen();

  await waitFor(() => expect(mockBudgets.fetchNextPage).toHaveBeenCalled());
});

it("stops reading at a failed page and offers the retry instead", async () => {
  Object.assign(mockBudgets, {
    data: [budget(2026, 10)],
    hasNextPage: true,
    isFetchNextPageError: true,
  });
  const view = await renderScreen();

  expect(view.getByText("budgets.list.loadErrorTitle")).toBeTruthy();
  expect(mockBudgets.fetchNextPage).not.toHaveBeenCalled();
});

it("announces zero creations and clears both navigation counters", async () => {
  mockBudgets.data = [budget(2026, 10)];
  Object.assign(mockGenerationResult, { createdCount: "0", skippedCount: "2" });
  const view = await renderScreen();

  expect(view.getByText(/budgets\.plan\.result/)).toBeTruthy();
  await fireEvent(view.getByText(/budgets\.plan\.result/), "onDismiss");
  await waitFor(() =>
    expect(router.setParams).toHaveBeenCalledWith({
      createdCount: undefined,
      skippedCount: undefined,
    }),
  );
});

it("keeps one stable row when consecutive pages overlap", () => {
  const first = [budget(2026, 10), budget(2026, 9)];
  const second = [budget(2026, 9), budget(2026, 8)];

  expect(uniqueBudgets([first, second]).map((row) => row.id)).toEqual([
    "budget-2026-10",
    "budget-2026-9",
    "budget-2026-8",
  ]);
});
