import { fireEvent, render } from "@testing-library/react-native";
import type { BudgetLine } from "pulpe-shared";

import { useAmountVisibility } from "@/core/ui/amount-visibility";
import { TOUCH_TARGET } from "@/core/ui/theme";

import { DEFAULT_FILTERS, detailsSections } from "../budget-details-selectors";
import { BudgetLineRow } from "./budget-line-row";

let mockFontScale = 1;
let mockSwipe: {
  children: React.ReactNode;
  onSwipeableOpenStartDrag: () => void;
  onSwipeableClose: () => void;
};

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ fontScale: mockFontScale }),
}));

beforeEach(() => {
  mockFontScale = 1;
});
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => ({
  __esModule: true,
  default: (props: typeof mockSwipe) => {
    mockSwipe = props;
    return props.children;
  },
}));

async function renderRow(sourceSavingsGoalId?: string) {
  const line: BudgetLine = {
    id: "line-1",
    budgetId: "budget-1",
    templateLineId: null,
    savingsGoalId: null,
    sourceSavingsGoalId,
    assetId: null,
    name: "Loyer",
    amount: 100,
    kind: sourceSavingsGoalId === undefined ? "expense" : "income",
    recurrence: "fixed",
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: "2026-11-01T00:00:00Z",
    updatedAt: "2026-11-01T00:00:00Z",
  };
  const [section] = detailsSections([line], [], DEFAULT_FILTERS);
  const onPress = jest.fn();
  const onToggle = jest.fn();
  const view = await render(
    <BudgetLineRow
      item={section.items[0]}
      currency="CHF"
      isSyncing={false}
      tagSummary="Maison"
      onPress={onPress}
      onToggle={onToggle}
    />,
  );
  return { view, onPress, onToggle };
}

it.each([false, true])(
  "separates pointing and opening, including during a swipe (%s)",
  async (isDragging) => {
    const { view, onPress, onToggle } = await renderRow();
    const point = view.getByRole("checkbox");
    const open = view.getByRole("button", { name: /Loyer.*Maison.*CHF/ });
    expect(point.parent).toBe(open.parent);
    expect(point).toHaveStyle({ width: TOUCH_TARGET, height: TOUCH_TARGET });

    if (isDragging) mockSwipe.onSwipeableOpenStartDrag();
    await fireEvent.press(point);
    expect(onPress).not.toHaveBeenCalled();
    await fireEvent.press(open);
    expect(onToggle).toHaveBeenCalledTimes(isDragging ? 0 : 1);
    expect(onPress).toHaveBeenCalledTimes(isDragging ? 0 : 1);
    if (isDragging) {
      mockSwipe.onSwipeableClose();
      await fireEvent.press(open);
      expect(onPress).toHaveBeenCalledTimes(1);
    }
  },
);

it("offers only the detail action when the goal owns pointing", async () => {
  const { view, onPress } = await renderRow("goal-1");
  expect(view.queryByRole("checkbox")).toBeNull();
  await fireEvent.press(view.getByRole("button", { name: /Loyer/ }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

it.each([1, 1.5, 2])(
  "switches to stacked layout at large font sizes (scale: %s)",
  async (fontScale) => {
    mockFontScale = fontScale;
    const { view } = await renderRow();
    const title = view.getByText("Loyer");
    const metadata = view.getByText(/Maison/);
    const amount = view.getByText(/CHF/);
    const stacked = fontScale > 1;

    expect(title.props.numberOfLines).toBe(stacked ? undefined : 2);
    expect(metadata.props.numberOfLines).toBe(stacked ? undefined : 1);
    expect(amount.props.numberOfLines).toBe(1);
    expect(amount.parent).toBe(
      stacked ? title.parent : view.getByRole("button"),
    );
    if (stacked) expect(title.parent?.children.at(-1)).toBe(amount);
  },
);

it("speaks an income's nature in words and never a sign before masked digits", async () => {
  useAmountVisibility.setState({ areAmountsHidden: true });
  try {
    const { view } = await renderRow("goal-1");
    const open = view.getByRole("button", { name: /^Income · Loyer/ });

    expect(open.props.accessibilityLabel).toMatch(/ · •••$/);
  } finally {
    useAmountVisibility.setState({ areAmountsHidden: false });
  }
});
