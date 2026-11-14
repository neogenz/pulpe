import type {
  BudgetPeriodDates,
  SupportedCurrency,
  Transaction,
} from "pulpe-shared";
import { useState } from "react";

import { useTranslation } from "@/core/i18n/locale-store";
import { Notice } from "@/core/ui/notice";
import { TransactionSheet } from "@/features/transactions/components/transaction-sheet";
import { useTransactionRemoval } from "@/features/transactions/use-transaction-removal";

/**
 * Opening a movement for correction, wherever it is listed: the sheet in edit
 * mode, its deletion with the way back, and the notice that reports both.
 * `requestEditMovement` on iOS.
 */
export function useMovementEditor(
  budgetId: string | null,
  currency: SupportedCurrency,
  period: BudgetPeriodDates,
) {
  const { t } = useTranslation();
  const [edited, setEdited] = useState<Transaction | null>(null);
  const [isUpdated, setUpdated] = useState(false);
  const removal = useTransactionRemoval();

  const element = (
    <>
      {budgetId !== null && edited !== null && (
        <TransactionSheet
          key={edited.id}
          isVisible
          onDismiss={() => setEdited(null)}
          budgetId={budgetId}
          currency={currency}
          period={period}
          transaction={edited}
          onSaved={() => {
            setEdited(null);
            setUpdated(true);
          }}
          onDelete={() => removal.remove(edited, () => setEdited(null))}
          isDeleting={removal.isPending}
          hasDeleteFailed={removal.failure === "delete"}
        />
      )}
      {removal.failure !== null ? (
        <Notice clearsFab visible onDismiss={removal.dismissFailure}>
          {t(`budgets.mutations.removal.${removal.failure}Error`)}
        </Notice>
      ) : removal.last !== null ? (
        <Notice
          clearsFab
          visible
          onDismiss={removal.forget}
          action={{ label: t("budgets.mutations.undo"), onPress: removal.undo }}
        >
          {removal.undoable.length === 1
            ? t("budgets.mutations.removal.removedOne", {
                name: removal.last.name,
              })
            : t("budgets.mutations.removal.removedMany", {
                count: removal.undoable.length,
              })}
        </Notice>
      ) : (
        <Notice
          clearsFab
          visible={isUpdated}
          onDismiss={() => setUpdated(false)}
        >
          {t("budgets.mutations.outcome.activityUpdated")}
        </Notice>
      )}
    </>
  );

  return { edit: setEdited, isOpen: edited !== null, element };
}
