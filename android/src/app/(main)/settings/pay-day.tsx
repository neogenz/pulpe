import { router } from "expo-router";
import { formatBudgetPeriod } from "pulpe-shared";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar,
  Button,
  Card,
  HelperText,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenAppBar } from "@/core/ui/screen-app-bar";

import { scheduleMonthlyReminder } from "@/core/notifications/scheduler";
import { formatMonthLabel } from "@/core/ui/date-format";
import { useRipple } from "@/core/ui/ripple";
import { RADIUS, SPACING, TOUCH_TARGET } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { useUpdateUserSettings } from "@/features/account/account-queries";

const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);
/**
 * The disc itself, kept at 44 so seven of them still fit across a phone — at 48
 * the grid drops to six columns and stops reading as a month. `CELL_SLOP`
 * carries the target to `TOUCH_TARGET` without widening anything: the gap
 * between two discs is `SPACING.sm`, so the slops never overlap.
 */
const CELL_SIZE = 44;
const CELL_SLOP = (TOUCH_TARGET - CELL_SIZE) / 2;

/**
 * The day the budget month restarts. Stored as `null` for the 1st, which is
 * what "no shift" means everywhere the period is computed — sending 1 would be
 * a second way to say the same thing.
 */
export default function PayDayScreen() {
  const theme = useTheme();
  const ripple = useRipple({ radius: CELL_SIZE / 2 });
  const settings = useUserSettings();
  const update = useUpdateUserSettings();
  const [selectedDay, setSelectedDay] = useState(
    settings.data?.payDayOfMonth ?? 1,
  );

  const now = new Date();
  const period = formatBudgetPeriod(
    now.getMonth() + 1,
    now.getFullYear(),
    selectedDay === 1 ? null : selectedDay,
  );

  function submit() {
    const payDayOfMonth = selectedDay === 1 ? null : selectedDay;

    update.mutate(
      { payDayOfMonth },
      {
        onSuccess: () => {
          // The reminder fires on the pay day, so moving the day moves it.
          void scheduleMonthlyReminder(payDayOfMonth);
          router.back();
        },
      },
    );
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="Jour de paie" />
      </ScreenAppBar>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="titleMedium">Le mois commencera un…</Text>
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          Choisis la date à laquelle tu souhaites commencer à suivre tes
          dépenses et revenus — ton jour de paie, par exemple.
        </Text>

        <View style={styles.grid}>
          {DAYS.map((day) => {
            const isSelected = day === selectedDay;

            return (
              <Pressable
                key={day}
                onPress={() => setSelectedDay(day)}
                android_ripple={ripple}
                hitSlop={CELL_SLOP}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Le ${day}`}
                style={[
                  styles.cell,
                  {
                    backgroundColor: isSelected
                      ? theme.colors.primary
                      : theme.colors.surfaceVariant,
                  },
                ]}
              >
                <Text
                  variant="labelLarge"
                  style={{
                    color: isSelected
                      ? theme.colors.onPrimary
                      : theme.colors.onSurfaceVariant,
                  }}
                >
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Card mode="contained">
          <Card.Content style={styles.hint}>
            <Text variant="labelLarge">Ton mois budgétaire</Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Ton budget «&nbsp;
              {formatMonthLabel(now.getMonth() + 1, now.getFullYear())}
              &nbsp;» couvrira du {period}.
            </Text>
          </Card.Content>
        </Card>

        {selectedDay > 28 && (
          <HelperText type="info" visible>
            Les mois plus courts démarreront leur dernier jour.
          </HelperText>
        )}

        {update.isError && (
          <HelperText type="error" visible>
            Le jour de paie n&apos;a pas pu être enregistré. Réessaie.
          </HelperText>
        )}

        <Button
          mode="contained"
          onPress={submit}
          disabled={update.isPending}
          loading={update.isPending}
        >
          Enregistrer
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  // Left-aligned so the last row continues the columns: centred, 29-30-31
  // drifted under 24-25-26 and read as a different set of days.
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { gap: SPACING.xs },
});
