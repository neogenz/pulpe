import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

import { SPACING } from "@/core/ui/theme";

import { AmountField } from "@/core/ui/amount-field";
import { useTranslation } from "@/core/i18n/locale-store";
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
  const { t } = useTranslation();
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
      title={t("onboarding.income.title")}
      subtitle={t("onboarding.income.subtitle")}
      onContinue={goToNextStep}
      onExit={onExit}
    >
      <View style={styles.block}>
        <Text variant="labelLarge">{t("onboarding.income.currencyTitle")}</Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("onboarding.income.currencyHint")}
        </Text>
        <CurrencyPicker selected={state.currency} onSelect={selectCurrency} />
      </View>

      <AmountField
        label={t("onboarding.income.monthlyIncome")}
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
        {t("onboarding.income.privacy")}
      </Text>

      <TransactionList
        title={t("onboarding.income.extraIncome")}
        transactions={extraIncomes}
        currency={state.currency}
        onEdit={(editing) => setDialog({ editing })}
      />

      <Button icon="plus" onPress={() => setDialog({ editing: null })}>
        {t("onboarding.income.addIncome")}
      </Button>

      <RunningTotal
        label={t("onboarding.income.total")}
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
