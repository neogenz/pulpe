import { CURRENCY_METADATA, type SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { TextInput } from "react-native-paper";

import { translate } from "@/core/i18n/i18n";
import { useTranslation } from "@/core/i18n/locale-store";

import { exceedsCents, parseAmount, seedAmountText } from "./money";
import { TABULAR_DIGITS } from "./theme";

export function amountFieldAccessibilityLabel(
  t: typeof translate,
  label: string,
  currency: SupportedCurrency,
): string {
  return t("common.amountInCurrency", {
    label,
    currency: t(`common.currencyName${currency}`),
  });
}

/**
 * An amount, typed.
 *
 * The text is local state and the number goes to the store, rather than the
 * field re-rendering its own text from the store: a controlled numeric field
 * erases the decimal separator the moment it is typed, because "12," parses
 * back to 12 and renders as "12".
 *
 * `isProminent` is the amount a form exists to take: the same Material field,
 * its figure set large in the display face so the number reads first — the
 * form leads with what it is asking for.
 */
export function AmountField({
  label,
  placeholder,
  amount,
  currency,
  onChange,
  autoFocus = false,
  isProminent = false,
}: {
  label: string;
  placeholder?: string;
  amount: number | null;
  currency: SupportedCurrency;
  onChange: (amount: number | null) => void;
  autoFocus?: boolean;
  isProminent?: boolean;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => seedAmountText(amount));

  return (
    <TextInput
      mode="outlined"
      label={label}
      placeholder={placeholder}
      value={text}
      onChangeText={(next) => {
        if (exceedsCents(next)) return;
        setText(next);
        onChange(parseAmount(next));
      }}
      keyboardType="decimal-pad"
      autoFocus={autoFocus}
      style={isProminent ? styles.prominent : undefined}
      contentStyle={isProminent ? styles.prominentFigure : undefined}
      right={<TextInput.Affix text={CURRENCY_METADATA[currency].symbol} />}
      accessibilityLabel={amountFieldAccessibilityLabel(t, label, currency)}
    />
  );
}

const styles = StyleSheet.create({
  prominent: { fontSize: 28 },
  prominentFigure: {
    fontFamily: "Manrope",
    fontWeight: "800",
    ...TABULAR_DIGITS,
  },
});
