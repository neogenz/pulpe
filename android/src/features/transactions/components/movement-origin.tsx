import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Switch, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { FadingRail } from "@/core/ui/fading-rail";
import { FilterChip } from "@/core/ui/filter-chip";
import { SPACING } from "@/core/ui/theme";
import type { useSavingsGoalWithdrawalOptions } from "@/features/savings-goals/goals-queries";

type WithdrawalOptions = ReturnType<typeof useSavingsGoalWithdrawalOptions>;
export type WithdrawalOption = NonNullable<WithdrawalOptions["data"]>[number];

interface MovementOriginProps {
  isFromSavingsGoal: boolean;
  onToggle: (isOn: boolean) => void;
  options: WithdrawalOptions;
  selectedGoalId: string | null;
  chosenOption: WithdrawalOption | null;
  onPick: (goalId: string) => void;
  /** What the chosen goal has left once this income is taken out of it. */
  remaining: number | null;
  /** The sheet gutter, given back by the rail so chips scroll edge to edge. */
  railInset: number;
}

/**
 * An income can be money coming in, or money coming back out of a pot the user
 * already filled. Only the second empties a goal, and the server needs to be
 * told which one this is.
 */
export function MovementOrigin({
  isFromSavingsGoal,
  onToggle,
  options,
  selectedGoalId,
  chosenOption,
  onPick,
  remaining,
  railInset,
}: MovementOriginProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.origin}>
      <View style={styles.checkedRow}>
        <View style={styles.checkedLabels}>
          <Text variant="bodyLarge">
            {t("budgets.mutations.activity.originTitle")}
          </Text>
          {isFromSavingsGoal && (
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("budgets.mutations.activity.originHint")}
            </Text>
          )}
        </View>
        <Switch
          value={isFromSavingsGoal}
          onValueChange={onToggle}
          accessibilityLabel={t(
            "budgets.mutations.activity.originAccessibility",
          )}
        />
      </View>

      {isFromSavingsGoal &&
        (options.isPending ? (
          <ActivityIndicator accessibilityLabel={t("common.loading")} />
        ) : (options.data ?? []).length === 0 ? (
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("budgets.mutations.activity.noGoals")}
          </Text>
        ) : (
          <FadingRail
            inset={railInset}
            background={theme.colors.surface}
            accessibilityLabel={t("budgets.mutations.activity.goalsAvailable")}
          >
            {(options.data ?? []).map((option) => (
              <FilterChip
                key={option.goalId}
                selected={option.goalId === selectedGoalId}
                icon="piggy-bank-outline"
                onPress={() => onPick(option.goalId)}
                accessibilityState={{
                  selected: option.goalId === selectedGoalId,
                }}
              >
                {`${option.name} · ${formatCompactCurrency(
                  option.availableAmount,
                  option.currency,
                )}`}
              </FilterChip>
            ))}
          </FadingRail>
        ))}

      {/* What the goal has left afterwards, which is the number the
          choice is actually made on. */}
      {isFromSavingsGoal && chosenOption !== null && remaining !== null && (
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {`${chosenOption.name} · ${formatCompactCurrency(
            chosenOption.availableAmount,
            chosenOption.currency,
          )} → ${formatCompactCurrency(remaining, chosenOption.currency)}`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  checkedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  checkedLabels: { flex: 1, gap: SPACING.xxs },
  origin: { gap: SPACING.sm },
});
