import {
  DEFAULT_REMINDER_DAY,
  LAST_SAFE_DAY,
  monthlyReminderDay,
} from "./monthly-reminder";

describe("monthlyReminderDay", () => {
  it("keeps a pay day every month has", () => {
    expect(monthlyReminderDay(5)).toBe(5);
    expect(monthlyReminderDay(LAST_SAFE_DAY)).toBe(LAST_SAFE_DAY);
  });

  // A day-31 reminder would never fire in February.
  it("pulls a late pay day back to a day February also has", () => {
    expect(monthlyReminderDay(31)).toBe(LAST_SAFE_DAY);
    expect(monthlyReminderDay(29)).toBe(LAST_SAFE_DAY);
  });

  it("falls back when no pay day is set", () => {
    expect(monthlyReminderDay(null)).toBe(DEFAULT_REMINDER_DAY);
  });

  it("refuses a day below the first of the month", () => {
    expect(monthlyReminderDay(0)).toBe(1);
    expect(monthlyReminderDay(-3)).toBe(1);
  });
});
