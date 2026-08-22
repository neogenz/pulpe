import { fireEvent, render } from "@testing-library/react-native";

import BudgetLineDetailScreen from "@/app/(main)/budget/[id]/line/[lineId]";

const mockDetails = jest.fn();
const mockSettings = jest.fn();
const mockDetailsRefetch = jest.fn(async () => undefined);
const mockSettingsRefetch = jest.fn(async () => undefined);
const mockUseBudgetPeriods = jest.fn((_year: number | null) => ({
  data: [],
  isSuccess: false,
}));

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ id: "budget-1", lineId: "missing-line" }),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string) => key,
  }),
}));
jest.mock("@/core/ui/amount-visibility", () => ({
  useAmountMasking: jest.fn(),
}));
jest.mock("@/core/user-settings/user-settings-queries", () => ({
  useUserSettings: () => mockSettings(),
}));
jest.mock("@/features/budgets/budget-queries", () => ({
  useBudgetDetails: () => mockDetails(),
  useBudgetPeriods: (year: number | null) => mockUseBudgetPeriods(year),
}));
jest.mock("@/features/tags/tag-queries", () => ({
  useTags: () => ({ data: [] }),
}));
jest.mock("@/features/budgets/toggle-check-mutation", () => ({
  useToggleCheck: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock("./components/budget-line-detail-overlays", () => ({
  BudgetLineDetailOverlays: () => null,
}));

const settings = () => ({
  isPending: false,
  isError: false,
  data: { currency: "CHF", payDayOfMonth: null },
  refetch: mockSettingsRefetch,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings.mockReturnValue(settings());
});

it("shows a retryable query error before the missing-line state", async () => {
  mockDetails.mockReturnValue({
    isPending: false,
    isError: true,
    refetch: mockDetailsRefetch,
  });
  const view = await render(<BudgetLineDetailScreen />);

  expect(view.getByText("budgets.actions.line.loadError")).toBeTruthy();
  await fireEvent.press(view.getByText("common.retry"));
  expect(mockDetailsRefetch).toHaveBeenCalledTimes(1);
  expect(mockSettingsRefetch).toHaveBeenCalledTimes(1);
});

it("shows the missing-line state only after queries succeeded", async () => {
  mockDetails.mockReturnValue({
    isPending: false,
    isError: false,
    data: {
      budget: { year: 2026, month: 12 },
      budgetLines: [],
      transactions: [],
    },
    refetch: mockDetailsRefetch,
  });
  const view = await render(<BudgetLineDetailScreen />);

  expect(view.getByText("budgets.actions.line.missingTitle")).toBeTruthy();
  expect(view.queryByText("budgets.actions.line.loadError")).toBeNull();
  expect(mockUseBudgetPeriods).toHaveBeenCalledWith(2027);
});
