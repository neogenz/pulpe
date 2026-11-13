import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { ActionButton } from "@/core/ui/action-button";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { useFinancialColors, useV2Colors } from "@/core/ui/scheme-colors";
import { SectionHeader } from "@/core/ui/section-header";
import { StateChip } from "@/core/ui/state-chip";
import { RADIUS, SPACING } from "@/core/ui/theme";

import type { ThisMonth } from "../goal-presentation";

export interface PlanButton {
  title: string;
  /** « Tu choisis le montant… » only where the button writes a plan. */
  explainsChoice: boolean;
  onPress: () => void;
}

interface GoalThisMonthProps {
  month: ThisMonth | null;
  /** « Vise X par mois pour finir en juin. » */
  sentence: string | null;
  plan: PlanButton | null;
}

/**
 * « Ce mois-ci » — `GoalThisMonthCard.swift`: what this month asks, whether it
 * is pointed, the pace in one sentence and the page's single button. Absent
 * when none of them has anything to say.
 */
export function GoalThisMonth({ month, sentence, plan }: GoalThisMonthProps) {
  const theme = useTheme();
  const v2 = useV2Colors();
  const financial = useFinancialColors();
  const { t } = useTranslation();

  if (month === null && sentence === null && plan === null) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title={t("goals.detail.thisMonth")} />
      {month !== null && (
        <LedgerCard>
          <LedgerRow
            title={month.title}
            subtitle={month.subtitle}
            trailing={
              <StateChip
                tint={
                  month.isPointed
                    ? financial.savings
                    : theme.colors.onSurfaceVariant
                }
              >
                {t(
                  month.isPointed
                    ? "budgets.detail.filters.checked"
                    : "budgets.detail.filters.unchecked",
                )}
              </StateChip>
            }
          />
        </LedgerCard>
      )}
      {sentence !== null && (
        <Text
          variant="bodyMedium"
          style={[
            styles.sentence,
            { backgroundColor: v2.sunk, color: theme.colors.onSurfaceVariant },
          ]}
        >
          {sentence}
        </Text>
      )}
      {plan !== null && (
        <View style={styles.plan}>
          <ActionButton variant="primary" onPress={plan.onPress}>
            {plan.title}
          </ActionButton>
          {plan.explainsChoice && (
            <Text
              variant="bodySmall"
              style={[styles.explain, { color: theme.colors.onSurfaceVariant }]}
            >
              {t("goals.detail.plan.explain")}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm },
  sentence: { padding: SPACING.md, borderRadius: RADIUS.card },
  plan: { gap: SPACING.xs },
  explain: { textAlign: "center" },
});
