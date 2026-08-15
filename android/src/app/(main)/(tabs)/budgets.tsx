import { router } from "expo-router";
import {
  getBudgetPeriodDates,
  getBudgetPeriodForDate,
  type BudgetSparse,
  type SupportedCurrency,
} from "pulpe-shared";
import { RefreshControl, SectionList, StyleSheet, View } from "react-native";
import { ActivityIndicator, FAB, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { Card } from "@/core/ui/card";
import { Amount } from "@/core/ui/amount";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatSignedCompactCurrency } from "@/core/ui/amount-format";
import { formatDayMonth, formatMonthName } from "@/core/ui/date-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { StatusBadge } from "@/core/ui/status-badge";
import { FAB_CLEARANCE, SPACING } from "@/core/ui/theme";
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

/**
 * Twice the hairline Paper draws around an outlined card, so the month being
 * lived in reads as the same shape drawn harder rather than as a different one.
 */
const CURRENT_MONTH_BORDER = 2;

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
        icon="cloud-off-outline"
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
        icon="calendar-blank-outline"
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
      {/* Sectioned rather than flat: an account two years old is 24 months of
          cards, and mounting all of them to show four is the frame drop the
          list opens on. `SectionList` is the virtualiser that already speaks
          year-then-months, so nothing has to be flattened by hand. */}
      <SectionList
        sections={sections.map((section) => ({
          year: section.year,
          data: section.budgets,
        }))}
        keyExtractor={(budget) => budget.id}
        contentContainerStyle={styles.content}
        // Off by default on Android, on by default on iOS. A year is the one
        // thing a month card never says, so scrolling into 2025 without it
        // leaves twelve "Décembre" with nothing to date them.
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl
            refreshing={budgets.isRefetching}
            onRefresh={() => void invalidateBudgetData()}
          />
        }
        ListHeaderComponent={
          <Text variant="headlineSmall" style={styles.screenTitle}>
            Budgets
          </Text>
        }
        renderSectionHeader={({ section }) => (
          <Text
            variant="titleSmall"
            style={[
              styles.year,
              {
                color: theme.colors.onSurfaceVariant,
                backgroundColor: theme.colors.background,
              },
            ]}
          >
            {section.year}
          </Text>
        )}
        renderItem={({ item: budget }) => (
          <View style={styles.row}>
            <BudgetRow
              budget={budget}
              currency={currency}
              payDayOfMonth={payDayOfMonth}
              timing={budgetTiming(budget, currentPeriod)}
            />
          </View>
        )}
      />

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
      // and ringed, a plan is only outlined, and a month that is over is a flat
      // filled surface. The surface carries it on its own — the 0.72 opacity
      // that used to sit on top took "Résultat" down to 3.64:1, and a month
      // already lived is exactly the one someone re-reads.
      //
      // The ring is what makes "raised" legible. `background` is #F7F6F3 and
      // `surface` is #FFFFFF, so an outlined card is white against warm grey
      // with a crisp edge, while an elevated one is a faint tint under a soft
      // Android shadow — on this background elevation is the *weakest* of the
      // three, and the current month ended up quieter than the plans above it.
      // Drawing its edge in `primary` is the app's own way of saying "this one"
      // (`budget/create.tsx` marks the chosen model the same way), and it does
      // it without tinting a surface: filling the card with `primaryContainer`
      // is what put the loudest colour in the palette on a list row and left
      // the text below on roles resolved for a neutral one.
      mode={isCurrent ? "elevated" : isPast ? "contained" : "outlined"}
      style={
        isCurrent && {
          borderWidth: CURRENT_MONTH_BORDER,
          borderColor: theme.colors.primary,
        }
      }
      onPress={() => router.push(`/budget/${budget.id}`)}
    >
      <Card.Content style={styles.cardRow}>
        <View style={styles.rowLabels}>
          {/* Beside the month, not above it: stacked, the badge pushed "Août"
              off the line every other month name shares with its amount, and a
              list read by scanning down one column cannot afford one row that
              sits lower than the rest. */}
          <View style={styles.monthLine}>
            <Text variant="titleMedium" style={styles.month}>
              {formatMonthName(month, year)}
            </Text>
            {isCurrent && <StatusBadge>Mois actuel</StatusBadge>}
          </View>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {periodLabel(month, year, payDayOfMonth, isPositive)}
          </Text>
        </View>

        <View style={styles.amount}>
          <Amount size="row">
            {formatSignedCompactCurrency(remaining, currency)}
          </Amount>
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
  // Rhythm per row, not a container `gap`: a virtualised list has no single
  // container to hold one.
  content: { padding: SPACING.md, paddingBottom: FAB_CLEARANCE },
  screenTitle: { paddingBottom: SPACING.md },
  // Opaque, because a sticky header scrolls over the cards underneath it.
  year: { paddingTop: SPACING.sm, paddingBottom: SPACING.sm },
  row: { paddingBottom: SPACING.sm },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  rowLabels: { flex: 1, gap: SPACING.xxs },
  monthLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
  month: { textTransform: "capitalize" },
  amount: { alignItems: "flex-end", gap: SPACING.xxs },
  fab: { position: "absolute", right: SPACING.md, bottom: SPACING.md },
});
