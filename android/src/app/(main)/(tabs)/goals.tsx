import { router } from "expo-router";
import type { SavingsGoal, SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Chip,
  FAB,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/core/ui/card";
import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { formatIsoDate } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { TabHeader } from "@/core/ui/tab-header";
import { FAB_CLEARANCE, SPACING } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { GoalFormSheet } from "@/features/savings-goals/components/goal-form-sheet";
import { GoalsIntro } from "@/features/savings-goals/components/goals-intro";
import {
  hasSeenGoalsIntro,
  markGoalsIntroSeen,
} from "@/features/savings-goals/goals-intro-gate";
import { useSavingsGoals } from "@/features/savings-goals/goals-queries";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";

export default function GoalsScreen() {
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const theme = useTheme();
  const { t } = useTranslation();
  const settings = useUserSettings();
  const goals = useSavingsGoals();
  // Read once, at mount: the flag is written the moment the intro is answered,
  // and re-reading it mid-render would make the intro vanish under the user.
  const [isIntroVisible, setIntroVisible] = useState(
    () => !hasSeenGoalsIntro(),
  );
  const [isCreating, setCreating] = useState(false);

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;

  if (goals.isPending || settings.isPending) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </SafeAreaView>
    );
  }

  if (goals.isError || settings.isError) {
    return (
      <PlaceholderScreen
        icon="cloud-off-outline"
        title={t("goals.list.loadErrorTitle")}
        hint={t("common.loadErrorHint")}
        action={{
          label: t("common.retry"),
          onPress: () =>
            void Promise.all([goals.refetch(), settings.refetch()]),
        }}
      />
    );
  }

  if (isIntroVisible) {
    return (
      <GoalsIntro
        currency={currency}
        onComplete={(shouldCreate) => {
          markGoalsIntroSeen();
          setIntroVisible(false);
          setCreating(shouldCreate);
        }}
      />
    );
  }

  const list = goals.data ?? [];

  return (
    // The app bar carries the status bar inset; asking the safe area for the
    // top edge too would double it.
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <TabHeader title={t("goals.list.title")} />
      {list.length === 0 ? (
        <PlaceholderScreen
          icon="target"
          title={t("goals.list.emptyTitle")}
          hint={t("goals.list.emptyHint")}
          action={{
            label: t("goals.list.create"),
            onPress: () => setCreating(true),
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={goals.isRefetching}
              onRefresh={() => void goals.refetch()}
            />
          }
        >
          {list.map((goal) => (
            <GoalRow key={goal.id} goal={goal} currency={currency} />
          ))}
        </ScrollView>
      )}

      {/* Hidden while the sheet is up: the FAB floats above the Portal's scrim
          and would otherwise sit on top of the form it just opened. */}
      {list.length > 0 && !isCreating && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => setCreating(true)}
          accessibilityLabel={t("goals.list.addAccessibility")}
        />
      )}

      <GoalFormSheet
        isVisible={isCreating}
        onDismiss={() => setCreating(false)}
        currency={currency}
        payDayOfMonth={payDayOfMonth}
        onSaved={() => setCreating(false)}
      />
    </View>
  );
}

function GoalRow({
  goal,
  currency,
}: {
  goal: SavingsGoal;
  currency: SupportedCurrency;
}) {
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const period = periodLabel(goal, locale, t);

  return (
    <Card mode="contained" onPress={() => router.push(`/goal/${goal.id}`)}>
      <Card.Content style={styles.row}>
        <View style={styles.rowLabels}>
          <Text variant="titleMedium">{goal.name}</Text>
          <View style={styles.statusLine}>
            <Chip compact>{t(`goals.status.${goal.status}`)}</Chip>
            {period !== null && (
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {period}
              </Text>
            )}
          </View>
        </View>

        {goal.targetAmount !== null && (
          <Amount size="row">
            {formatCompactCurrency(goal.targetAmount, currency)}
          </Amount>
        )}
      </Card.Content>
    </Card>
  );
}

function periodLabel(
  goal: SavingsGoal,
  locale: string,
  t: ReturnType<typeof useTranslation>["t"],
): string | null {
  if (goal.startDate !== null && goal.targetDate !== null) {
    return `${formatIsoDate(goal.startDate, locale)} → ${formatIsoDate(goal.targetDate, locale)}`;
  }
  if (goal.targetDate !== null)
    return t("goals.list.deadline", {
      date: formatIsoDate(goal.targetDate, locale),
    });
  if (goal.startDate !== null)
    return t("goals.list.since", {
      date: formatIsoDate(goal.startDate, locale),
    });
  return null;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    padding: SPACING.md,
    gap: SPACING.md,
    paddingBottom: FAB_CLEARANCE,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  rowLabels: { flex: 1, gap: SPACING.sm },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
  fab: { position: "absolute", right: SPACING.md, bottom: SPACING.md },
});
