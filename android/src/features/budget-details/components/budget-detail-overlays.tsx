import type {
  BudgetPeriod,
  SupportedCurrency,
  Transaction,
} from "pulpe-shared";
import { forwardRef, useImperativeHandle, useState } from "react";
import { FAB, Menu, useTheme } from "react-native-paper";

import { Notice } from "@/core/ui/notice";
import type { CurrentMonthViewModel } from "@/features/current-month/current-month-view-model";
import { RealizedBalanceSheet } from "@/features/current-month/components/realized-balance-sheet";
import { TransactionSheet } from "@/features/transactions/components/transaction-sheet";
import { useTransactionRemoval } from "@/features/transactions/use-transaction-removal";

import { SavingsWithdrawalSheet } from "../savings-withdrawal/components/savings-withdrawal-sheet";
import { BudgetLineSheet } from "./budget-line-sheet";

export interface BudgetDetailOverlaysHandle {
  editTransaction: (transaction: Transaction) => void;
  showTransactionMenu: (
    transaction: Transaction,
    anchor: { x: number; y: number },
  ) => void;
  showWithdrawal: () => void;
  showRealizedBalance: () => void;
  showToggleFailure: () => void;
}

interface BudgetDetailOverlaysProps {
  budgetId: string;
  period: BudgetPeriod;
  currency: SupportedCurrency;
  missingAmount: number;
  viewModel: CurrentMonthViewModel | null;
}

/** One owner for every action surface mounted above the budget route. */
export const BudgetDetailOverlays = forwardRef<
  BudgetDetailOverlaysHandle,
  BudgetDetailOverlaysProps
>(function BudgetDetailOverlays(
  { budgetId, period, currency, missingAmount, viewModel },
  ref,
) {
  const theme = useTheme();
  const [isFabOpen, setFabOpen] = useState(false);
  const [isLineSheetVisible, setLineSheetVisible] = useState(false);
  const [isTransactionSheetVisible, setTransactionSheetVisible] =
    useState(false);
  const [edited, setEdited] = useState<Transaction | null>(null);
  const [contextual, setContextual] = useState<{
    transaction: Transaction;
    anchor: { x: number; y: number };
  } | null>(null);
  const [isWithdrawalVisible, setWithdrawalVisible] = useState(false);
  const [isRealizedVisible, setRealizedVisible] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [hasToggleFailed, setToggleFailed] = useState(false);
  const removal = useTransactionRemoval();

  useImperativeHandle(ref, () => ({
    editTransaction: setEdited,
    showTransactionMenu: (transaction, anchor) =>
      setContextual({ transaction, anchor }),
    showWithdrawal: () => setWithdrawalVisible(true),
    showRealizedBalance: () => setRealizedVisible(true),
    showToggleFailure: () => setToggleFailed(true),
  }));

  return (
    <>
      {/* The owning route reserves FAB_CLEARANCE below its virtualized list. */}
      <FAB.Group
        open={isFabOpen}
        visible={
          !isLineSheetVisible && !isTransactionSheetVisible && edited === null
        }
        icon={isFabOpen ? "close" : "plus"}
        onStateChange={({ open }) => setFabOpen(open)}
        actions={[
          {
            icon: "calendar-check",
            label: "Une prévision",
            onPress: () => setLineSheetVisible(true),
          },
          {
            icon: "cash",
            label: "Une opération",
            onPress: () => setTransactionSheetVisible(true),
          },
        ]}
        accessibilityLabel="Ajouter"
      />

      <Notice
        clearsFab
        visible={savedMessage !== null}
        onDismiss={() => setSavedMessage(null)}
      >
        {savedMessage ?? ""}
      </Notice>

      <Notice
        clearsFab
        visible={hasToggleFailed}
        onDismiss={() => setToggleFailed(false)}
        action={{ label: "Fermer", onPress: () => setToggleFailed(false) }}
      >
        Le pointage n&apos;a pas été enregistré. Réessaie.
      </Notice>

      <BudgetLineSheet
        isVisible={isLineSheetVisible}
        onDismiss={() => setLineSheetVisible(false)}
        budgetId={budgetId}
        anchor={period}
        currency={currency}
        onSaved={() => {
          setLineSheetVisible(false);
          setSavedMessage("Prévision ajoutée");
        }}
      />

      <TransactionSheet
        isVisible={isTransactionSheetVisible}
        onDismiss={() => setTransactionSheetVisible(false)}
        budgetId={budgetId}
        currency={currency}
        onSaved={() => {
          setTransactionSheetVisible(false);
          setSavedMessage("Opération ajoutée");
        }}
      />

      {edited !== null && (
        <TransactionSheet
          key={edited.id}
          isVisible
          onDismiss={() => setEdited(null)}
          budgetId={budgetId}
          currency={currency}
          transaction={edited}
          onSaved={() => {
            setEdited(null);
            setSavedMessage("Opération modifiée");
          }}
          onDelete={() => removal.remove(edited, () => setEdited(null))}
        />
      )}

      <Menu
        visible={contextual !== null}
        onDismiss={() => setContextual(null)}
        anchor={contextual?.anchor ?? { x: 0, y: 0 }}
      >
        <Menu.Item
          leadingIcon="pencil-outline"
          title="Modifier"
          onPress={() => {
            setEdited(contextual?.transaction ?? null);
            setContextual(null);
          }}
        />
        <Menu.Item
          leadingIcon="trash-can-outline"
          title="Supprimer"
          titleStyle={{ color: theme.colors.error }}
          onPress={() => {
            if (contextual !== null) removal.remove(contextual.transaction);
            setContextual(null);
          }}
        />
      </Menu>

      <Notice
        clearsFab
        visible={removal.last !== null}
        onDismiss={removal.forget}
        action={{ label: "Annuler", onPress: removal.undo }}
      >
        {removal.undoable.length === 1
          ? `« ${removal.last?.name} » supprimée`
          : `${removal.undoable.length} opérations supprimées`}
      </Notice>

      <Notice
        clearsFab
        visible={removal.failureMessage !== null}
        onDismiss={removal.dismissFailure}
      >
        {removal.failureMessage}
      </Notice>

      <SavingsWithdrawalSheet
        isVisible={isWithdrawalVisible}
        onDismiss={() => setWithdrawalVisible(false)}
        budgetId={budgetId}
        viewedPeriod={period}
        missingAmount={missingAmount}
        currency={currency}
        onWithdrawn={() => {
          setWithdrawalVisible(false);
          setSavedMessage("C'est en place");
        }}
      />

      {viewModel !== null && (
        <RealizedBalanceSheet
          isVisible={isRealizedVisible}
          onDismiss={() => setRealizedVisible(false)}
          metrics={viewModel.metrics}
          realized={viewModel.realized}
          currency={currency}
        />
      )}
    </>
  );
});
