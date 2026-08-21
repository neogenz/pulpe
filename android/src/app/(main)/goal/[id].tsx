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

import { ScreenAppBar } from "@/core/ui/screen-app-bar";
import { useTranslation } from "@/core/i18n/locale-store";

import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatIsoDate } from "@/core/ui/date-format";
import { InlineQueryError } from "@/core/ui/inline-query-error";
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
import { GoalPlanSimulatorSheet } from "@/features/savings-goals/components/simulator/goal-plan-simulator-sheet";
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
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { locale, t } = useTranslation();
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
  const [isSimulatorVisible, setSimulatorVisible] = useState(false);

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;
  const series = useMemo(
    () =>
      progress.data === undefined ? null : projectionSeries(progress.data),
    [progress.data],
  );

  if (goal.isPending || progress.isPending || settings.isPending) {
    return (
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </SafeAreaView>
    );
  }

  if (goal.isError || progress.isError || settings.isError) {
    return (
      <PlaceholderScreen
        icon="cloud-off-outline"
        title={t("goals.detail.loadErrorTitle")}
        hint={t("common.loadErrorHint")}
        action={{
          label: t("common.retry"),
          onPress: () =>
            void Promise.all([
              goal.refetch(),
              progress.refetch(),
              settings.refetch(),
            ]),
        }}
      />
    );
  }

  if (goal.data === undefined) {
    return (
      <PlaceholderScreen
        icon="target-variant"
        title={t("goals.detail.missingTitle")}
        hint={t("goals.detail.missingHint")}
        action={{ label: t("common.back"), onPress: () => router.back() }}
      />
    );
  }

  const lines = futureLines.data ?? [];
  const areFutureLinesReady =
    futureLines.data !== undefined && !futureLines.isError;

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
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={goal.data.name} />
        <Appbar.Action
          icon="pencil-outline"
          onPress={() => setEditVisible(true)}
          disabled={!areFutureLinesReady}
          accessibilityLabel={t("goals.form.editTitle")}
        />
        <Menu
          visible={isMenuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              onPress={() => setMenuVisible(true)}
              accessibilityLabel={t("common.moreOptions")}
            />
          }
        >
          <Menu.Item
            leadingIcon="delete-outline"
            title={t("goals.detail.delete")}
            onPress={() => {
              setMenuVisible(false);
              setDeleteVisible(true);
            }}
          />
        </Menu>
      </ScreenAppBar>

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
            {t("goals.detail.deadline", {
              date: formatIsoDate(goal.data.targetDate, locale),
            })}
          </Text>
        )}

        {progress.data !== undefined && (
          <GoalProgressCard progress={progress.data} currency={currency} />
        )}

        {futureLines.isError && (
          <InlineQueryError
            message={t("goals.detail.futureLinesError")}
            onRetry={() => void futureLines.refetch()}
          />
        )}

        {progress.data !== undefined && areFutureLinesReady && (
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
            <Text variant="titleMedium">{t("goals.progress.trajectory")}</Text>
            <GoalProjectionChart series={series} currency={currency} />
          </>
        )}

        {progress.data !== undefined && (
          <GoalPlanTimeline
            months={progress.data.months}
            currency={currency}
            onAdjust={
              goal.data.status === "ACTIVE" && areFutureLinesReady
                ? () => setSimulatorVisible(true)
                : undefined
            }
          />
        )}

        {withdrawals.data !== undefined && (
          <GoalWithdrawals
            realized={withdrawals.data.data}
            planned={withdrawals.data.planned}
            planOnly={withdrawals.data.planOnly}
            currency={currency}
          />
        )}

        {withdrawals.isError && (
          <InlineQueryError
            message={t("goals.withdrawals.loadError")}
            onRetry={() => void withdrawals.refetch()}
          />
        )}

        {contributions.data !== undefined && (
          <GoalContributions
            contributions={contributions.data}
            currency={currency}
          />
        )}

        {contributions.isError && (
          <InlineQueryError
            message={t("goals.contributions.loadError")}
            onRetry={() => void contributions.refetch()}
          />
        )}
      </ScrollView>

      <GoalFormSheet
        key={goal.data.updatedAt}
        isVisible={isEditVisible && areFutureLinesReady}
        onDismiss={() => setEditVisible(false)}
        currency={currency}
        payDayOfMonth={payDayOfMonth}
        goal={goal.data}
        onSaved={() => setEditVisible(false)}
      />

      {progress.data !== undefined && areFutureLinesReady && (
        <GoalPlanSimulatorSheet
          isVisible={isSimulatorVisible}
          onDismiss={() => setSimulatorVisible(false)}
          goalId={id}
          progress={progress.data}
          currency={currency}
          onApplied={() => setSimulatorVisible(false)}
        />
      )}

      {areFutureLinesReady && (
        <GoalGenerationStopSheet
          isVisible={isStopVisible}
          onDismiss={() => setStopVisible(false)}
          goalId={id}
          status={goal.data.status}
          lines={lines}
          currency={currency}
          onApplied={() => setStopVisible(false)}
        />
      )}

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
