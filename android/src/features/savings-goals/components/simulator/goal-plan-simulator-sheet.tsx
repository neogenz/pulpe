import * as Haptics from "expo-haptics";
import type {
  SavingsGoalProgress,
  SavingsPlanSimulatedMonth,
  SupportedCurrency,
} from "pulpe-shared";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Chip, Divider, Text, useTheme } from "react-native-paper";

import { Card } from "@/core/ui/card";
import { Amount } from "@/core/ui/amount";
import { AmountField } from "@/core/ui/amount-field";
import { formatCompactCurrency, formatCurrency } from "@/core/ui/amount-format";
import { formatMonthLabel } from "@/core/ui/date-format";
import { Sheet } from "@/core/ui/sheet";
import { SPACING } from "@/core/ui/theme";

import { useApplySavingsGoalPlan } from "../../goals-queries";
import {
  buildPlanApply,
  isEditablePlanMonth,
  monthKey,
  planChanges,
  planVerdict,
  redistributedOverrides,
  simulatePlan,
  type PlanOverrides,
} from "../../plan-simulator";
import { GoalPlanApplyRecap } from "./goal-plan-apply-recap";

interface GoalPlanSimulatorSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  goalId: string;
  progress: SavingsGoalProgress;
  currency: SupportedCurrency;
  onApplied: () => void;
}

/**
 * What a different monthly effort would give, before committing to it.
 *
 * The whole simulation runs locally so the verdict answers under the finger —
 * the server stays authoritative and recomputes the progression on apply. Only
 * months that can still move are editable: a past cycle, a fully checked month
 * and a month whose withdrawal is already under way keep their amount and still
 * count towards the total.
 */
export function GoalPlanSimulatorSheet({
  isVisible,
  onDismiss,
  goalId,
  progress,
  currency,
  onApplied,
}: GoalPlanSimulatorSheetProps) {
  const theme = useTheme();
  const apply = useApplySavingsGoalPlan();
  const [overrides, setOverrides] = useState<PlanOverrides>({});
  // Bumped whenever the whole plan is rewritten at once, to re-seed the fields:
  // their text is local state, so they would otherwise keep the typed value.
  const [generation, setGeneration] = useState(0);
  const [isRecapVisible, setRecapVisible] = useState(false);

  const simulation = useMemo(
    () => simulatePlan(progress.months, progress, overrides),
    [progress, overrides],
  );
  const changes = useMemo(() => planChanges(simulation), [simulation]);
  const editableMonths = simulation.months.filter(isEditablePlanMonth);

  function rewrite(next: PlanOverrides) {
    setOverrides(next);
    setGeneration((current) => current + 1);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function setUniformAmount(amount: number | null) {
    if (amount === null) return;
    rewrite(
      Object.fromEntries(
        editableMonths.map((month) => [monthKey(month), amount]),
      ),
    );
  }

  function redistribute() {
    const next = redistributedOverrides(progress.months, progress);
    if (next !== null) rewrite(next);
  }

  function dismiss() {
    setOverrides({});
    setGeneration((current) => current + 1);
    setRecapVisible(false);
    apply.reset();
    onDismiss();
  }

  function confirm() {
    const plan = buildPlanApply(changes);
    if (plan === null) return;
    apply.mutate(
      { goalId, plan },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          setOverrides({});
          setGeneration((current) => current + 1);
          setRecapVisible(false);
          onApplied();
        },
      },
    );
  }

  return (
    <>
      <Sheet
        isVisible={isVisible && !isRecapVisible}
        onDismiss={dismiss}
        title="Simuler ton plan"
        // One amount field per editable month: a year-long plan is twelve of
        // them, and the count on the button is the feedback the user is typing
        // against — both have to stay in sight.
        footer={
          <>
            <Button
              mode="contained"
              onPress={() => setRecapVisible(true)}
              disabled={changes.length === 0}
            >
              Appliquer ({changes.length} mois)
            </Button>
            <Button mode="text" onPress={dismiss}>
              Annuler
            </Button>
          </>
        }
      >
        <Card mode="contained">
          <Card.Content style={styles.verdict}>
            <Text variant="bodyLarge">
              {planVerdict(
                simulation,
                (amount) => formatCompactCurrency(amount, currency),
                (period) => formatMonthLabel(period.month, period.year),
              )}
            </Text>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Total simulé {formatCurrency(simulation.simulatedFinal, currency)}
            </Text>
          </Card.Content>
        </Card>

        {editableMonths.length === 0 ? (
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Aucun mois de ce plan n&apos;est encore modifiable.
          </Text>
        ) : (
          <>
            <AmountField
              key={`uniform-${generation}`}
              label="Même montant chaque mois"
              amount={null}
              currency={currency}
              onChange={setUniformAmount}
            />

            <View style={styles.actions}>
              <Button mode="outlined" onPress={redistribute} compact>
                Réajuster la suite
              </Button>
              {changes.length > 0 && (
                <Button mode="text" onPress={() => rewrite({})} compact>
                  Repartir du plan actuel
                </Button>
              )}
            </View>

            <Divider />

            {simulation.months.map((month) => (
              <MonthRow
                key={`${monthKey(month)}-${generation}`}
                month={month}
                currency={currency}
                onChange={(amount) => {
                  if (amount === null) return;
                  setOverrides((current) => ({
                    ...current,
                    [monthKey(month)]: amount,
                  }));
                }}
              />
            ))}
          </>
        )}
      </Sheet>

      <GoalPlanApplyRecap
        isVisible={isVisible && isRecapVisible}
        onDismiss={() => setRecapVisible(false)}
        changes={changes}
        currency={currency}
        isApplying={apply.isPending}
        hasFailed={apply.isError}
        onConfirm={confirm}
      />
    </>
  );
}

function MonthRow({
  month,
  currency,
  onChange,
}: {
  month: SavingsPlanSimulatedMonth;
  currency: SupportedCurrency;
  onChange: (amount: number | null) => void;
}) {
  const theme = useTheme();
  const label = formatMonthLabel(month.month, month.year);

  if (!isEditablePlanMonth(month)) {
    return (
      <View style={styles.lockedRow}>
        <View style={styles.lockedLabel}>
          <Text variant="bodyLarge">{label}</Text>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {month.isLocked ? "Déjà joué" : "Non modifiable"}
          </Text>
        </View>
        <Amount size="meta" tone="muted">
          {formatCurrency(month.simulatedAmount, currency)}
        </Amount>
      </View>
    );
  }

  return (
    <View style={styles.editRow}>
      <View style={styles.editHeader}>
        <Text variant="labelLarge">{label}</Text>
        {month.isProvisionable === true && (
          <Chip compact icon="plus">
            À créer
          </Chip>
        )}
      </View>
      <AmountField
        label="Montant du mois"
        amount={month.simulatedAmount}
        currency={currency}
        onChange={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  verdict: { gap: SPACING.xxs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  editRow: { gap: SPACING.xs },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  lockedLabel: { flex: 1, gap: SPACING.xxs },
});
