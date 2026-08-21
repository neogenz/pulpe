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
  localized = false,
  onDismiss,
  onSubmit,
}: {
  kind: OnboardingTransaction["type"];
  currency: SupportedCurrency;
  /** The line being edited, or null when adding a new one. */
  editing: OnboardingTransaction | null;
  localized?: boolean;
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
        <Dialog.Title>
          {localized ? t(`onboarding.transaction.title.${kind}`) : TITLES[kind]}
        </Dialog.Title>
        <Dialog.Content style={styles.content}>
          <TextInput
            mode="outlined"
            label={localized ? t("onboarding.transaction.name") : "Nom"}
            placeholder={
              localized
                ? t(`onboarding.transaction.placeholder.${kind}`)
                : PLACEHOLDERS[kind]
            }
            value={name}
            onChangeText={setName}
            maxLength={NAME_MAX_LENGTH}
            autoFocus
          />
          <AmountField
            label={
              localized
                ? t("onboarding.transaction.monthlyAmount")
                : "Montant mensuel"
            }
            amount={amount}
            currency={currency}
            onChange={setAmount}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>
            {localized ? t("common.cancel") : "Annuler"}
          </Button>
          <Button disabled={!isValid} onPress={submit}>
            {localized
              ? t(
                  editing === null
                    ? "onboarding.transaction.add"
                    : "onboarding.transaction.save",
                )
              : editing === null
                ? "Ajouter"
                : "Enregistrer"}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const TITLES: Record<OnboardingTransaction["type"], string> = {
  income: "Ajouter un revenu",
  expense: "Ajouter une dépense",
  saving: "Ajouter une épargne",
};

const PLACEHOLDERS: Record<OnboardingTransaction["type"], string> = {
  income: "Prime, allocation…",
  expense: "Abonnement, garde d'enfants…",
  saving: "Projet, fonds d'urgence…",
};

const styles = StyleSheet.create({
  content: { gap: SPACING.md },
});
