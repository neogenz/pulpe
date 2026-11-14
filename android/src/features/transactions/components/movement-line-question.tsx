import {
  BudgetFormulas,
  type BudgetLine,
  type SupportedCurrency,
  type Transaction,
} from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { FilterChip } from "@/core/ui/filter-chip";
import { EMPHASIS, SPACING } from "@/core/ui/theme";

interface MovementLineQuestionProps {
  isEditing: boolean;
  isLocked: boolean;
  /** The first chip: the user's pick, the suggestion, or the line an edit sits in. */
  shownLine: BudgetLine | undefined;
  selectedLineId: string | null;
  hasEligibleLines: boolean;
  transactions: Transaction[];
  currency: SupportedCurrency;
  onPick: (lineId: string | null) => void;
  onPickOther: () => void;
}

/** « C'était prévu dans ton budget ? » */
export function MovementLineQuestion({
  isEditing,
  isLocked,
  shownLine,
  selectedLineId,
  hasEligibleLines,
  transactions,
  currency,
  onPick,
  onPickOther,
}: MovementLineQuestionProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      testID="movement-question"
      style={[styles.question, isLocked && !isEditing && styles.locked]}
    >
      <Text
        variant="labelLarge"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {t("budgets.mutations.activity.question")}
      </Text>
      <View style={styles.chips}>
        {shownLine !== undefined && (
          <FilterChip
            selected={selectedLineId === shownLine.id}
            disabled={isLocked}
            onPress={() => onPick(shownLine.id)}
            accessibilityState={{
              selected: selectedLineId === shownLine.id,
            }}
          >
            {`${shownLine.name} · ${t("budgets.mutations.activity.leftChip", {
              amount: formatCompactCurrency(
                Math.max(
                  BudgetFormulas.calculateConsumption(shownLine, transactions)
                    .available,
                  0,
                ),
                currency,
              ),
            })}`}
          </FilterChip>
        )}
        {hasEligibleLines && !isEditing && (
          <FilterChip
            testID="movement-other-line"
            disabled={isLocked}
            onPress={() => onPickOther()}
          >
            {t("budgets.mutations.activity.other")}
          </FilterChip>
        )}
        <FilterChip
          testID="movement-unplanned"
          selected={selectedLineId === null}
          disabled={isLocked}
          onPress={() => onPick(null)}
          accessibilityState={{ selected: selectedLineId === null }}
        >
          {t("budgets.mutations.activity.unplanned")}
        </FilterChip>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  question: { gap: SPACING.sm },
  locked: { opacity: EMPHASIS.disabled },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
});
