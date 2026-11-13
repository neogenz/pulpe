import {
  type BudgetLine,
  type BudgetPeriod,
  getBudgetPeriodDates,
  getBudgetPeriodForDate,
  type SupportedCurrency,
  type Transaction,
} from "pulpe-shared";
import { forwardRef, useImperativeHandle, useState } from "react";
import { StyleSheet } from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";

import { formatAmount, formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { useTranslation } from "@/core/i18n/locale-store";
import { budgetTiming } from "@/features/budgets/budget-list-selectors";
import { Notice } from "@/core/ui/notice";
import { useTransactionRemoval } from "@/features/transactions/use-transaction-removal";
import { TransactionSheet } from "@/features/transactions/components/transaction-sheet";

import {
  useDeleteBudgetLine,
  usePostponeBudgetLine,
} from "../budget-line-mutations";
import { type MonthLedger, impactOfRemoving } from "../month-impact";
import { postponeTargetPeriod } from "../postpone-gate";
import { repaymentPeriod } from "../savings-withdrawal/withdrawal-gate";
import { useDeleteSavingsWithdrawal } from "../savings-withdrawal/withdrawal-mutations";
import { SpreadExistingSheet } from "../spread/components/spread-existing-sheet";
import { SpreadOccurrencesSheet } from "../spread/components/spread-occurrences-sheet";
import { BudgetLineSheet } from "./budget-line-sheet";
import { CatchUpSheet } from "./catch-up-sheet";
import {
  impactBlockFor,
  ImpactConfirmSheet,
  impactTitle,
} from "./impact-confirm-sheet";

export interface BudgetLineDetailOverlaysHandle {
  editLine: () => void;
  editTransaction: (transaction: Transaction) => void;
  addTransaction: () => void;
  showSpread: () => void;
  showOccurrences: () => void;
  postpone: () => void;
  catchUp: () => void;
  confirmDelete: () => void;
  showToggleFailure: () => void;
}

interface BudgetLineDetailOverlaysProps {
  budgetId: string;
  period: BudgetPeriod;
  currency: SupportedCurrency;
  payDayOfMonth: number | null;
  line: BudgetLine;
  /** The line's own movements. */
  transactions: Transaction[];
  /** The whole month, to say what leaving it does to the disponible. */
  ledger: MonthLedger;
  onLeave: () => void;
}

/** One owner for every form, dialog, notice and mutation above a line detail. */
export const BudgetLineDetailOverlays = forwardRef<
  BudgetLineDetailOverlaysHandle,
  BudgetLineDetailOverlaysProps
>(function BudgetLineDetailOverlays(
  {
    budgetId,
    period,
    currency,
    payDayOfMonth,
    line,
    transactions,
    ledger,
    onLeave,
  },
  ref,
) {
  const { locale, t } = useTranslation();
  // A closed month has no model to write into: « Mensuel » would be a lie.
  const isClosedMonth =
    budgetTiming(period, getBudgetPeriodForDate(new Date(), payDayOfMonth)) ===
    "past";
  const periodDates = getBudgetPeriodDates(
    period.month,
    period.year,
    payDayOfMonth,
  );
  const remove = useDeleteBudgetLine();
  const removePair = useDeleteSavingsWithdrawal();
  const postpone = usePostponeBudgetLine();
  const removal = useTransactionRemoval();
  const [isEditVisible, setEditVisible] = useState(false);
  const [isDeleteVisible, setDeleteVisible] = useState(false);
  const [isPostponeVisible, setPostponeVisible] = useState(false);
  const [isCatchUpVisible, setCatchUpVisible] = useState(false);
  const [isAddVisible, setAddVisible] = useState(false);
  const [edited, setEdited] = useState<Transaction | null>(null);
  const [isSpreadVisible, setSpreadVisible] = useState(false);
  const [areOccurrencesVisible, setOccurrencesVisible] = useState(false);
  const [hasToggleFailed, setToggleFailed] = useState(false);
  const [failure, setFailure] = useState<"deletePair" | null>(null);

  useImperativeHandle(ref, () => ({
    editLine: () => setEditVisible(true),
    editTransaction: setEdited,
    addTransaction: () => setAddVisible(true),
    showSpread: () => setSpreadVisible(true),
    showOccurrences: () => setOccurrencesVisible(true),
    postpone: () => setPostponeVisible(true),
    catchUp: () => setCatchUpVisible(true),
    confirmDelete: () => setDeleteVisible(true),
    showToggleFailure: () => setToggleFailed(true),
  }));

  const incomePeriod = line.kind === "income" ? period : previousPeriod(period);
  const incomeMonthName = formatMonthName(
    incomePeriod.month,
    incomePeriod.year,
    locale,
  );
  const postponeTarget = postponeTargetPeriod(period);
  const nextMonthName = formatMonthName(
    postponeTarget.month,
    postponeTarget.year,
    locale,
  );
  const currentMonthName = formatMonthName(period.month, period.year, locale);
  const removalImpact = impactOfRemoving(ledger, line.id);
  const deleteMessage = [
    transactions.length > 0
      ? t("budgets.actions.line.deleteMovements", {
          count: transactions.length,
          total: formatAmount(
            transactions.reduce((sum, { amount }) => sum + amount, 0),
            currency,
          ),
        })
      : null,
    removalImpact.tone === "neutral"
      ? t("budgets.actions.line.deleteNoMove")
      : null,
  ]
    .filter((sentence) => sentence !== null)
    .join(" ");
  const deleteParagraphs = [
    deleteMessage,
    line.templateLineId !== null
      ? t("budgets.actions.line.deleteTemplate", {
          month: currentMonthName,
          name: line.name,
        })
      : null,
  ]
    .filter((paragraph) => paragraph !== null && paragraph !== "")
    .join("\n");
  const repayment = repaymentPeriod(incomePeriod);
  const repaymentMonthName = formatMonthName(
    repayment.month,
    repayment.year,
    locale,
  );

  return (
    <>
      {/* One slot, the most pressing news first: four snackbars sharing the
          spot drew over one another. Lifted over the page's FAB. */}
      {removal.failure !== null ? (
        <Notice clearsFab visible onDismiss={removal.dismissFailure}>
          {t(`budgets.mutations.removal.${removal.failure}Error`)}
        </Notice>
      ) : failure !== null ? (
        <Notice clearsFab visible onDismiss={() => setFailure(null)}>
          {t(`budgets.actions.line.failure.${failure}`)}
        </Notice>
      ) : hasToggleFailed ? (
        <Notice
          clearsFab
          visible
          onDismiss={() => setToggleFailed(false)}
          action={{
            label: t("common.close"),
            onPress: () => setToggleFailed(false),
          }}
        >
          {t("budgets.mutations.toggleError")}
        </Notice>
      ) : (
        <Notice
          clearsFab
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
      )}

      <BudgetLineSheet
        key={line.updatedAt}
        isVisible={isEditVisible}
        onDismiss={() => setEditVisible(false)}
        budgetId={budgetId}
        anchor={period}
        currency={currency}
        isEveryMonthDisabled={isClosedMonth}
        line={line}
        onSaved={() => setEditVisible(false)}
      />

      <TransactionSheet
        isVisible={isAddVisible}
        onDismiss={() => setAddVisible(false)}
        budgetId={budgetId}
        currency={currency}
        period={periodDates}
        envelope={{ id: line.id, name: line.name, kind: line.kind }}
        onSaved={() => setAddVisible(false)}
      />

      {edited !== null && (
        <TransactionSheet
          key={edited.id}
          isVisible
          onDismiss={() => setEdited(null)}
          budgetId={budgetId}
          currency={currency}
          period={periodDates}
          transaction={edited}
          onSaved={() => setEdited(null)}
          onDelete={() => removal.remove(edited, () => setEdited(null))}
          isDeleting={removal.isPending}
          hasDeleteFailed={removal.failure === "delete"}
        />
      )}

      <SpreadExistingSheet
        isVisible={isSpreadVisible}
        onDismiss={() => setSpreadVisible(false)}
        line={line}
        anchor={period}
        currency={currency}
        onSpread={onLeave}
      />

      {line.spreadGroupId != null && (
        <SpreadOccurrencesSheet
          isVisible={areOccurrencesVisible}
          onDismiss={() => setOccurrencesVisible(false)}
          spreadGroupId={line.spreadGroupId}
          viewedPeriod={period}
          payDayOfMonth={payDayOfMonth}
          currency={currency}
        />
      )}

      {/* Reporting moves the amount out of this month: say what that does to
          the disponible before it happens, not after. */}
      <ImpactConfirmSheet
        isVisible={isPostponeVisible}
        onDismiss={() => {
          postpone.reset();
          setPostponeVisible(false);
        }}
        title={t("budgets.postpone.title", { month: nextMonthName })}
        message={t("budgets.postpone.message", {
          amount: formatAmount(line.amount, currency),
          name: line.name,
          current: currentMonthName,
          next: nextMonthName,
        })}
        impact={impactBlockFor(
          removalImpact,
          impactTitle(t, removalImpact, currency),
        )}
        currency={currency}
        confirmLabel={t("budgets.postpone.confirm")}
        isBusy={postpone.isPending}
        error={
          postpone.isError ? t("budgets.actions.line.failure.postpone") : null
        }
        onConfirm={() =>
          postpone.mutate(line.id, {
            onSuccess: () => {
              setPostponeVisible(false);
              onLeave();
            },
          })
        }
      />

      {isCatchUpVisible && (
        <CatchUpSheet
          onDismiss={() => setCatchUpVisible(false)}
          onDone={() => setCatchUpVisible(false)}
          ledger={ledger}
          focusLineId={line.id}
          monthName={currentMonthName}
          currency={currency}
        />
      )}

      {line.savingsWithdrawalGroupId == null && (
        <ImpactConfirmSheet
          isVisible={isDeleteVisible}
          onDismiss={() => {
            remove.reset();
            setDeleteVisible(false);
          }}
          title={t("budgets.actions.line.deleteTitle", { name: line.name })}
          message={deleteParagraphs}
          impact={
            removalImpact.tone === "neutral"
              ? undefined
              : impactBlockFor(
                  removalImpact,
                  impactTitle(t, removalImpact, currency),
                )
          }
          currency={currency}
          isDestructive
          confirmLabel={t("budgets.actions.line.deleteConfirm")}
          isBusy={remove.isPending}
          error={
            remove.isError ? t("budgets.actions.line.failure.deleteLine") : null
          }
          onConfirm={() => remove.mutate(line.id, { onSuccess: onLeave })}
        />
      )}

      <Portal>
        {line.savingsWithdrawalGroupId != null && (
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
                      onSuccess: onLeave,
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
                      onSuccess: onLeave,
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
        )}
      </Portal>
    </>
  );
});

function previousPeriod(period: BudgetPeriod): BudgetPeriod {
  return period.month === 1
    ? { year: period.year - 1, month: 12 }
    : { year: period.year, month: period.month - 1 };
}

const styles = StyleSheet.create({ pairActions: { flexWrap: "wrap" } });
