import type {
  SavingsGoalFutureLine,
  SavingsGoalStatus,
  SupportedCurrency,
} from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";

import { hapticSuccess } from "@/core/ui/haptics";
import { useTranslation } from "@/core/i18n/locale-store";
import { Card } from "@/core/ui/card";
import { Amount } from "@/core/ui/amount";
import { formatCompactCurrency, formatCurrency } from "@/core/ui/amount-format";
import { formatMonthLabel } from "@/core/ui/date-format";
import { FormModal } from "@/core/ui/sheet";
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
  const { locale, t } = useTranslation();
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
    <FormModal
      isVisible={isVisible}
      onDismiss={dismiss}
      isBusy={stop.isPending}
      title={t(
        `goals.stop.${status === "PAUSED" ? "pausedTitle" : "completedTitle"}`,
      )}
      // The two decisions are the point of the sheet, so they stay put while
      // the months they apply to scroll behind them — a goal paused in January
      // lists eleven of them.
      footer={
        <>
          {stop.isError && (
            <FieldError visible>{t("goals.stop.error")}</FieldError>
          )}

          <View style={styles.decision}>
            <Button
              mode="contained"
              onPress={() => apply("freeze")}
              disabled={stop.isPending}
              loading={stop.isPending}
            >
              {t("goals.stop.freeze")}
            </Button>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("goals.stop.freezeHint")}
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
              accessibilityHint={t("goals.stop.removeAccessibility")}
            >
              {t("goals.stop.remove")}
            </Button>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("goals.stop.removeHint")}
            </Text>
          </View>

          <Button mode="text" onPress={dismiss} disabled={stop.isPending}>
            {t("goals.stop.cancel")}
          </Button>
        </>
      }
    >
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {t("goals.stop.intro", { count: lines.length })}
      </Text>

      <Card mode="contained">
        <Card.Content style={styles.card}>
          {lines.map((line) => (
            <View key={line.budgetLineId} style={styles.row}>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {formatMonthLabel(line.month, line.year, locale)}
              </Text>
              <Amount size="meta">
                {formatCurrency(line.amount, currency)}
              </Amount>
            </View>
          ))}

          <Divider />

          <View style={styles.row}>
            <Text variant="labelLarge">{t("goals.stop.total")}</Text>
            <Amount size="meta">
              {formatCompactCurrency(total, currency)}
            </Amount>
          </View>
        </Card.Content>
      </Card>
    </FormModal>
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
