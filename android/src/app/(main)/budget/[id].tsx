import { router, useLocalSearchParams } from "expo-router";
import {
  BudgetFormulas,
  type SupportedCurrency,
  type Transaction,
} from "pulpe-shared";
import { useEffect, useMemo, useState } from "react";
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
  FAB,
  Searchbar,
  Snackbar,
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
import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { FAB_CLEARANCE, SCREEN_PADDING, SPACING } from "@/core/ui/theme";
import { tagSummary } from "@/core/tags/tag-selection";
import { useTags } from "@/core/tags/tag-queries";
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
import { BudgetLineRow } from "@/features/budget-details/components/budget-line-row";
import { BudgetLineSheet } from "@/features/budget-details/components/budget-line-sheet";
import { DetailsFilterBar } from "@/features/budget-details/components/details-filter-bar";
import { MonthPager } from "@/features/budget-details/components/month-pager";
import { SavingsWithdrawalSheet } from "@/features/budget-details/savings-withdrawal/components/savings-withdrawal-sheet";
import { TightMonthCard } from "@/features/budget-details/savings-withdrawal/components/tight-month-card";
import {
  dismissWithdrawal,
  isWithdrawalDismissed,
  shouldOfferWithdrawal,
} from "@/features/budget-details/savings-withdrawal/withdrawal-gate";
import { TransactionRow } from "@/features/budget-details/components/transaction-row";
import { TransactionSheet } from "@/features/transactions/components/transaction-sheet";
import { useTransactionRemoval } from "@/features/transactions/use-transaction-removal";
import { RealizedBalanceSheet } from "@/features/current-month/components/realized-balance-sheet";
import { buildCurrentMonthViewModel } from "@/features/current-month/current-month-view-model";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";

const SECTION_TITLES = {
  income: "Revenus",
  saving: "Épargne",
  expense: "Dépenses",
} as const;

/**
 * The month flattened into rows, because a budget grows without bound in two
 * directions at once — envelopes and loose operations — and mounting all of
 * both to show a screenful is what makes an old account open slowly.
 */
type DetailRow =
  | { key: string; kind: "header"; title: string }
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
      title: SECTION_TITLES[section.kind],
    },
    ...section.items.map((item) => ({
      key: item.line.id,
      kind: "line" as const,
      item,
    })),
  ]);

  if (free.length > 0) {
    rows.push({ key: "header-free", kind: "header", title: "Hors prévision" });
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
  // The search bar replaces the app bar, and unlike the app bar it does not
  // inset itself against the status bar.
  const insets = useSafeAreaInsets();
  const settings = useUserSettings();
  const details = useBudgetDetails(id);
  const budgets = useBudgetList();
  const tags = useTags();
  const toggle = useToggleCheck(id);
  const [filters, setFilters] = useState<DetailsFilters>(DEFAULT_FILTERS);
  const [isSearchVisible, setSearchVisible] = useState(false);
  const [isRealizedVisible, setRealizedVisible] = useState(false);
  const [hasToggleFailed, setToggleFailed] = useState(false);
  const [isFabOpen, setFabOpen] = useState(false);
  const [isLineSheetVisible, setLineSheetVisible] = useState(false);
  const [isTransactionSheetVisible, setTransactionSheetVisible] =
    useState(false);
  const [edited, setEdited] = useState<Transaction | null>(null);
  const [isWithdrawalVisible, setWithdrawalVisible] = useState(false);
  const [isCardDismissed, setCardDismissed] = useState(() =>
    isWithdrawalDismissed(id),
  );
  const removal = useTransactionRemoval();
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const isPessimisticTipArmed = useIsTipArmed("pessimistic-check");

  // Back closes the search before it leaves the screen — on Android that is
  // what the button means while any overlay is open, and losing the whole
  // screen because you wanted to stop filtering is a bad trade.
  useEffect(() => {
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
  }, [isSearchVisible]);

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;
  const formatAmount = useMemo(
    () => (value: number) => formatCurrency(value, currency),
    [currency],
  );

  const sections = useMemo(
    () =>
      details.data === undefined
        ? []
        : detailsSections(
            details.data.budgetLines,
            details.data.transactions,
            filters,
            formatAmount,
          ),
    [details.data, filters, formatAmount],
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
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (details.isError || details.data === undefined) {
    return (
      <PlaceholderScreen
        title="On n'a pas pu charger ce budget"
        hint="Vérifie ta connexion, puis réessaie."
        action={{ label: "Réessayer", onPress: () => void details.refetch() }}
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
            placeholder="Rechercher"
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
          <Appbar.Content
            title={formatMonthName(budget.month, budget.year)}
            titleStyle={styles.title}
          />
          <Appbar.Action
            icon="magnify"
            accessibilityLabel="Rechercher"
            onPress={() => setSearchVisible(true)}
          />
        </ScreenAppBar>
      )}

      {months.length > 1 && (
        // Raised, so the list below reads as passing under it. Without the
        // shadow the rail's own bottom edge is where the content is clipped,
        // and a half-cut segmented control there looks like a rendering fault
        // rather than like something that scrolled away.
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
                {row.title}
              </Text>
            );
          }
          if (row.kind === "transaction") {
            return (
              <View style={styles.row}>
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
                  onPress={() => setEdited(row.transaction)}
                  onToggle={() =>
                    toggle.mutate(
                      { source: "transaction", sourceId: row.transaction.id },
                      { onError: () => setToggleFailed(true) },
                    )
                  }
                />
              </View>
            );
          }
          return (
            <View style={styles.row}>
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
                    { onError: () => setToggleFailed(true) },
                  );
                }}
              />
            </View>
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
              ? "Tout est pointé pour ce mois."
              : "Rien ne correspond à ce filtre."}
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
              onPressMetrics={() => setRealizedVisible(true)}
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
                  title="Budget protégé"
                  message="Quand tu dépenses moins que prévu, Pulpe garde le montant prévu pour protéger ton budget."
                />
              </View>
            )}

            {isTight && (
              <View style={styles.gutter}>
                <TightMonthCard
                  onWithdraw={() => setWithdrawalVisible(true)}
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
                title="Deux gestes par ligne"
                message="Touche le rond pour pointer · Touche la ligne pour la modifier"
              />
            </View>
          </View>
        }
      />

      {/* Two things can be added to a month and they are not the same act: a
          forecast plans, an operation records. One FAB, two answers. */}
      <FAB.Group
        open={isFabOpen}
        visible={
          !isLineSheetVisible && !isTransactionSheetVisible && edited === null
        }
        icon={isFabOpen ? "close" : "plus"}
        onStateChange={({ open }) => setFabOpen(open)}
        actions={[
          {
            icon: "calendar-check",
            label: "Une prévision",
            onPress: () => setLineSheetVisible(true),
          },
          {
            icon: "cash",
            label: "Une opération",
            onPress: () => setTransactionSheetVisible(true),
          },
        ]}
        accessibilityLabel="Ajouter"
      />

      <Snackbar
        visible={savedMessage !== null}
        onDismiss={() => setSavedMessage(null)}
      >
        {savedMessage ?? ""}
      </Snackbar>

      <Snackbar
        visible={hasToggleFailed}
        onDismiss={() => setToggleFailed(false)}
        action={{ label: "Fermer", onPress: () => setToggleFailed(false) }}
      >
        Le pointage n&apos;a pas été enregistré. Réessaie.
      </Snackbar>

      <BudgetLineSheet
        isVisible={isLineSheetVisible}
        onDismiss={() => setLineSheetVisible(false)}
        budgetId={id}
        anchor={{ year: budget.year, month: budget.month }}
        currency={currency}
        onSaved={() => {
          setLineSheetVisible(false);
          setSavedMessage("Prévision ajoutée");
        }}
      />

      <TransactionSheet
        isVisible={isTransactionSheetVisible}
        onDismiss={() => setTransactionSheetVisible(false)}
        budgetId={id}
        currency={currency}
        onSaved={() => {
          setTransactionSheetVisible(false);
          setSavedMessage("Opération ajoutée");
        }}
      />

      {edited !== null && (
        <TransactionSheet
          // Keyed on the operation so opening a second one starts from its own
          // values rather than from the first one's.
          key={edited.id}
          isVisible
          onDismiss={() => setEdited(null)}
          budgetId={id}
          currency={currency}
          transaction={edited}
          onSaved={() => {
            setEdited(null);
            setSavedMessage("Opération modifiée");
          }}
          onDelete={() => removal.remove(edited, () => setEdited(null))}
        />
      )}

      <Snackbar
        visible={removal.last !== null}
        onDismiss={removal.forget}
        action={{ label: "Annuler", onPress: removal.undo }}
      >
        {removal.undoable.length === 1
          ? `« ${removal.last?.name} » supprimée`
          : `${removal.undoable.length} opérations supprimées`}
      </Snackbar>

      <Snackbar
        visible={removal.failureMessage !== null}
        onDismiss={removal.dismissFailure}
      >
        {removal.failureMessage}
      </Snackbar>

      <SavingsWithdrawalSheet
        isVisible={isWithdrawalVisible}
        onDismiss={() => setWithdrawalVisible(false)}
        budgetId={id}
        viewedPeriod={{ year: budget.year, month: budget.month }}
        missingAmount={Math.max(0, -metrics.remaining)}
        currency={currency}
        onWithdrawn={() => {
          setWithdrawalVisible(false);
          setSavedMessage("C'est en place");
        }}
      />

      {viewModel !== null && (
        <RealizedBalanceSheet
          isVisible={isRealizedVisible}
          onDismiss={() => setRealizedVisible(false)}
          metrics={viewModel.metrics}
          realized={viewModel.realized}
          currency={currency}
        />
      )}
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
): string | null {
  const previous = budgets.find((budget) => budget.id === previousBudgetId);
  if (previous?.month === undefined || previous.year === undefined) return null;
  return formatMonthName(previous.month, previous.year).toLocaleLowerCase();
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  // No horizontal padding here: the gutter belongs to each block, so that the
  // chip rails inside them can still run the full width of the display.
  // The rhythm is per row rather than a container `gap`, which a virtualised
  // list has no single container to hold.
  content: { paddingVertical: SPACING.md, paddingBottom: FAB_CLEARANCE },
  pager: { elevation: 3, zIndex: 1 },
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
