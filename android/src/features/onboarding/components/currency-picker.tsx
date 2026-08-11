import {
  CURRENCY_METADATA,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { Chip } from "react-native-paper";

import { SPACING } from "@/core/ui/theme";

/**
 * Which currency the amounts that follow are in. Asked once, on the first
 * screen that shows one, because every field after it inherits the answer.
 */
export function CurrencyPicker({
  selected,
  onSelect,
}: {
  selected: SupportedCurrency;
  onSelect: (currency: SupportedCurrency) => void;
}) {
  return (
    <View style={styles.row}>
      {SUPPORTED_CURRENCIES.map((currency) => {
        const meta = CURRENCY_METADATA[currency];
        return (
          <Chip
            key={currency}
            mode="outlined"
            selected={currency === selected}
            showSelectedCheck={false}
            onPress={() => onSelect(currency)}
            accessibilityLabel={`${meta.nativeName} (${currency})`}
          >
            {`${meta.flag} ${currency}`}
          </Chip>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: SPACING.sm },
});
