import { act, fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import PayDayScreen from "@/app/(main)/settings/pay-day";

const mockSchedule = jest.fn();
const mockUpdate = jest.fn();
let mockRemindersEnabled = false;

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/screen-app-bar", () => ({
  ScreenAppBar: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/core/notifications/scheduler", () => ({
  scheduleMonthlyReminder: (payDay: number | null) => mockSchedule(payDay),
}));
jest.mock("@/core/notifications/reminder-flags", () => ({
  readRemindersEnabled: () => mockRemindersEnabled,
}));
jest.mock("@/core/user-settings/user-settings-queries", () => ({
  useUserSettings: () => ({ data: { payDayOfMonth: null } }),
}));
jest.mock("@/features/account/account-queries", () => ({
  useUpdateUserSettings: () => ({
    mutate: mockUpdate,
    isPending: false,
    isError: false,
  }),
}));

async function savePayDay(day: number) {
  const view = await render(
    <PaperProvider>
      <PayDayScreen />
    </PaperProvider>,
  );
  await fireEvent.press(
    view.getAllByLabelText("settings.payDay.dayLabel")[day - 1],
  );
  await fireEvent.press(view.getByText("settings.payDay.save"));

  expect(mockUpdate).toHaveBeenCalledWith(
    { payDayOfMonth: day },
    expect.any(Object),
  );
  const { onSuccess } = mockUpdate.mock.calls[0][1] as {
    onSuccess: () => void;
  };
  await act(async () => onSuccess());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRemindersEnabled = false;
});

/**
 * The OS grant outlives the in-app switch: scheduling on the grant alone armed
 * again the reminder the user had turned off, while the switch still read off.
 */
it("leaves a switched-off reminder off when the pay day moves", async () => {
  await savePayDay(25);

  expect(mockSchedule).not.toHaveBeenCalled();
});

it("moves a switched-on reminder to the new pay day", async () => {
  mockRemindersEnabled = true;

  await savePayDay(25);

  expect(mockSchedule).toHaveBeenCalledWith(25);
});
