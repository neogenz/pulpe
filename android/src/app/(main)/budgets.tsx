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
import { formatSignedCompactCurrency } from "@/core/ui/amount-format";
import { formatDayMonth, formatMonthName } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { SPACING, TABULAR_DIGITS } from "@/core/ui/theme";
import { budgetYearSections } from "@/features/budgets/budget-list-selectors";
import {
  invalidateBudgetData,
  useBudgetList,
} from "@/features/budgets/budget-queries";
import { monthSubtitle } from "@/features/budgets/month-subtitle";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";

/** Below this, the period is the calendar month and printing its dates says nothing. */
const CALENDAR_PAY_DAY = 1;

export default function BudgetsScreen() {
  const theme = useTheme();
  const settings = useUserSettings();
  const budgets = useBudgetList();

  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;
  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;

  if (budgets.isPending || settings.isPending) {
    return (
      <SafeAreaView
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
          onPress: () => router.push("/budget/create-next"),
        }}
      />
    );
  }

  const currentPeriod = getBudgetPeriodForDate(new Date(), payDayOfMonth);

  return (
    <SafeAreaView
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
                isCurrent={
                  budget.month === currentPeriod.month &&
                  budget.year === currentPeriod.year
                }
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push("/budget/create-next")}
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
  isCurrent,
}: {
  budget: BudgetSparse;
  currency: SupportedCurrency;
  payDayOfMonth: number | null;
  isCurrent: boolean;
}) {
  const theme = useTheme();
  const month = budget.month ?? 1;
  const year = budget.year ?? new Date().getFullYear();
  const remaining = budget.remaining ?? 0;
  const isPositive = remaining >= 0;

  return (
    <Card mode="contained">
      <Card.Content style={styles.row}>
        <View style={styles.rowLabels}>
          {isCurrent && (
            <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
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
            {isPositive ? "Potentiel" : "Ajustement"}
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
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  section: { gap: SPACING.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  rowLabels: { flex: 1, gap: SPACING.xxs },
  month: { textTransform: "capitalize" },
  amount: { alignItems: "flex-end", gap: SPACING.xxs },
  fab: { position: "absolute", right: SPACING.md, bottom: SPACING.md },
});
