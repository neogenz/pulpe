import { router, useLocalSearchParams } from "expo-router";
import {
  BudgetFormulas,
  type SupportedCurrency,
  type Transaction,
} from "pulpe-shared";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Appbar,
  Button,
  Dialog,
  Menu,
  Portal,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { recurrenceLabel } from "@/core/ui/vocabulary";
import { useTranslation } from "@/core/i18n/locale-store";
import { Amount } from "@/core/ui/amount";
import { ScreenAppBar } from "@/core/ui/screen-app-bar";

import { useTags } from "@/features/tags/tag-queries";
import { tagSummary } from "@/features/tags/tag-selection";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { InlineQueryError } from "@/core/ui/inline-query-error";
import { PlaceholderScreen } from "@/core/ui/placeholder-screen";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { SPACING } from "@/core/ui/theme";
import { Notice } from "@/core/ui/notice";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import {
  useBudgetDetails,
  useBudgetList,
} from "@/features/budgets/budget-queries";
import { useToggleCheck } from "@/features/budgets/toggle-check-mutation";
import {
  useDeleteBudgetLine,
  usePostponeBudgetLine,
} from "@/features/budget-details/budget-line-mutations";
import { BudgetLineSheet } from "@/features/budget-details/components/budget-line-sheet";
import {
  hasBudgetForPeriod,
  isPostponeEligible,
  postponeTargetPeriod,
} from "@/features/budget-details/postpone-gate";
import { SpreadExistingSheet } from "@/features/budget-details/spread/components/spread-existing-sheet";
import { SpreadOccurrencesSheet } from "@/features/budget-details/spread/components/spread-occurrences-sheet";
import { useDeleteSavingsWithdrawal } from "@/features/budget-details/savings-withdrawal/withdrawal-mutations";
import { repaymentPeriod } from "@/features/budget-details/savings-withdrawal/withdrawal-gate";
import { TransactionRow } from "@/features/budget-details/components/transaction-row";
import { TransactionSheet } from "@/features/transactions/components/transaction-sheet";
import { useTransactionRemoval } from "@/features/transactions/use-transaction-removal";

const FALLBACK_CURRENCY: SupportedCurrency = "CHF";
const PERCENT = 100;

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
  const { locale, t } = useTranslation();
  const financial = useFinancialColors();
  const settings = useUserSettings();
  const details = useBudgetDetails(id);
  const budgets = useBudgetList();
  const tags = useTags();
  const toggle = useToggleCheck(id);
  const remove = useDeleteBudgetLine();
  const removePair = useDeleteSavingsWithdrawal();
  const postpone = usePostponeBudgetLine();
  const [hasToggleFailed, setToggleFailed] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isEditVisible, setEditVisible] = useState(false);
  const [isDeleteVisible, setDeleteVisible] = useState(false);
  const [failure, setFailure] = useState<
    "postpone" | "deletePair" | "deleteLine" | null
  >(null);
  const [isAddVisible, setAddVisible] = useState(false);
  const [edited, setEdited] = useState<Transaction | null>(null);
  const [isSpreadVisible, setSpreadVisible] = useState(false);
  const [areOccurrencesVisible, setOccurrencesVisible] = useState(false);
  const removal = useTransactionRemoval();

  const currency = settings.data?.currency ?? FALLBACK_CURRENCY;
  const payDayOfMonth = settings.data?.payDayOfMonth ?? null;

  if (details.isPending || settings.isPending) {
    return (
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </SafeAreaView>
    );
  }

  if (details.isError || settings.isError) {
    return (
      <SafeAreaView
        edges={["bottom"]}
        style={[styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <InlineQueryError
          message={t("budgets.actions.line.loadError")}
          onRetry={() =>
            void Promise.all([details.refetch(), settings.refetch()])
          }
        />
      </SafeAreaView>
    );
  }

  const budget = details.data?.budget;
  const line = details.data?.budgetLines.find((row) => row.id === lineId);

  if (line === undefined || budget === undefined) {
    return (
      <PlaceholderScreen
        icon="receipt-text-remove-outline"
        title={t("budgets.actions.line.missingTitle")}
        hint={t("budgets.actions.line.missingHint")}
        action={{ label: t("common.back"), onPress: () => router.back() }}
      />
    );
  }

  const transactions = (details.data?.transactions ?? []).filter(
    (transaction) => transaction.budgetLineId === lineId,
  );
  const consumption = BudgetFormulas.calculateConsumption(line, transactions);
  const postponeTarget = postponeTargetPeriod({
    year: budget.year,
    month: budget.month,
  });
  // Only claim the month is missing once the list has actually answered:
  // pending, the entry stays live and a real failure still speaks for itself.
  const isPostponeTargetMissing =
    budgets.isSuccess && !hasBudgetForPeriod(budgets.data, postponeTarget);
  // The pair spans two months and the open budget shows one of them: an income
  // half sits on month M, a repayment half on M+1.
  const incomePeriod =
    line.kind === "income"
      ? { year: budget.year, month: budget.month }
      : previousPeriod({ year: budget.year, month: budget.month });
  const incomeMonthName = formatMonthName(
    incomePeriod.month,
    incomePeriod.year,
    locale,
  );
  const repaymentMonthName = formatMonthName(
    repaymentPeriod(incomePeriod).month,
    repaymentPeriod(incomePeriod).year,
    locale,
  );
  const accent =
    line.kind === "expense" && consumption.available < 0
      ? financial.overBudget
      : financial[
          line.kind === "income"
            ? "income"
            : line.kind === "saving"
              ? "savings"
              : "expense"
        ];

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <ScreenAppBar>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={line.name} />
        <Menu
          visible={isMenuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={
            <Appbar.Action
              icon="dots-vertical"
              onPress={() => setMenuOpen(true)}
              accessibilityLabel={t("budgets.actions.line.actions")}
            />
          }
        >
          <Menu.Item
            leadingIcon="pencil"
            title={t("budgets.mutations.edit")}
            onPress={() => {
              setMenuOpen(false);
              setEditVisible(true);
            }}
          />
          {line.spreadGroupId != null && (
            <Menu.Item
              leadingIcon="calendar-multiple"
              title={t("budgets.actions.line.viewSpread")}
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
                title={t("budgets.mutations.forecast.spreadTitle")}
                onPress={() => {
                  setMenuOpen(false);
                  setSpreadVisible(true);
                }}
              />
            )}
          {/* The endpoint refuses six shapes of line outright, and no amount of
              retrying changes any of them — so the entry is simply not there.
              The seventh refusal, a next month that was never created, is the
              user's to lift: it stays on screen and says how. */}
          {isPostponeEligible(line, transactions.length) && (
            <Menu.Item
              leadingIcon={
                isPostponeTargetMissing
                  ? "calendar-alert"
                  : "calendar-arrow-right"
              }
              title={
                isPostponeTargetMissing
                  ? t("budgets.actions.line.createTargetBudget", {
                      month: formatMonthName(
                        postponeTarget.month,
                        postponeTarget.year,
                        locale,
                      ),
                    })
                  : t("budgets.actions.line.postpone")
              }
              disabled={isPostponeTargetMissing || postpone.isPending}
              onPress={() => {
                setMenuOpen(false);
                postpone.mutate(line.id, {
                  // The line has left this month, so the page it was opened from
                  // no longer has anything to show.
                  onSuccess: () => router.back(),
                  onError: () => setFailure("postpone"),
                });
              }}
            />
          )}
          <Menu.Item
            leadingIcon="trash-can-outline"
            title={t("budgets.mutations.delete")}
            onPress={() => {
              setMenuOpen(false);
              setDeleteVisible(true);
            }}
          />
        </Menu>
      </ScreenAppBar>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={details.isRefetching}
            onRefresh={() => void details.refetch()}
          />
        }
      >
        <View style={styles.hero}>
          <Text
            variant="labelLarge"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t(`vocabulary.kind.${line.kind}`)} ·{" "}
            {recurrenceLabel(t, line.recurrence).toLocaleLowerCase(locale)}
          </Text>

          <Amount size="hero" style={{ color: accent }} numberOfLines={1}>
            {formatCurrency(consumption.allocated, currency)}
          </Amount>

          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("budgets.actions.line.plannedAmount", {
              amount: formatCurrency(line.amount, currency),
            })}
          </Text>

          <ProgressBar
            progress={Math.min(consumption.percentage / PERCENT, 1)}
            color={accent}
            style={styles.progress}
          />

          <Amount size="row">
            {consumption.available >= 0
              ? t("budgets.actions.line.remaining", {
                  amount: formatCurrency(consumption.available, currency),
                })
              : t("budgets.actions.line.overrun", {
                  amount: formatCurrency(-consumption.available, currency),
                })}
          </Amount>
        </View>

        <Text variant="titleSmall">
          {t(
            `budgets.actions.line.${transactions.length === 0 ? "activityNone" : transactions.length === 1 ? "activityOne" : "activityMany"}`,
            { count: transactions.length },
          )}
        </Text>

        {transactions.length === 0 ? (
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("budgets.actions.line.empty")}
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
          {t("budgets.mutations.activity.createTitle")}
        </Button>
      </ScrollView>

      <Notice
        visible={hasToggleFailed}
        onDismiss={() => setToggleFailed(false)}
        action={{
          label: t("common.close"),
          onPress: () => setToggleFailed(false),
        }}
      >
        {t("budgets.mutations.toggleError")}
      </Notice>

      <Notice visible={failure !== null} onDismiss={() => setFailure(null)}>
        {failure === null ? "" : t(`budgets.actions.line.failure.${failure}`)}
      </Notice>

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

      <Notice
        visible={removal.last !== null}
        onDismiss={removal.forget}
        action={{ label: t("budgets.mutations.undo"), onPress: removal.undo }}
      >
        {removal.undoable.length === 1
          ? t("budgets.mutations.removal.removedOne", {
              name: removal.last?.name,
            })
          : t("budgets.mutations.removal.removedMany", {
              count: removal.undoable.length,
            })}
      </Notice>

      <Notice
        visible={removal.failure !== null}
        onDismiss={removal.dismissFailure}
      >
        {removal.failure === null
          ? ""
          : t(`budgets.mutations.removal.${removal.failure}Error`)}
      </Notice>

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
            <Dialog.Title>{t("budgets.actions.line.pairTitle")}</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium">
                {t("budgets.actions.line.pairDescription", {
                  amount: formatCurrency(line.amount, currency),
                  incomeMonth: incomeMonthName,
                  repaymentMonth: repaymentMonthName,
                })}
              </Text>
            </Dialog.Content>
            <Dialog.Actions style={styles.pairActions}>
              <Button onPress={() => setDeleteVisible(false)}>
                {t("common.cancel")}
              </Button>
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
                        setFailure("deletePair");
                      },
                    },
                  )
                }
              >
                {t("budgets.actions.line.keepIncome", {
                  month: incomeMonthName,
                })}
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
                        setFailure("deletePair");
                      },
                    },
                  )
                }
              >
                {t("budgets.actions.line.cancelPair")}
              </Button>
            </Dialog.Actions>
          </Dialog>
        ) : (
          <Dialog
            visible={isDeleteVisible}
            onDismiss={() => setDeleteVisible(false)}
          >
            <Dialog.Title>{t("budgets.actions.line.deleteTitle")}</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium">
                {transactions.length === 0
                  ? t("budgets.actions.line.deleteEmpty")
                  : t(
                      `budgets.actions.line.${transactions.length === 1 ? "deleteWithOne" : "deleteWithMany"}`,
                      { count: transactions.length },
                    )}
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setDeleteVisible(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                loading={remove.isPending}
                disabled={remove.isPending}
                onPress={() =>
                  remove.mutate(line.id, {
                    onSuccess: () => router.back(),
                    onError: () => {
                      setDeleteVisible(false);
                      setFailure("deleteLine");
                    },
                  })
                }
              >
                {t("budgets.mutations.delete")}
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
