import { renderHook } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";

import { captureEvent } from "@/core/observability/analytics-client";

import { useReminderTapTracking } from "./use-reminder-tap-tracking";

jest.mock("@/core/observability/analytics-client", () => ({
  captureEvent: jest.fn(),
}));
jest.mock("expo-notifications", () => ({
  useLastNotificationResponse: jest.fn(),
  DEFAULT_ACTION_IDENTIFIER: "default",
  getPermissionsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: {},
}));
jest.mock("@/core/ui/amount-visibility", () => ({
  areAmountsHidden: () => false,
}));

const tapped = (identifier: string, actionIdentifier = "default") =>
  jest.mocked(Notifications.useLastNotificationResponse).mockReturnValue({
    actionIdentifier,
    notification: { request: { identifier } },
  } as never);

beforeEach(() => jest.clearAllMocks());

it("counts a tap on the Monday recap as that reminder opening the app", async () => {
  tapped("pulpe.reminder.weekly-recap.1");

  await renderHook(() => useReminderTapTracking());

  expect(captureEvent).toHaveBeenCalledWith("reminder_opened", {
    reminder: "weekly_recap",
  });
});

it("ignores notifications Pulpe did not schedule", async () => {
  tapped("somebody-else");

  await renderHook(() => useReminderTapTracking());

  expect(captureEvent).not.toHaveBeenCalled();
});
