import type {
  BudgetLine,
  BudgetPeriod,
  SupportedCurrency,
  Transaction,
} from "pulpe-shared";
import { forwardRef, useImperativeHandle, useState } from "react";
import { StyleSheet } from "react-native";
import { Button, Dialog, Portal, Text } from "react-native-paper";

import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { useTranslation } from "@/core/i18n/locale-store";
import { Notice } from "@/core/ui/notice";
import { useTransactionRemoval } from "@/features/transactions/use-transaction-removal";
import { TransactionSheet } from "@/features/transactions/components/transaction-sheet";

import {
  useDeleteBudgetLine,
  usePostponeBudgetLine,
} from "../budget-line-mutations";
import { repaymentPeriod } from "../savings-withdrawal/withdrawal-gate";
import { useDeleteSavingsWithdrawal } from "../savings-withdrawal/withdrawal-mutations";
import { SpreadExistingSheet } from "../spread/components/spread-existing-sheet";
import { SpreadOccurrencesSheet } from "../spread/components/spread-occurrences-sheet";
import { BudgetLineSheet } from "./budget-line-sheet";

export interface BudgetLineDetailOverlaysHandle {
  editLine: () => void;
  editTransaction: (transaction: Transaction) => void;
  addTransaction: () => void;
  showSpread: () => void;
  showOccurrences: () => void;
  postpone: () => void;
  confirmDelete: () => void;
  showToggleFailure: () => void;
}

interface BudgetLineDetailOverlaysProps {
  budgetId: string;
  period: BudgetPeriod;
  currency: SupportedCurrency;
  payDayOfMonth: number | null;
  line: BudgetLine;
  transactions: Transaction[];
  onLeave: () => void;
}

/** One owner for every form, dialog, notice and mutation above a line detail. */
export const BudgetLineDetailOverlays = forwardRef<
  BudgetLineDetailOverlaysHandle,
  BudgetLineDetailOverlaysProps
>(function BudgetLineDetailOverlays(
  { budgetId, period, currency, payDayOfMonth, line, transactions, onLeave },
  ref,
) {
  const { locale, t } = useTranslation();
  const remove = useDeleteBudgetLine(budgetId);
  const removePair = useDeleteSavingsWithdrawal();
  const postpone = usePostponeBudgetLine();
  const removal = useTransactionRemoval();
  const [isEditVisible, setEditVisible] = useState(false);
  const [isDeleteVisible, setDeleteVisible] = useState(false);
  const [isAddVisible, setAddVisible] = useState(false);
  const [edited, setEdited] = useState<Transaction | null>(null);
  const [isSpreadVisible, setSpreadVisible] = useState(false);
  const [areOccurrencesVisible, setOccurrencesVisible] = useState(false);
  const [hasToggleFailed, setToggleFailed] = useState(false);
  const [failure, setFailure] = useState<
    "postpone" | "deletePair" | "deleteLine" | null
  >(null);

  useImperativeHandle(ref, () => ({
    editLine: () => setEditVisible(true),
    editTransaction: setEdited,
    addTransaction: () => setAddVisible(true),
    showSpread: () => setSpreadVisible(true),
    showOccurrences: () => setOccurrencesVisible(true),
    postpone: () => {
      if (postpone.isPending) return;
      postpone.mutate(line.id, {
        onSuccess: onLeave,
        onError: () => setFailure("postpone"),
      });
    },
    confirmDelete: () => setDeleteVisible(true),
    showToggleFailure: () => setToggleFailed(true),
  }));

  const incomePeriod = line.kind === "income" ? period : previousPeriod(period);
  const incomeMonthName = formatMonthName(
    incomePeriod.month,
    incomePeriod.year,
    locale,
  );
  const repayment = repaymentPeriod(incomePeriod);
  const repaymentMonthName = formatMonthName(
    repayment.month,
    repayment.year,
    locale,
  );

  return (
    <>
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
        key={line.updatedAt}
        isVisible={isEditVisible}
        onDismiss={() => setEditVisible(false)}
        budgetId={budgetId}
        anchor={period}
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
        budgetId={budgetId}
        currency={currency}
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
          transaction={edited}
          onSaved={() => setEdited(null)}
          onDelete={() => removal.remove(edited, () => setEdited(null))}
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

      <Portal>
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
                    onSuccess: onLeave,
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
    </>
  );
});

function previousPeriod(period: BudgetPeriod): BudgetPeriod {
  return period.month === 1
    ? { year: period.year - 1, month: 12 }
    : { year: period.year, month: period.month - 1 };
}

const styles = StyleSheet.create({ pairActions: { flexWrap: "wrap" } });
