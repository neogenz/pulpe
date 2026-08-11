import { router } from "expo-router";
import type {
  SavingsGoalContribution,
  SupportedCurrency,
  Transaction,
} from "pulpe-shared";
import { StyleSheet, useColorScheme, View } from "react-native";
import { Card, Divider, Text, useTheme } from "react-native-paper";

import { formatCurrency } from "@/core/ui/amount-format";
import { formatIsoDate, formatMonthLabel } from "@/core/ui/date-format";
import { FINANCIAL_COLORS, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";

interface GoalContributionsProps {
  contributions: SavingsGoalContribution[];
  currency: SupportedCurrency;
}

/**
 * "Ton suivi" — every forecast that feeds this goal, month by month, with the
 * operations actually booked against it.
 *
 * The list starts from the forecasts rather than the transactions: pointing a
 * forecast is a contribution with no transaction behind it, and a list built
 * from transactions would lose exactly those months.
 */
export function GoalContributions({
  contributions,
  currency,
}: GoalContributionsProps) {
  if (contributions.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="titleMedium">Ton suivi</Text>

      {contributions.map((contribution) => (
        <ContributionCard
          key={contribution.lineId}
          contribution={contribution}
          currency={currency}
        />
      ))}
    </View>
  );
}

function ContributionCard({
  contribution,
  currency,
}: {
  contribution: SavingsGoalContribution;
  currency: SupportedCurrency;
}) {
  const theme = useTheme();
  // A pointed forecast with no operation behind it has no budget to open — the
  // row stays passive rather than pretending otherwise.
  const budgetId = contribution.transactions[0]?.budgetId;
  const period = formatMonthLabel(
    contribution.budgetMonth,
    contribution.budgetYear,
  );

  return (
    <Card
      mode="contained"
      onPress={
        budgetId === undefined
          ? undefined
          : () => router.push(`/budget/${budgetId}`)
      }
      accessibilityLabel={
        budgetId === undefined ? undefined : `Ouvrir le budget de ${period}`
      }
    >
      <Card.Content style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLabels}>
            <Text variant="bodyLarge">{contribution.name}</Text>
            <StatusLine
              base={period}
              isChecked={contribution.checkedAt !== null}
            />
          </View>

          <Text variant="titleMedium" style={TABULAR_DIGITS}>
            {formatCurrency(contribution.amount, currency)}
          </Text>
        </View>

        {contribution.transactions.length > 0 && (
          <View style={styles.transactions}>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Transactions réelles
            </Text>
            {contribution.transactions.map((transaction, index) => (
              <View key={transaction.id}>
                {index > 0 && <Divider />}
                <TransactionLine
                  transaction={transaction}
                  currency={currency}
                />
              </View>
            ))}
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

function TransactionLine({
  transaction,
  currency,
}: {
  transaction: Transaction;
  currency: SupportedCurrency;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabels}>
        <Text variant="bodyMedium">{transaction.name}</Text>
        <StatusLine
          base={formatIsoDate(transaction.transactionDate.slice(0, 10))}
          isChecked={transaction.checkedAt !== null}
        />
      </View>

      <Text variant="labelLarge" style={TABULAR_DIGITS}>
        {formatCurrency(transaction.amount, currency)}
      </Text>
    </View>
  );
}

/**
 * "Juillet 2026 · Pointé". The pointing state lives in the metadata line and
 * only "Pointé" takes the savings colour — the passive surface has no circle,
 * because a circle is the vocabulary of the interactive control everywhere else.
 */
function StatusLine({ base, isChecked }: { base: string; isChecked: boolean }) {
  const theme = useTheme();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  return (
    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
      {base} ·{" "}
      <Text
        variant="labelSmall"
        style={{
          color: isChecked
            ? FINANCIAL_COLORS[scheme].savings
            : theme.colors.onSurfaceVariant,
        }}
      >
        {isChecked ? "Pointé" : "À pointer"}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm },
  card: { gap: SPACING.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  rowLabels: { flex: 1, gap: SPACING.xxs },
  transactions: { paddingLeft: SPACING.md, gap: SPACING.xs },
});
