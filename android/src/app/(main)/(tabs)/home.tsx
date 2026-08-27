import { router } from "expo-router";
import { getBudgetPeriodDates } from "pulpe-shared";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { FAB, IconButton, Text, useTheme } from "react-native-paper";

import {
  consumeAddExpenseRequest,
  useDeepLinkStore,
} from "@/core/linking/deep-links";
import { useReminderPriming } from "@/core/notifications/use-reminder-priming";
import { dismissTip } from "@/core/tips/tips-store";
import { Tooltip } from "@/core/tips/tooltip";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatMonthName } from "@/core/ui/date-format";
import { hapticFailure, hapticSuccess } from "@/core/ui/haptics";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { TabHeader } from "@/core/ui/tab-header";
import { FAB_CLEARANCE, SPACING } from "@/core/ui/theme";
import { Notice } from "@/core/ui/notice";
import { useTranslation } from "@/core/i18n/locale-store";
import { useBudgetList } from "@/features/budgets/budget-queries";
import { hasAvailableMonth } from "@/features/budgets/available-months";
import { ActivityCard } from "@/features/current-month/components/activity-card";
import { TransactionSheet } from "@/features/transactions/components/transaction-sheet";
import { DriftCard } from "@/features/current-month/components/drift-card";
import { HomeHeroCard } from "@/features/current-month/components/home-hero-card";
import { HomeHeroSkeleton } from "@/features/current-month/components/home-hero-skeleton";
import { NotificationPrimeSheet } from "@/features/current-month/components/notification-prime-sheet";
import { RealizedBalanceSheet } from "@/features/current-month/components/realized-balance-sheet";
import { SavingsDoneCard } from "@/features/current-month/components/savings-done-card";
import { UncheckedOperationsCard } from "@/features/current-month/components/unchecked-operations-card";
import { useCurrentMonth } from "@/features/current-month/current-month-queries";
import type { CheckableItem } from "@/features/current-month/current-month-view-model";
import { heroPresentation } from "@/features/current-month/home-hero-presentation";
import { useToggleCheck } from "@/features/budgets/toggle-check-mutation";

export default function HomeScreen() {
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const currentMonth = useCurrentMonth();
  const [isRealizedVisible, setRealizedVisible] = useState(false);
  const [isAddOpen, setAddOpen] = useState(false);
  // `pulpe://add-expense` lands here rather than on a route of its own: the
  // sheet is the add-expense surface, and it belongs to this screen.
  const isAddRequested = useDeepLinkStore(
    (state) => state.isAddExpenseRequested,
  );
  const isAddVisible = isAddOpen || isAddRequested;
  // Names the step that failed: a pointing that never reached the server and an
  // undo that did not go back are two different pieces of news.
  const [toggleFailure, setToggleFailure] = useState<"point" | "undo" | null>(
    null,
  );
  const [pointed, setPointed] = useState<CheckableItem | null>(null);
  const [hasTransactionAdded, setTransactionAdded] = useState(false);
  // A rolled-back row reappearing is not an explanation, so the failure is said
  // out loud — and so is the success, because the row leaves the card either
  // way and the way back has to be offered while it is still obvious.
  const toggle = useToggleCheck(currentMonth.budgetId);
  const reminders = useReminderPriming();
  // Same cached query the current month resolves against, so this costs nothing
  // extra — it only asks a different question of it.
  const budgets = useBudgetList();
  const hasMonthToPrepare =
    budgets.data !== undefined &&
    hasAvailableMonth(budgets.data, new Date(), currentMonth.payDayOfMonth);

  // The calendar month while the details are still on their way, so the app
  // bar does not change its title once they land on the same month.
  const month = currentMonth.details?.budget.month ?? new Date().getMonth() + 1;
  const year = currentMonth.details?.budget.year ?? new Date().getFullYear();
  const monthName = formatMonthName(month, year, locale);
  const period = getBudgetPeriodDates(month, year, currentMonth.payDayOfMonth);
  const header = (
    <TabHeader
      title={monthName.charAt(0).toLocaleUpperCase(locale) + monthName.slice(1)}
      trailing={
        <IconButton
          testID="home-account"
          icon="account-circle-outline"
          onPress={() => router.push("/settings")}
          accessibilityLabel={t("home.accountAccessibility")}
        />
      }
    />
  );

  if (currentMonth.status === "loading") {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {header}
        <View style={styles.content}>
          <HomeHeroSkeleton />
        </View>
      </View>
    );
  }

  if (currentMonth.status === "failed") {
    return (
      <PlaceholderScreen
        icon="cloud-off-outline"
        title={t("home.states.loadErrorTitle")}
        hint={t("home.states.loadErrorHint")}
        action={{
          label: t("common.retry"),
          onPress: () => void currentMonth.refresh(),
        }}
      />
    );
  }

  if (currentMonth.status === "empty" || currentMonth.viewModel === null) {
    return (
      <PlaceholderScreen
        icon="calendar-blank-outline"
        title={t("home.states.emptyTitle")}
        hint={t("home.states.emptyHint")}
        action={{
          label: t("home.states.createBudget"),
          onPress: () => router.push("/budget/create"),
        }}
      />
    );
  }

  const { viewModel, currency } = currentMonth;
  // One verdict for the whole screen: the hero states it, the drift card reads
  // it to say whether the overrun was covered elsewhere.
  const presentation = heroPresentation({
    estimatedBalance: viewModel.metrics.remaining,
    fallbackPlannedBalance: viewModel.metrics.endingBalance,
    trajectory: viewModel.trajectory,
  });
  // Closing has to answer both openers, or a deep-linked sheet reopens itself.
  function closeAdd() {
    setAddOpen(false);
    consumeAddExpenseRequest();
  }

  return (
    // The app bar carries the status bar inset; asking the safe area for the
    // top edge too would double it.
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={currentMonth.isRefreshing}
            onRefresh={() => void currentMonth.refresh()}
          />
        }
      >
        <HomeHeroCard
          presentation={presentation}
          trajectory={viewModel.trajectory}
          period={period}
          monthName={monthName}
          uncheckedCount={viewModel.uncheckedCount}
          currency={currency}
          onPressMetrics={() => setRealizedVisible(true)}
          onPressDetail={
            currentMonth.budgetId === null
              ? undefined
              : () => router.push(`/budget/${currentMonth.budgetId}`)
          }
          onPrepareNextMonth={
            hasMonthToPrepare ? () => router.push("/budget/create") : undefined
          }
        />

        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("home.periodRemaining", { count: viewModel.daysRemaining })}
        </Text>

        {viewModel.uncheckedItems.length > 0 && (
          <>
            <Tooltip
              id="checking"
              icon="check-circle-outline"
              title={t("home.checking.tooltipTitle")}
              message={t("home.checking.tooltipMessage")}
            />
            <UncheckedOperationsCard
              items={viewModel.uncheckedItems}
              currency={currency}
              isSyncing={toggle.isPending}
              onToggle={(item) => {
                // Doing it explains it better than the card ever could.
                dismissTip("checking");
                toggle.mutate(item, {
                  onError: () => {
                    hapticFailure();
                    setToggleFailure("point");
                  },
                  // Offered here and nowhere else: a reminder to point is worth
                  // something only to someone who has just found out what
                  // pointing does.
                  onSuccess: () => {
                    hapticSuccess();
                    setPointed(item);
                    reminders.offer();
                  },
                });
              }}
            />
          </>
        )}

        {viewModel.driftLines.length > 0 ? (
          <DriftCard
            drifts={viewModel.driftLines}
            totalOver={viewModel.driftTotal}
            absorbsOverrun={presentation.absorbsEnvelopeOverrun}
            currency={currency}
          />
        ) : (
          viewModel.savings.isComplete && (
            <SavingsDoneCard
              amount={viewModel.savings.totalRealized}
              currency={currency}
              onPress={() => router.push("/goals")}
            />
          )
        )}

        <ActivityCard
          transactions={currentMonth.details?.transactions ?? []}
          currency={currency}
          onPressAll={
            currentMonth.budgetId === null
              ? undefined
              : () => router.push(`/budget/${currentMonth.budgetId}`)
          }
        />
      </ScrollView>

      {/* Hidden while a sheet is up: the FAB floats above the Portal's scrim
          and would otherwise sit on top of the form it just opened. */}
      {!isAddVisible && !isRealizedVisible && !reminders.isVisible && (
        <FAB
          testID="home-add-entry"
          icon="plus"
          label={t("home.add")}
          style={styles.fab}
          onPress={() => setAddOpen(true)}
          accessibilityLabel={t("home.addAccessibility")}
        />
      )}

      {/* The server flips whatever state it holds, so taking the pointing back
          is the very same call a second time. */}
      <Notice
        clearsFab
        visible={pointed !== null}
        onDismiss={() => setPointed(null)}
        action={{
          label: t("common.cancel"),
          onPress: () => {
            const item = pointed;
            setPointed(null);
            if (item === null) return;
            toggle.mutate(item, {
              onError: () => setToggleFailure("undo"),
            });
          },
        }}
      >
        {pointed === null
          ? ""
          : t("home.checking.pointed", { name: pointed.name })}
      </Notice>

      <Notice
        clearsFab
        visible={toggleFailure !== null}
        onDismiss={() => setToggleFailure(null)}
        action={{
          label: t("common.close"),
          onPress: () => setToggleFailure(null),
        }}
      >
        {toggleFailure === null
          ? ""
          : t(`home.checking.${toggleFailure}Failure`)}
      </Notice>

      <Notice
        clearsFab
        visible={hasTransactionAdded}
        onDismiss={() => setTransactionAdded(false)}
      >
        {t("home.activity.added")}
      </Notice>

      <RealizedBalanceSheet
        isVisible={isRealizedVisible}
        onDismiss={() => setRealizedVisible(false)}
        metrics={viewModel.metrics}
        realized={viewModel.realized}
        currency={currency}
      />

      <NotificationPrimeSheet
        isVisible={reminders.isVisible}
        onDismiss={reminders.dismiss}
        onEnable={reminders.enable}
      />

      {currentMonth.budgetId !== null && (
        <TransactionSheet
          isVisible={isAddVisible}
          onDismiss={closeAdd}
          budgetId={currentMonth.budgetId}
          currency={currency}
          onSaved={() => {
            closeAdd();
            setTransactionAdded(true);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: SPACING.md,
    gap: SPACING.md,
    paddingBottom: FAB_CLEARANCE,
  },
  fab: { position: "absolute", right: SPACING.md, bottom: SPACING.md },
});
