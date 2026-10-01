import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
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
  ICON_SIZE,
  ROW,
  SPACING,
  TABULAR_DIGITS,
  TOUCH_TARGET,
} from "@/core/ui/theme";

import type { AmountAccent, LineItem } from "../budget-details-selectors";

import { PointCircle } from "./point-circle";

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
  const accent = accentColor(item.accent, financial, muted);
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
  const amountSuffix =
    item.amountSuffix === null
      ? null
      : t(`budgets.detail.amountSuffix.${item.amountSuffix.kind}`, {
          amount:
            "amount" in item.amountSuffix
              ? formatCurrency(item.amountSuffix.amount, currency)
              : undefined,
        });
  const statusLabel =
    item.statusLabel === null
      ? null
      : t(`budgets.detail.status.${item.statusLabel.kind}`, {
          amount:
            "amount" in item.statusLabel
              ? formatCurrency(item.statusLabel.amount, currency)
              : undefined,
        });
  const metadata = [
    recurrenceLabel(t, item.line.recurrence),
    // A spread month is one of a window, not something that comes back.
    item.line.spreadGroupId != null ? t("budgets.detail.spread") : null,
    item.line.savingsGoalId != null ? t("budgets.detail.goalShort") : null,
    tagSummary,
  ].filter((part): part is string => part !== null);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={ripple}
      style={styles.row}
      accessibilityRole="button"
      accessibilityHint={t("budgets.detail.openForecast")}
    >
      {/* A withdrawal planned from a goal is pointed where the goal is, so its
          disc is a plain one: there is nothing to tick here. */}
      {item.line.sourceSavingsGoalId == null ? (
        <PointCircle
          isChecked={item.isChecked}
          color={discColor}
          icon={KIND_ICONS[item.line.kind]}
          isSyncing={isSyncing}
          label={item.line.name}
          onToggle={onToggle}
        />
      ) : (
        <View style={styles.plainDisc}>
          <IconDisc name={KIND_ICONS[item.line.kind]} tint={discColor} />
        </View>
      )}

      <View style={styles.labels}>
        <Text
          variant="titleMedium"
          numberOfLines={1}
          style={[
            { color: item.isChecked ? muted : theme.colors.onSurface },
            item.isChecked && styles.struck,
          ]}
        >
          {item.line.name}
        </Text>
        <Text variant="bodySmall" numberOfLines={1} style={{ color: muted }}>
          {metadata.join(" · ")}
        </Text>
        {statusLabel !== null && (
          <Text
            variant="labelMedium"
            numberOfLines={1}
            style={[
              styles.status,
              { color: item.isOverBudget ? financial.overBudget : muted },
            ]}
          >
            {statusLabel}
          </Text>
        )}
      </View>

      <View style={styles.amounts}>
        <Text
          numberOfLines={1}
          style={[BRAND_TYPE.rowAmount, TABULAR_DIGITS, { color: accent }]}
        >
          {formatCurrency(item.displayAmount, currency)}
        </Text>
        {amountSuffix !== null && (
          <Text
            variant="bodySmall"
            numberOfLines={1}
            style={[TABULAR_DIGITS, { color: muted }]}
          >
            {amountSuffix}
          </Text>
        )}
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={ICON_SIZE.md}
        color={muted}
      />
    </Pressable>
  );
}

function accentColor(
  accent: AmountAccent | "expense",
  palette: ReturnType<typeof useFinancialColors>,
  neutral: string,
): string {
  switch (accent) {
    case "income":
      return palette.income;
    case "savings":
      return palette.savings;
    case "expense":
      return palette.expense;
    case "overBudget":
      return palette.overBudget;
    case "warning":
      return palette.warning;
    default:
      return neutral;
  }
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
    paddingRight: SPACING.sm + SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  plainDisc: {
    width: TOUCH_TARGET,
    alignItems: "center",
  },
  struck: { textDecorationLine: "line-through" },
  labels: { flex: 1, gap: SPACING.xxs, paddingVertical: SPACING.sm },
  status: { fontWeight: "700" },
  amounts: { alignItems: "flex-end", gap: SPACING.xxs, maxWidth: "45%" },
});
