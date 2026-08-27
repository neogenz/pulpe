import type { SupportedCurrency } from "pulpe-shared";
import { StyleSheet } from "react-native";
import { List } from "react-native-paper";

import { IconDisc } from "@/core/ui/icon-disc";
import { Amount } from "@/core/ui/amount";
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
    <List.Item
      title={t("home.savingsDone.title")}
      description={() => (
        <Amount size="meta" tone="muted">
          {formatted}
        </Amount>
      )}
      left={() => <IconDisc name="check" tint={financial.savings} />}
      right={(props) => <List.Icon {...props} icon="chevron-right" />}
      onPress={onPress}
      accessibilityLabel={t("home.savingsDone.accessibility", {
        amount: formatted,
      })}
      accessibilityHint={t("home.savingsDone.hint")}
      style={styles.item}
    />
  );
}

const styles = StyleSheet.create({
  // Paper pads its list chrome to its own gutter; the page already has one.
  item: { paddingHorizontal: 0 },
});
