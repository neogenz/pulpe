import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import Animated, { LinearTransition } from "react-native-reanimated";
import {
  BudgetFormulas,
  type SupportedCurrency,
  type Transaction,
} from "pulpe-shared";
import { useCallback, useMemo, useRef, useState } from "react";
import { BackHandler, RefreshControl, StyleSheet, View } from "react-native";
import { Searchbar, Text, useTheme } from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { usePushOnce } from "@/core/navigation/push-once";
import {
  ContentZone,
  HeroAppBar,
  HeroAppBarAction,
  HeroZone,
} from "@/core/ui/hero";
import { LedgerSegment } from "@/core/ui/ledger";
import { SectionHeader } from "@/core/ui/section-header";
import { useHeroColors } from "@/core/ui/scheme-colors";
import { armTip, dismissTip, useIsTipArmed } from "@/core/tips/tips-store";
import { Tooltip } from "@/core/tips/tooltip";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { useTranslation } from "@/core/i18n/locale-store";
import { formatMonthName } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import {
  DURATION,
  FAB_CLEARANCE,
  SCREEN_PADDING,
  SPACING,
} from "@/core/ui/theme";
import { tagSummary } from "@/features/tags/tag-selection";
import { useTags } from "@/features/tags/tag-queries";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { usePullToRefresh } from "@/core/ui/pull-to-refresh";
import { budgetsInPeriodOrder } from "@/features/budgets/budget-list-selectors";
import {
  invalidateBudgetData,
  useBudgetDetails,
  useBudgetPeriods,
} from "@/features/budgets/budget-queries";
import {
  usePendingCheck,
  useToggleCheck,
} from "@/features/budgets/toggle-check-mutation";
import {
  DEFAULT_FILTERS,
  type DetailsFilters,
  detailsSections,
  freeTransactions,
  kindCounts,
  type LineItem,
} from "@/features/budget-details/budget-details-selectors";
import {
  BudgetDetailHero,
  BudgetDetailSkeleton,
} from "@/features/budget-details/components/budget-detail-hero";
import {
  BudgetDetailOverlays,
  type BudgetDetailOverlaysHandle,
} from "@/features/budget-details/components/budget-detail-overlays";
import { BudgetLineRow } from "@/features/budget-details/components/budget-line-row";
import { DetailsFilterBar } from "@/features/budget-details/components/details-filter-bar";
import { MonthPager } from "@/features/budget-details/components/month-pager";
import { TightMonthCard } from "@/features/budget-details/savings-withdrawal/components/tight-month-card";
import {
  dismissWithdrawal,
  isWithdrawalDismissed,
  shouldOfferWithdrawal,
} from "@/features/budget-details/savings-withdrawal/withdrawal-gate";
import { TransactionRow } from "@/features/budget-details/components/transaction-row";
import { buildCurrentMonthViewModel } from "@/features/current-month/current-month-view-model";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";

/**
 * The month flattened into rows, because a budget grows without bound in two
 * directions at once — envelopes and loose operations — and mounting all of
 * both to show a screenful is what makes an old account open slowly.
 */
type DetailRow =
  | { key: string; kind: "header"; titleKey: string; count: number }
  | ({ key: string; kind: "line"; item: LineItem } & SegmentPosition)
  | ({
      key: string;
      kind: "transaction";
      transaction: Transaction;
    } & SegmentPosition);

/** Where a row falls in its section's card: which corners it carries. */
interface SegmentPosition {
  isFirst: boolean;
  isLast: boolean;
}

function position(index: number, count: number): SegmentPosition {
  return { isFirst: index === 0, isLast: index === count - 1 };
}

function detailRows(
  sections: ReturnType<typeof detailsSections>,
  free: Transaction[],
): DetailRow[] {
  const rows: DetailRow[] = sections.flatMap((section) => [
    {
      key: `header-${section.kind}`,
      kind: "header" as const,
      titleKey: `budgets.detail.filters.${section.kind}`,
      count: section.items.length,
    },
    ...section.items.map((item, index) => ({
      key: item.line.id,
      kind: "line" as const,
      item,
      ...position(index, section.items.length),
    })),
  ]);

  if (free.length > 0) {
    rows.push({
      key: "header-free",
      kind: "header",
      titleKey: "budgets.detail.sections.free",
      count: free.length,
    });
    free.forEach((transaction, index) => {
      rows.push({
        key: transaction.id,
        kind: "transaction",
        transaction,
        ...position(index, free.length),
      });
    });
  }

  return rows;
}

/**
 * Pointing an outflow that absorbed less than it planned: the moment the
 * "budget protégé" rule becomes visible, because the envelope keeps its planned
 * amount instead of shrinking to what was spent.
 */
function isPessimistic(item: LineItem): boolean {
  return (
    !item.isChecked &&
    item.line.kind !== "income" &&
    item.consumption.allocated > 0 &&
    item.line.amount > item.consumption.allocated
  );
}

export default function BudgetDetailScreen() {
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const hero = useHeroColors();
  const push = usePushOnce();
  const { locale, t } = useTranslation();
  // The search bar replaces the app bar, and unlike the app bar it does not
  // inset itself against the status bar.
  const insets = useSafeAreaInsets();
  const settings = useUserSettings();
  const details = useBudgetDetails(id);
  const viewedBudget = details.data?.budget;
  const budgetPeriods = useBudgetPeriods(viewedBudget?.year ?? null);
  const boundaryPeriods = useBudgetPeriods(
    viewedBudget === undefined
      ? null
      : viewedBudget.month === 1
        ? viewedBudget.year - 1
        : viewedBudget.month === 12
          ? viewedBudget.year + 1
          : null,
  );
  const tags = useTags();
  const toggle = useToggleCheck(id);
  const isPendingCheck = usePendingCheck(id);
  const pull = usePullToRefresh(invalidateBudgetData);
  const overlays = useRef<BudgetDetailOverlaysHandle>(null);
  const [filters, setFilters] = useState<DetailsFilters>(DEFAULT_FILTERS);
  const [isSearchVisible, setSearchVisible] = useState(false);
  const [isCardDismissed, setCardDismissed] = useState(() =>
    isWithdrawalDismissed(id),
  );
  const isPessimisticTipArmed = useIsTipArmed("pessimistic-check");

  // Back closes the search before it leaves the screen — on Android that is
  // what the button means while any overlay is open, and losing the whole
  // screen because you wanted to stop filtering is a bad trade.
  //
  // `useFocusEffect`, not `useEffect`: handlers are a global LIFO stack, and
  // this one answers `true`. Left subscribed while a filtered row pushes the
  // line detail, it ate the back press meant for that child screen — the exit
  // this app has, since predictive back is off.
  useFocusEffect(
    useCallback(() => {
      if (!isSearchVisible) return;
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          setFilters((current) => ({ ...current, search: "" }));
          setSearchVisible(false);
          return true;
        },
      );
      return () => subscription.remove();
    }, [isSearchVisible]),
  );

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;
  const sections = useMemo(
    () =>
      details.data === undefined
        ? []
        : detailsSections(
            details.data.budgetLines,
            details.data.transactions,
            filters,
          ),
    [details.data, filters],
  );
  const free = useMemo(
    () =>
      details.data === undefined
        ? []
        : freeTransactions(details.data.transactions, filters),
    [details.data, filters],
  );
  const counts = useMemo(
    () =>
      details.data === undefined
        ? { all: 0, income: 0, saving: 0, expense: 0 }
        : kindCounts(details.data.budgetLines, filters.checked),
    [details.data, filters.checked],
  );
  // The dashboard's own view model, reused whole: the realized sheet asks the
  // same question of any budget, not only of the month being lived in.
  const viewModel = useMemo(
    () =>
      details.data === undefined
        ? null
        : buildCurrentMonthViewModel(details.data, {
            now: new Date(),
            payDayOfMonth,
          }),
    [details.data, payDayOfMonth],
  );

  // The forest bar is there from the first frame, whatever the data says: the
  // screen does not change colour under the user's thumb when it lands.
  const pendingBar = <HeroAppBar title="" onBack={() => router.back()} />;

  if (details.isPending || settings.isPending) {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {pendingBar}
        <HeroZone>
          <BudgetDetailSkeleton />
        </HeroZone>
        <ContentZone>
          <View />
        </ContentZone>
      </View>
    );
  }

  if (details.isError || settings.isError) {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {pendingBar}
        <PlaceholderScreen
          icon="cloud-off-outline"
          title={t("budgets.detail.loadErrorTitle")}
          hint={t("budgets.detail.loadErrorHint")}
          action={{
            label: t("common.retry"),
            onPress: () =>
              void Promise.all([details.refetch(), settings.refetch()]),
          }}
        />
      </View>
    );
  }

  if (details.data === undefined) {
    return (
      <View
        style={[styles.screen, { backgroundColor: theme.colors.background }]}
      >
        {pendingBar}
        <PlaceholderScreen
          icon="calendar-remove-outline"
          title={t("budgets.detail.missingTitle")}
          hint={t("budgets.detail.missingHint")}
          action={{ label: t("common.back"), onPress: () => router.back() }}
        />
      </View>
    );
  }

  const { budget } = details.data;
  const metrics = BudgetFormulas.calculateAllMetrics(
    details.data.budgetLines,
    details.data.transactions,
    budget.rollover ?? 0,
  );
  const previousMonthName = namePreviousMonth(
    budget.previousBudgetId ?? null,
    [...(budgetPeriods.data ?? []), ...(boundaryPeriods.data ?? [])],
    locale,
  );
  const rows = detailRows(sections, free);
  const isTight = shouldOfferWithdrawal({
    available: metrics.remaining,
    viewedPeriod: { year: budget.year, month: budget.month },
    payDayOfMonth,
    isDismissed: isCardDismissed,
  });
  const months = budgetsInPeriodOrder([
    ...(budgetPeriods.data ?? []),
    ...(boundaryPeriods.data ?? []),
  ]);

  // The month and its year, whatever the rail under the bar says: the rail
  // scrolls, and the bar is what still names the page once it has.
  const monthName = formatMonthName(budget.month, budget.year, locale);
  const monthTitle = `${monthName.charAt(0).toLocaleUpperCase(locale)}${monthName.slice(1)} ${budget.year}`;

  // Leaving the search puts the whole list back: a term left behind would keep
  // filtering it from a field the user can no longer see.
  function closeSearch() {
    setFilters({ ...filters, search: "" });
    setSearchVisible(false);
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      {/* Searching takes over the app bar rather than adding a row under it:
          that is where Android has always put it, and the row version pushed
          the first line of data off the bottom of the screen. */}
      {isSearchVisible ? (
        <View style={{ paddingTop: insets.top }}>
          <Searchbar
            mode="view"
            autoFocus
            placeholder={t("budgets.detail.search")}
            value={filters.search}
            onChangeText={(search) => setFilters({ ...filters, search })}
            icon="arrow-left"
            onIconPress={closeSearch}
            // Clearing the field is not leaving the search — only the arrow is,
            // and it is the one that puts the full list back.
            onClearIconPress={() => setFilters({ ...filters, search: "" })}
          />
        </View>
      ) : (
        <HeroAppBar title={monthTitle} onBack={() => router.back()}>
          <HeroAppBarAction
            icon="magnify"
            accessibilityLabel={t("budgets.detail.search")}
            onPress={() => setSearchVisible(true)}
          />
          <HeroAppBarAction
            icon="chart-donut"
            accessibilityLabel={t("budgets.detail.tracking")}
            onPress={() => overlays.current?.showRealizedBalance()}
          />
        </HeroAppBar>
      )}

      {months.length > 1 && (
        // Opaque and above the list, so the content passes under it rather than
        // through it: the forest of the bar, extended by one row of tabs.
        <View style={styles.pager}>
          <MonthPager
            months={months}
            currentBudgetId={id}
            // Replace rather than push: the rail is one screen the user moves
            // sideways in, not a stack of months to back out of one by one.
            onSelect={(budgetId) => router.replace(`/budget/${budgetId}`)}
          />
        </View>
      )}

      <Animated.FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        // On the cells, where the list places them: pointing a line moves it
        // from "À pointer" to "Pointé", and that move is what animates. A
        // `layout` on a view inside a row never fired — within its own cell
        // the row does not move. `layout`, never `entering`: the row exists
        // either way, and an `entering` animation takes it out of flow while it
        // plays, which in this app once left a whole screen drawing over its
        // own chrome.
        itemLayoutAnimation={LinearTransition.duration(DURATION.short)}
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            {...pull}
            colors={[hero.surface]}
            progressBackgroundColor={hero.ink}
          />
        }
        renderItem={({ item: row }) => {
          if (row.kind === "header") {
            return (
              <View style={styles.sectionHeader}>
                <SectionHeader title={t(row.titleKey)} count={row.count} />
              </View>
            );
          }
          if (row.kind === "transaction") {
            return (
              <LedgerSegment isFirst={row.isFirst} isLast={row.isLast}>
                <TransactionRow
                  transaction={row.transaction}
                  currency={currency}
                  isSyncing={isPendingCheck({
                    source: "transaction",
                    sourceId: row.transaction.id,
                  })}
                  tagSummary={tagSummary(
                    row.transaction.tagIds ?? [],
                    tags.data ?? [],
                  )}
                  onPress={() =>
                    overlays.current?.editTransaction(row.transaction)
                  }
                  onLongPress={(anchor) =>
                    overlays.current?.showTransactionMenu(
                      row.transaction,
                      anchor,
                    )
                  }
                  onToggle={() =>
                    void toggle
                      .mutateAsync({
                        source: "transaction",
                        sourceId: row.transaction.id,
                      })
                      .catch(() => overlays.current?.showToggleFailure())
                  }
                />
              </LedgerSegment>
            );
          }
          return (
            <LedgerSegment isFirst={row.isFirst} isLast={row.isLast}>
              <BudgetLineRow
                item={row.item}
                currency={currency}
                isSyncing={isPendingCheck({
                  source: "budgetLine",
                  sourceId: row.item.line.id,
                })}
                tagSummary={tagSummary(
                  row.item.line.tagIds ?? [],
                  tags.data ?? [],
                )}
                onPress={() => {
                  dismissTip("gestures");
                  push(`/budget/${id}/line/${row.item.line.id}`);
                }}
                onToggle={() => {
                  dismissTip("gestures");
                  if (isPessimistic(row.item)) armTip("pessimistic-check");
                  void toggle
                    .mutateAsync({
                      source: "budgetLine",
                      sourceId: row.item.line.id,
                    })
                    // Per call: `mutate`'s callbacks belong to the latest call alone,
                    // so a failure on a row pointed just before another went unsaid.
                    .catch(() => overlays.current?.showToggleFailure());
                }}
              />
            </LedgerSegment>
          );
        }}
        ListEmptyComponent={
          <Text
            variant="bodyMedium"
            style={[
              styles.empty,
              styles.gutter,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {filters.checked === "unchecked" && filters.search === ""
              ? t("budgets.detail.allChecked")
              : t("budgets.detail.noResults")}
          </Text>
        }
        ListHeaderComponent={
          <View>
            <HeroZone>
              <BudgetDetailHero
                metrics={metrics}
                currency={currency}
                rollover={budget.rollover ?? 0}
                previousMonthName={previousMonthName}
                onPressMetrics={() => overlays.current?.showRealizedBalance()}
                onPressRollover={
                  budget.previousBudgetId == null
                    ? undefined
                    : // Push, not replace: reading where the carry-over came from
                      // is a step back in time the user expects to return from,
                      // unlike the pager's sideways moves.
                      () => router.push(`/budget/${budget.previousBudgetId}`)
                }
              />
            </HeroZone>

            <ContentZone style={styles.zone}>
              {/* Only after the user has actually pointed an envelope for less
                than it planned — before that it answers a question nobody
                asked. */}
              {isPessimisticTipArmed && (
                <View style={styles.gutter}>
                  <Tooltip
                    id="pessimistic-check"
                    icon="shield-check-outline"
                    title={t("budgets.detail.protectedTitle")}
                    message={t("budgets.detail.protectedMessage")}
                  />
                </View>
              )}

              {isTight && (
                <View style={styles.gutter}>
                  <TightMonthCard
                    onWithdraw={() => overlays.current?.showWithdrawal()}
                    onDismiss={() => {
                      dismissWithdrawal(id);
                      setCardDismissed(true);
                    }}
                  />
                </View>
              )}

              <DetailsFilterBar
                filters={filters}
                counts={counts}
                onChange={setFilters}
              />

              <View style={styles.gutter}>
                <Tooltip
                  id="gestures"
                  icon="gesture-tap"
                  title={t("budgets.detail.gesturesTitle")}
                  message={t("budgets.detail.gesturesMessage")}
                />
              </View>
            </ContentZone>
          </View>
        }
      />

      <BudgetDetailOverlays
        ref={overlays}
        budgetId={id}
        period={{ year: budget.year, month: budget.month }}
        currency={currency}
        missingAmount={Math.max(0, -metrics.remaining)}
        viewModel={viewModel}
      />
    </SafeAreaView>
  );
}

/**
 * The carry-over disclosure names the month it came from when that budget is
 * in the list, and stays generic when it is not — the list is capped by nothing
 * today, but a budget older than the account's first one would still be absent.
 */
function namePreviousMonth(
  previousBudgetId: string | null,
  budgets: { id: string; month?: number; year?: number }[],
  locale: string,
): string | null {
  const previous = budgets.find((budget) => budget.id === previousBudgetId);
  if (previous?.month === undefined || previous.year === undefined) return null;
  return formatMonthName(previous.month, previous.year, locale);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The rhythm is per row rather than a container `gap`, which a virtualised
  // list has no single container to hold.
  content: { flexGrow: 1, paddingBottom: FAB_CLEARANCE },
  pager: { zIndex: 1 },
  // No horizontal padding on the zone: the gutter belongs to each block, so
  // that the chip rail inside it can still run the full width of the display.
  zone: { paddingHorizontal: 0, paddingBottom: 0, gap: SPACING.md },
  gutter: { paddingHorizontal: SCREEN_PADDING },
  sectionHeader: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  empty: { paddingVertical: SPACING.lg, textAlign: "center" },
});
