import type { SavingsGoal, SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, FAB, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePushOnce } from "@/core/navigation/push-once";
import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { IconDisc } from "@/core/ui/icon-disc";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { SectionHeader } from "@/core/ui/section-header";
import { StateChip } from "@/core/ui/state-chip";
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

  const header = <TabHeader title={t("goals.list.title")} />;

  if (goals.isError || settings.isError) {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {header}
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
      </View>
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
      {header}
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
          <SectionHeader title={t("goals.list.section")} count={list.length} />
          <LedgerCard>
            {list.map((goal) => (
              <GoalRow key={goal.id} goal={goal} currency={currency} />
            ))}
          </LedgerCard>
        </ScrollView>
      )}

      {/* The empty state names the action itself; once there is a list, the
          plus sign carries it. */}
      {list.length > 0 && (
        <FAB
          testID="goals-create"
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

/**
 * A goal as a ledger row: its disc, its name, the span it runs over, and the
 * amount it aims at — or, once it is no longer under way, the state it is in,
 * which then matters more than the target.
 */
function GoalRow({
  goal,
  currency,
}: {
  goal: SavingsGoal;
  currency: SupportedCurrency;
}) {
  const theme = useTheme();
  const financial = useFinancialColors();
  const push = usePushOnce();
  const { locale, t } = useTranslation();
  const period = periodLabel(goal, locale, t);

  return (
    <LedgerRow
      testID={`goal-row-${goal.id}`}
      leading={<IconDisc name="target" tint={financial.savings} />}
      title={goal.name}
      subtitle={period ?? undefined}
      trailing={
        goal.status === "ACTIVE" ? (
          goal.targetAmount !== null ? (
            <Amount size="row" numberOfLines={1}>
              {formatCompactCurrency(goal.targetAmount, currency)}
            </Amount>
          ) : undefined
        ) : (
          <StateChip
            tint={
              goal.status === "COMPLETED"
                ? financial.savings
                : theme.colors.onSurfaceVariant
            }
          >
            {t(`goals.status.${goal.status}`)}
          </StateChip>
        )
      }
      onPress={() => push(`/goal/${goal.id}`)}
    />
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
    gap: SPACING.sm,
    paddingBottom: FAB_CLEARANCE,
  },
  fab: { position: "absolute", right: SPACING.md, bottom: SPACING.md },
});
