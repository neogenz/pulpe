import { router } from "expo-router";
import { LOCALE_METADATA, type SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Appbar, Switch, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/core/ui/card";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";
import { useTranslation } from "@/core/i18n/locale-store";

import {
  cancelMonthlyReminder,
  cancelWeeklyRecaps,
  requestReminderPermission,
  scheduleMonthlyReminder,
  scheduleWeeklyRecaps,
} from "@/core/notifications/scheduler";
import {
  readRemindersEnabled,
  readWeeklyRecapEnabled,
  writeRemindersEnabled,
  writeWeeklyRecapEnabled,
} from "@/core/notifications/reminder-flags";
import {
  setDiagnosticSharing,
  useDiagnosticsConsent,
} from "@/core/observability/diagnostics-consent";
import {
  toggleAmountVisibility,
  useAmountVisibility,
} from "@/core/ui/amount-visibility";
import { SPACING } from "@/core/ui/theme";
import { captureReminderToggled } from "@/core/observability/product-events";
import { Notice } from "@/core/ui/notice";
import { useCurrentMonth } from "@/features/current-month/current-month-queries";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
import {
  SettingsRow,
  SettingsSection,
  SettingsSectionTitle,
} from "@/features/account/components/settings-section";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";

/**
 * The two assumptions the whole app rests on — when a month starts and how an
 * amount reads — plus the one notification Pulpe sends. Mirrors
 * `PreferencesView` on iOS.
 */
export default function PreferencesScreen() {
  const theme = useTheme();
  const settings = useUserSettings();
  const pull = usePullToRefresh(() => settings.refetch());
  const { locale, t } = useTranslation();
  const [areRemindersEnabled, setRemindersEnabled] =
    useState(readRemindersEnabled);
  const [isWeeklyRecapEnabled, setWeeklyRecapEnabled] = useState(
    readWeeklyRecapEnabled,
  );
  const currentMonth = useCurrentMonth();
  const [notice, setNotice] = useState<string | null>(null);
  const areAmountsHidden = useAmountVisibility(
    (state) => state.areAmountsHidden,
  );
  const isDiagnosticSharingEnabled = useDiagnosticsConsent(
    (state) => state.isDiagnosticSharingEnabled,
  );

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const payDay = settings.data?.payDayOfMonth ?? null;

  async function applyReminders(isEnabled: boolean) {
    // Optimistic: the switch answers instantly, and a denied permission flips
    // it back rather than leaving it claiming a reminder that will not fire.
    setRemindersEnabled(isEnabled);

    if (!isEnabled) {
      writeRemindersEnabled(false);
      captureReminderToggled("monthly", false);
      await cancelMonthlyReminder();
      return;
    }

    const isGranted = await requestReminderPermission();
    if (!isGranted) {
      setRemindersEnabled(false);
      writeRemindersEnabled(false);
      setNotice(t("settings.preferences.reminderPermissionBlocked"));
      return;
    }
    writeRemindersEnabled(true);
    captureReminderToggled("monthly", true);
    await scheduleMonthlyReminder(payDay);
  }

  /**
   * Same contract as `applyReminders`. The recap needs the month's figures, so
   * the month already on screen schedules it; without one yet, the home
   * schedules it as soon as the month lands.
   */
  async function applyWeeklyRecap(isEnabled: boolean) {
    setWeeklyRecapEnabled(isEnabled);

    if (!isEnabled) {
      writeWeeklyRecapEnabled(false);
      captureReminderToggled("weekly_recap", false);
      await cancelWeeklyRecaps();
      return;
    }

    const isGranted = await requestReminderPermission();
    if (!isGranted) {
      setWeeklyRecapEnabled(false);
      writeWeeklyRecapEnabled(false);
      setNotice(t("settings.preferences.reminderPermissionBlocked"));
      return;
    }
    writeWeeklyRecapEnabled(true);
    captureReminderToggled("weekly_recap", true);
    if (currentMonth.details === null) return;
    await scheduleWeeklyRecaps({
      details: currentMonth.details,
      payDayOfMonth: payDay,
      currency,
    });
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction
          onPress={() => router.back()}
          accessibilityLabel={t("common.back")}
        />
        <Appbar.Content title={t("settings.preferences.title")} />
      </ScreenAppBar>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl {...pull} />}
      >
        <SettingsSection title={t("settings.language.title")}>
          <SettingsRow
            testID="settings-language"
            icon="translate"
            title={t("settings.language.title")}
            description={t("settings.language.description")}
            value={LOCALE_METADATA[locale].nativeName}
            onPress={() => router.push("/settings/language")}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.preferences.currencyTitle")}>
          <SettingsRow
            icon="currency-usd"
            title={t("settings.preferences.currencyTitle")}
            description={t("settings.preferences.currencyDescription")}
            value={currency}
            onPress={() => router.push("/settings/currency")}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.payDay.title")}>
          <SettingsRow
            icon="calendar-clock"
            title={t("settings.payDay.title")}
            description={t("settings.preferences.payDayDescription")}
            value={t(
              payDay === null
                ? "settings.preferences.payDayFirst"
                : "settings.preferences.payDayValue",
              { day: payDay },
            )}
            onPress={() => router.push("/settings/pay-day")}
          />
        </SettingsSection>

        <View style={styles.section}>
          <SettingsSectionTitle>
            {t("settings.preferences.privacySection")}
          </SettingsSectionTitle>
          <Card mode="contained">
            <Card.Content style={styles.switchRow}>
              <View style={styles.switchLabels}>
                <Text variant="bodyLarge">
                  {t("settings.preferences.hideAmountsTitle")}
                </Text>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("settings.preferences.hideAmountsDescription")}
                </Text>
              </View>
              <Switch
                value={areAmountsHidden}
                onValueChange={toggleAmountVisibility}
                accessibilityLabel={t("settings.preferences.hideAmountsTitle")}
              />
            </Card.Content>
          </Card>
        </View>

        <View style={styles.section}>
          <SettingsSectionTitle>
            {t("settings.preferences.remindersSection")}
          </SettingsSectionTitle>
          <Card mode="contained">
            <Card.Content style={styles.switchRow}>
              <View style={styles.switchLabels}>
                <Text variant="bodyLarge">
                  {t("settings.preferences.reminderTitle")}
                </Text>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("settings.preferences.reminderDescription")}
                </Text>
              </View>
              <Switch
                value={areRemindersEnabled}
                onValueChange={(next) => void applyReminders(next)}
                accessibilityLabel={t("settings.preferences.reminderTitle")}
              />
            </Card.Content>
            <Card.Content style={styles.switchRow}>
              <View style={styles.switchLabels}>
                <Text variant="bodyLarge">
                  {t("settings.preferences.weeklyRecap.title")}
                </Text>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("settings.preferences.weeklyRecap.description")}
                </Text>
              </View>
              <Switch
                value={isWeeklyRecapEnabled}
                onValueChange={(next) => void applyWeeklyRecap(next)}
                accessibilityLabel={t("settings.preferences.weeklyRecap.title")}
              />
            </Card.Content>
          </Card>
        </View>

        {/* Last, and worded exactly as on iOS and the webapp: the same promise
            has to read the same on all three. */}
        <View style={styles.section}>
          <SettingsSectionTitle>
            {t("settings.preferences.dataPrivacySection")}
          </SettingsSectionTitle>
          <Card mode="contained">
            <Card.Content style={styles.switchRow}>
              <View style={styles.switchLabels}>
                <Text variant="bodyLarge">
                  {t("settings.preferences.diagnosticsTitle")}
                </Text>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("settings.preferences.diagnosticsDescription")}
                </Text>
              </View>
              <Switch
                value={isDiagnosticSharingEnabled}
                onValueChange={setDiagnosticSharing}
                accessibilityLabel={t("settings.preferences.diagnosticsTitle")}
              />
            </Card.Content>
          </Card>
        </View>
      </ScrollView>

      <Notice visible={notice !== null} onDismiss={() => setNotice(null)}>
        {notice ?? ""}
      </Notice>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.md, gap: SPACING.lg, paddingBottom: SPACING.xxl },
  section: { gap: SPACING.sm },
  card: { gap: SPACING.md },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  switchLabels: { flex: 1, gap: SPACING.xxs },
});
