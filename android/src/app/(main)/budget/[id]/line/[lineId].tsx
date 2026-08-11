import { router, useLocalSearchParams } from "expo-router";
import type { SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { ScrollView, StyleSheet, useColorScheme, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Dialog,
  Menu,
  Portal,
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
import {
  useDeleteBudgetLine,
  usePostponeBudgetLine,
} from "@/features/budget-details/budget-line-mutations";
import { BudgetLineSheet } from "@/features/budget-details/components/budget-line-sheet";
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
  const remove = useDeleteBudgetLine();
  const postpone = usePostponeBudgetLine();
  const [hasToggleFailed, setToggleFailed] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isEditVisible, setEditVisible] = useState(false);
  const [isDeleteVisible, setDeleteVisible] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

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
        <Menu
          visible={isMenuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              onPress={() => setMenuOpen(true)}
              accessibilityLabel="Actions sur la prévision"
            />
          }
        >
          <Menu.Item
            leadingIcon="pencil"
            title="Modifier"
            onPress={() => {
              setMenuOpen(false);
              setEditVisible(true);
            }}
          />
          <Menu.Item
            leadingIcon="calendar-arrow-right"
            title="Reporter au mois suivant"
            disabled={postpone.isPending}
            onPress={() => {
              setMenuOpen(false);
              postpone.mutate(line.id, {
                // The line has left this month, so the page it was opened from
                // no longer has anything to show.
                onSuccess: () => router.back(),
                onError: () =>
                  setFailure("Le report n'a pas pu être fait. Réessaie."),
              });
            }}
          />
          <Menu.Item
            leadingIcon="trash-can-outline"
            title="Supprimer"
            onPress={() => {
              setMenuOpen(false);
              setDeleteVisible(true);
            }}
          />
        </Menu>
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

      <Snackbar visible={failure !== null} onDismiss={() => setFailure(null)}>
        {failure ?? ""}
      </Snackbar>

      <BudgetLineSheet
        // Keyed on the line so reopening after a change starts from the saved
        // values rather than from what the form held on first mount.
        key={line.updatedAt}
        isVisible={isEditVisible}
        onDismiss={() => setEditVisible(false)}
        budgetId={id}
        currency={currency}
        line={line}
        onSaved={() => setEditVisible(false)}
      />

      <Portal>
        <Dialog
          visible={isDeleteVisible}
          onDismiss={() => setDeleteVisible(false)}
        >
          <Dialog.Title>Supprimer cette prévision ?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {transactions.length === 0
                ? "Elle disparaîtra de ce mois-ci."
                : `Les ${transactions.length} opérations rattachées resteront, mais sans prévision.`}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteVisible(false)}>Annuler</Button>
            <Button
              loading={remove.isPending}
              disabled={remove.isPending}
              onPress={() =>
                remove.mutate(line.id, {
                  onSuccess: () => router.back(),
                  onError: () => {
                    setDeleteVisible(false);
                    setFailure(
                      "La prévision n'a pas pu être supprimée. Réessaie.",
                    );
                  },
                })
              }
            >
              Supprimer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
