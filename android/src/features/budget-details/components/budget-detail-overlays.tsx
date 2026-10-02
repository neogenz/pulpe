import type {
  BudgetPeriod,
  SupportedCurrency,
  Transaction,
} from "pulpe-shared";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { BackHandler, StyleSheet } from "react-native";
import { FAB, Menu, useTheme } from "react-native-paper";

import { Notice } from "@/core/ui/notice";
import { useTranslation } from "@/core/i18n/locale-store";
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
  const { t } = useTranslation();
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
  const [savedMessage, setSavedMessage] = useState<
    | "forecastAdded"
    | "activityAdded"
    | "activityUpdated"
    | "withdrawalReady"
    | null
  >(null);
  const [hasToggleFailed, setToggleFailed] = useState(false);
  const [isFabOpen, setFabOpen] = useState(false);
  const removal = useTransactionRemoval();

  // Back folds an open speed dial first, as Android's own menus do; without
  // this it left the budget with the dial still open over it.
  useEffect(() => {
    if (!isFabOpen) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setFabOpen(false);
        return true;
      },
    );
    return () => subscription.remove();
  }, [isFabOpen]);

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
      {/* A budget is made of forecasts, and a loose operation is the other way
          to add to it: two actions behind one FAB, Material's speed dial. The
          owning route reserves FAB_CLEARANCE below its virtualized list. */}
      <FAB.Group
        testID="budget-add"
        open={isFabOpen}
        visible={
          !isLineSheetVisible && !isTransactionSheetVisible && edited === null
        }
        icon={isFabOpen ? "close" : "plus"}
        onStateChange={({ open }) => setFabOpen(open)}
        // Above the month tabs, which sit one layer over the list: the scrim
        // has to dim the whole page, tabs included, while the menu is open.
        style={styles.fabGroup}
        actions={[
          {
            icon: "calendar-check",
            label: t("budgets.mutations.forecastAction"),
            onPress: () => setLineSheetVisible(true),
            testID: "budget-add-forecast",
          },
          {
            icon: "cash",
            label: t("budgets.mutations.activityAction"),
            onPress: () => setTransactionSheetVisible(true),
            testID: "budget-add-activity",
          },
        ]}
        accessibilityLabel={t("budgets.mutations.add")}
      />

      {/* One slot, the most pressing news first. Four snackbars in the same
          spot drew over one another — a failure could hide under the "Annuler"
          of a deletion, or a confirmation over it. */}
      {removal.failure !== null ? (
        <Notice clearsFab visible onDismiss={removal.dismissFailure}>
          {t(`budgets.mutations.removal.${removal.failure}Error`)}
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
      ) : removal.last !== null ? (
        <Notice
          clearsFab
          visible
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
      ) : (
        <Notice
          clearsFab
          visible={savedMessage !== null}
          onDismiss={() => setSavedMessage(null)}
        >
          {savedMessage === null
            ? ""
            : t(`budgets.mutations.outcome.${savedMessage}`)}
        </Notice>
      )}

      <BudgetLineSheet
        isVisible={isLineSheetVisible}
        onDismiss={() => setLineSheetVisible(false)}
        budgetId={budgetId}
        anchor={period}
        currency={currency}
        onSaved={() => {
          setLineSheetVisible(false);
          setSavedMessage("forecastAdded");
        }}
      />

      <TransactionSheet
        isVisible={isTransactionSheetVisible}
        onDismiss={() => setTransactionSheetVisible(false)}
        budgetId={budgetId}
        currency={currency}
        onSaved={() => {
          setTransactionSheetVisible(false);
          setSavedMessage("activityAdded");
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
            setSavedMessage("activityUpdated");
          }}
          onDelete={() => removal.remove(edited, () => setEdited(null))}
          isDeleting={removal.isPending}
          hasDeleteFailed={removal.failure === "delete"}
        />
      )}

      <Menu
        visible={contextual !== null}
        onDismiss={() => setContextual(null)}
        anchor={contextual?.anchor ?? { x: 0, y: 0 }}
      >
        <Menu.Item
          leadingIcon="pencil-outline"
          title={t("budgets.mutations.edit")}
          onPress={() => {
            setEdited(contextual?.transaction ?? null);
            setContextual(null);
          }}
        />
        <Menu.Item
          leadingIcon="trash-can-outline"
          title={t("budgets.mutations.delete")}
          titleStyle={{ color: theme.colors.error }}
          onPress={() => {
            if (contextual !== null) removal.remove(contextual.transaction);
            setContextual(null);
          }}
        />
      </Menu>

      <SavingsWithdrawalSheet
        isVisible={isWithdrawalVisible}
        onDismiss={() => setWithdrawalVisible(false)}
        budgetId={budgetId}
        viewedPeriod={period}
        missingAmount={missingAmount}
        currency={currency}
        onWithdrawn={() => {
          setWithdrawalVisible(false);
          setSavedMessage("withdrawalReady");
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

const styles = StyleSheet.create({ fabGroup: { zIndex: 2 } });
