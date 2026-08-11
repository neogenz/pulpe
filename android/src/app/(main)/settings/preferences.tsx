import { router } from "expo-router";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar,
  Button,
  Card,
  Dialog,
  Portal,
  SegmentedButtons,
  Snackbar,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  cancelMonthlyReminder,
  requestReminderPermission,
  scheduleMonthlyReminder,
} from "@/core/notifications/scheduler";
import {
  readRemindersEnabled,
  writeRemindersEnabled,
} from "@/core/notifications/reminder-flags";
import { SPACING } from "@/core/ui/theme";
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
  const [pendingCurrency, setPendingCurrency] =
    useState<SupportedCurrency | null>(null);
  const [areRemindersEnabled, setRemindersEnabled] =
    useState(readRemindersEnabled);
  const [notice, setNotice] = useState<string | null>(null);

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
      { onError: () => setNotice("La devise n'a pas pu être enregistrée.") },
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
      setNotice("Les notifications sont bloquées dans les réglages Android.");
      return;
    }
    writeRemindersEnabled(true);
    await scheduleMonthlyReminder(payDay);
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header mode="small" elevated={false}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Préférences" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text
            variant="labelLarge"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            DEVISE
          </Text>
          <Card mode="contained">
            <Card.Content style={styles.card}>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                On l&apos;utilise pour afficher tous tes montants.
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
                  Cours indicatif : 1 {rate.data.base} ={" "}
                  {rate.data.rate.toFixed(RATE_DECIMALS)} {rate.data.target}
                </Text>
              )}
            </Card.Content>
          </Card>
        </View>

        <SettingsSection title="JOUR DE PAIE">
          <SettingsRow
            icon="calendar-clock"
            title="Jour de paie"
            description="Le jour où ton mois budgétaire recommence"
            value={payDay === null ? "Le 1er" : `Le ${payDay}`}
            onPress={() => router.push("/settings/pay-day")}
          />
        </SettingsSection>

        <View style={styles.section}>
          <Text
            variant="labelLarge"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            RAPPELS
          </Text>
          <Card mode="contained">
            <Card.Content style={styles.switchRow}>
              <View style={styles.switchLabels}>
                <Text variant="bodyLarge">Rappel mensuel</Text>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Un rappel par mois, le jour de paie, pour pointer tes
                  dépenses. Tu peux couper quand tu veux.
                </Text>
              </View>
              <Switch
                value={areRemindersEnabled}
                onValueChange={(next) => void applyReminders(next)}
                accessibilityLabel="Rappel mensuel"
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
          <Dialog.Title>Changer la devise d&apos;affichage ?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Tes montants existants ne sont pas convertis — 100 restera 100,
              affiché en {pendingCurrency}. Seule la devise d&apos;affichage
              change.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPendingCurrency(null)}>Annuler</Button>
            <Button
              onPress={() => {
                if (pendingCurrency !== null) applyCurrency(pendingCurrency);
              }}
            >
              Changer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={notice !== null} onDismiss={() => setNotice(null)}>
        {notice ?? ""}
      </Snackbar>
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
