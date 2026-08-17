import type {
  SavingsPlanSimulatedMonth,
  SupportedCurrency,
} from "pulpe-shared";
import { currentPlanMovement } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Button, Icon, Text, useTheme } from "react-native-paper";

import { Card } from "@/core/ui/card";
import { Amount } from "@/core/ui/amount";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthLabel } from "@/core/ui/date-format";
import { Sheet } from "@/core/ui/sheet";
import { ICON_SIZE, SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

interface GoalPlanApplyRecapProps {
  isVisible: boolean;
  onDismiss: () => void;
  changes: SavingsPlanSimulatedMonth[];
  currency: SupportedCurrency;
  isApplying: boolean;
  hasFailed: boolean;
  onConfirm: () => void;
}

/**
 * The exact write, month by month, before it happens. Applying a plan rewrites
 * forecasts inside budgets the user may be counting on, so the amounts that
 * move are named — not summarised.
 */
export function GoalPlanApplyRecap({
  isVisible,
  onDismiss,
  changes,
  currency,
  isApplying,
  hasFailed,
  onConfirm,
}: GoalPlanApplyRecapProps) {
  const theme = useTheme();

  return (
    <Sheet
      isVisible={isVisible}
      onDismiss={onDismiss}
      isBusy={isApplying}
      title="Appliquer ce plan"
      // The month-by-month list is the whole point of the recap and runs long,
      // so the button that commits the write stays out of it.
      footer={
        <>
          {hasFailed && (
            <FieldError visible>
              Le plan n&apos;a pas pu être appliqué. Rien n&apos;a changé —
              recharge l&apos;objectif et réessaie.
            </FieldError>
          )}

          <Button
            mode="contained"
            onPress={onConfirm}
            disabled={isApplying}
            loading={isApplying}
          >
            {isApplying ? "Application…" : "Confirmer"}
          </Button>
          <Button mode="text" onPress={onDismiss} disabled={isApplying}>
            Revenir au simulateur
          </Button>
        </>
      }
    >
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {changes.length} mois {changes.length > 1 ? "vont" : "va"} changer. Les
        montants déjà pointés ne bougent pas.
      </Text>

      <Card mode="contained">
        <Card.Content style={styles.card}>
          {changes.map((month) => (
            <View key={`${month.year}-${month.month}`} style={styles.row}>
              <View style={styles.label}>
                <Text variant="bodyLarge">
                  {formatMonthLabel(month.month, month.year)}
                </Text>
                {month.isProvisionable === true && (
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Prévision à créer
                  </Text>
                )}
              </View>
              <View style={styles.amounts}>
                <Amount size="meta" tone="muted">
                  {formatCurrency(currentPlanMovement(month), currency)}
                </Amount>
                <Icon
                  source="arrow-right"
                  size={ICON_SIZE.sm}
                  color={theme.colors.onSurfaceVariant}
                />
                <Amount size="meta">
                  {formatCurrency(month.simulatedAmount, currency)}
                </Amount>
              </View>
            </View>
          ))}
        </Card.Content>
      </Card>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACING.xxs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  label: { flex: 1, gap: SPACING.xxs },
  amounts: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
});
