import { useState } from "react";
import { Button } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
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
  const { t } = useTranslation();
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
      title={t("onboarding.savings.title")}
      subtitle={t("onboarding.savings.subtitle")}
      onContinue={goToNextStep}
      onSkip={goToNextStep}
      onExit={onExit}
    >
      <SuggestionGrid
        suggestions={savingSuggestions(state.currency, {
          saving: t("onboarding.suggestions.saving"),
          retirement: t("onboarding.suggestions.retirement"),
          retirementSwiss: t("onboarding.suggestions.retirementSwiss"),
        })}
        currency={state.currency}
      />

      <TransactionList
        title={t("onboarding.savings.items")}
        localized
        transactions={customSavings}
        currency={state.currency}
        onEdit={(editing) => setDialog({ editing })}
      />

      <Button icon="plus" onPress={() => setDialog({ editing: null })}>
        {t("onboarding.savings.add")}
      </Button>

      <RunningTotal
        label={t("onboarding.savings.total")}
        amount={totalSavings(state)}
        accent="savings"
        currency={state.currency}
      />

      {dialog !== null && (
        <TransactionDialog
          kind="saving"
          localized
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
