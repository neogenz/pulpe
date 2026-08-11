import { getCurrencyFormatter, type SupportedCurrency } from "pulpe-shared";
import { StyleSheet, View } from "react-native";
import { IconButton, Text, useTheme } from "react-native-paper";

import { SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

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
}: {
  title: string;
  transactions: readonly OnboardingTransaction[];
  currency: SupportedCurrency;
  onEdit: (transaction: OnboardingTransaction) => void;
}) {
  const theme = useTheme();
  const formatter = getCurrencyFormatter(currency);

  if (transactions.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="labelLarge">{title}</Text>
      {transactions.map((transaction) => (
        <View key={transaction.id} style={styles.row}>
          <View style={styles.labels}>
            <Text variant="bodyLarge">{transaction.name}</Text>
            <Text
              variant="bodySmall"
              style={[TABULAR_DIGITS, { color: theme.colors.onSurfaceVariant }]}
            >
              {formatter.format(transaction.amount)}
            </Text>
          </View>
          <IconButton
            icon="pencil"
            onPress={() => onEdit(transaction)}
            accessibilityLabel={`Modifier ${transaction.name}`}
          />
          <IconButton
            icon="close"
            onPress={() => removeCustomTransaction(transaction.id)}
            accessibilityLabel={`Supprimer ${transaction.name}`}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.xs },
  row: { flexDirection: "row", alignItems: "center" },
  labels: { flex: 1, gap: SPACING.xxs },
});
