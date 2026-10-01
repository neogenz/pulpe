import { router } from "expo-router";
import { getBudgetPeriodDates } from "pulpe-shared";
import { useRef, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Button, useTheme } from "react-native-paper";

import { usePushOnce } from "@/core/navigation/push-once";
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
import { ActionButton } from "@/core/ui/action-button";
import {
  ContentZone,
  HeroAppBar,
  HeroAppBarAction,
  HeroZone,
} from "@/core/ui/hero";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { useHeroColors } from "@/core/ui/scheme-colors";
import { SPACING } from "@/core/ui/theme";
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
  // One slot for every piece of news, latest wins: three snackbars sharing the
  // same spot drew over each other, and the "Annuler" of a pointing vanished
  // under the "Ajouté" of the operation noted right after it. A failure names
  // its step — a pointing that never reached the server and an undo that did
  // not go back are two different pieces of news.
  const [notice, setNotice] = useState<HomeNotice | null>(null);
  const scroll = useRef<ScrollView>(null);
  const [checkingY, setCheckingY] = useState({ zone: 0, section: 0 });
  const hero = useHeroColors();
  const push = usePushOnce();
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
  // The account lives in the bar, in every state: an empty or failed month
  // used to drop the header with it, and with it the only way to the
  // settings — sign out, pay day, the very setting that can empty a month.
  const header = (
    <HeroAppBar
      title={monthName.charAt(0).toLocaleUpperCase(locale) + monthName.slice(1)}
    >
      <HeroAppBarAction
        testID="home-account"
        icon="account-circle-outline"
        onPress={() => push("/settings")}
        accessibilityLabel={t("home.accountAccessibility")}
      />
    </HeroAppBar>
  );

  if (currentMonth.status === "loading") {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {header}
        <ScrollView contentContainerStyle={styles.scroll}>
          <HeroZone>
            <HomeHeroSkeleton />
          </HeroZone>
          <ContentZone>
            <View />
          </ContentZone>
        </ScrollView>
      </View>
    );
  }

  if (currentMonth.status === "failed") {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {header}
        <PlaceholderScreen
          icon="cloud-off-outline"
          title={t("home.states.loadErrorTitle")}
          hint={t("home.states.loadErrorHint")}
          action={{
            label: t("common.retry"),
            onPress: () => void currentMonth.refresh(),
          }}
        />
      </View>
    );
  }

  if (currentMonth.status === "empty" || currentMonth.viewModel === null) {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {header}
        <PlaceholderScreen
          icon="calendar-blank-outline"
          title={t("home.states.emptyTitle")}
          hint={t("home.states.emptyHint")}
          action={{
            label: t("home.states.createBudget"),
            onPress: () => router.push("/budget/create"),
          }}
        />
      </View>
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
  function noticeMessage(current: HomeNotice | null): string {
    switch (current?.kind) {
      case "pointed":
        return t("home.checking.pointed", { name: current.item.name });
      case "failure":
        return t(`home.checking.${current.step}Failure`);
      case "added":
        return t("home.activity.added");
      default:
        return "";
    }
  }

  function noticeAction(current: HomeNotice | null) {
    if (current?.kind === "pointed") {
      return {
        label: t("common.cancel"),
        onPress: () => {
          setNotice(null);
          void toggle
            .mutateAsync(current.item)
            .catch(() => setNotice({ kind: "failure", step: "undo" }));
        },
      };
    }
    if (current?.kind === "failure") {
      return { label: t("common.close"), onPress: () => setNotice(null) };
    }
    return undefined;
  }

  // Closing has to answer both openers, or a deep-linked sheet reopens itself.
  function closeAdd() {
    setAddOpen(false);
    consumeAddExpenseRequest();
  }

  const openBudget =
    currentMonth.budgetId === null
      ? undefined
      : () => push(`/budget/${currentMonth.budgetId}`);

  return (
    // The app bar carries the status bar inset; asking the safe area for the
    // top edge too would double it.
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      {header}
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={currentMonth.isRefreshing}
            onRefresh={() => void currentMonth.refresh()}
            colors={[hero.surface]}
            progressBackgroundColor={hero.ink}
          />
        }
      >
        <HeroZone>
          <HomeHeroCard
            presentation={presentation}
            trajectory={viewModel.trajectory}
            period={period}
            monthName={monthName}
            uncheckedCount={viewModel.uncheckedCount}
            daysRemaining={viewModel.daysRemaining}
            currency={currency}
            onPressUnchecked={() =>
              scroll.current?.scrollTo({
                y: checkingY.zone + checkingY.section - SPACING.md,
                animated: true,
              })
            }
            onPressMetrics={() => setRealizedVisible(true)}
            onPressDetail={openBudget}
          />
        </HeroZone>

        <ContentZone
          onLayout={(event) => {
            const zone = event.nativeEvent.layout.y;
            setCheckingY((current) =>
              current.zone === zone ? current : { ...current, zone },
            );
          }}
        >
          {/* The one filled action under the hero. Recording an operation is
              what the app is opened for, so it is a labelled action the eye
              reads in place, not a floating button covering the last row. */}
          <ActionButton
            testID="home-add-entry"
            icon="plus"
            onPress={() => setAddOpen(true)}
            accessibilityLabel={t("home.addAccessibility")}
          >
            {t("home.add")}
          </ActionButton>

          {viewModel.uncheckedItems.length > 0 && (
            <View
              style={styles.checking}
              onLayout={(event) => {
                const section = event.nativeEvent.layout.y;
                setCheckingY((current) =>
                  current.section === section
                    ? current
                    : { ...current, section },
                );
              }}
            >
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
                onViewAll={openBudget}
                onToggle={(item) => {
                  // Doing it explains it better than the card ever could.
                  dismissTip("checking");
                  // Per call: `mutate`'s callbacks belong to the latest call
                  // alone, so pointing two operations quickly lost the first
                  // one's answer — its failure said nothing.
                  void toggle.mutateAsync(item).then(
                    // Offered here and nowhere else: a reminder to point is
                    // worth something only to someone who has just found out
                    // what pointing does.
                    () => {
                      hapticSuccess();
                      setNotice({ kind: "pointed", item });
                      reminders.offer();
                    },
                    () => {
                      hapticFailure();
                      setNotice({ kind: "failure", step: "point" });
                    },
                  );
                }}
              />
            </View>
          )}

          {viewModel.driftLines.length > 0 ? (
            <DriftCard
              drifts={viewModel.driftLines}
              totalOver={viewModel.driftTotal}
              absorbsOverrun={presentation.absorbsEnvelopeOverrun}
              currency={currency}
              onCatchUp={openBudget}
            />
          ) : (
            viewModel.savings.isComplete && (
              <SavingsDoneCard
                amount={viewModel.savings.totalRealized}
                currency={currency}
                onPress={() => push("/goals")}
              />
            )
          )}

          <ActivityCard
            transactions={currentMonth.details?.transactions ?? []}
            currency={currency}
            onPressAll={openBudget}
          />

          {hasMonthToPrepare && (
            <Button
              mode="text"
              icon="chevron-right"
              onPress={() => router.push("/budget/create")}
              contentStyle={styles.prepareContent}
              style={styles.prepare}
            >
              {t("home.prepareNextMonth")}
            </Button>
          )}
        </ContentZone>
      </ScrollView>

      {/* The server flips whatever state it holds, so taking the pointing back
          is the very same call a second time. */}
      <Notice
        visible={notice !== null}
        onDismiss={() => setNotice(null)}
        action={noticeAction(notice)}
      >
        {noticeMessage(notice)}
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
            setNotice({ kind: "added" });
          }}
        />
      )}
    </View>
  );
}

type HomeNotice =
  | { kind: "pointed"; item: CheckableItem }
  | { kind: "failure"; step: "point" | "undo" }
  | { kind: "added" };

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1 },
  checking: { gap: SPACING.md },
  prepare: { alignSelf: "center" },
  // The chevron follows the label: it points at the screen the tap opens.
  prepareContent: { flexDirection: "row-reverse" },
});
