import type { SupportedCurrency } from "pulpe-shared";
import { ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import { Divider, Modal, Portal, Text, useTheme } from "react-native-paper";

import {
  formatCompactCurrency,
  formatSignedCompactCurrency,
} from "@/core/ui/amount-format";
import {
  FINANCIAL_COLORS,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
} from "@/core/ui/theme";

import type {
  CurrentMonthViewModel,
  RealizedMetrics,
} from "../current-month-view-model";

const SEGMENT_COUNT = 10;
const SEGMENT_HEIGHT = 8;
const BAR_HEIGHT = 6;
const PERCENT = 100;
const MAX_PERCENT_SHOWN = 999;

interface RealizedBalanceSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  metrics: CurrentMonthViewModel["metrics"];
  realized: RealizedMetrics;
  currency: SupportedCurrency;
}

/**
 * What the month has actually done, as against what it planned. The headline is
 * the balance the user can compare against their bank app — which is the whole
 * point of pointing operations, and what the tip at the bottom says out loud.
 */
export function RealizedBalanceSheet({
  isVisible,
  onDismiss,
  metrics,
  realized,
  currency,
}: RealizedBalanceSheetProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const financial = FINANCIAL_COLORS[scheme];
  const isPositive = realized.realizedBalance >= 0;
  const statusColor = isPositive ? financial.savings : financial.overBudget;

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
          <Text variant="titleMedium">Suivi du budget</Text>

          <View style={styles.balanceBlock}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Solde à date
            </Text>
            <Text
              variant="displaySmall"
              style={[
                TABULAR_DIGITS,
                { color: isPositive ? theme.colors.onSurface : statusColor },
              ]}
            >
              {formatSignedCompactCurrency(realized.realizedBalance, currency)}
            </Text>
            <Text variant="bodySmall" style={{ color: statusColor }}>
              {isPositive
                ? "Tout va bien"
                : "Solde négatif — on y remédie ensemble ?"}
            </Text>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <View style={styles.row}>
              <Text variant="labelLarge">Pointage</Text>
              <Text
                variant="labelLarge"
                style={[TABULAR_DIGITS, { color: statusColor }]}
              >
                {`${realized.checkedItemsCount} / ${realized.totalItemsCount}`}
              </Text>
            </View>
            <CompletionBar
              checked={realized.checkedItemsCount}
              total={realized.totalItemsCount}
              color={statusColor}
              trackColor={theme.colors.outlineVariant}
            />
          </View>

          <Text variant="titleSmall">Prévu vs réalisé</Text>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <CategoryRow
              label="Revenu"
              realized={realized.realizedIncome}
              planned={metrics.totalIncome}
              color={financial.income}
              trackColor={theme.colors.outlineVariant}
              currency={currency}
            />
            <Divider />
            <CategoryRow
              label="Dépense"
              realized={realized.realizedSpending}
              planned={metrics.totalExpenses - metrics.totalSavings}
              color={financial.expense}
              trackColor={theme.colors.outlineVariant}
              currency={currency}
            />
            <Divider />
            <CategoryRow
              label="Épargne"
              realized={realized.realizedSavings}
              planned={metrics.totalSavings}
              color={financial.savings}
              trackColor={theme.colors.outlineVariant}
              currency={currency}
            />
          </View>

          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Compare ce solde avec ton compte bancaire. S&apos;il y a un écart,
            vérifie que toutes tes dépenses sont bien pointées.
          </Text>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

/** Ten segments rather than a continuous bar: pointing is counted, not poured. */
function CompletionBar({
  checked,
  total,
  color,
  trackColor,
}: {
  checked: number;
  total: number;
  color: string;
  trackColor: string;
}) {
  const filled = total > 0 ? Math.floor((checked / total) * SEGMENT_COUNT) : 0;

  return (
    <View style={styles.segments}>
      {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
        <View
          key={index}
          style={[
            styles.segment,
            { backgroundColor: index < filled ? color : trackColor },
          ]}
        />
      ))}
    </View>
  );
}

function CategoryRow({
  label,
  realized,
  planned,
  color,
  trackColor,
  currency,
}: {
  label: string;
  realized: number;
  planned: number;
  color: string;
  trackColor: string;
  currency: SupportedCurrency;
}) {
  const ratio = planned > 0 ? Math.min(realized / planned, 1) : 0;
  const percent =
    planned > 0
      ? Math.min(Math.round((realized / planned) * PERCENT), MAX_PERCENT_SHOWN)
      : 0;

  return (
    <View style={styles.category}>
      <View style={styles.row}>
        <Text variant="bodyMedium">{label}</Text>
        <Text variant="bodySmall" style={TABULAR_DIGITS}>
          {`${formatCompactCurrency(realized, currency)} / ${formatCompactCurrency(planned, currency)}`}
        </Text>
      </View>
      <View style={styles.row}>
        <View style={[styles.track, { backgroundColor: trackColor }]}>
          <View
            style={[
              styles.fill,
              { backgroundColor: color, width: `${ratio * PERCENT}%` },
            ]}
          />
        </View>
        <Text variant="labelSmall" style={[TABULAR_DIGITS, styles.percent]}>
          {`${percent}%`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    maxHeight: "85%",
  },
  content: { padding: SPACING.lg, gap: SPACING.lg },
  balanceBlock: { alignItems: "center", gap: SPACING.xs },
  card: { borderRadius: RADIUS.card, padding: SPACING.md, gap: SPACING.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  segments: { flexDirection: "row", gap: SPACING.xs },
  segment: { flex: 1, height: SEGMENT_HEIGHT, borderRadius: RADIUS.xs },
  category: { gap: SPACING.sm, paddingVertical: SPACING.sm },
  track: {
    flex: 1,
    flexDirection: "row",
    height: BAR_HEIGHT,
    borderRadius: RADIUS.xs,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: RADIUS.xs },
  percent: { minWidth: 40, textAlign: "right" },
});
