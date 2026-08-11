import { useState } from "react";
import { Button } from "react-native-paper";

import { RunningTotal } from "../components/running-total";
import { StepScaffold } from "../components/step-scaffold";
import { SuggestionGrid } from "../components/suggestion-grid";
import { TransactionDialog } from "../components/transaction-dialog";
import { TransactionList } from "../components/transaction-list";
import { totalSavings } from "../onboarding-selectors";
import {
  addCustomTransaction,
  goToNextStep,
  replaceCustomTransaction,
  useOnboardingStore,
} from "../onboarding-store";
import type { OnboardingTransaction } from "../onboarding-transaction";
import { savingSuggestions } from "../suggestions";

export function SavingsStep({ onExit }: { onExit: () => void }) {
  const state = useOnboardingStore();
  const [dialog, setDialog] = useState<null | {
    editing: OnboardingTransaction | null;
  }>(null);

  const customSavings = state.customTransactions.filter(
    (transaction) => transaction.type === "saving",
  );

  return (
    <StepScaffold
      isCtaEnabled
      onContinue={goToNextStep}
      onSkip={goToNextStep}
      onExit={onExit}
    >
      <SuggestionGrid
        suggestions={savingSuggestions(state.currency)}
        currency={state.currency}
      />

      <TransactionList
        title="Mes épargnes"
        transactions={customSavings}
        currency={state.currency}
        onEdit={(editing) => setDialog({ editing })}
      />

      <Button icon="plus" onPress={() => setDialog({ editing: null })}>
        Ajouter une épargne
      </Button>

      <RunningTotal
        label="Total épargne"
        amount={totalSavings(state)}
        accent="savings"
        currency={state.currency}
      />

      {dialog !== null && (
        <TransactionDialog
          kind="saving"
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
