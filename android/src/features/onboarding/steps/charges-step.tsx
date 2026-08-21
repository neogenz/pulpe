import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { SPACING } from "@/core/ui/theme";

import { AmountField } from "@/core/ui/amount-field";
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
  const { t } = useTranslation();
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
      title={t("onboarding.charges.title")}
      subtitle={t("onboarding.charges.subtitle")}
      onContinue={goToNextStep}
      onSkip={goToNextStep}
      onExit={onExit}
    >
      <View style={styles.section}>
        <Text variant="labelLarge">{t("onboarding.charges.housing")}</Text>
        <AmountField
          label={t("onboarding.charges.rent")}
          placeholder="1500"
          amount={state.housingCosts}
          currency={state.currency}
          onChange={(housingCosts) => updateAnswers({ housingCosts })}
        />
      </View>

      <View style={styles.section}>
        <Text variant="labelLarge">{t("onboarding.charges.insurance")}</Text>
        {/* Health insurance is a mandatory Swiss line and has no French
            equivalent worth asking about, so it follows the currency. */}
        {state.currency === "CHF" && (
          <AmountField
            label={t("onboarding.charges.healthInsurance")}
            placeholder="400"
            amount={state.healthInsurance}
            currency={state.currency}
            onChange={(healthInsurance) => updateAnswers({ healthInsurance })}
          />
        )}
        <AmountField
          label={t("onboarding.charges.phonePlan")}
          placeholder="50"
          amount={state.phonePlan}
          currency={state.currency}
          onChange={(phonePlan) => updateAnswers({ phonePlan })}
        />
      </View>

      <View style={styles.section}>
        <Text variant="labelLarge">{t("onboarding.charges.mobility")}</Text>
        <AmountField
          label={t("onboarding.charges.transport")}
          placeholder="100"
          amount={state.transportCosts}
          currency={state.currency}
          onChange={(transportCosts) => updateAnswers({ transportCosts })}
        />
        <AmountField
          label={t("onboarding.charges.leasingCredit")}
          placeholder="300"
          amount={state.leasingCredit}
          currency={state.currency}
          onChange={(leasingCredit) => updateAnswers({ leasingCredit })}
        />
      </View>

      <SuggestionGrid
        suggestions={chargeSuggestions({
          groceries: t("onboarding.suggestions.groceries"),
          diningOut: t("onboarding.suggestions.diningOut"),
          leisureSport: t("onboarding.suggestions.leisureSport"),
        })}
        currency={state.currency}
      />

      <TransactionList
        title={t("onboarding.charges.plannedItems")}
        transactions={customExpenses}
        currency={state.currency}
        onEdit={(editing) => setDialog({ editing })}
      />

      <Button icon="plus" onPress={() => setDialog({ editing: null })}>
        {t("onboarding.charges.addExpense")}
      </Button>

      <RunningTotal
        label={t("onboarding.charges.total")}
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
