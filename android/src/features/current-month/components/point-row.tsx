import type { TransactionKind } from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { Amount } from "@/core/ui/amount";
import { useRipple } from "@/core/ui/ripple";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { ROW, SPACING, TOUCH_TARGET } from "@/core/ui/theme";
import { KIND_ICONS } from "@/core/ui/vocabulary";
import { PointCircle } from "@/features/budget-details/components/point-circle";

const KIND_ACCENTS = {
  income: "income",
  expense: "expense",
  saving: "savings",
} as const;

interface PointRowProps {
  title: string;
  subtitle?: string;
  /** The subtitle is an overrun: it takes the drift ink. */
  isOverrun?: boolean;
  /** Already formatted. */
  amount: string;
  kind: TransactionKind;
  isPointed: boolean;
  isSyncing: boolean;
  onToggle: () => void;
  onOpen: () => void;
}

/**
 * One row of the home's three lists — « À faire », « Derniers mouvements » and
 * the two pages: the circle points, the rest of the row opens. `PointRow` and
 * `MovementRow` on iOS.
 */
export function PointRow({
  title,
  subtitle,
  isOverrun = false,
  amount,
  kind,
  isPointed,
  isSyncing,
  onToggle,
  onOpen,
}: PointRowProps) {
  const theme = useTheme();
  const ripple = useRipple();
  const financial = useFinancialColors();

  return (
    <View style={styles.row}>
      <PointCircle
        isChecked={isPointed}
        color={financial[KIND_ACCENTS[kind]]}
        icon={KIND_ICONS[kind]}
        isSyncing={isSyncing}
        label={title}
        onToggle={onToggle}
      />
      <Pressable
        style={styles.open}
        onPress={onOpen}
        android_ripple={ripple}
        accessibilityRole="button"
      >
        <View style={styles.text}>
          <Text
            variant="titleMedium"
            numberOfLines={1}
            style={[
              {
                color: isPointed
                  ? theme.colors.onSurfaceVariant
                  : theme.colors.onSurface,
              },
              isPointed && styles.struck,
            ]}
          >
            {title}
          </Text>
          {subtitle !== undefined && (
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{
                color: isOverrun
                  ? financial.drift
                  : theme.colors.onSurfaceVariant,
              }}
            >
              {subtitle}
            </Text>
          )}
        </View>
        <Amount size="row" numberOfLines={1}>
          {amount}
        </Amount>
      </Pressable>
    </View>
  );
}

/** Lines the disc up with the 16dp rail a `LedgerRow` keeps: (48 − 36) / 2. */
const TARGET_INSET = (TOUCH_TARGET - ROW.disc) / 2;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: ROW.minHeight,
    paddingLeft: SPACING.md - TARGET_INSET,
  },
  open: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: ROW.minHeight,
    paddingRight: SPACING.md,
    paddingLeft: SPACING.xs,
  },
  text: { flex: 1, gap: SPACING.xxs },
  struck: { textDecorationLine: "line-through" },
});
