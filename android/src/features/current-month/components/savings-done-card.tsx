import type { SupportedCurrency } from "pulpe-shared";

import { IconDisc } from "@/core/ui/icon-disc";
import { LedgerCard, LedgerRow } from "@/core/ui/ledger";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { useTranslation } from "@/core/i18n/locale-store";

interface SavingsDoneCardProps {
  amount: number;
  currency: SupportedCurrency;
  onPress: () => void;
}

/**
 * Takes the drift rows' place when nothing drifted and the month's transfers
 * are all made. One row, no heading: "tout va bien" is the whole message, and
 * a section title above one row announces a list that is not there.
 */
export function SavingsDoneCard({
  amount,
  currency,
  onPress,
}: SavingsDoneCardProps) {
  const financial = useFinancialColors();
  const { t } = useTranslation();
  const formatted = formatCompactCurrency(amount, currency);

  return (
    <LedgerCard>
      <LedgerRow
        leading={<IconDisc name="check" tint={financial.savings} />}
        title={t("home.savingsDone.title")}
        subtitle={formatted}
        onPress={onPress}
        accessibilityLabel={t("home.savingsDone.accessibility", {
          amount: formatted,
        })}
        accessibilityHint={t("home.savingsDone.hint")}
      />
    </LedgerCard>
  );
}
