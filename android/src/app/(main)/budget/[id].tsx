import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import Animated, { LinearTransition } from "react-native-reanimated";
import {
  BudgetFormulas,
  type SupportedCurrency,
  type Transaction,
} from "pulpe-shared";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Searchbar,
  Text,
  useTheme,
} from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ScreenAppBar } from "@/core/ui/screen-app-bar";
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
import { budgetsInPeriodOrder } from "@/features/budgets/budget-list-selectors";
import {
  invalidateBudgetData,
  useBudgetDetails,
  useBudgetList,
} from "@/features/budgets/budget-queries";
import { useToggleCheck } from "@/features/budgets/toggle-check-mutation";
import {
  DEFAULT_FILTERS,
  type DetailsFilters,
  detailsSections,
  freeTransactions,
  kindCounts,
  type LineItem,
} from "@/features/budget-details/budget-details-selectors";
import { BudgetDetailHero } from "@/features/budget-details/components/budget-detail-hero";
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
  | { key: string; kind: "header"; titleKey: string }
  | { key: string; kind: "line"; item: LineItem }
  | { key: string; kind: "transaction"; transaction: Transaction };

function detailRows(
  sections: ReturnType<typeof detailsSections>,
  free: Transaction[],
): DetailRow[] {
  const rows: DetailRow[] = sections.flatMap((section) => [
    {
      key: `header-${section.kind}`,
      kind: "header" as const,
      titleKey: `budgets.detail.filters.${section.kind}`,
    },
    ...section.items.map((item) => ({
      key: item.line.id,
      kind: "line" as const,
      item,
    })),
  ]);

  if (free.length > 0) {
    rows.push({
      key: "header-free",
      kind: "header",
      titleKey: "budgets.detail.sections.free",
    });
    for (const transaction of free) {
      rows.push({ key: transaction.id, kind: "transaction", transaction });
    }
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
  const { locale, t } = useTranslation();
  // The search bar replaces the app bar, and unlike the app bar it does not
  // inset itself against the status bar.
  const insets = useSafeAreaInsets();
  const settings = useUserSettings();
  const details = useBudgetDetails(id);
  const budgets = useBudgetList();
  const tags = useTags();
  const toggle = useToggleCheck(id);
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

  if (details.isPending || settings.isPending) {
    return (
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </SafeAreaView>
    );
  }

  if (details.isError || settings.isError) {
    return (
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
    );
  }

  if (details.data === undefined) {
    return (
      <PlaceholderScreen
        icon="calendar-remove-outline"
        title={t("budgets.detail.missingTitle")}
        hint={t("budgets.detail.missingHint")}
        action={{ label: t("common.back"), onPress: () => router.back() }}
      />
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
    budgets.data ?? [],
    locale,
  );
  const rows = detailRows(sections, free);
  const isTight = shouldOfferWithdrawal({
    available: metrics.remaining,
    viewedPeriod: { year: budget.year, month: budget.month },
    payDayOfMonth,
    isDismissed: isCardDismissed,
  });
  const months = budgetsInPeriodOrder(budgets.data ?? []);

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
        <ScreenAppBar>
          <Appbar.BackAction onPress={() => router.back()} />
          {/* The year, whenever the tabs below name the month — otherwise the
              same word is written twice, three centimetres apart. It is also
              the hierarchy the budget list already uses: a year heads a group
              of months. With a single budget there are no tabs, so the app bar
              is the only thing left to say which month this is. */}
          <Appbar.Content
            title={
              months.length > 1
                ? `${budget.year}`
                : formatMonthName(budget.month, budget.year, locale)
            }
            titleStyle={styles.title}
          />
          <Appbar.Action
            icon="magnify"
            accessibilityLabel={t("budgets.detail.search")}
            onPress={() => setSearchVisible(true)}
          />
        </ScreenAppBar>
      )}

      {months.length > 1 && (
        // Opaque and above the list, so the content passes under it rather than
        // through it. The boundary is drawn by the tab row's own divider now,
        // which is what Material puts under a set of tabs — the shadow this
        // carried was standing in for that line.
        <View
          style={[styles.pager, { backgroundColor: theme.colors.background }]}
        >
          <MonthPager
            months={months}
            currentBudgetId={id}
            // Replace rather than push: the rail is one screen the user moves
            // sideways in, not a stack of months to back out of one by one.
            onSelect={(budgetId) => router.replace(`/budget/${budgetId}`)}
          />
        </View>
      )}

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={details.isRefetching}
            onRefresh={() => void invalidateBudgetData()}
          />
        }
        renderItem={({ item: row }) => {
          if (row.kind === "header") {
            return (
              <Text variant="titleSmall" style={styles.sectionTitle}>
                {t(row.titleKey)}
              </Text>
            );
          }
          if (row.kind === "transaction") {
            return (
              // `layout`, never `entering`: pointing a line moves it from "À
              // pointer" to "Pointé", and that is a move, not an arrival — the
              // row exists either way. An `entering` animation would also take
              // the row out of flow while it played, which in this app once
              // left a whole screen drawing over its own chrome.
              <Animated.View
                style={styles.row}
                layout={LinearTransition.duration(DURATION.short)}
              >
                <TransactionRow
                  transaction={row.transaction}
                  currency={currency}
                  isSyncing={
                    toggle.isPending &&
                    toggle.variables?.sourceId === row.transaction.id
                  }
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
                    toggle.mutate(
                      { source: "transaction", sourceId: row.transaction.id },
                      { onError: () => overlays.current?.showToggleFailure() },
                    )
                  }
                />
              </Animated.View>
            );
          }
          return (
            <Animated.View
              style={styles.row}
              layout={LinearTransition.duration(DURATION.short)}
            >
              <BudgetLineRow
                item={row.item}
                currency={currency}
                isSyncing={
                  toggle.isPending &&
                  toggle.variables?.sourceId === row.item.line.id
                }
                tagSummary={tagSummary(
                  row.item.line.tagIds ?? [],
                  tags.data ?? [],
                )}
                onPress={() => {
                  dismissTip("gestures");
                  router.push(`/budget/${id}/line/${row.item.line.id}`);
                }}
                onToggle={() => {
                  dismissTip("gestures");
                  if (isPessimistic(row.item)) armTip("pessimistic-check");
                  toggle.mutate(
                    { source: "budgetLine", sourceId: row.item.line.id },
                    { onError: () => overlays.current?.showToggleFailure() },
                  );
                }}
              />
            </Animated.View>
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
          <View style={styles.header}>
            {/* No gutter here: the hero pays its own, so its pill rail can run
                edge to edge. */}
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
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  // No horizontal padding here: the gutter belongs to each block, so that the
  // chip rails inside them can still run the full width of the display.
  // The rhythm is per row rather than a container `gap`, which a virtualised
  // list has no single container to hold.
  content: { paddingVertical: SPACING.md, paddingBottom: FAB_CLEARANCE },
  pager: { zIndex: 1 },
  header: { gap: SPACING.md, paddingBottom: SPACING.md },
  gutter: { paddingHorizontal: SCREEN_PADDING },
  row: { paddingHorizontal: SCREEN_PADDING, paddingBottom: SPACING.sm },
  title: { textTransform: "capitalize" },
  sectionTitle: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  empty: { paddingVertical: SPACING.lg, textAlign: "center" },
});
