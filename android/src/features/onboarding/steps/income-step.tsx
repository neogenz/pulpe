import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { SPACING } from "@/core/ui/theme";

import { AmountField } from "@/core/ui/amount-field";
import { CurrencyPicker } from "../components/currency-picker";
import { RunningTotal } from "../components/running-total";
import { StepScaffold } from "../components/step-scaffold";
import { TransactionDialog } from "../components/transaction-dialog";
import { TransactionList } from "../components/transaction-list";
import { canProceed, totalIncome } from "../onboarding-selectors";
import {
  addCustomTransaction,
  goToNextStep,
  replaceCustomTransaction,
  selectCurrency,
  updateAnswers,
  useOnboardingStore,
} from "../onboarding-store";
import type { OnboardingTransaction } from "../onboarding-transaction";

export function IncomeStep({ onExit }: { onExit: () => void }) {
  const theme = useTheme();
  const state = useOnboardingStore();
  const [dialog, setDialog] = useState<null | {
    editing: OnboardingTransaction | null;
  }>(null);

  const extraIncomes = state.customTransactions.filter(
    (transaction) => transaction.type === "income",
  );

  return (
    <StepScaffold
      isCtaEnabled={canProceed(state)}
      onContinue={goToNextStep}
      onExit={onExit}
    >
      <View style={styles.block}>
        <Text variant="labelLarge">Tu comptes en francs ou en euros ?</Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          Tu pourras changer plus tard si besoin.
        </Text>
        <CurrencyPicker selected={state.currency} onSelect={selectCurrency} />
      </View>

      <AmountField
        label="Revenu mensuel net"
        placeholder="5000"
        amount={state.monthlyIncome}
        currency={state.currency}
        onChange={(monthlyIncome) => updateAnswers({ monthlyIncome })}
        autoFocus
      />

      <Text
        variant="bodySmall"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        Personne d&apos;autre ne voit ces montants — pas même moi qui développe
        Pulpe.
      </Text>

      <TransactionList
        title="Revenus supplémentaires"
        transactions={extraIncomes}
        currency={state.currency}
        onEdit={(editing) => setDialog({ editing })}
      />

      <Button icon="plus" onPress={() => setDialog({ editing: null })}>
        Ajouter un revenu
      </Button>

      <RunningTotal
        label="Total revenus"
        amount={totalIncome(state)}
        accent="income"
        currency={state.currency}
      />

      {dialog !== null && (
        <TransactionDialog
          kind="income"
          currency={state.currency}
          editing={dialog.editing}
          onDismiss={() => setDialog(null)}
          onSubmit={
            dialog.editing === null
              ? addCustomTransaction
              : replaceCustomTransaction
          }
        />
      )}
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  block: { gap: SPACING.sm },
});
