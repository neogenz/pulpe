import { router } from "expo-router";
import type {
  SavingsGoalContribution,
  SupportedCurrency,
  Transaction,
} from "pulpe-shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Divider, Text, useTheme } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { SectionHeader } from "@/core/ui/section-header";
import { Amount } from "@/core/ui/amount";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatIsoDate, formatMonthLabel } from "@/core/ui/date-format";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { useRipple } from "@/core/ui/ripple";
import { RADIUS, SPACING } from "@/core/ui/theme";

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
  const theme = useTheme();
  const { t } = useTranslation();
  if (contributions.length === 0) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title={t("goals.contributions.title")} />

      {/* One card for the whole record, one hairline between months — the
          ledger every other list in the app is. A card per month made a year
          of saving read as twelve unrelated objects. */}
      <View style={[styles.ledger, { backgroundColor: theme.colors.surface }]}>
        {contributions.map((contribution, index) => (
          <View key={contribution.lineId}>
            {index > 0 && (
              <View
                style={[
                  styles.divider,
                  { backgroundColor: theme.colors.outlineVariant },
                ]}
              />
            )}
            <ContributionCard contribution={contribution} currency={currency} />
          </View>
        ))}
      </View>
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
  const ripple = useRipple();
  const { locale, t } = useTranslation();
  // A pointed forecast with no operation behind it has no budget to open — the
  // row stays passive rather than pretending otherwise.
  const budgetId = contribution.transactions[0]?.budgetId;
  const period = formatMonthLabel(
    contribution.budgetMonth,
    contribution.budgetYear,
    locale,
  );

  return (
    <Pressable
      disabled={budgetId === undefined}
      onPress={
        budgetId === undefined
          ? undefined
          : () => router.push(`/budget/${budgetId}`)
      }
      android_ripple={ripple}
      accessibilityRole={budgetId === undefined ? undefined : "button"}
      accessibilityLabel={
        budgetId === undefined
          ? undefined
          : t("goals.contributions.openBudget", { period })
      }
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={styles.rowLabels}>
          <Text variant="bodyLarge">{contribution.name}</Text>
          <StatusLine
            base={period}
            isChecked={contribution.checkedAt !== null}
          />
        </View>

        <Amount size="row">
          {formatCurrency(contribution.amount, currency)}
        </Amount>
      </View>

      {contribution.transactions.length > 0 && (
        <View style={styles.transactions}>
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("goals.contributions.movements")}
          </Text>
          {contribution.transactions.map((transaction, index) => (
            <View key={transaction.id}>
              {index > 0 && <Divider />}
              <TransactionLine transaction={transaction} currency={currency} />
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

function TransactionLine({
  transaction,
  currency,
}: {
  transaction: Transaction;
  currency: SupportedCurrency;
}) {
  const { locale } = useTranslation();
  return (
    <View style={styles.row}>
      <View style={styles.rowLabels}>
        <Text variant="bodyMedium">{transaction.name}</Text>
        <StatusLine
          base={formatIsoDate(transaction.transactionDate.slice(0, 10), locale)}
          isChecked={transaction.checkedAt !== null}
        />
      </View>

      <Amount size="meta">
        {formatCurrency(transaction.amount, currency)}
      </Amount>
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
  const financial = useFinancialColors();
  const { t } = useTranslation();

  return (
    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
      {base} ·{" "}
      <Text
        variant="labelSmall"
        style={{
          color: isChecked ? financial.savings : theme.colors.onSurfaceVariant,
        }}
      >
        {t(`budgets.detail.filters.${isChecked ? "checked" : "unchecked"}`)}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.sm },
  ledger: { borderRadius: RADIUS.card, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: SPACING.md },
  card: { gap: SPACING.md, padding: SPACING.md },
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
