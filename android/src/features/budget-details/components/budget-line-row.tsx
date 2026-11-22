import type { SupportedCurrency } from "pulpe-shared";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { KIND_ICONS, recurrenceLabel } from "@/core/ui/vocabulary";
import { useTranslation } from "@/core/i18n/locale-store";
import { IconDisc } from "@/core/ui/icon-disc";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { formatCurrency } from "@/core/ui/amount-format";
import { useRipple } from "@/core/ui/ripple";
import {
  ACCESSIBLE_FONT_SCALE,
  BRAND_TYPE,
  ROW,
  SPACING,
  TABULAR_DIGITS,
  TOUCH_TARGET,
} from "@/core/ui/theme";

import type { LineItem } from "../budget-details-selectors";

import { PointCircle } from "./point-circle";
import { SwipeToPoint } from "./swipe-to-point";

interface BudgetLineRowProps {
  item: LineItem;
  currency: SupportedCurrency;
  isSyncing: boolean;
  tagSummary: string | null;
  onPress: () => void;
  onToggle: () => void;
}

/**
 * One envelope: what it plans, what it has absorbed, and whether it has been
 * pointed — `BudgetLineMixedRow` on iOS. The disc says the nature and is the
 * pointing control; the metadata line says how it recurs and what it is tied
 * to; the amount is already resolved by the selector, and the row only
 * decides which ink it wears.
 */
export function BudgetLineRow({
  item,
  currency,
  isSyncing,
  tagSummary,
  onPress,
  onToggle,
}: BudgetLineRowProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const ripple = useRipple();
  const financial = useFinancialColors();
  const stacksAmount = useWindowDimensions().fontScale >= ACCESSIBLE_FONT_SCALE;
  const muted = theme.colors.onSurfaceVariant;
  // The disc wears the nature, whatever the amount beside it says: an income
  // is blue, a saving green, an expense amber — burnt once it has overrun.
  const discColor =
    item.line.kind === "income"
      ? financial.income
      : item.line.kind === "saving"
        ? financial.savings
        : item.isOverBudget
          ? financial.overBudget
          : financial.expense;
  const { line, consumed } = item;
  // Consumption speaks first (« Reste 188.00 »); an untouched line names where
  // it comes from instead, then whether it is pointed.
  const fact =
    line.spreadGroupId != null
      ? t("budgets.detail.spread")
      : line.savingsGoalId != null
        ? t("budgets.detail.goalShort")
        : line.kind === "income" && line.savingsWithdrawalGroupId != null
          ? t("budgets.detail.withdrawal")
          : line.sourceSavingsGoalName != null
            ? t("budgets.detail.withdrawnFrom", {
                name: line.sourceSavingsGoalName,
              })
            : recurrenceLabel(t, line.recurrence);
  const subtitle =
    consumed === null
      ? [fact, item.isChecked ? t("budgets.detail.pointed") : null, tagSummary]
      : [
          t(`budgets.detail.row.${consumed.kind}`, {
            amount: formatCurrency(Math.abs(consumed.amount), currency),
          }),
          tagSummary,
        ];
  const metadata = subtitle
    .filter((part): part is string => part !== null)
    .join(" · ");
  const formattedAmount = `${line.kind === "income" ? "+" : ""}${formatCurrency(item.shownAmount, currency)}`;

  const isPointable = line.sourceSavingsGoalId == null;
  const amount = (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
      style={[
        BRAND_TYPE.rowAmount,
        TABULAR_DIGITS,
        { color: theme.colors.onSurface },
        !stacksAmount && styles.amount,
        !stacksAmount && isPointable && styles.pointableAmount,
      ]}
    >
      {formattedAmount}
    </Text>
  );

  return (
    <SwipeToPoint
      isChecked={item.isChecked}
      tint={discColor}
      isEnabled={isPointable}
      onPoint={onToggle}
    >
      {(guard) => (
        <View style={[styles.row, isPointable && styles.discInset]}>
          {isPointable && (
            <PointCircle
              isChecked={item.isChecked}
              isSyncing={isSyncing}
              label={line.name}
              onToggle={guard(onToggle) ?? onToggle}
            />
          )}
          <Pressable
            onPress={guard(onPress)}
            android_ripple={ripple}
            style={[styles.open, !isPointable && styles.discInset]}
            accessibilityRole="button"
            // The nature in words and the amount unsigned, as iOS speaks the
            // row: a `+` before masked digits would still be read out.
            accessibilityLabel={[
              t(`vocabulary.kind.${line.kind}`),
              line.name,
              metadata,
              formatCurrency(item.shownAmount, currency),
            ].join(" · ")}
            accessibilityHint={t("budgets.detail.openForecast")}
          >
            {/* Planned withdrawals are pointed from their goal. */}
            {!isPointable && (
              <View style={styles.plainDisc}>
                <IconDisc name={KIND_ICONS[line.kind]} tint={discColor} />
              </View>
            )}
            <View style={styles.labels}>
              <Text
                variant="titleMedium"
                numberOfLines={stacksAmount ? undefined : 2}
                style={[
                  { color: item.isChecked ? muted : theme.colors.onSurface },
                  item.isChecked && styles.struck,
                ]}
              >
                {line.name}
              </Text>
              <Text
                variant="bodySmall"
                numberOfLines={stacksAmount ? undefined : 1}
                style={{
                  color: item.isOverBudget ? financial.overBudget : muted,
                }}
              >
                {metadata}
              </Text>
              {stacksAmount && amount}
            </View>
            {!stacksAmount && amount}
          </Pressable>
        </View>
      )}
    </SwipeToPoint>
  );
}

/** Lines the disc up with the 16dp rail a `LedgerRow` keeps: (48 − 36) / 2. */
const TARGET_INSET = (TOUCH_TARGET - ROW.disc) / 2;
const DISC_GAP = SPACING.sm + SPACING.xs - TARGET_INSET;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  discInset: { paddingLeft: SPACING.md - TARGET_INSET },
  open: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: DISC_GAP,
    minHeight: ROW.minHeight,
    paddingLeft: DISC_GAP,
    paddingRight: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  plainDisc: {
    width: TOUCH_TARGET,
    alignItems: "center",
  },
  struck: { textDecorationLine: "line-through" },
  labels: { flex: 1, gap: SPACING.xxs, paddingVertical: SPACING.sm },
  // The row's gap is shaved for the disc's touch target; the amount takes the
  // shave back, or a long name ellipsized 6dp from it and the two read as one.
  amount: {
    maxWidth: "45%",
    marginLeft: TARGET_INSET,
  },
  // Keep room for the amount on narrow rows now that the point target is outside the button.
  pointableAmount: { maxWidth: "55%" },
});
