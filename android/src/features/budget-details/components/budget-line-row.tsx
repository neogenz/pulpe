import type { SupportedCurrency } from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { KIND_ICONS, recurrenceLabel } from "@/core/ui/vocabulary";
import { useTranslation } from "@/core/i18n/locale-store";
import { IconDisc } from "@/core/ui/icon-disc";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { formatCurrency } from "@/core/ui/amount-format";
import { useRipple } from "@/core/ui/ripple";
import {
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
 * to; the amount on the right is already resolved by the selector, the row only
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
  const metadata = subtitle.filter((part): part is string => part !== null);

  const isPointable = item.line.sourceSavingsGoalId == null;

  return (
    <SwipeToPoint
      isChecked={item.isChecked}
      tint={discColor}
      isEnabled={isPointable}
      onPoint={onToggle}
    >
      {(guard) => (
        <Pressable
          onPress={guard(onPress)}
          android_ripple={ripple}
          style={styles.row}
          accessibilityRole="button"
          accessibilityHint={t("budgets.detail.openForecast")}
        >
          {/* A withdrawal planned from a goal is pointed where the goal is, so its
          disc is a plain one: there is nothing to tick here. */}
          {isPointable ? (
            <PointCircle
              isChecked={item.isChecked}
              color={discColor}
              icon={KIND_ICONS[item.line.kind]}
              isSyncing={isSyncing}
              label={item.line.name}
              onToggle={guard(onToggle) ?? onToggle}
            />
          ) : (
            <View style={styles.plainDisc}>
              <IconDisc name={KIND_ICONS[item.line.kind]} tint={discColor} />
            </View>
          )}

          <View style={styles.labels}>
            <Text
              variant="titleMedium"
              numberOfLines={2}
              style={[
                { color: item.isChecked ? muted : theme.colors.onSurface },
                item.isChecked && styles.struck,
              ]}
            >
              {item.line.name}
            </Text>
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{
                color: item.isOverBudget ? financial.overBudget : muted,
              }}
            >
              {metadata.join(" · ")}
            </Text>
          </View>

          <View style={styles.amounts}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[
                BRAND_TYPE.rowAmount,
                TABULAR_DIGITS,
                { color: theme.colors.onSurface },
              ]}
            >
              {`${line.kind === "income" ? "+" : ""}${formatCurrency(item.shownAmount, currency)}`}
            </Text>
          </View>
        </Pressable>
      )}
    </SwipeToPoint>
  );
}

/** Lines the disc up with the 16dp rail a `LedgerRow` keeps: (48 − 36) / 2. */
const TARGET_INSET = (TOUCH_TARGET - ROW.disc) / 2;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm + SPACING.xs - TARGET_INSET,
    minHeight: ROW.minHeight,
    paddingLeft: SPACING.md - TARGET_INSET,
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
  amounts: {
    alignItems: "flex-end",
    gap: SPACING.xxs,
    maxWidth: "45%",
    marginLeft: TARGET_INSET,
  },
});
