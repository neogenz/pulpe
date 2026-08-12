import type {
  SavingsPlanSimulatedMonth,
  SupportedCurrency,
} from "pulpe-shared";
import { currentPlanMovement } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  HelperText,
  Icon,
  Text,
  useTheme,
} from "react-native-paper";

import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthLabel } from "@/core/ui/date-format";
import { Sheet } from "@/core/ui/sheet";
import { SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

const ARROW_SIZE = 16;

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
      title="Appliquer ce plan"
      // The month-by-month list is the whole point of the recap and runs long,
      // so the button that commits the write stays out of it.
      footer={
        <>
          {hasFailed && (
            <HelperText type="error" visible>
              Le plan n&apos;a pas pu être appliqué. Rien n&apos;a changé —
              recharge l&apos;objectif et réessaie.
            </HelperText>
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
                <Text
                  variant="labelLarge"
                  style={[
                    TABULAR_DIGITS,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {formatCurrency(currentPlanMovement(month), currency)}
                </Text>
                <Icon
                  source="arrow-right"
                  size={ARROW_SIZE}
                  color={theme.colors.onSurfaceVariant}
                />
                <Text variant="labelLarge" style={TABULAR_DIGITS}>
                  {formatCurrency(month.simulatedAmount, currency)}
                </Text>
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
