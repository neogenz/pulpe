import * as Notifications from "expo-notifications";

import type { BudgetDetails } from "@/features/budgets/budget-api";

import {
  cancelAllReminders,
  reminderOfNotification,
  scheduleWeeklyRecaps,
} from "./scheduler";

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  dismissNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  SchedulableTriggerInputTypes: { DATE: "date", MONTHLY: "monthly" },
}));
jest.mock("@/core/ui/amount-visibility", () => ({
  areAmountsHidden: () => false,
}));

const details = {
  budget: { month: 11, year: 2026, rollover: 0 },
  budgetLines: [],
  transactions: [],
  checkingDays: {},
} as unknown as BudgetDetails;
const input = { details, payDayOfMonth: null, currency: "CHF" } as const;

beforeEach(() => jest.clearAllMocks());

it("schedules the next three Mondays at 8:30 under stable ids", async () => {
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue({ granted: true } as never);

  await scheduleWeeklyRecaps(input);

  const calls = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls;
  expect(calls.map(([request]) => request.identifier)).toEqual([
    "pulpe.reminder.weekly-recap.0",
    "pulpe.reminder.weekly-recap.1",
    "pulpe.reminder.weekly-recap.2",
  ]);
  const dates = calls.map(
    ([request]) => (request.trigger as { date: Date }).date,
  );
  for (const date of dates) {
    expect([date.getDay(), date.getHours(), date.getMinutes()]).toEqual([
      1, 8, 30,
    ]);
  }
  expect(dates[1].getTime() - dates[0].getTime()).toBeGreaterThanOrEqual(
    6 * 86_400_000,
  );
  // Replaced, not stacked.
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(
    3,
  );
});

it("schedules nothing without the system permission", async () => {
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue({ granted: false } as never);

  await scheduleWeeklyRecaps(input);

  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it("recognizes its own reminders, and nothing else", () => {
  expect(reminderOfNotification("pulpe.reminder.monthly")).toBe("monthly");
  expect(reminderOfNotification("pulpe.reminder.weekly-recap.2")).toBe(
    "weekly_recap",
  );
  expect(reminderOfNotification("other")).toBeNull();
});

it("clears the delivered recaps too when the account leaves", async () => {
  await cancelAllReminders();

  expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(3);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    "pulpe.reminder.monthly",
  );
});

it("schedules nothing once the account left while the system was answering", async () => {
  let grant: (value: never) => void = () => undefined;
  jest.mocked(Notifications.getPermissionsAsync).mockReturnValue(
    new Promise((resolve) => {
      grant = resolve;
    }),
  );

  const scheduling = scheduleWeeklyRecaps(input);
  await cancelAllReminders();
  grant({ granted: true } as never);
  await scheduling;

  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
