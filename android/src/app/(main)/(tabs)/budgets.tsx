import { router } from "expo-router";
import {
  getBudgetPeriodDates,
  getBudgetPeriodForDate,
  type BudgetSparse,
  type SupportedCurrency,
} from "pulpe-shared";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Card,
  FAB,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatSignedCompactCurrency } from "@/core/ui/amount-format";
import { formatDayMonth, formatMonthName } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { FAB_CLEARANCE, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";
import {
  type BudgetTiming,
  budgetTiming,
  budgetYearSections,
} from "@/features/budgets/budget-list-selectors";
import {
  invalidateBudgetData,
  useBudgetList,
} from "@/features/budgets/budget-queries";
import { monthSubtitle } from "@/features/budgets/month-subtitle";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";

/** Below this, the period is the calendar month and printing its dates says nothing. */
const CALENDAR_PAY_DAY = 1;

export default function BudgetsScreen() {
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const theme = useTheme();
  const settings = useUserSettings();
  const budgets = useBudgetList();

  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;
  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;

  if (budgets.isPending || settings.isPending) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (budgets.isError) {
    return (
      <PlaceholderScreen
        title="On n'a pas pu charger tes budgets"
        hint="Vérifie ta connexion, puis réessaie."
        action={{
          label: "Réessayer",
          onPress: () => void invalidateBudgetData(),
        }}
      />
    );
  }

  const sections = budgetYearSections(budgets.data ?? []);

  if (sections.length === 0) {
    return (
      <PlaceholderScreen
        title="Aucun budget pour l'instant"
        hint="Crée ton premier mois depuis un de tes modèles."
        action={{
          label: "Créer mon budget",
          onPress: () => router.push("/budget/create"),
        }}
      />
    );
  }

  const currentPeriod = getBudgetPeriodForDate(new Date(), payDayOfMonth);

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={budgets.isRefetching}
            onRefresh={() => void invalidateBudgetData()}
          />
        }
      >
        <Text variant="headlineSmall">Budgets</Text>

        {sections.map((section) => (
          <View key={section.year} style={styles.section}>
            <Text
              variant="titleSmall"
              style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
            >
              {section.year}
            </Text>
            {section.budgets.map((budget) => (
              <BudgetRow
                key={budget.id}
                budget={budget}
                currency={currency}
                payDayOfMonth={payDayOfMonth}
                timing={budgetTiming(budget, currentPeriod)}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push("/budget/create")}
        accessibilityLabel="Créer un budget"
      />
    </SafeAreaView>
  );
}

/**
 * A month, what it leaves, and — only when the pay cycle is not the calendar —
 * the dates it actually spans. On a pay day of 1 that range restates the month
 * name, and the encouragement iOS prints there says more.
 */
function BudgetRow({
  budget,
  currency,
  payDayOfMonth,
  timing,
}: {
  budget: BudgetSparse;
  currency: SupportedCurrency;
  payDayOfMonth: number | null;
  timing: BudgetTiming;
}) {
  const theme = useTheme();
  const month = budget.month ?? 1;
  const year = budget.year ?? new Date().getFullYear();
  const remaining = budget.remaining ?? 0;
  const isPositive = remaining >= 0;
  const isCurrent = timing === "current";
  const isPast = timing === "past";

  return (
    <Card
      // Three weights for three meanings: the month being lived in is raised
      // and tinted, a plan is only outlined, and a month that is over keeps the
      // flat surface but steps back in contrast.
      mode={isCurrent ? "elevated" : isPast ? "contained" : "outlined"}
      style={[
        isCurrent && { backgroundColor: theme.colors.primaryContainer },
        isPast && styles.past,
      ]}
      onPress={() => router.push(`/budget/${budget.id}`)}
    >
      <Card.Content style={styles.row}>
        <View style={styles.rowLabels}>
          {isCurrent && (
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onPrimaryContainer }}
            >
              Mois actuel
            </Text>
          )}
          <Text variant="titleMedium" style={styles.month}>
            {formatMonthName(month, year)}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {periodLabel(month, year, payDayOfMonth, isPositive)}
          </Text>
        </View>

        <View style={styles.amount}>
          <Text variant="titleMedium" style={TABULAR_DIGITS}>
            {formatSignedCompactCurrency(remaining, currency)}
          </Text>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {/* A month that is over settled at this figure; the two other
                tenses are still describing something that has not happened. */}
            {isPast ? "Résultat" : isPositive ? "Potentiel" : "Ajustement"}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

function periodLabel(
  month: number,
  year: number,
  payDayOfMonth: number | null,
  isPositive: boolean,
): string {
  if (payDayOfMonth === null || payDayOfMonth <= CALENDAR_PAY_DAY) {
    return monthSubtitle(month, isPositive);
  }
  const { startDate, endDate } = getBudgetPeriodDates(
    month,
    year,
    payDayOfMonth,
  );
  return `${formatDayMonth(startDate)} – ${formatDayMonth(endDate)}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: {
    padding: SPACING.md,
    gap: SPACING.md,
    paddingBottom: FAB_CLEARANCE,
  },
  section: { gap: SPACING.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  rowLabels: { flex: 1, gap: SPACING.xxs },
  month: { textTransform: "capitalize" },
  /** A settled month is still readable, but stops competing with the live one. */
  past: { opacity: 0.72 },
  amount: { alignItems: "flex-end", gap: SPACING.xxs },
  fab: { position: "absolute", right: SPACING.md, bottom: SPACING.md },
});
