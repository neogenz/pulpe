import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { SupportedCurrency } from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { recurrenceLabel } from "@/core/ui/vocabulary";
import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { formatCurrency } from "@/core/ui/amount-format";
import { useRipple } from "@/core/ui/ripple";
import { ICON_SIZE, RADIUS, SPACING } from "@/core/ui/theme";

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
 * pointed. The amount on the right is already resolved by the selector — the
 * row only decides which ink it wears.
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
  const accent = accentColor(
    item.accent,
    financial,
    theme.colors.onSurfaceVariant,
  );
  const dotColor = accentColor(
    item.line.kind === "expense" && !item.isOverBudget
      ? "expense"
      : item.accent,
    financial,
    theme.colors.onSurfaceVariant,
  );
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

  return (
    <Pressable
      onPress={onPress}
      android_ripple={ripple}
      style={[styles.row, { backgroundColor: theme.colors.surface }]}
      accessibilityRole="button"
      accessibilityHint={t("budgets.detail.openForecast")}
    >
      {item.line.sourceSavingsGoalId == null && (
        <PointCircle
          isChecked={item.isChecked}
          color={dotColor}
          isSyncing={isSyncing}
          label={item.line.name}
          onToggle={onToggle}
        />
      )}

      <View style={styles.labels}>
        <View style={styles.eyebrow}>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {recurrenceLabel(t, item.line.recurrence)}
          </Text>
          {/* A calendar, never a repeat arrow: a spread month is one of a
              window, not something that comes back forever. */}
          {item.line.spreadGroupId != null && (
            <>
              <MaterialCommunityIcons
                name="calendar-multiple"
                size={ICON_SIZE.xs}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("budgets.detail.spread")}
              </Text>
            </>
          )}
          {item.line.savingsGoalId != null && (
            <>
              <MaterialCommunityIcons
                name="target"
                size={ICON_SIZE.xs}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("budgets.detail.goalShort")}
              </Text>
            </>
          )}
        </View>
        <Text
          variant="bodyLarge"
          numberOfLines={1}
          style={item.isChecked && styles.struck}
        >
          {item.line.name}
        </Text>
        {tagSummary !== null && (
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {tagSummary}
          </Text>
        )}
        {statusLabel !== null && (
          <Text
            variant="labelMedium"
            style={{
              color: item.isOverBudget
                ? financial.overBudget
                : theme.colors.onSurfaceVariant,
            }}
          >
            {statusLabel}
          </Text>
        )}
      </View>

      <View style={styles.amounts}>
        <Amount size="row" style={{ color: accent }} numberOfLines={1}>
          {formatCurrency(item.displayAmount, currency)}
        </Amount>
        {amountSuffix !== null && (
          <Amount size="meta" tone="muted" numberOfLines={1}>
            {amountSuffix}
          </Amount>
        )}
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={ICON_SIZE.md}
        color={theme.colors.onSurfaceVariant}
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
      return palette.expense;
    default:
      return neutral;
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingRight: SPACING.sm,
    borderRadius: RADIUS.card,
  },
  // A pointed row is struck through and nothing else. Dimming the whole row on
  // top of that took its amounts to 2.25:1 — the half of a month someone
  // re-reads to check what has already gone through is not decoration.
  struck: { textDecorationLine: "line-through" },
  labels: { flex: 1, gap: SPACING.xxs, paddingVertical: SPACING.sm },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: SPACING.xxs },
  amounts: { alignItems: "flex-end", gap: SPACING.xxs },
});
