import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { isContributivePlanMonth, type SupportedCurrency } from "pulpe-shared";
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
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { InlineQueryError } from "@/core/ui/inline-query-error";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { RADIUS, SPACING } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
import { GoalDeletionSheet } from "@/features/savings-goals/components/goal-deletion-sheet";
import { GoalFormSheet } from "@/features/savings-goals/components/goal-form-sheet";
import { GoalGenerationStopSheet } from "@/features/savings-goals/components/goal-generation-stop-sheet";
import { GoalThisMonth } from "@/features/savings-goals/components/goal-this-month";
import { GoalUpcoming } from "@/features/savings-goals/components/goal-upcoming";
import { GoalProgressCard } from "@/features/savings-goals/components/goal-progress-card";
import { GoalProjectionChart } from "@/features/savings-goals/components/goal-projection-chart";
import { GoalStateCards } from "@/features/savings-goals/components/goal-state-cards";
import { GoalPlanApplyRecap } from "@/features/savings-goals/components/simulator/goal-plan-apply-recap";
import { GoalPlanSimulatorSheet } from "@/features/savings-goals/components/simulator/goal-plan-simulator-sheet";
import {
  goalKeys,
  useSavingsGoal,
  useSavingsGoalFutureLines,
  useSavingsGoalProgress,
  useApplySavingsGoalPlan,
  useSavingsGoalWithdrawals,
  useUpdateSavingsGoal,
} from "@/features/savings-goals/goals-queries";
import {
  goalHero,
  goalHistory,
  historySummary,
  monthRuns,
  planTitle,
  repairTitle,
  thisMonth,
  upcomingItems,
} from "@/features/savings-goals/goal-presentation";
import {
  buildPlanApply,
  canRepairPlan,
  repairChanges,
} from "@/features/savings-goals/plan-simulator";
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
  const withdrawals = useSavingsGoalWithdrawals(id);
  const futureLines = useSavingsGoalFutureLines(id);
  const update = useUpdateSavingsGoal();
  const repair = useApplySavingsGoalPlan();
  const [isEditVisible, setEditVisible] = useState(false);
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [isDeleteVisible, setDeleteVisible] = useState(false);
  const [isStopVisible, setStopVisible] = useState(false);
  const [isSimulatorVisible, setSimulatorVisible] = useState(false);
  const [isRepairVisible, setRepairVisible] = useState(false);
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

  if (
    (goal.isError && goal.data === undefined) ||
    (progress.isError && progress.data === undefined) ||
    (settings.isError && settings.data === undefined)
  ) {
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

  /** Pausing asks the same second question as completing. */
  function pause() {
    update.mutate(
      { goalId: id, changes: { status: "PAUSED" } },
      {
        onSuccess: () => setStopVisible(lines.length > 0),
        onError: () => setStatusFailed(true),
      },
    );
  }

  function resume() {
    update.mutate(
      { goalId: id, changes: { status: "ACTIVE" } },
      { onError: () => setStatusFailed(true) },
    );
  }

  const words = { t, locale, currency };
  const status = goal.data.status;
  const runs = monthRuns(progress.data?.months ?? [], words);
  const nextPlanTitle = planTitle(runs, words);
  const canAdjust =
    progress.data !== undefined &&
    areFutureLinesReady &&
    status === "ACTIVE" &&
    progress.data.linkedLineCount > 0 &&
    progress.data.months.some(isContributivePlanMonth);
  const canRepair =
    progress.data !== undefined &&
    nextPlanTitle !== null &&
    canRepairPlan(progress.data);
  let plan = null;
  if (progress.data !== undefined && canAdjust) {
    plan = {
      title: nextPlanTitle ?? t("goals.detail.plan.adjust"),
      explainsChoice: nextPlanTitle !== null,
      onPress: () => setSimulatorVisible(true),
    };
  } else if (progress.data !== undefined && canRepair) {
    plan = {
      title: repairTitle(progress.data.months, words) ?? nextPlanTitle,
      explainsChoice: true,
      onPress: () => setRepairVisible(true),
    };
  }
  const summary =
    progress.data === undefined ? null : goalHero(progress.data, status, words);
  const history =
    progress.data === undefined
      ? null
      : goalHistory(progress.data, withdrawals.data?.data ?? [], payDayOfMonth);

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <HeroAppBar title={goal.data.name} onBack={() => router.back()}>
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
            leadingIcon="pencil-outline"
            title={t("goals.form.editTitle")}
            disabled={!areFutureLinesReady}
            onPress={() => {
              setMenuVisible(false);
              setEditVisible(true);
            }}
          />
          {status !== "COMPLETED" && (
            <Menu.Item
              leadingIcon={status === "ACTIVE" ? "pause" : "play"}
              title={t(
                status === "ACTIVE"
                  ? "goals.detail.menu.pause"
                  : "goals.detail.menu.resume",
              )}
              disabled={update.isPending}
              onPress={() => {
                setMenuVisible(false);
                if (status === "ACTIVE") pause();
                else resume();
              }}
            />
          )}
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
              status={status}
              currency={currency}
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

          {series !== null && series.hasDrawableLine && (
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
            <GoalThisMonth
              month={thisMonth(progress.data.months, status, words)}
              sentence={
                status === "ACTIVE" ? (summary?.sentence ?? null) : null
              }
              plan={plan}
            />
          )}

          {progress.data !== undefined && (
            <GoalUpcoming
              items={upcomingItems(
                runs,
                withdrawals.data?.planned ?? [],
                withdrawals.data?.planOnly ?? [],
                words,
              )}
              currency={currency}
              hasWithdrawalsFailed={withdrawals.isError}
              onRetry={() => void withdrawals.refetch()}
            />
          )}

          {history !== null && history.months.length > 0 && (
            <LedgerCard>
              <LedgerRow
                title={t("goals.detail.history")}
                subtitle={historySummary(history, words)}
                onPress={() => router.push(`/goal/${id}/history`)}
              />
            </LedgerCard>
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

      {progress.data !== undefined && (
        <GoalPlanApplyRecap
          isVisible={isRepairVisible}
          onDismiss={() => {
            repair.reset();
            setRepairVisible(false);
          }}
          changes={repairChanges(progress.data)}
          currency={currency}
          isApplying={repair.isPending}
          hasFailed={repair.isError}
          onConfirm={() => {
            const planToApply = buildPlanApply(repairChanges(progress.data));
            if (planToApply === null) return;
            repair.mutate(
              { goalId: id, plan: planToApply },
              { onSuccess: () => setRepairVisible(false) },
            );
          }}
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
  scroll: { flexGrow: 1 },
  section: { gap: SPACING.sm },
  card: { borderRadius: RADIUS.card, padding: SPACING.md },
  bone: { height: 160, borderRadius: RADIUS.sm },
});
