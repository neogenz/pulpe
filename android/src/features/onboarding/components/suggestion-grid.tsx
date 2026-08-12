import * as Haptics from "expo-haptics";
import { type SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Chip, Text, useTheme } from "react-native-paper";

import { formatCurrency } from "@/core/ui/amount-format";
import { SPACING } from "@/core/ui/theme";

import {
  isSuggestionSelected,
  toggleSuggestion,
  useOnboardingStore,
} from "../onboarding-store";
import type { OnboardingTransaction } from "../onboarding-transaction";

/**
 * The common answers, one tap each. A chip carries a stable identity, so
 * toggling it off removes the line it added rather than the first line that
 * happens to share its name.
 */
export function SuggestionGrid({
  suggestions,
  currency,
}: {
  suggestions: readonly OnboardingTransaction[];
  currency: SupportedCurrency;
}) {
  const theme = useTheme();
  const state = useOnboardingStore();

  return (
    <View style={styles.section}>
      <Text variant="labelLarge">Suggestions</Text>
      <View style={styles.grid}>
        {suggestions.map((suggestion) => {
          const isSelected = isSuggestionSelected(state, suggestion);
          return (
            <Chip
              key={suggestion.id}
              mode="outlined"
              selected={isSelected}
              showSelectedCheck
              onPress={() => {
                void Haptics.selectionAsync();
                toggleSuggestion(suggestion);
              }}
              accessibilityLabel={`${suggestion.name}, ${formatCurrency(suggestion.amount, currency)}`}
            >
              {suggestion.name}
            </Chip>
          );
        })}
      </View>
      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        Tu pourras ajuster chaque montant plus tard.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
});
