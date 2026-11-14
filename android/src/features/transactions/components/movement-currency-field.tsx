import { CURRENCY_METADATA, SUPPORTED_CURRENCIES } from "pulpe-shared";
import type { SupportedCurrency } from "pulpe-shared";
import { View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatIsoDate } from "@/core/ui/date-format";
import { SegmentedPicker } from "@/core/ui/segmented-picker";
import { SPACING } from "@/core/ui/theme";
import type { useCurrencyRate } from "@/features/account/currency-queries";

import type { MovementConversion } from "../movement-conversion";

/** Digits kept when the quoted rate is shown. */
const RATE_DECIMALS = 4;

interface MovementCurrencyFieldProps {
  inputCurrency: SupportedCurrency;
  onChange: (currency: SupportedCurrency) => void;
  /** The display currency the amount is booked in. */
  currency: SupportedCurrency;
  rate: ReturnType<typeof useCurrencyRate>;
  conversion: MovementConversion | null;
}

/** The currency the amount is typed in, and what it comes to in the display one. */
export function MovementCurrencyField({
  inputCurrency,
  onChange,
  currency,
  rate,
  conversion,
}: MovementCurrencyFieldProps) {
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const isForeign = inputCurrency !== currency;

  return (
    <View style={{ gap: SPACING.xs }}>
      <SegmentedPicker
        value={inputCurrency}
        onValueChange={onChange}
        accessibilityLabel={t("budgets.mutations.activity.currencyPicker")}
        buttons={SUPPORTED_CURRENCIES.map((code) => ({
          value: code,
          label: `${CURRENCY_METADATA[code].flag} ${code}`,
        }))}
      />
      {isForeign && rate.isError && (
        <Text variant="labelMedium" style={{ color: theme.colors.error }}>
          {t("budgets.mutations.activity.rateUnavailable")}
        </Text>
      )}
      {isForeign && conversion !== null && rate.data !== undefined && (
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {`≈ ${formatCurrency(conversion.amount, currency)} · ${t(
            "settings.currency.converter.rate",
            {
              base: rate.data.base,
              rate: rate.data.rate.toFixed(RATE_DECIMALS),
              target: rate.data.target,
              date: formatIsoDate(rate.data.date, locale),
            },
          )}`}
        </Text>
      )}
    </View>
  );
}
