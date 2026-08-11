import * as Haptics from "expo-haptics";
import type {
  SavingsGoalFutureLine,
  SavingsGoalStatus,
  SupportedCurrency,
} from "pulpe-shared";
import { ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import {
  Button,
  Card,
  Divider,
  HelperText,
  Modal,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";

import { formatCompactCurrency, formatCurrency } from "@/core/ui/amount-format";
import { formatMonthLabel } from "@/core/ui/date-format";
import {
  FINANCIAL_COLORS,
  RADIUS,
  SPACING,
  TABULAR_DIGITS,
} from "@/core/ui/theme";

import { useStopSavingsGoalGeneration } from "../goals-queries";

interface GoalGenerationStopSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  goalId: string;
  status: SavingsGoalStatus;
  lines: SavingsGoalFutureLine[];
  currency: SupportedCurrency;
  onApplied: () => void;
}

/**
 * A goal that has stopped still holds savings forecasts on months to come. This
 * asks what becomes of them — kept but unlinked, or taken out — and never
 * decides on its own.
 *
 * Freezing also marks each forecast as manually adjusted: without that, the
 * next propagation from the Mois Type would link it straight back to the goal
 * the user just detached it from.
 */
export function GoalGenerationStopSheet({
  isVisible,
  onDismiss,
  goalId,
  status,
  lines,
  currency,
  onApplied,
}: GoalGenerationStopSheetProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const stop = useStopSavingsGoalGeneration();

  const total = lines.reduce((sum, line) => sum + line.amount, 0);

  function dismiss() {
    stop.reset();
    onDismiss();
  }

  function apply(mode: "freeze" | "remove") {
    if (lines.length === 0) return;
    stop.mutate(
      {
        goalId,
        decision: {
          mode,
          budgetLineIds: lines.map((line) => line.budgetLineId),
        },
      },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          onApplied();
        },
      },
    );
  }

  return (
    <Portal>
      <Modal
        visible={isVisible}
        onDismiss={dismiss}
        contentContainerStyle={[
          styles.sheet,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="titleMedium">
            {status === "PAUSED" ? "Objectif en pause" : "Objectif atteint"}
          </Text>

          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {lines.length} prévision(s) Épargne restent liées à cet objectif sur
            tes mois futurs. Que veux-tu en faire ?
          </Text>

          <Card mode="contained">
            <Card.Content style={styles.card}>
              {lines.map((line) => (
                <View key={line.budgetLineId} style={styles.row}>
                  <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {formatMonthLabel(line.month, line.year)}
                  </Text>
                  <Text variant="labelLarge" style={TABULAR_DIGITS}>
                    {formatCurrency(line.amount, currency)}
                  </Text>
                </View>
              ))}

              <Divider />

              <View style={styles.row}>
                <Text variant="labelLarge">Total</Text>
                <Text variant="labelLarge" style={TABULAR_DIGITS}>
                  {formatCompactCurrency(total, currency)}
                </Text>
              </View>
            </Card.Content>
          </Card>

          {stop.isError && (
            <HelperText type="error" visible>
              La décision n&apos;a pas pu être appliquée. Recharge et réessaie.
            </HelperText>
          )}

          <View style={styles.decision}>
            <Button
              mode="contained"
              onPress={() => apply("freeze")}
              disabled={stop.isPending}
              loading={stop.isPending}
            >
              Garder sans objectif
            </Button>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Les prévisions restent dans tes budgets, simplement déliées de
              l&apos;objectif.
            </Text>
          </View>

          <View style={styles.decision}>
            <Button
              mode="outlined"
              textColor={FINANCIAL_COLORS[scheme].destructive}
              onPress={() => apply("remove")}
              disabled={stop.isPending}
              accessibilityHint="Supprime les prévisions affichées et libère leur montant"
            >
              Retirer des mois futurs
            </Button>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Les prévisions sont supprimées : le montant redevient disponible
              chaque mois.
            </Text>
          </View>

          <Button mode="text" onPress={dismiss} disabled={stop.isPending}>
            Ne rien changer
          </Button>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    maxHeight: "88%",
  },
  content: { padding: SPACING.lg, gap: SPACING.md },
  card: { gap: SPACING.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  decision: { gap: SPACING.xs },
});
