import type { SupportedCurrency, TransactionKind } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";

import { IconDisc } from "@/core/ui/icon-disc";
import { hapticSelection, hapticSuccess } from "@/core/ui/haptics";
import { Amount } from "@/core/ui/amount";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { EMPHASIS, RADIUS, SPACING } from "@/core/ui/theme";

import type { CheckableItem } from "../current-month-view-model";

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
  const financial = useFinancialColors();
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

  const accent = financial[KIND_ACCENTS[current.kind]];

  function handleConfirm() {
    hapticSuccess();
    onToggle(current);
  }

  function handleSkip() {
    hapticSelection();
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
          <IconDisc name={KIND_ICONS[current.kind]} tint={accent} />

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

          <Amount size="row" numberOfLines={1}>
            {formatCompactCurrency(current.amount, currency)}
          </Amount>
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
  syncing: { opacity: EMPHASIS.pending },
  operation: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  labels: { flex: 1, gap: SPACING.xxs },
  actions: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
});
