import type { BudgetLine, SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatCurrency } from "@/core/ui/amount-format";
import { useFinancialColors, useV2Colors } from "@/core/ui/scheme-colors";
import { RADIUS, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

import { impactNote, type MovementImpact } from "../movement-impact";

interface MovementImpactBlockProps {
  impact: MovementImpact;
  /** The prévision the movement is filed under, when it has one. */
  line: BudgetLine | undefined;
  currency: SupportedCurrency;
}

/**
 * What the movement does to the disponible, before the user validates:
 * `ImpactBlock` on iOS. The figures are the struck-through "before" and the
 * "after"; they are left out when nothing moves, as the title says it.
 */
export function MovementImpactBlock({
  impact,
  line,
  currency,
}: MovementImpactBlockProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const v2 = useV2Colors();
  const financial = useFinancialColors();
  const note = impactNote(impact, line);
  const fill = { neutral: v2.sunk, over: v2.overWash, ok: v2.accentWash }[
    impact.tone
  ];
  const titleColor = {
    neutral: theme.colors.onSurfaceVariant,
    over: financial.overBudget,
    ok: v2.accentInk,
  }[impact.tone];
  const title =
    impact.tone === "neutral"
      ? t("budgets.mutations.activity.impact.neutral")
      : t(
          `budgets.mutations.activity.impact.${impact.tone === "over" ? "down" : "up"}`,
          { amount: formatCurrency(Math.abs(impact.delta), currency) },
        );
  const noteText =
    note === null
      ? null
      : t(`budgets.mutations.activity.impact.note.${note.kind}`, {
          name: "lineName" in note ? note.lineName : "",
          before: "before" in note ? formatCurrency(note.before, currency) : "",
          after: "after" in note ? formatCurrency(note.after, currency) : "",
        });

  return (
    <View
      testID="movement-impact"
      accessible
      accessibilityLabel={[title, noteText].filter(Boolean).join(", ")}
      style={[styles.block, { backgroundColor: fill }]}
    >
      <Text variant="labelLarge" style={{ color: titleColor }}>
        {title}
      </Text>
      {impact.tone !== "neutral" && (
        <View style={styles.figures}>
          <Text
            variant="titleMedium"
            style={[
              TABULAR_DIGITS,
              { color: v2.ink3, textDecorationLine: "line-through" },
            ]}
          >
            {formatCurrency(impact.before, currency)}
          </Text>
          <Text variant="titleMedium" style={{ color: v2.ink3 }}>
            →
          </Text>
          <Text variant="titleMedium" style={TABULAR_DIGITS}>
            {formatCurrency(impact.after, currency)}
          </Text>
        </View>
      )}
      {noteText !== null && (
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {noteText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: SPACING.xs,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + SPACING.xs,
  },
  figures: { flexDirection: "row", alignItems: "baseline", gap: SPACING.sm },
});
