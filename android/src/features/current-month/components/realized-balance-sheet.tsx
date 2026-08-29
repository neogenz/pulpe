import type { SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import {
  formatCompactCurrency,
  formatSignedCompactCurrency,
} from "@/core/ui/amount-format";
import { Amount } from "@/core/ui/amount";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { FormModal } from "@/core/ui/sheet";
import { RADIUS, SPACING } from "@/core/ui/theme";

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
  const { t } = useTranslation();
  const theme = useTheme();
  const financial = useFinancialColors();
  const isPositive = realized.realizedBalance >= 0;
  const statusColor = isPositive ? financial.savings : financial.overBudget;

  return (
    <FormModal
      isVisible={isVisible}
      onDismiss={onDismiss}
      title={t("home.realized.title")}
    >
      <View style={styles.balanceBlock}>
        <Text
          variant="bodyMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("home.realized.balanceToDate")}
        </Text>
        <Amount
          size="hero"
          style={{ color: isPositive ? theme.colors.onSurface : statusColor }}
        >
          {formatSignedCompactCurrency(realized.realizedBalance, currency)}
        </Amount>
        <Text variant="bodySmall" style={{ color: statusColor }}>
          {t(
            isPositive
              ? "home.realized.positiveStatus"
              : "home.realized.negativeStatus",
          )}
        </Text>
      </View>

      <View
        style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
      >
        <View style={styles.row}>
          <Text variant="labelLarge">{t("home.realized.checking")}</Text>
          <Amount size="meta" style={{ color: statusColor }}>
            {`${realized.checkedItemsCount} / ${realized.totalItemsCount}`}
          </Amount>
        </View>
        <CompletionBar
          checked={realized.checkedItemsCount}
          total={realized.totalItemsCount}
          color={statusColor}
          trackColor={theme.colors.outlineVariant}
        />
      </View>

      <Text variant="titleSmall">{t("home.realized.plannedVsActual")}</Text>
      <View
        style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
      >
        <CategoryRow
          label={t("home.realized.income")}
          realized={realized.realizedIncome}
          planned={metrics.totalIncome}
          color={financial.income}
          trackColor={theme.colors.outlineVariant}
          currency={currency}
        />
        <Divider />
        <CategoryRow
          label={t("home.realized.expense")}
          realized={realized.realizedSpending}
          planned={metrics.totalExpenses - metrics.totalSavings}
          color={financial.expense}
          trackColor={theme.colors.outlineVariant}
          currency={currency}
        />
        <Divider />
        <CategoryRow
          label={t("home.realized.savings")}
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
        {t("home.realized.tip")}
      </Text>
    </FormModal>
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
        <Amount size="meta">
          {`${formatCompactCurrency(realized, currency)} / ${formatCompactCurrency(planned, currency)}`}
        </Amount>
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
        <Amount size="meta" style={styles.percent}>
          {`${percent}%`}
        </Amount>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
