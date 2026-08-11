import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

import { SPACING } from "@/core/ui/theme";

import { AmountField } from "../components/amount-field";
import { RunningTotal } from "../components/running-total";
import { StepScaffold } from "../components/step-scaffold";
import { SuggestionGrid } from "../components/suggestion-grid";
import { TransactionDialog } from "../components/transaction-dialog";
import { TransactionList } from "../components/transaction-list";
import { totalCharges } from "../onboarding-selectors";
import {
  addCustomTransaction,
  goToNextStep,
  replaceCustomTransaction,
  updateAnswers,
  useOnboardingStore,
} from "../onboarding-store";
import type { OnboardingTransaction } from "../onboarding-transaction";
import { chargeSuggestions } from "../suggestions";

/**
 * The fixed charges, asked as named fields rather than a free-form list: the
 * five below cover most of what leaves an account every month, and a field with
 * a name attached is answered far more often than an empty "add a line".
 */
export function ChargesStep({ onExit }: { onExit: () => void }) {
  const state = useOnboardingStore();
  const [dialog, setDialog] = useState<null | {
    editing: OnboardingTransaction | null;
  }>(null);

  const customExpenses = state.customTransactions.filter(
    (transaction) => transaction.type === "expense",
  );

  return (
    <StepScaffold
      isCtaEnabled
      onContinue={goToNextStep}
      onSkip={goToNextStep}
      onExit={onExit}
    >
      <View style={styles.section}>
        <Text variant="labelLarge">Logement</Text>
        <AmountField
          label="Loyer mensuel"
          placeholder="1500"
          amount={state.housingCosts}
          currency={state.currency}
          onChange={(housingCosts) => updateAnswers({ housingCosts })}
        />
      </View>

      <View style={styles.section}>
        <Text variant="labelLarge">Assurance & abonnements</Text>
        {/* Health insurance is a mandatory Swiss line and has no French
            equivalent worth asking about, so it follows the currency. */}
        {state.currency === "CHF" && (
          <AmountField
            label="Assurance maladie"
            placeholder="400"
            amount={state.healthInsurance}
            currency={state.currency}
            onChange={(healthInsurance) => updateAnswers({ healthInsurance })}
          />
        )}
        <AmountField
          label="Forfait téléphone"
          placeholder="50"
          amount={state.phonePlan}
          currency={state.currency}
          onChange={(phonePlan) => updateAnswers({ phonePlan })}
        />
      </View>

      <View style={styles.section}>
        <Text variant="labelLarge">Mobilité & crédit</Text>
        <AmountField
          label="Transport (abonnement, essence…)"
          placeholder="100"
          amount={state.transportCosts}
          currency={state.currency}
          onChange={(transportCosts) => updateAnswers({ transportCosts })}
        />
        <AmountField
          label="Leasing ou mensualité de crédit"
          placeholder="300"
          amount={state.leasingCredit}
          currency={state.currency}
          onChange={(leasingCredit) => updateAnswers({ leasingCredit })}
        />
      </View>

      <SuggestionGrid
        suggestions={chargeSuggestions()}
        currency={state.currency}
      />

      <TransactionList
        title="Mes prévisions"
        transactions={customExpenses}
        currency={state.currency}
        onEdit={(editing) => setDialog({ editing })}
      />

      <Button icon="plus" onPress={() => setDialog({ editing: null })}>
        Ajouter une dépense
      </Button>

      <RunningTotal
        label="Total charges"
        amount={totalCharges(state)}
        accent="expense"
        currency={state.currency}
      />

      {dialog !== null && (
        <TransactionDialog
          kind="expense"
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
  section: { gap: SPACING.sm },
});
