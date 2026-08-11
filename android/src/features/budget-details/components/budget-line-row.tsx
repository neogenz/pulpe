import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { SupportedCurrency } from "pulpe-shared";
import { Pressable, StyleSheet, useColorScheme, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { formatCurrency } from "@/core/ui/amount-format";
import {
  FINANCIAL_COLORS,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
} from "@/core/ui/theme";

import type { AmountAccent, LineItem } from "../budget-details-selectors";

import { PointCircle } from "./point-circle";

const CHEVRON_SIZE = 18;
const SPREAD_ICON_SIZE = 12;
/** How much a pointed row steps back without disappearing. */
const POINTED_OPACITY = 0.55;

const RECURRENCE_LABELS = {
  fixed: "Récurrent",
  one_off: "Prévu",
} as const;

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
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const accent = accentColor(
    item.accent,
    scheme,
    theme.colors.onSurfaceVariant,
  );
  const dotColor = accentColor(
    item.line.kind === "expense" && !item.isOverBudget
      ? "expense"
      : item.accent,
    scheme,
    theme.colors.onSurfaceVariant,
  );

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        { backgroundColor: theme.colors.surface },
        item.isChecked && styles.pointed,
      ]}
      accessibilityRole="button"
      accessibilityHint="Ouvre le détail de la prévision"
    >
      <PointCircle
        isChecked={item.isChecked}
        color={dotColor}
        isSyncing={isSyncing}
        label={item.line.name}
        onToggle={onToggle}
      />

      <View style={styles.labels}>
        <View style={styles.eyebrow}>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {RECURRENCE_LABELS[item.line.recurrence]}
          </Text>
          {/* A calendar, never a repeat arrow: a spread month is one of a
              window, not something that comes back forever. */}
          {item.line.spreadGroupId != null && (
            <>
              <MaterialCommunityIcons
                name="calendar-multiple"
                size={SPREAD_ICON_SIZE}
                color={theme.colors.outline}
              />
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.outline }}
              >
                Lissé
              </Text>
            </>
          )}
          {item.line.savingsGoalId != null && (
            <>
              <MaterialCommunityIcons
                name="target"
                size={SPREAD_ICON_SIZE}
                color={theme.colors.outline}
              />
              <Text
                variant="labelSmall"
                style={{ color: theme.colors.outline }}
              >
                Objectif
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
          <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
            {tagSummary}
          </Text>
        )}
        {item.statusLabel !== null && (
          <Text
            variant="labelMedium"
            style={{
              color: item.isOverBudget
                ? FINANCIAL_COLORS[scheme].overBudget
                : theme.colors.onSurfaceVariant,
            }}
          >
            {item.statusLabel}
          </Text>
        )}
      </View>

      <View style={styles.amounts}>
        <Text
          variant="titleMedium"
          numberOfLines={1}
          style={[TABULAR_DIGITS, { color: accent }]}
        >
          {formatCurrency(item.displayAmount, currency)}
        </Text>
        {item.amountSuffix !== null && (
          <Text
            variant="labelSmall"
            numberOfLines={1}
            style={[TABULAR_DIGITS, { color: theme.colors.outline }]}
          >
            {item.amountSuffix}
          </Text>
        )}
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={CHEVRON_SIZE}
        color={theme.colors.outline}
      />
    </Pressable>
  );
}

function accentColor(
  accent: AmountAccent | "expense",
  scheme: "light" | "dark",
  neutral: string,
): string {
  const palette = FINANCIAL_COLORS[scheme];
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
  pointed: { opacity: POINTED_OPACITY },
  struck: { textDecorationLine: "line-through" },
  labels: { flex: 1, gap: SPACING.xxs, paddingVertical: SPACING.sm },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: SPACING.xxs },
  amounts: { alignItems: "flex-end", gap: SPACING.xxs },
});
