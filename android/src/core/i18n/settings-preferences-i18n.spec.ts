import { i18n, translate } from "./i18n";
import { scheduleMonthlyReminder } from "@/core/notifications/scheduler";

const mockGetPermissions = jest.fn();
const mockCancel = jest.fn();
const mockSchedule = jest.fn();

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
  PermissionStatus: { UNDETERMINED: "undetermined" },
  SchedulableTriggerInputTypes: { MONTHLY: "monthly" },
}));

const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

describe("settings preferences localization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissions.mockResolvedValue({ granted: true });
    mockCancel.mockResolvedValue(undefined);
    mockSchedule.mockResolvedValue(undefined);
  });

  it.each([
    ["fr", "Préférences", "Jour de paie"],
    ["en", "Preferences", "Pay day"],
    ["de", "Einstellungen", "Zahltag"],
    ["it", "Preferenze", "Giorno di paga"],
  ])("serves preferences and pay-day copy in %s", (locale, title, payDay) => {
    i18n.locale = locale;
    expect(translate("settings.preferences.title")).toBe(title);
    expect(translate("settings.payDay.title")).toBe(payDay);
  });

  it("schedules the notification in the active locale", async () => {
    i18n.locale = "it";

    await scheduleMonthlyReminder(5);

    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: {
          title: "Nuovo mese",
          body: "Il budget del mese ti aspetta. Controllalo in 30 secondi.",
        },
      }),
    );
  });

  it("keeps the existing language row and localizes both touched surfaces", () => {
    const preferences = readFileSync(
      "src/app/(main)/settings/preferences.tsx",
      "utf8",
    );
    const payDay = readFileSync("src/app/(main)/settings/pay-day.tsx", "utf8");

    expect(preferences).toContain('t("settings.language.title")');
    expect(preferences).toContain('t("settings.preferences.currencyTitle")');
    expect(payDay).toContain('t("settings.payDay.dayLabel", { day })');
    expect(payDay).toContain("`${locale}-CH`");
    expect(`${preferences}\n${payDay}`).not.toMatch(
      /title="Préférences"|title="Jour de paie"|accessibilityLabel={`Le/,
    );
  });
});
