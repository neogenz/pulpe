import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import type { SavingsGoal, SupportedCurrency } from "pulpe-shared";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Menu, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "@/core/i18n/locale-store";
import {
  ContentZone,
  HeroAppBar,
  HeroAppBarAction,
  HeroZone,
} from "@/core/ui/hero";
import { Notice } from "@/core/ui/notice";
import { SectionHeader } from "@/core/ui/section-header";
import { useHeroColors } from "@/core/ui/scheme-colors";

import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatIsoDate } from "@/core/ui/date-format";
import { InlineQueryError } from "@/core/ui/inline-query-error";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { RADIUS, SPACING } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
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
  goalKeys,
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
  const hero = useHeroColors();
  const queryClient = useQueryClient();
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
  // A status change that did not happen has to say so: the button only
  // re-enabled, and nothing on the screen moved.
  const [hasStatusFailed, setStatusFailed] = useState(false);
  // Everything on the page, not the progress alone: a pull that left the
  // contributions and withdrawals as they were looked like a refresh and was
  // not one.
  const pull = usePullToRefresh(() =>
    queryClient.invalidateQueries({ queryKey: goalKeys.all }),
  );

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;
  const series = useMemo(
    () =>
      progress.data === undefined ? null : projectionSeries(progress.data),
    [progress.data],
  );

  const pendingBar = <HeroAppBar title="" onBack={() => router.back()} />;

  if (goal.isPending || progress.isPending || settings.isPending) {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("common.loading")}
      >
        {pendingBar}
        <HeroZone>
          <View style={[styles.bone, { backgroundColor: hero.tile }]} />
        </HeroZone>
        <ContentZone>
          <View />
        </ContentZone>
      </View>
    );
  }

  if (goal.isError || progress.isError || settings.isError) {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {pendingBar}
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
      </View>
    );
  }

  if (goal.data === undefined) {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {pendingBar}
        <PlaceholderScreen
          icon="target-variant"
          title={t("goals.detail.missingTitle")}
          hint={t("goals.detail.missingHint")}
          action={{ label: t("common.back"), onPress: () => router.back() }}
        />
      </View>
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
      {
        onSuccess: () => setStopVisible(lines.length > 0),
        onError: () => setStatusFailed(true),
      },
    );
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <HeroAppBar title={goal.data.name} onBack={() => router.back()}>
        <HeroAppBarAction
          icon="pencil-outline"
          onPress={() => setEditVisible(true)}
          disabled={!areFutureLinesReady}
          accessibilityLabel={t("goals.form.editTitle")}
        />
        <Menu
          visible={isMenuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <HeroAppBarAction
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
      </HeroAppBar>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl {...pull} />}
      >
        <HeroZone>
          {progress.data !== undefined && (
            <GoalProgressCard
              progress={progress.data}
              currency={currency}
              period={goalPeriod(goal.data, locale, t)}
            />
          )}
        </HeroZone>

        <ContentZone>
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
                update.mutate(
                  { goalId: id, changes: { status: "ACTIVE" } },
                  { onError: () => setStatusFailed(true) },
                )
              }
              onManageFutureLines={() => setStopVisible(true)}
            />
          )}

          {/* The trajectory needs a month behind it to be a trajectory. Before
            that it is two axes and a dashed target — decoration that reads as
            a verdict on a goal set this morning. */}
          {series !== null && series.hasConfirmedTrend && (
            <View style={styles.section}>
              <SectionHeader title={t("goals.progress.trajectory")} />
              <View
                style={[styles.card, { backgroundColor: theme.colors.surface }]}
              >
                <GoalProjectionChart series={series} currency={currency} />
              </View>
            </View>
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
        </ContentZone>
      </ScrollView>

      <Notice
        visible={hasStatusFailed}
        onDismiss={() => setStatusFailed(false)}
        action={{
          label: t("common.close"),
          onPress: () => setStatusFailed(false),
        }}
      >
        {t("goals.detail.statusError")}
      </Notice>

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

/** The span a goal runs over, or its deadline, or when it started. */
function goalPeriod(
  goal: SavingsGoal,
  locale: string,
  t: ReturnType<typeof useTranslation>["t"],
): string | null {
  if (goal.startDate !== null && goal.targetDate !== null) {
    return `${formatIsoDate(goal.startDate, locale)} → ${formatIsoDate(goal.targetDate, locale)}`;
  }
  if (goal.targetDate !== null) {
    return t("goals.detail.deadline", {
      date: formatIsoDate(goal.targetDate, locale),
    });
  }
  if (goal.startDate !== null) {
    return t("goals.list.since", {
      date: formatIsoDate(goal.startDate, locale),
    });
  }
  return null;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1 },
  section: { gap: SPACING.sm },
  card: { borderRadius: RADIUS.card, padding: SPACING.md },
  bone: { height: 160, borderRadius: RADIUS.sm },
});
