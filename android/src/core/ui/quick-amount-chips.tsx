import { CURRENCY_METADATA, type SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";

import { useTranslation } from "@/core/i18n/locale-store";

import { formatCurrency } from "./amount-format";
import { FilterChip } from "./filter-chip";
import { hapticSelection } from "./haptics";
import { SPACING } from "./theme";

/**
 * The amounts a hand reaches for most — a coffee, a lunch, a ticket. The same
 * four as `DesignTokens.AmountInput.quickAmounts` on iOS, so the two apps offer
 * the same shortcuts.
 */
export const QUICK_AMOUNTS = [10, 15, 20, 30] as const;

/**
 * Suggestion chips under an amount field: one tap fills it, the field still
 * takes anything typed. Material's chips, through the app's chip atom, rather
 * than a row of hand-drawn capsules.
 */
export function QuickAmountChips({
  amount,
  currency,
  onSelect,
}: {
  amount: number | null;
  currency: SupportedCurrency;
  onSelect: (amount: number) => void;
}) {
  const { t } = useTranslation();
  const symbol = CURRENCY_METADATA[currency].symbol;

  return (
    <View style={styles.row}>
      {QUICK_AMOUNTS.map((quick) => (
        <FilterChip
          key={quick}
          selected={amount === quick}
          onPress={() => {
            hapticSelection();
            onSelect(quick);
          }}
          accessibilityLabel={t("common.quickAmountAccessibility", {
            amount: formatCurrency(quick, currency),
          })}
        >
          {`${quick} ${symbol}`}
        </FilterChip>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
});
