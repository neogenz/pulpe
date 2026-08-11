import { router, useLocalSearchParams } from "expo-router";
import type { SupportedCurrency } from "pulpe-shared";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Menu,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatIsoDate } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { SPACING } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { GoalContributions } from "@/features/savings-goals/components/goal-contributions";
import { GoalDeletionSheet } from "@/features/savings-goals/components/goal-deletion-sheet";
import { GoalFormSheet } from "@/features/savings-goals/components/goal-form-sheet";
import { GoalGenerationStopSheet } from "@/features/savings-goals/components/goal-generation-stop-sheet";
import { GoalPlanTimeline } from "@/features/savings-goals/components/goal-plan-timeline";
import { GoalProgressCard } from "@/features/savings-goals/components/goal-progress-card";
import { GoalProjectionChart } from "@/features/savings-goals/components/goal-projection-chart";
import { GoalStateCards } from "@/features/savings-goals/components/goal-state-cards";
import { GoalWithdrawals } from "@/features/savings-goals/components/goal-withdrawals";
import {
  useSavingsGoal,
  useSavingsGoalContributions,
  useSavingsGoalFutureLines,
  useSavingsGoalProgress,
  useSavingsGoalWithdrawals,
  useUpdateSavingsGoal,
} from "@/features/savings-goals/goals-queries";
import { projectionSeries } from "@/features/savings-goals/projection-series";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";

/**
 * One goal, and how far along it is. Everything the card shows is computed
 * server-side from the forecasts that fund the goal, so the screen never has to
 * know which budgets those are.
 */
export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const settings = useUserSettings();
  const goal = useSavingsGoal(id);
  const progress = useSavingsGoalProgress(id);
  const contributions = useSavingsGoalContributions(id);
  const withdrawals = useSavingsGoalWithdrawals(id);
  const futureLines = useSavingsGoalFutureLines(id);
  const update = useUpdateSavingsGoal();
  const [isEditVisible, setEditVisible] = useState(false);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [isDeleteVisible, setDeleteVisible] = useState(false);
  const [isStopVisible, setStopVisible] = useState(false);

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;
  const series = useMemo(
    () =>
      progress.data === undefined ? null : projectionSeries(progress.data),
    [progress.data],
  );

  if (goal.isPending || progress.isPending) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (goal.data === undefined) {
    return (
      <PlaceholderScreen
        title="Cet objectif n'existe plus"
        hint="Il a peut-être été supprimé depuis un autre appareil."
        action={{ label: "Revenir", onPress: () => router.back() }}
      />
    );
  }

  const lines = futureLines.data ?? [];

  /**
   * Stopping a goal is one decision; what happens to the forecasts it still
   * holds on months to come is another. Completing only asks the second
   * question when there is something left to decide.
   */
  function complete() {
    update.mutate(
      { goalId: id, changes: { status: "COMPLETED" } },
      { onSuccess: () => setStopVisible(lines.length > 0) },
    );
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header mode="small" elevated={false}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={goal.data.name} />
        <Appbar.Action
          icon="pencil-outline"
          onPress={() => setEditVisible(true)}
          accessibilityLabel="Modifier l'objectif"
        />
        <Menu
          visible={isMenuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              onPress={() => setMenuVisible(true)}
              accessibilityLabel="Plus d'options"
            />
          }
        >
          <Menu.Item
            leadingIcon="delete-outline"
            title="Supprimer l'objectif"
            onPress={() => {
              setMenuVisible(false);
              setDeleteVisible(true);
            }}
          />
        </Menu>
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={progress.isRefetching}
            onRefresh={() => void progress.refetch()}
          />
        }
      >
        {goal.data.targetDate !== null && (
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Échéance {formatIsoDate(goal.data.targetDate)}
          </Text>
        )}

        {progress.data !== undefined && (
          <GoalProgressCard progress={progress.data} currency={currency} />
        )}

        {progress.data !== undefined && (
          <GoalStateCards
            progress={progress.data}
            status={goal.data.status}
            futureLineCount={lines.length}
            isMutating={update.isPending}
            onEdit={() => setEditVisible(true)}
            onComplete={complete}
            onReopen={() =>
              update.mutate({ goalId: id, changes: { status: "ACTIVE" } })
            }
            onManageFutureLines={() => setStopVisible(true)}
          />
        )}

        {/* The trajectory needs a month behind it to be a trajectory. Before
            that it is two axes and a dashed target — decoration that reads as
            a verdict on a goal set this morning. */}
        {series !== null && series.hasConfirmedTrend && (
          <>
            <Text variant="titleMedium">Ta trajectoire</Text>
            <GoalProjectionChart series={series} currency={currency} />
          </>
        )}

        {progress.data !== undefined && (
          <GoalPlanTimeline months={progress.data.months} currency={currency} />
        )}

        {withdrawals.data !== undefined && (
          <GoalWithdrawals
            realized={withdrawals.data.data}
            planned={withdrawals.data.planned}
            planOnly={withdrawals.data.planOnly}
            currency={currency}
          />
        )}

        {contributions.data !== undefined && (
          <GoalContributions
            contributions={contributions.data}
            currency={currency}
          />
        )}
      </ScrollView>

      <GoalFormSheet
        key={goal.data.updatedAt}
        isVisible={isEditVisible}
        onDismiss={() => setEditVisible(false)}
        currency={currency}
        payDayOfMonth={payDayOfMonth}
        goal={goal.data}
        onSaved={() => setEditVisible(false)}
      />

      <GoalGenerationStopSheet
        isVisible={isStopVisible}
        onDismiss={() => setStopVisible(false)}
        goalId={id}
        status={goal.data.status}
        lines={lines}
        currency={currency}
        onApplied={() => setStopVisible(false)}
      />

      <GoalDeletionSheet
        isVisible={isDeleteVisible}
        onDismiss={() => setDeleteVisible(false)}
        goal={goal.data}
        currency={currency}
        onDeleted={() => {
          setDeleteVisible(false);
          router.back();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
});
