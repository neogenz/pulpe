import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import PreferencesScreen from "@/app/(main)/settings/preferences";
import { captureEvent } from "@/core/observability/analytics-client";

const mockRequestPermission = jest.fn();
const mockSchedule = jest.fn(async (_input: unknown) => undefined);
const mockCancel = jest.fn(async () => undefined);
const mockWriteEnabled = jest.fn();
const details = { budget: { month: 11 } };

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("@/core/observability/analytics-client", () => ({
  captureEvent: jest.fn(),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/screen-app-bar", () => ({
  ScreenAppBar: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/core/ui/pull-to-refresh", () => ({
  usePullToRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }),
}));
jest.mock("@/core/user-settings/user-settings-queries", () => ({
  useUserSettings: () => ({
    data: { currency: "CHF", payDayOfMonth: 25 },
    refetch: jest.fn(),
  }),
}));
jest.mock("@/features/current-month/current-month-queries", () => ({
  useCurrentMonth: () => ({ details }),
}));
jest.mock("@/core/notifications/scheduler", () => ({
  cancelMonthlyReminder: jest.fn(),
  scheduleMonthlyReminder: jest.fn(),
  requestReminderPermission: () => mockRequestPermission(),
  scheduleWeeklyRecaps: (input: unknown) => mockSchedule(input),
  cancelWeeklyRecaps: () => mockCancel(),
}));
jest.mock("@/core/notifications/reminder-flags", () => ({
  readRemindersEnabled: () => false,
  readWeeklyRecapEnabled: () => false,
  writeRemindersEnabled: jest.fn(),
  writeWeeklyRecapEnabled: (isEnabled: boolean) => mockWriteEnabled(isEnabled),
}));

beforeEach(() => jest.clearAllMocks());

async function toggleRecap() {
  const view = await render(
    <PaperProvider>
      <PreferencesScreen />
    </PaperProvider>,
  );
  await fireEvent(
    view.getByLabelText("settings.preferences.weeklyRecap.title"),
    "valueChange",
    true,
  );
  return view;
}

it("arms the Monday recap from the month on screen once the permission is granted", async () => {
  mockRequestPermission.mockResolvedValue(true);

  await toggleRecap();

  await waitFor(() =>
    expect(mockSchedule).toHaveBeenCalledWith({
      details,
      payDayOfMonth: 25,
      currency: "CHF",
    }),
  );
  expect(mockWriteEnabled).toHaveBeenCalledWith(true);
  expect(captureEvent).toHaveBeenCalledWith("reminder_toggled", {
    enabled: true,
    reminder: "weekly_recap",
  });
});

it("flips back and schedules nothing when the permission is refused", async () => {
  mockRequestPermission.mockResolvedValue(false);

  const view = await toggleRecap();

  await waitFor(() =>
    expect(
      view.getByText("settings.preferences.reminderPermissionBlocked"),
    ).toBeTruthy(),
  );
  expect(mockSchedule).not.toHaveBeenCalled();
  expect(mockWriteEnabled).toHaveBeenLastCalledWith(false);
});
