import { type SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { IconButton, Text } from "react-native-paper";

import { Amount } from "@/core/ui/amount";
import { formatCurrency } from "@/core/ui/amount-format";
import { ROW_ACTION_ICON_SIZE, SPACING } from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";

import { removeCustomTransaction } from "../onboarding-store";
import type { OnboardingTransaction } from "../onboarding-transaction";

/**
 * What the user has added so far on this step, each line editable and
 * removable. Empty renders nothing rather than an empty-state card: the step
 * already says what it is asking for.
 */
export function TransactionList({
  title,
  transactions,
  currency,
  onEdit,
  localized = false,
}: {
  title: string;
  transactions: readonly OnboardingTransaction[];
  currency: SupportedCurrency;
  onEdit: (transaction: OnboardingTransaction) => void;
  localized?: boolean;
}) {
  const { t } = useTranslation();
  if (transactions.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="labelLarge">{title}</Text>
      {transactions.map((transaction) => (
        <View key={transaction.id} style={styles.row}>
          <View style={styles.labels}>
            <Text variant="bodyLarge">{transaction.name}</Text>
            <Amount size="meta" tone="muted">
              {formatCurrency(transaction.amount, currency)}
            </Amount>
          </View>
          <IconButton
            icon="pencil"
            size={ROW_ACTION_ICON_SIZE}
            style={styles.action}
            onPress={() => onEdit(transaction)}
            accessibilityLabel={
              localized
                ? t("onboarding.transaction.edit", { name: transaction.name })
                : `Modifier ${transaction.name}`
            }
          />
          <IconButton
            icon="close"
            size={ROW_ACTION_ICON_SIZE}
            style={styles.action}
            onPress={() => removeCustomTransaction(transaction.id)}
            accessibilityLabel={
              localized
                ? t("onboarding.transaction.delete", { name: transaction.name })
                : `Supprimer ${transaction.name}`
            }
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.xs },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  labels: { flex: 1, gap: SPACING.xxs },
  action: { margin: 0 },
});
