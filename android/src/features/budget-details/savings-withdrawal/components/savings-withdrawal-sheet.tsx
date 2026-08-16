import type { BudgetPeriod, SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { randomUUID } from "react-native-quick-crypto";
import { StyleSheet, View } from "react-native";
import { Button, Chip, Text, TextInput, useTheme } from "react-native-paper";

import { hapticSuccess } from "@/core/ui/haptics";
import { AmountField } from "@/core/ui/amount-field";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { Sheet } from "@/core/ui/sheet";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

import { useCreateSavingsWithdrawal } from "../withdrawal-mutations";
import { repaymentPeriod } from "../withdrawal-gate";

const NAME_MAX_LENGTH = 100;
/** The default source name when the user names none. */
const DEFAULT_SOURCE = "Mon épargne";
/** The repayment line's label, owned by the client — the backend has no i18n. */
const REPAYMENT_NAME = "Remettre sur ton épargne";

interface SavingsWithdrawalSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  budgetId: string;
  viewedPeriod: BudgetPeriod;
  /** What the month is short of, offered as a one-tap amount. */
  missingAmount: number;
  currency: SupportedCurrency;
  onWithdrawn: () => void;
}

/**
 * Taking from savings to cover a month, in two steps: how much, then what it
 * will look like across the two months before anything is written.
 *
 * The preview exists because the second line is the surprising one — the money
 * arrives now and leaves next month, and a user who only saw the first half
 * would find an unexplained saving waiting for them.
 */
export function SavingsWithdrawalSheet({
  isVisible,
  onDismiss,
  budgetId,
  viewedPeriod,
  missingAmount,
  currency,
  onWithdrawn,
}: SavingsWithdrawalSheetProps) {
  const theme = useTheme();
  const financial = useFinancialColors();
  const withdraw = useCreateSavingsWithdrawal();
  const [amount, setAmount] = useState<number | null>(null);
  const [source, setSource] = useState("");
  const [isPreviewing, setPreviewing] = useState(false);
  const [generation, setGeneration] = useState(0);
  // One key per intention, replayed on retry: a double tap must replay the
  // pair, never create a second one.
  const [groupId, setGroupId] = useState(() => randomUUID());

  const repayment = repaymentPeriod(viewedPeriod);
  const monthName = formatMonthName(viewedPeriod.month, viewedPeriod.year);
  const repaymentName = formatMonthName(repayment.month, repayment.year);
  const canContinue = amount !== null && amount > 0;

  function reset() {
    setAmount(null);
    setSource("");
    setPreviewing(false);
    setGeneration((current) => current + 1);
    setGroupId(randomUUID());
  }

  function dismiss() {
    reset();
    withdraw.reset();
    onDismiss();
  }

  function submit() {
    if (amount === null || amount <= 0) return;
    const trimmed = source.trim();
    withdraw.mutate(
      {
        budgetId,
        amount,
        incomeName: trimmed === "" ? DEFAULT_SOURCE : trimmed,
        savingName: REPAYMENT_NAME,
        groupId,
      },
      {
        onSuccess: () => {
          hapticSuccess();
          reset();
          onWithdrawn();
        },
      },
    );
  }

  return (
    <Sheet
      isVisible={isVisible}
      onDismiss={dismiss}
      title={
        isPreviewing
          ? "Voici ce qu'on met en place"
          : "Combien te manque-t-il ?"
      }
      // The preview runs to two month blocks and a paragraph, so the step that
      // actually writes to two budgets must not be something you scroll to find.
      footer={
        isPreviewing ? (
          <>
            {withdraw.isError && (
              <FieldError visible>
                On n&apos;a pas pu mettre ça en place. Réessaie.
              </FieldError>
            )}

            <Button
              mode="contained"
              onPress={submit}
              disabled={withdraw.isPending}
              loading={withdraw.isPending}
            >
              Confirmer
            </Button>
            <Button
              mode="text"
              onPress={() => setPreviewing(false)}
              disabled={withdraw.isPending}
            >
              Modifier
            </Button>
          </>
        ) : (
          <Button
            mode="contained"
            onPress={() => setPreviewing(true)}
            disabled={!canContinue}
          >
            Continuer
          </Button>
        )
      }
    >
      {isPreviewing ? (
        <>
          <MonthBlock
            monthLabel={`${monthName} · le mois choisi`}
            kindLabel="REVENU"
            amount={amount ?? 0}
            sign="+"
            note="arrivent sur ton budget"
            footnote="↪ pris sur ton épargne"
            accent={financial.income}
            currency={currency}
          />

          <MonthBlock
            monthLabel={`${repaymentName} · le mois suivant`}
            kindLabel="ÉPARGNE"
            amount={amount ?? 0}
            sign="-"
            note="mis de côté pour remettre l'argent sur ton épargne"
            accent={financial.savings}
            currency={currency}
          />

          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Tu tiens {monthName}. Ton épargne est reconstituée en{" "}
            {repaymentName}.
          </Text>
        </>
      ) : (
        <>
          <AmountField
            key={generation}
            label="Montant"
            amount={amount}
            currency={currency}
            onChange={setAmount}
          />

          {missingAmount > 0 && (
            <View style={styles.quickFill}>
              <Chip
                icon="target"
                onPress={() => {
                  setAmount(missingAmount);
                  setGeneration((current) => current + 1);
                }}
              >
                {formatCurrency(missingAmount, currency)} manquants
              </Chip>
            </View>
          )}

          <TextInput
            mode="outlined"
            label="D'où vient l'argent ? (optionnel)"
            placeholder={DEFAULT_SOURCE}
            value={source}
            onChangeText={setSource}
            maxLength={NAME_MAX_LENGTH}
          />
        </>
      )}
    </Sheet>
  );
}

function MonthBlock({
  monthLabel,
  kindLabel,
  amount,
  sign,
  note,
  footnote,
  accent,
  currency,
}: {
  monthLabel: string;
  kindLabel: string;
  amount: number;
  sign: "+" | "-";
  note: string;
  footnote?: string;
  accent: string;
  currency: SupportedCurrency;
}) {
  const theme = useTheme();

  return (
    <View style={styles.block}>
      <Text
        variant="labelMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {monthLabel}
      </Text>
      <Text variant="labelSmall" style={{ color: accent }}>
        {kindLabel}
      </Text>
      <Text variant="headlineSmall" style={{ color: accent }}>
        {sign}
        {formatCurrency(amount, currency)}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant }}
      >
        {note}
      </Text>
      {footnote !== undefined && (
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {footnote}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  quickFill: { flexDirection: "row" },
  block: { gap: SPACING.xxs },
});
