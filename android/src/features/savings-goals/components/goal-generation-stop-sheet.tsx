import type {
  SavingsGoalFutureLine,
  SavingsGoalStatus,
  SupportedCurrency,
} from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";

import { hapticSuccess } from "@/core/ui/haptics";
import { Card } from "@/core/ui/card";
import { Amount } from "@/core/ui/amount";
import { formatCompactCurrency, formatCurrency } from "@/core/ui/amount-format";
import { formatMonthLabel } from "@/core/ui/date-format";
import { Sheet } from "@/core/ui/sheet";
import { SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

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
          hapticSuccess();
          onApplied();
        },
      },
    );
  }

  return (
    <Sheet
      isVisible={isVisible}
      onDismiss={dismiss}
      isBusy={stop.isPending}
      title={status === "PAUSED" ? "Objectif en pause" : "Objectif atteint"}
      // The two decisions are the point of the sheet, so they stay put while
      // the months they apply to scroll behind them — a goal paused in January
      // lists eleven of them.
      footer={
        <>
          {stop.isError && (
            <FieldError visible>
              La décision n&apos;a pas pu être appliquée. Recharge et réessaie.
            </FieldError>
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
              // Amber, not the destructive red: these forecasts can be planned
              // again next month, and spending the irreversible colour here is
              // what makes it stop meaning anything on the account deletion.
              textColor={theme.colors.error}
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
        </>
      }
    >
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {lines.length} prévision(s) Épargne restent liées à cet objectif sur tes
        mois futurs. Que veux-tu en faire ?
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
              <Amount size="meta">
                {formatCurrency(line.amount, currency)}
              </Amount>
            </View>
          ))}

          <Divider />

          <View style={styles.row}>
            <Text variant="labelLarge">Total</Text>
            <Amount size="meta">
              {formatCompactCurrency(total, currency)}
            </Amount>
          </View>
        </Card.Content>
      </Card>
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
