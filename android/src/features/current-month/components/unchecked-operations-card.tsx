import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Haptics from "expo-haptics";
import type { SupportedCurrency, TransactionKind } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";

import { formatCompactCurrency } from "@/core/ui/amount-format";
import {
  FINANCIAL_COLORS,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
} from "@/core/ui/theme";

import type { CheckableItem } from "../current-month-view-model";

const ICON_SIZE = 20;
const ICON_DIAMETER = 36;
const ICON_TINT_OPACITY = "26";

const KIND_ICONS = {
  income: "arrow-down",
  expense: "arrow-up",
  saving: "piggy-bank-outline",
} as const satisfies Record<TransactionKind, string>;

const KIND_ACCENTS: Record<TransactionKind, "income" | "expense" | "savings"> =
  {
    income: "income",
    expense: "expense",
    saving: "savings",
  };

interface UncheckedOperationsCardProps {
  items: CheckableItem[];
  currency: SupportedCurrency;
  isSyncing: boolean;
  onToggle: (item: CheckableItem) => void;
}

/**
 * One operation at a time, with the two answers under it. A list of five with
 * five checkboxes is a chore; one question with "C'est passé" and "Plus tard"
 * is a habit — which is the whole point of pointing.
 */
export function UncheckedOperationsCard({
  items,
  currency,
  isSyncing,
  onToggle,
}: UncheckedOperationsCardProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const [skippedIds, setSkippedIds] = useState<string[]>([]);

  // Pruned at render rather than in an effect: an operation that was deferred
  // and has since been pointed elsewhere is simply gone from `items`, and a
  // stale id left in the set would make the rotation wrap one turn early.
  const deferredIds = skippedIds.filter((id) =>
    items.some((item) => item.id === id),
  );
  // Deferring the last one would leave the card empty while operations remain,
  // so the rotation wraps instead of running out.
  const current =
    items.find((item) => !deferredIds.includes(item.id)) ?? items[0];

  if (current === undefined) return null;

  const accent = FINANCIAL_COLORS[scheme][KIND_ACCENTS[current.kind]];

  function handleConfirm() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onToggle(current);
  }

  function handleSkip() {
    void Haptics.selectionAsync();
    setSkippedIds(
      deferredIds.length + 1 >= items.length
        ? []
        : [...deferredIds, current.id],
    );
  }

  return (
    <View style={styles.card}>
      <Text variant="titleSmall">Opérations à pointer</Text>

      <View
        style={[
          styles.pane,
          { backgroundColor: theme.colors.surfaceVariant },
          isSyncing && styles.syncing,
        ]}
      >
        <View style={styles.operation}>
          <View
            style={[
              styles.icon,
              { backgroundColor: `${accent}${ICON_TINT_OPACITY}` },
            ]}
          >
            <MaterialCommunityIcons
              name={KIND_ICONS[current.kind]}
              size={ICON_SIZE}
              color={accent}
            />
          </View>

          <View style={styles.labels}>
            <Text variant="bodyLarge" numberOfLines={1}>
              {current.name}
            </Text>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {current.subtitle}
            </Text>
          </View>

          <Text variant="bodyMedium" style={TABULAR_DIGITS} numberOfLines={1}>
            {formatCompactCurrency(current.amount, currency)}
          </Text>
        </View>

        <Divider />

        {/* Adjacent and both on the leading rail: pushed to opposite ends they
            read as two unrelated controls, side by side as one question with
            two answers, the affirmative first. */}
        <View style={styles.actions}>
          <Button
            mode="contained-tonal"
            icon="check"
            disabled={isSyncing}
            onPress={handleConfirm}
            accessibilityLabel={`Pointer ${current.name}`}
          >
            C&apos;est passé
          </Button>
          <Button
            mode="text"
            disabled={isSyncing}
            onPress={handleSkip}
            accessibilityLabel={`Plus tard pour ${current.name}`}
          >
            Plus tard
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACING.sm },
  pane: {
    borderRadius: RADIUS.card,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  syncing: { opacity: 0.5 },
  operation: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  icon: {
    width: ICON_DIAMETER,
    height: ICON_DIAMETER,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  labels: { flex: 1, gap: SPACING.xxs },
  actions: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
});
