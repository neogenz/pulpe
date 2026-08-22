import type { SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { StyleSheet } from "react-native";
import { Button, Dialog, Portal, TextInput } from "react-native-paper";

import { SPACING } from "@/core/ui/theme";
import { useTranslation } from "@/core/i18n/locale-store";

import {
  createCustomTransaction,
  type OnboardingTransaction,
} from "../onboarding-transaction";
import { AmountField } from "@/core/ui/amount-field";

const NAME_MAX_LENGTH = 100;

/**
 * Adds or edits one hand-entered line. Editing reuses the same form so the two
 * can never accept different things; what tells them apart is whether an
 * existing line was handed in, and therefore whether its id is kept.
 */
export function TransactionDialog({
  kind,
  currency,
  editing,
  onDismiss,
  onSubmit,
}: {
  kind: OnboardingTransaction["type"];
  currency: SupportedCurrency;
  /** The line being edited, or null when adding a new one. */
  editing: OnboardingTransaction | null;
  onDismiss: () => void;
  onSubmit: (transaction: OnboardingTransaction) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState<number | null>(editing?.amount ?? null);

  const isValid = name.trim().length > 0 && amount !== null && amount > 0;

  function submit() {
    if (!isValid) return;
    onSubmit(
      editing === null
        ? createCustomTransaction({
            name: name.trim(),
            amount,
            type: kind,
            expenseType: "fixed",
            isRecurring: true,
          })
        : { ...editing, name: name.trim(), amount },
    );
    onDismiss();
  }

  return (
    <Portal>
      <Dialog visible onDismiss={onDismiss}>
        <Dialog.Title>{t(`onboarding.transaction.title.${kind}`)}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <TextInput
            mode="outlined"
            label={t("onboarding.transaction.name")}
            placeholder={t(`onboarding.transaction.placeholder.${kind}`)}
            value={name}
            onChangeText={setName}
            maxLength={NAME_MAX_LENGTH}
            autoFocus
          />
          <AmountField
            label={t("onboarding.transaction.monthlyAmount")}
            amount={amount}
            currency={currency}
            onChange={setAmount}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t("common.cancel")}</Button>
          <Button disabled={!isValid} onPress={submit}>
            {t(
              editing === null
                ? "onboarding.transaction.add"
                : "onboarding.transaction.save",
            )}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACING.md },
});
