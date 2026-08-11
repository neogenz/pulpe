import { router, useLocalSearchParams } from "expo-router";
import {
  BudgetFormulas,
  type SupportedCurrency,
  type Transaction,
} from "pulpe-shared";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  FAB,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { SPACING } from "@/core/ui/theme";
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
} from "@/features/budget-details/budget-details-selectors";
import { BudgetDetailHero } from "@/features/budget-details/components/budget-detail-hero";
import { BudgetLineRow } from "@/features/budget-details/components/budget-line-row";
import { BudgetLineSheet } from "@/features/budget-details/components/budget-line-sheet";
import { DetailsFilterBar } from "@/features/budget-details/components/details-filter-bar";
import { MonthPager } from "@/features/budget-details/components/month-pager";
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

export default function BudgetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const settings = useUserSettings();
  const details = useBudgetDetails(id);
  const budgets = useBudgetList();
  const tags = useTags();
  const toggle = useToggleCheck(id);
  const [filters, setFilters] = useState<DetailsFilters>(DEFAULT_FILTERS);
  const [isRealizedVisible, setRealizedVisible] = useState(false);
  const [hasToggleFailed, setToggleFailed] = useState(false);
  const [isFabOpen, setFabOpen] = useState(false);
  const [isLineSheetVisible, setLineSheetVisible] = useState(false);
  const [isTransactionSheetVisible, setTransactionSheetVisible] =
    useState(false);
  const [edited, setEdited] = useState<Transaction | null>(null);
  const removal = useTransactionRemoval();
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

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
  const isEmpty = sections.length === 0 && free.length === 0;
  const months = budgetsInPeriodOrder(budgets.data ?? []);

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content
          title={formatMonthName(budget.month, budget.year)}
          titleStyle={styles.title}
        />
      </Appbar.Header>

      {months.length > 1 && (
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

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={details.isRefetching}
            onRefresh={() => void invalidateBudgetData()}
          />
        }
      >
        <BudgetDetailHero
          metrics={metrics}
          currency={currency}
          rollover={budget.rollover ?? 0}
          previousMonthName={previousMonthName}
          onPressMetrics={() => setRealizedVisible(true)}
          onPressRollover={
            budget.previousBudgetId == null
              ? undefined
              : // Push, not replace: reading where the carry-over came from is
                // a step back in time the user expects to return from, unlike
                // the pager's sideways moves.
                () => router.push(`/budget/${budget.previousBudgetId}`)
          }
        />

        <DetailsFilterBar
          filters={filters}
          counts={counts}
          onChange={setFilters}
        />

        {sections.map((section) => (
          <View key={section.kind} style={styles.section}>
            <Text variant="titleSmall">{SECTION_TITLES[section.kind]}</Text>
            {section.items.map((item) => (
              <BudgetLineRow
                key={item.line.id}
                item={item}
                currency={currency}
                isSyncing={
                  toggle.isPending &&
                  toggle.variables?.sourceId === item.line.id
                }
                tagSummary={tagSummary(item.line.tagIds ?? [], tags.data ?? [])}
                onPress={() =>
                  router.push(`/budget/${id}/line/${item.line.id}`)
                }
                onToggle={() =>
                  toggle.mutate(
                    { source: "budgetLine", sourceId: item.line.id },
                    { onError: () => setToggleFailed(true) },
                  )
                }
              />
            ))}
          </View>
        ))}

        {free.length > 0 && (
          <View style={styles.section}>
            <Text variant="titleSmall">Hors prévision</Text>
            {free.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                currency={currency}
                isSyncing={
                  toggle.isPending &&
                  toggle.variables?.sourceId === transaction.id
                }
                tagSummary={tagSummary(
                  transaction.tagIds ?? [],
                  tags.data ?? [],
                )}
                onPress={() => setEdited(transaction)}
                onToggle={() =>
                  toggle.mutate(
                    { source: "transaction", sourceId: transaction.id },
                    { onError: () => setToggleFailed(true) },
                  )
                }
              />
            ))}
          </View>
        )}

        {isEmpty && (
          <Text
            variant="bodyMedium"
            style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}
          >
            {filters.checked === "unchecked" && filters.search === ""
              ? "Tout est pointé pour ce mois."
              : "Rien ne correspond à ce filtre."}
          </Text>
        )}
      </ScrollView>

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

      <Snackbar visible={removal.hasFailed} onDismiss={removal.dismissFailure}>
        L&apos;opération n&apos;a pas pu être supprimée. Réessaie.
      </Snackbar>

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
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  title: { textTransform: "capitalize" },
  pager: { paddingHorizontal: SPACING.md },
  section: { gap: SPACING.sm },
  empty: { paddingVertical: SPACING.lg, textAlign: "center" },
});
