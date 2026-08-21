import { CURRENCY_METADATA, type SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { TextInput } from "react-native-paper";

import { translate } from "@/core/i18n/i18n";
import { useTranslation } from "@/core/i18n/locale-store";

import { parseAmount, seedAmountText } from "./money";

export function amountFieldAccessibilityLabel(
  t: typeof translate,
  label: string,
  currency: string,
): string {
  return t("common.amountInCurrency", { label, currency });
}

/**
 * An amount, typed.
 *
 * The text is local state and the number goes to the store, rather than the
 * field re-rendering its own text from the store: a controlled numeric field
 * erases the decimal separator the moment it is typed, because "12," parses
 * back to 12 and renders as "12".
 */
export function AmountField({
  label,
  placeholder,
  amount,
  currency,
  onChange,
  autoFocus = false,
}: {
  label: string;
  placeholder?: string;
  amount: number | null;
  currency: SupportedCurrency;
  onChange: (amount: number | null) => void;
  autoFocus?: boolean;
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
        setText(next);
        onChange(parseAmount(next));
      }}
      keyboardType="decimal-pad"
      autoFocus={autoFocus}
      right={<TextInput.Affix text={CURRENCY_METADATA[currency].symbol} />}
      accessibilityLabel={amountFieldAccessibilityLabel(
        t,
        label,
        CURRENCY_METADATA[currency].nativeName,
      )}
    />
  );
}
