import { router } from "expo-router";
import type { BudgetLine } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";

import { Card } from "@/core/ui/card";
import { useTranslation } from "@/core/i18n/locale-store";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { ICON_SIZE, SPACING } from "@/core/ui/theme";
import { useSavingsGoals } from "@/features/savings-goals/goals-queries";

/**
 * The goal a forecast belongs to, in whichever direction it points.
 *
 * `savingsGoalId` is a contribution filling a goal; `sourceSavingsGoalId` is an
 * income announcing a withdrawal from one. Two fields rather than one signed
 * link, because a pot being filled and a pot being emptied do not obey the same
 * rules.
 */
export function SavingsGoalLinks({
  line,
  onNavigate,
}: {
  line: BudgetLine;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const goals = useSavingsGoals();
  const linkedGoal =
    line.kind === "saving" && line.savingsGoalId !== null
      ? goals.data?.find((goal) => goal.id === line.savingsGoalId)
      : undefined;

  function open(goalId: string) {
    onNavigate();
    router.push(`/goal/${goalId}`);
  }

  return (
    <>
      {/* Nothing while the goals are still loading: a placeholder that turns
          into a real row a moment later reads as a glitch. */}
      {linkedGoal !== undefined && (
        <LinkRow
          icon="target"
          label={t("budgets.detail.goal", { name: linkedGoal.name })}
          hint={t("budgets.detail.openGoal")}
          onPress={() => open(linkedGoal.id)}
        />
      )}

      {line.sourceSavingsGoalName != null &&
        (line.sourceSavingsGoalId != null ? (
          <LinkRow
            icon="arrow-down-circle-outline"
            label={t("budgets.detail.withdrawnFrom", {
              name: line.sourceSavingsGoalName,
            })}
            hint={t("budgets.detail.openGoal")}
            onPress={() => open(line.sourceSavingsGoalId as string)}
          />
        ) : (
          // No press target: a row that looked navigable would promise a screen
          // that cannot open.
          <LinkRow
            icon="link-off"
            label={t("budgets.detail.withdrawnFrom", {
              name: line.sourceSavingsGoalName,
            })}
            detail={t("budgets.detail.deletedGoal")}
          />
        ))}
    </>
  );
}

function LinkRow({
  icon,
  label,
  detail,
  hint,
  onPress,
}: {
  icon: string;
  label: string;
  detail?: string;
  hint?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const financial = useFinancialColors();
  const tint =
    onPress === undefined ? theme.colors.onSurfaceVariant : financial.savings;

  return (
    <Card mode="contained" onPress={onPress} accessibilityHint={hint}>
      <Card.Content style={styles.row}>
        <Icon source={icon} size={ICON_SIZE.md} color={tint} />
        <View style={styles.labels}>
          <Text variant="bodyMedium">{label}</Text>
          {detail !== undefined && (
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {detail}
            </Text>
          )}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  labels: { flex: 1, gap: SPACING.xxs },
});
