import type { SupportedCurrency, Transaction } from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { hapticCommit } from "@/core/ui/haptics";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatDayMonth } from "@/core/ui/date-format";
import { useRipple } from "@/core/ui/ripple";
import {
  BRAND_TYPE,
  ROW,
  SPACING,
  TABULAR_DIGITS,
  TOUCH_TARGET,
} from "@/core/ui/theme";
import { KIND_ICONS } from "@/core/ui/vocabulary";

import { PointCircle } from "./point-circle";
import { SwipeToPoint } from "./swipe-to-point";

const KIND_ACCENTS = {
  income: "income",
  expense: "expense",
  saving: "savings",
} as const;

interface TransactionRowProps {
  transaction: Transaction;
  currency: SupportedCurrency;
  isSyncing: boolean;
  tagSummary: string | null;
  onToggle: () => void;
  /** Opens the operation for correction; absent where it cannot be edited. */
  onPress?: () => void;
  /**
   * Where the finger was, so the menu opens under it rather than at a corner.
   * Absent alongside `onPress`: a row that cannot be edited has no menu.
   */
  onLongPress?: (anchor: { x: number; y: number }) => void;
}

/**
 * A spend that answers to no envelope: its disc, its name, the day it was
 * noted, and its amount — the same grammar as an envelope's row, so the two
 * kinds of line read as one ledger.
 */
export function TransactionRow({
  transaction,
  currency,
  isSyncing,
  tagSummary,
  onToggle,
  onPress,
  onLongPress,
}: TransactionRowProps) {
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const ripple = useRipple();
  const financial = useFinancialColors();
  const isChecked = transaction.checkedAt !== null;
  const accent = financial[KIND_ACCENTS[transaction.kind]];
  const muted = theme.colors.onSurfaceVariant;
  const day = formatDayMonth(new Date(transaction.transactionDate), locale);

  return (
    <SwipeToPoint
      isChecked={isChecked}
      tint={accent}
      isEnabled
      onPoint={onToggle}
    >
      {(guard) => (
        <Pressable
          style={styles.row}
          onPress={guard(onPress)}
          onLongPress={
            onLongPress === undefined
              ? undefined
              : (event) => {
                  hapticCommit();
                  onLongPress({
                    x: event.nativeEvent.pageX,
                    y: event.nativeEvent.pageY,
                  });
                }
          }
          android_ripple={ripple}
          disabled={onPress === undefined}
          accessibilityRole={onPress === undefined ? undefined : "button"}
          accessibilityLabel={
            onPress === undefined
              ? undefined
              : t("budgets.detail.editActivity", { name: transaction.name })
          }
          accessibilityHint={
            onLongPress === undefined
              ? undefined
              : t("budgets.detail.activityLongPressHint")
          }
        >
          <PointCircle
            isChecked={isChecked}
            color={accent}
            icon={KIND_ICONS[transaction.kind]}
            isSyncing={isSyncing}
            label={transaction.name}
            onToggle={guard(onToggle) ?? onToggle}
          />

          <View style={styles.labels}>
            <Text
              variant="titleMedium"
              numberOfLines={1}
              style={[
                { color: isChecked ? muted : theme.colors.onSurface },
                isChecked && styles.struck,
              ]}
            >
              {transaction.name}
            </Text>
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{ color: muted }}
            >
              {tagSummary === null ? day : `${day} · ${tagSummary}`}
            </Text>
          </View>

          <Text
            numberOfLines={1}
            style={[
              BRAND_TYPE.rowAmount,
              TABULAR_DIGITS,
              styles.amount,
              { color: transaction.kind === "expense" ? muted : accent },
            ]}
          >
            {formatCurrency(transaction.amount, currency)}
          </Text>
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
  /** Struck through and receding, never faded — a pointed row is re-read. */
  struck: { textDecorationLine: "line-through" },
  labels: { flex: 1, gap: SPACING.xxs, paddingVertical: SPACING.sm },
  amount: { maxWidth: "45%" },
});
