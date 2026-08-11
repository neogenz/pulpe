import { router, useLocalSearchParams } from "expo-router";
import type { SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  ProgressBar,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTags } from "@/core/tags/tag-queries";
import { tagSummary } from "@/core/tags/tag-selection";
import { formatCurrency } from "@/core/ui/amount-format";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { FINANCIAL_COLORS, SPACING, TABULAR_DIGITS } from "@/core/ui/theme";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { useBudgetDetails } from "@/features/budgets/budget-queries";
import { lineConsumption } from "@/features/budgets/line-consumption";
import { useToggleCheck } from "@/features/budgets/toggle-check-mutation";
import { TransactionRow } from "@/features/budget-details/components/transaction-row";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";
const PERCENT = 100;

const KIND_LABELS = {
  income: "Revenu",
  expense: "Dépense",
  saving: "Épargne",
} as const;

const RECURRENCE_LABELS = {
  fixed: "Récurrent",
  one_off: "Prévu",
} as const;

/**
 * One envelope and everything booked against it. The list here is the answer to
 * the row's amount: it says *where* the money went, which the parent screen has
 * no room to.
 */
export default function BudgetLineDetailScreen() {
  const { id, lineId } = useLocalSearchParams<{ id: string; lineId: string }>();
  const theme = useTheme();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const settings = useUserSettings();
  const details = useBudgetDetails(id);
  const tags = useTags();
  const toggle = useToggleCheck(id);
  const [hasToggleFailed, setToggleFailed] = useState(false);

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;

  if (details.isPending) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const line = details.data?.budgetLines.find((row) => row.id === lineId);

  if (line === undefined) {
    return (
      <PlaceholderScreen
        title="Cette prévision n'existe plus"
        hint="Elle a peut-être été supprimée depuis un autre appareil."
        action={{ label: "Revenir", onPress: () => router.back() }}
      />
    );
  }

  const transactions = (details.data?.transactions ?? []).filter(
    (transaction) => transaction.budgetLineId === lineId,
  );
  const consumption = lineConsumption(line, transactions);
  const accent =
    line.kind === "expense" && consumption.available < 0
      ? FINANCIAL_COLORS[scheme].overBudget
      : FINANCIAL_COLORS[scheme][
          line.kind === "income"
            ? "income"
            : line.kind === "saving"
              ? "savings"
              : "expense"
        ];

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={line.name} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text
            variant="labelLarge"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {KIND_LABELS[line.kind]} ·{" "}
            {RECURRENCE_LABELS[line.recurrence].toLocaleLowerCase()}
          </Text>

          <Text
            variant="displaySmall"
            style={[TABULAR_DIGITS, { color: accent }]}
            numberOfLines={1}
          >
            {formatCurrency(consumption.allocated, currency)}
          </Text>

          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            sur {formatCurrency(line.amount, currency)} prévus
          </Text>

          <ProgressBar
            progress={Math.min(consumption.percentage / PERCENT, 1)}
            color={accent}
            style={styles.progress}
          />

          <Text variant="bodyMedium" style={TABULAR_DIGITS}>
            {consumption.available >= 0
              ? `${formatCurrency(consumption.available, currency)} restants`
              : `${formatCurrency(-consumption.available, currency)} de dépassement`}
          </Text>
        </View>

        <Text variant="titleSmall">
          {transactions.length === 0
            ? "Aucune opération"
            : `${transactions.length} opération${transactions.length > 1 ? "s" : ""}`}
        </Text>

        {transactions.length === 0 ? (
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Rien n&apos;a encore été rattaché à cette prévision.
          </Text>
        ) : (
          transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              currency={currency}
              isSyncing={
                toggle.isPending &&
                toggle.variables?.sourceId === transaction.id
              }
              tagSummary={tagSummary(transaction.tagIds ?? [], tags.data ?? [])}
              onToggle={() =>
                toggle.mutate(
                  { source: "transaction", sourceId: transaction.id },
                  { onError: () => setToggleFailed(true) },
                )
              }
            />
          ))
        )}
      </ScrollView>

      <Snackbar
        visible={hasToggleFailed}
        onDismiss={() => setToggleFailed(false)}
        action={{ label: "Fermer", onPress: () => setToggleFailed(false) }}
      >
        Le pointage n&apos;a pas été enregistré. Réessaie.
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  hero: { gap: SPACING.xs },
  progress: { height: SPACING.sm, borderRadius: SPACING.xs },
});
