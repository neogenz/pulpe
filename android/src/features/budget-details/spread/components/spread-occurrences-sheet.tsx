import {
  type BudgetPeriod,
  getBudgetPeriodForDate,
  type SpreadOccurrenceItem,
  spreadOccurrenceItems,
  spreadTracker,
  type SupportedCurrency,
} from "pulpe-shared";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";

import { Amount } from "@/core/ui/amount";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { Sheet } from "@/core/ui/sheet";
import { RADIUS, SPACING } from "@/core/ui/theme";

import { useSpreadOccurrences } from "../spread-queries";

const PERCENT = 100;

interface SpreadOccurrencesSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  spreadGroupId: string;
  /** The month the sheet was opened from — the one marked in the list. */
  viewedPeriod: BudgetPeriod;
  payDayOfMonth: number | null;
  currency: SupportedCurrency;
}

/**
 * The whole spread, month by month. It answers the question a single tranche
 * cannot: how much of this expense is already behind, and what the months still
 * open have left to carry.
 */
export function SpreadOccurrencesSheet({
  isVisible,
  onDismiss,
  spreadGroupId,
  viewedPeriod,
  payDayOfMonth,
  currency,
}: SpreadOccurrencesSheetProps) {
  const theme = useTheme();
  const occurrences = useSpreadOccurrences(isVisible ? spreadGroupId : null);

  // Past is judged against the month actually being lived in, pay-day aware —
  // reading a spread from an older budget must not turn its own months future.
  const livePeriod = useMemo(
    () => getBudgetPeriodForDate(new Date(), payDayOfMonth),
    [payDayOfMonth],
  );
  const items = useMemo(
    () =>
      spreadOccurrenceItems(occurrences.data ?? [], viewedPeriod, livePeriod),
    [occurrences.data, viewedPeriod, livePeriod],
  );
  const tracker = useMemo(() => spreadTracker(items), [items]);
  const isLivePeriodViewed =
    livePeriod.month === viewedPeriod.month &&
    livePeriod.year === viewedPeriod.year;

  return (
    <Sheet isVisible={isVisible} onDismiss={onDismiss} title="Dépense lissée">
      {occurrences.isPending && (
        <ActivityIndicator accessibilityLabel="Chargement" />
      )}

      {occurrences.isError && (
        <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
          On n&apos;a pas pu charger les mois de cette dépense.
        </Text>
      )}

      {tracker !== null && (
        <View style={styles.tracker}>
          <View style={styles.trackerRow}>
            <Text variant="titleSmall">
              Mois {tracker.currentIndex} sur {tracker.count}
            </Text>
            <Amount size="meta" tone="muted">
              {formatCurrency(tracker.cumulatedAmount, currency)} /{" "}
              {formatCurrency(tracker.totalAmount, currency)}
            </Amount>
          </View>

          <ProgressBar
            progress={tracker.progressPercent / PERCENT}
            style={styles.progress}
          />

          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {tracker.remainingToProvision <= 0
              ? "Objectif atteint"
              : tracker.perRemainingMonth === null
                ? `Il manque ${formatCurrency(tracker.remainingToProvision, currency)}`
                : `Reste ${formatCurrency(tracker.remainingToProvision, currency)} · ${formatCurrency(tracker.perRemainingMonth, currency)} par mois restant`}
          </Text>
        </View>
      )}

      {items.map((item) => (
        <OccurrenceRow
          key={item.occurrence.budgetLineId}
          item={item}
          currency={currency}
          isLivePeriodViewed={isLivePeriodViewed}
        />
      ))}
    </Sheet>
  );
}

function OccurrenceRow({
  item,
  currency,
  isLivePeriodViewed,
}: {
  item: SpreadOccurrenceItem;
  currency: SupportedCurrency;
  isLivePeriodViewed: boolean;
}) {
  const theme = useTheme();
  const { occurrence } = item;
  const hasReal = occurrence.transactionCount > 0;

  return (
    <View style={styles.row}>
      <View style={styles.rowLabels}>
        <Text
          variant="bodyLarge"
          style={[
            styles.month,
            item.isChecked && styles.struck,
            // A past month recedes through its ink, never through the row's
            // opacity: 0.5 over the whole row took its amounts to 2.42:1, the
            // failure `budget-line-row.tsx` already names. The instalments a
            // spread has already paid are exactly what someone opens this sheet
            // to count.
            item.isPast && { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {formatMonthName(occurrence.month, occurrence.year)}
        </Text>
        {item.isViewed && (
          <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
            {isLivePeriodViewed ? "Ce mois" : "Ici"}
          </Text>
        )}
      </View>

      {/* A month with real operations shows what it cost against what it
          planned; the plan alone would read as still open. */}
      {hasReal ? (
        <View style={styles.rowAmounts}>
          <Amount size="row">
            {formatCurrency(occurrence.consumed, currency)}
          </Amount>
          <Amount size="meta" tone="muted">
            / {formatCurrency(occurrence.amount, currency)}
          </Amount>
        </View>
      ) : (
        <Amount size="row">
          {formatCurrency(occurrence.amount, currency)}
        </Amount>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tracker: { gap: SPACING.xs },
  trackerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  progress: { height: SPACING.sm, borderRadius: RADIUS.full },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  rowLabels: { flex: 1, gap: SPACING.xxs },
  rowAmounts: { flexDirection: "row", alignItems: "baseline", gap: SPACING.xs },
  month: { textTransform: "capitalize" },
  struck: { textDecorationLine: "line-through" },
});
