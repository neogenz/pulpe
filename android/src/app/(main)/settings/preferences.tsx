import { router } from "expo-router";
import {
  LOCALE_METADATA,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from "pulpe-shared";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar,
  Button,
  Dialog,
  Portal,
  SegmentedButtons,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/core/ui/card";
import { Eyebrow } from "@/core/ui/eyebrow";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";
import { useTranslation } from "@/core/i18n/locale-store";

import {
  cancelMonthlyReminder,
  requestReminderPermission,
  scheduleMonthlyReminder,
} from "@/core/notifications/scheduler";
import {
  readRemindersEnabled,
  writeRemindersEnabled,
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
import { Notice } from "@/core/ui/notice";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { useUpdateUserSettings } from "@/features/account/account-queries";
import { useCurrencyRate } from "@/features/account/currency-queries";
import {
  SettingsRow,
  SettingsSection,
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
  const update = useUpdateUserSettings();
  const { locale, t } = useTranslation();
  const [pendingCurrency, setPendingCurrency] =
    useState<SupportedCurrency | null>(null);
  const [areRemindersEnabled, setRemindersEnabled] =
    useState(readRemindersEnabled);
  const [notice, setNotice] = useState<string | null>(null);
  const areAmountsHidden = useAmountVisibility(
    (state) => state.areAmountsHidden,
  );
  const isDiagnosticSharingEnabled = useDiagnosticsConsent(
    (state) => state.isDiagnosticSharingEnabled,
  );

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const otherCurrency =
    SUPPORTED_CURRENCIES.find((candidate) => candidate !== currency) ??
    currency;
  const rate = useCurrencyRate(currency, otherCurrency);
  const payDay = settings.data?.payDayOfMonth ?? null;

  function applyCurrency(next: SupportedCurrency) {
    setPendingCurrency(null);
    update.mutate(
      { currency: next },
      {
        onError: () => setNotice(t("settings.preferences.currencySaveError")),
      },
    );
  }

  async function applyReminders(isEnabled: boolean) {
    // Optimistic: the switch answers instantly, and a denied permission flips
    // it back rather than leaving it claiming a reminder that will not fire.
    setRemindersEnabled(isEnabled);

    if (!isEnabled) {
      writeRemindersEnabled(false);
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
    await scheduleMonthlyReminder(payDay);
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={t("settings.preferences.title")} />
      </ScreenAppBar>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={settings.isRefetching}
            onRefresh={() => void settings.refetch()}
          />
        }
      >
        <SettingsSection title={t("settings.language.title")}>
          <SettingsRow
            icon="translate"
            title={t("settings.language.title")}
            description={t("settings.language.description")}
            value={LOCALE_METADATA[locale].nativeName}
            onPress={() => router.push("/settings/language")}
          />
        </SettingsSection>

        <View style={styles.section}>
          <Eyebrow>{t("settings.preferences.currencyTitle")}</Eyebrow>
          <Card mode="contained">
            <Card.Content style={styles.card}>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("settings.preferences.currencyDescription")}
              </Text>
              <SegmentedButtons
                value={currency}
                onValueChange={(next) =>
                  setPendingCurrency(next as SupportedCurrency)
                }
                buttons={SUPPORTED_CURRENCIES.map((candidate) => ({
                  value: candidate,
                  label: candidate,
                  disabled: update.isPending,
                }))}
              />
              {rate.data !== undefined && (
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("settings.preferences.currencyRate", {
                    base: rate.data.base,
                    rate: rate.data.rate.toFixed(RATE_DECIMALS),
                    target: rate.data.target,
                  })}
                </Text>
              )}
            </Card.Content>
          </Card>
        </View>

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
          <Eyebrow>{t("settings.preferences.privacySection")}</Eyebrow>
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
          <Eyebrow>{t("settings.preferences.remindersSection")}</Eyebrow>
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
          </Card>
        </View>

        {/* Last, and worded exactly as on iOS and the webapp: the same promise
            has to read the same on all three. */}
        <View style={styles.section}>
          <Eyebrow>{t("settings.preferences.dataPrivacySection")}</Eyebrow>
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

      <Portal>
        <Dialog
          visible={pendingCurrency !== null}
          onDismiss={() => setPendingCurrency(null)}
        >
          <Dialog.Title>
            {t("settings.preferences.currencyDialogTitle")}
          </Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t("settings.preferences.currencyDialogDescription", {
                currency: pendingCurrency ?? "",
              })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendingCurrency(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onPress={() => {
                if (pendingCurrency !== null) applyCurrency(pendingCurrency);
              }}
            >
              {t("settings.preferences.currencyDialogAction")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Notice visible={notice !== null} onDismiss={() => setNotice(null)}>
        {notice ?? ""}
      </Notice>
    </SafeAreaView>
  );
}

const RATE_DECIMALS = 4;

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
