import {
  type BudgetPeriod,
  getBudgetPeriodForDate,
  type SupportedCurrency,
} from "pulpe-shared";
import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Modal,
  Portal,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";

import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { RADIUS, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

import {
  type SpreadOccurrenceItem,
  spreadOccurrenceItems,
  spreadTracker,
} from "../spread-progress";
import { useSpreadOccurrences } from "../spread-queries";

const PERCENT = 100;
/** How far a month that can no longer move steps back. */
const PAST_OPACITY = 0.5;

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
    <Portal>
      <Modal
        visible={isVisible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.sheet,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="titleMedium">Dépense lissée</Text>

          {occurrences.isPending && <ActivityIndicator />}

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
                <Text
                  variant="labelLarge"
                  style={[
                    TABULAR_DIGITS,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {formatCurrency(tracker.cumulatedAmount, currency)} /{" "}
                  {formatCurrency(tracker.totalAmount, currency)}
                </Text>
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
        </ScrollView>
      </Modal>
    </Portal>
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
    <View style={[styles.row, item.isPast && styles.past]}>
      <View style={styles.rowLabels}>
        <Text
          variant="bodyLarge"
          style={[styles.month, item.isChecked && styles.struck]}
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
          <Text variant="titleMedium" style={TABULAR_DIGITS}>
            {formatCurrency(occurrence.consumed, currency)}
          </Text>
          <Text
            variant="labelSmall"
            style={[TABULAR_DIGITS, { color: theme.colors.outline }]}
          >
            / {formatCurrency(occurrence.amount, currency)}
          </Text>
        </View>
      ) : (
        <Text variant="titleMedium" style={TABULAR_DIGITS}>
          {formatCurrency(occurrence.amount, currency)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    maxHeight: "88%",
  },
  content: { padding: SPACING.lg, gap: SPACING.md },
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
  past: { opacity: PAST_OPACITY },
  rowLabels: { flex: 1, gap: SPACING.xxs },
  rowAmounts: { flexDirection: "row", alignItems: "baseline", gap: SPACING.xs },
  month: { textTransform: "capitalize" },
  struck: { textDecorationLine: "line-through" },
});
