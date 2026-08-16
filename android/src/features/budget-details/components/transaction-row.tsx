import type { SupportedCurrency, Transaction } from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { Amount } from "@/core/ui/amount";
import { hapticCommit } from "@/core/ui/haptics";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatDayMonth } from "@/core/ui/date-format";
import { useRipple } from "@/core/ui/ripple";
import { RADIUS, SPACING } from "@/core/ui/theme";

import { PointCircle } from "./point-circle";

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

/** A spend that answers to no envelope: date, name, amount, and its ring. */
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
  const ripple = useRipple();
  const financial = useFinancialColors();
  const isChecked = transaction.checkedAt !== null;
  const accent = financial[KIND_ACCENTS[transaction.kind]];

  return (
    // The whole row answers, exactly as `budget-line-row.tsx` does: with the
    // press on the middle column alone, the amount and the margin beside it
    // were dead, and the ripple drew a rectangle inside a rounded row. Two
    // sibling rows in one list where only one opens when you tap its amount is
    // not a distinction anyone can learn. `PointCircle` keeps its own touch.
    <Pressable
      style={[styles.row, { backgroundColor: theme.colors.surface }]}
      onPress={onPress}
      // A press-and-hold is the Android way to ask "what else can I do with
      // this?", and the answer had been two taps and a scroll to the bottom
      // of a form. `pageY` rather than `locationY`: the menu is positioned
      // against the window, not against the row it came out of.
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
        onPress === undefined ? undefined : `Modifier ${transaction.name}`
      }
      // TalkBack has no long press, so the menu's contents have to be
      // reachable some other way — the sheet the tap opens still holds them.
      accessibilityHint={
        onLongPress === undefined
          ? undefined
          : "Appui long pour supprimer ou modifier"
      }
    >
      <PointCircle
        isChecked={isChecked}
        color={accent}
        isSyncing={isSyncing}
        label={transaction.name}
        onToggle={onToggle}
      />

      <View style={styles.labels}>
        <Text
          variant="bodyLarge"
          numberOfLines={1}
          style={isChecked && styles.struck}
        >
          {transaction.name}
        </Text>
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {tagSummary === null
            ? formatDayMonth(new Date(transaction.transactionDate))
            : `${formatDayMonth(new Date(transaction.transactionDate))} · ${tagSummary}`}
        </Text>
      </View>

      <Amount size="row" style={{ color: accent }} numberOfLines={1}>
        {formatCurrency(transaction.amount, currency)}
      </Amount>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    paddingRight: SPACING.md,
    borderRadius: RADIUS.card,
  },
  /** Struck through, never dimmed — see the note in `budget-line-row.tsx`. */
  struck: { textDecorationLine: "line-through" },
  labels: { flex: 1, gap: SPACING.xxs, paddingVertical: SPACING.sm },
});
