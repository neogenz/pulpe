import { router, useLocalSearchParams } from "expo-router";
import type { SupportedCurrency, Transaction } from "pulpe-shared";
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
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
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
import { SpreadExistingSheet } from "@/features/budget-details/spread/components/spread-existing-sheet";
import { SpreadOccurrencesSheet } from "@/features/budget-details/spread/components/spread-occurrences-sheet";
import { useDeleteSavingsWithdrawal } from "@/features/budget-details/savings-withdrawal/withdrawal-mutations";
import { repaymentPeriod } from "@/features/budget-details/savings-withdrawal/withdrawal-gate";
import { TransactionRow } from "@/features/budget-details/components/transaction-row";
import { TransactionSheet } from "@/features/transactions/components/transaction-sheet";
import { useTransactionRemoval } from "@/features/transactions/use-transaction-removal";

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
  // Repaints this screen when amounts are hidden or shown; the masking
  // itself lives in the formatters.
  useAmountMasking();
  const { id, lineId } = useLocalSearchParams<{ id: string; lineId: string }>();
  const theme = useTheme();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const settings = useUserSettings();
  const details = useBudgetDetails(id);
  const tags = useTags();
  const toggle = useToggleCheck(id);
  const remove = useDeleteBudgetLine();
  const removePair = useDeleteSavingsWithdrawal();
  const postpone = usePostponeBudgetLine();
  const [hasToggleFailed, setToggleFailed] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isEditVisible, setEditVisible] = useState(false);
  const [isDeleteVisible, setDeleteVisible] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [isAddVisible, setAddVisible] = useState(false);
  const [edited, setEdited] = useState<Transaction | null>(null);
  const [isSpreadVisible, setSpreadVisible] = useState(false);
  const [areOccurrencesVisible, setOccurrencesVisible] = useState(false);
  const removal = useTransactionRemoval();

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;

  if (details.isPending) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const budget = details.data?.budget;
  const line = details.data?.budgetLines.find((row) => row.id === lineId);

  if (line === undefined || budget === undefined) {
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
  // The pair spans two months and the open budget shows one of them: an income
  // half sits on month M, a repayment half on M+1.
  const incomePeriod =
    line.kind === "income"
      ? { year: budget.year, month: budget.month }
      : previousPeriod({ year: budget.year, month: budget.month });
  const incomeMonthName = formatMonthName(
    incomePeriod.month,
    incomePeriod.year,
  ).toLocaleLowerCase();
  const repaymentMonthName = formatMonthName(
    repaymentPeriod(incomePeriod).month,
    repaymentPeriod(incomePeriod).year,
  ).toLocaleLowerCase();
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
          {line.spreadGroupId != null && (
            <Menu.Item
              leadingIcon="calendar-multiple"
              title="Voir les mois lissés"
              onPress={() => {
                setMenuOpen(false);
                setOccurrencesVisible(true);
              }}
            />
          )}
          {/* Spreading redistributes a one-off's own total forward. A recurring
              forecast already spans months, and a revenue has no shape to
              spread — both are out by the endpoint's own rules. */}
          {line.spreadGroupId == null &&
            line.recurrence === "one_off" &&
            line.kind !== "income" && (
              <Menu.Item
                leadingIcon="calendar-multiple"
                title="Lisser sur plusieurs mois"
                onPress={() => {
                  setMenuOpen(false);
                  setSpreadVisible(true);
                }}
              />
            )}
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
              onPress={() => setEdited(transaction)}
              onToggle={() =>
                toggle.mutate(
                  { source: "transaction", sourceId: transaction.id },
                  { onError: () => setToggleFailed(true) },
                )
              }
            />
          ))
        )}

        {/* Allocating happens here and only here: the envelope being filled is
            on screen, so nothing has to be picked from a list of them. */}
        <Button
          mode="outlined"
          icon="plus"
          onPress={() => setAddVisible(true)}
          style={styles.add}
        >
          Ajouter une opération
        </Button>
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
        anchor={{ year: budget.year, month: budget.month }}
        currency={currency}
        line={line}
        onSaved={() => setEditVisible(false)}
      />

      <Snackbar
        visible={removal.last !== null}
        onDismiss={removal.forget}
        action={{ label: "Annuler", onPress: removal.undo }}
      >
        {removal.undoable.length === 1
          ? `« ${removal.last?.name} » supprimée`
          : `${removal.undoable.length} opérations supprimées`}
      </Snackbar>

      <Snackbar visible={removal.hasFailed} onDismiss={removal.dismissFailure}>
        L&apos;opération n&apos;a pas pu être supprimée. Réessaie.
      </Snackbar>

      <TransactionSheet
        isVisible={isAddVisible}
        onDismiss={() => setAddVisible(false)}
        budgetId={id}
        currency={currency}
        envelope={{ id: line.id, name: line.name, kind: line.kind }}
        onSaved={() => setAddVisible(false)}
      />

      {edited !== null && (
        <TransactionSheet
          key={edited.id}
          isVisible
          onDismiss={() => setEdited(null)}
          budgetId={id}
          currency={currency}
          transaction={edited}
          onSaved={() => setEdited(null)}
          onDelete={() => removal.remove(edited, () => setEdited(null))}
        />
      )}

      <SpreadExistingSheet
        isVisible={isSpreadVisible}
        onDismiss={() => setSpreadVisible(false)}
        line={line}
        anchor={{ year: budget.year, month: budget.month }}
        currency={currency}
        // The forecast has been replaced by its tranches, so the page it was
        // opened from no longer has anything to show.
        onSpread={() => router.back()}
      />

      {line.spreadGroupId != null && (
        <SpreadOccurrencesSheet
          isVisible={areOccurrencesVisible}
          onDismiss={() => setOccurrencesVisible(false)}
          spreadGroupId={line.spreadGroupId}
          viewedPeriod={{ year: budget.year, month: budget.month }}
          payDayOfMonth={payDayOfMonth}
          currency={currency}
        />
      )}

      <Portal>
        {/* A line taken from savings is half of a pair, and deleting it alone
            would leave the other half owing nothing to anyone. The choice is
            explicit rather than defaulted: cancelling both, or keeping the
            money taken and dropping the giving back. */}
        {line.savingsWithdrawalGroupId != null ? (
          <Dialog
            visible={isDeleteVisible}
            onDismiss={() => setDeleteVisible(false)}
          >
            <Dialog.Title>Ces deux lignes sont liées</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium">
                {`+${formatCurrency(line.amount, currency)} sur ${incomeMonthName} est lié à -${formatCurrency(line.amount, currency)} sur ${repaymentMonthName}.`}
              </Text>
            </Dialog.Content>
            <Dialog.Actions style={styles.pairActions}>
              <Button onPress={() => setDeleteVisible(false)}>Annuler</Button>
              <Button
                disabled={removePair.isPending}
                onPress={() =>
                  removePair.mutate(
                    {
                      groupId: line.savingsWithdrawalGroupId as string,
                      scope: "repayment",
                    },
                    {
                      onSuccess: () => router.back(),
                      onError: () => {
                        setDeleteVisible(false);
                        setFailure("La suppression a échoué. Réessaie.");
                      },
                    },
                  )
                }
              >
                {`Garder le revenu de ${incomeMonthName}`}
              </Button>
              <Button
                loading={removePair.isPending}
                disabled={removePair.isPending}
                onPress={() =>
                  removePair.mutate(
                    {
                      groupId: line.savingsWithdrawalGroupId as string,
                      scope: "pair",
                    },
                    {
                      onSuccess: () => router.back(),
                      onError: () => {
                        setDeleteVisible(false);
                        setFailure("La suppression a échoué. Réessaie.");
                      },
                    },
                  )
                }
              >
                Tout annuler
              </Button>
            </Dialog.Actions>
          </Dialog>
        ) : (
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
        )}
      </Portal>
    </SafeAreaView>
  );
}

function previousPeriod(period: { year: number; month: number }) {
  return period.month === 1
    ? { year: period.year - 1, month: 12 }
    : { year: period.year, month: period.month - 1 };
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pairActions: { flexWrap: "wrap" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.xxl },
  hero: { gap: SPACING.xs },
  progress: { height: SPACING.sm, borderRadius: SPACING.xs },
  add: { marginTop: SPACING.sm },
});
