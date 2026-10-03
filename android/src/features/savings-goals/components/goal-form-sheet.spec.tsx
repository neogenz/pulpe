import { fireEvent, render } from "@testing-library/react-native";
import type { SavingsGoal } from "pulpe-shared";
import { PaperProvider } from "react-native-paper";

import { GoalFormSheet } from "./goal-form-sheet";

interface PickerProps {
  minimumDate?: Date;
  maximumDate?: Date;
}

let mockPicker: PickerProps | null = null;
const mockMutation = () => ({
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
});

jest.mock("@react-native-community/datetimepicker", () => ({
  __esModule: true,
  default: (props: PickerProps) => {
    mockPicker = props;
    return null;
  },
}));
jest.mock("../goals-queries", () => ({
  useCreateSavingsGoal: () => mockMutation(),
  useUpdateSavingsGoal: () => mockMutation(),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/haptics", () => ({ hapticSuccess: jest.fn() }));
jest.mock("@/core/ui/amount-field", () => ({ AmountField: () => null }));
jest.mock("@/core/ui/sheet", () => {
  const { View } = jest.requireActual("react-native");
  return {
    FormModal: ({
      isVisible,
      children,
      footer,
    }: {
      isVisible: boolean;
      children: React.ReactNode;
      footer: React.ReactNode;
    }) =>
      isVisible ? (
        <View>
          {children}
          {footer}
        </View>
      ) : null,
  };
});

const goal = {
  id: "1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d",
  userId: "9f8e7d6c-5b4a-4392-8172-6d5e4f3a2b1c",
  name: "Voyage Japon",
  startDate: null,
  targetAmount: 6000,
  targetDate: "2026-03-31",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as SavingsGoal;

async function renderSheet(edited?: SavingsGoal) {
  return render(
    <PaperProvider>
      <GoalFormSheet
        isVisible
        onDismiss={jest.fn()}
        currency="CHF"
        payDayOfMonth={null}
        goal={edited}
        onSaved={jest.fn()}
      />
    </PaperProvider>,
  );
}

beforeEach(() => {
  mockPicker = null;
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 1, 10));
});

afterEach(() => jest.useRealTimers());

/**
 * The calendar offered any day, the button stayed enabled, and a deadline
 * the request schema refuses only surfaced as a generic save error.
 */
it("offers deadlines from today to the end of the planning horizon", async () => {
  const view = await renderSheet();

  // Start, then deadline: the two date rows, in reading order.
  await fireEvent.press(view.getAllByText("common.choose")[1]);

  expect(mockPicker?.minimumDate).toEqual(new Date(2026, 9, 1));
  expect(mockPicker?.maximumDate).toEqual(new Date(2036, 8, 30));
});

it("leaves the start date unbounded", async () => {
  const view = await renderSheet();

  await fireEvent.press(view.getAllByText("common.choose")[0]);

  expect(mockPicker).not.toBeNull();
  expect(mockPicker?.minimumDate).toBeUndefined();
  expect(mockPicker?.maximumDate).toBeUndefined();
});

it("keeps the deadline an edited goal already has within reach", async () => {
  const view = await renderSheet(goal);

  await fireEvent.press(view.getAllByText("common.edit")[0]);

  expect(mockPicker?.minimumDate).toEqual(new Date(2026, 2, 31));
  expect(view.queryByText("goals.form.validation.pastDeadline")).toBeNull();
});
