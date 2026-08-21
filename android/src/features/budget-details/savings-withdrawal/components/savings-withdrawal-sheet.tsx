import type { BudgetPeriod, SupportedCurrency } from "pulpe-shared";
import { useState } from "react";
import { randomUUID } from "react-native-quick-crypto";
import { StyleSheet, View } from "react-native";
import { Button, Chip, Text, TextInput, useTheme } from "react-native-paper";

import { hapticSuccess } from "@/core/ui/haptics";
import { useTranslation } from "@/core/i18n/locale-store";
import { AmountField } from "@/core/ui/amount-field";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatMonthName } from "@/core/ui/date-format";
import { FormModal } from "@/core/ui/sheet";
import { useFinancialColors } from "@/core/ui/scheme-colors";
import { SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

import { useCreateSavingsWithdrawal } from "../withdrawal-mutations";
import { repaymentPeriod } from "../withdrawal-gate";

const NAME_MAX_LENGTH = 100;
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
  const { locale, t } = useTranslation();
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
  const monthName = formatMonthName(
    viewedPeriod.month,
    viewedPeriod.year,
    locale,
  );
  const repaymentMonthName = formatMonthName(
    repayment.month,
    repayment.year,
    locale,
  );
  const defaultSource = t("budgets.actions.withdrawal.defaultSource");
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
        incomeName: trimmed === "" ? defaultSource : trimmed,
        savingName: t("budgets.actions.withdrawal.repaymentName"),
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
    <FormModal
      isVisible={isVisible}
      onDismiss={dismiss}
      isBusy={withdraw.isPending}
      title={
        isPreviewing
          ? t("budgets.actions.withdrawal.previewTitle")
          : t("budgets.actions.withdrawal.title")
      }
      // The preview runs to two month blocks and a paragraph, so the step that
      // actually writes to two budgets must not be something you scroll to find.
      footer={
        isPreviewing ? (
          <>
            {withdraw.isError && (
              <FieldError visible>
                {t("budgets.actions.withdrawal.error")}
              </FieldError>
            )}

            <Button
              mode="contained"
              onPress={submit}
              disabled={withdraw.isPending}
              loading={withdraw.isPending}
            >
              {t("budgets.actions.withdrawal.confirm")}
            </Button>
            <Button
              mode="text"
              onPress={() => setPreviewing(false)}
              disabled={withdraw.isPending}
            >
              {t("budgets.mutations.edit")}
            </Button>
          </>
        ) : (
          <Button
            mode="contained"
            onPress={() => setPreviewing(true)}
            disabled={!canContinue}
          >
            {t("common.continue")}
          </Button>
        )
      }
    >
      {isPreviewing ? (
        <>
          <MonthBlock
            monthLabel={t("budgets.actions.withdrawal.chosenMonth", {
              month: monthName,
            })}
            kindLabel={t("vocabulary.kind.income").toLocaleUpperCase(locale)}
            amount={amount ?? 0}
            sign="+"
            note={t("budgets.actions.withdrawal.incomeNote")}
            footnote={t("budgets.actions.withdrawal.incomeFootnote")}
            accent={financial.income}
            currency={currency}
          />

          <MonthBlock
            monthLabel={t("budgets.actions.withdrawal.nextMonth", {
              month: repaymentMonthName,
            })}
            kindLabel={t("vocabulary.kind.saving").toLocaleUpperCase(locale)}
            amount={amount ?? 0}
            sign="-"
            note={t("budgets.actions.withdrawal.savingNote")}
            accent={financial.savings}
            currency={currency}
          />

          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("budgets.actions.withdrawal.recap", {
              month: monthName,
              repaymentMonth: repaymentMonthName,
            })}
          </Text>
        </>
      ) : (
        <>
          <AmountField
            key={generation}
            label={t("budgets.mutations.amount")}
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
                {t("budgets.actions.withdrawal.missing", {
                  amount: formatCurrency(missingAmount, currency),
                })}
              </Chip>
            </View>
          )}

          <TextInput
            mode="outlined"
            label={t("budgets.actions.withdrawal.sourceLabel")}
            placeholder={defaultSource}
            value={source}
            onChangeText={setSource}
            maxLength={NAME_MAX_LENGTH}
          />
        </>
      )}
    </FormModal>
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
