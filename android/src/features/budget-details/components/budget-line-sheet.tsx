import type {
  BudgetLine,
  SupportedCurrency,
  TransactionKind,
} from "pulpe-shared";
import { useState } from "react";
import { randomUUID } from "react-native-quick-crypto";
import { StyleSheet, View } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";

import { kindOptions } from "@/core/ui/vocabulary";
import { useTranslation } from "@/core/i18n/locale-store";
import { hapticSuccess } from "@/core/ui/haptics";
import { QuickAmountChips } from "@/core/ui/quick-amount-chips";
import { AmountField } from "@/core/ui/amount-field";
import { SegmentedPicker } from "@/core/ui/segmented-picker";
import { FormModal } from "@/core/ui/sheet";
import { SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

import {
  budgetLineDraftFrom,
  budgetLineDraftHint,
  buildBudgetLineCreate,
  buildBudgetLineUpdate,
  emptyBudgetLineDraft,
  isBudgetLineDraftSubmittable,
  type BudgetLineDraft,
} from "../budget-line-draft";
import {
  useCreateBudgetLine,
  useUpdateBudgetLine,
} from "../budget-line-mutations";
import { SpreadFormSection } from "../spread/components/spread-form-section";

import { SavingsGoalLinks } from "./savings-goal-links";
import { useCreateSpread } from "../spread/spread-queries";
import {
  DEFAULT_SPREAD_LENGTH,
  selectedPeriods,
  type SpreadMode,
  type SpreadPeriod,
  spreadWindow,
  spreadWindowProblem,
} from "../spread/spread-window";

const NAME_MAX_LENGTH = 100;

/** The three answers of « Quand ? » (`SpreadModeToggle.swift`). */
type When = "fixed" | "one_off" | "spread";

interface BudgetLineSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  budgetId: string;
  /** The month this budget covers — where a spread window starts. */
  anchor: SpreadPeriod;
  currency: SupportedCurrency;
  /** Absent when creating; the line being corrected otherwise. */
  line?: BudgetLine;
  /** « Mensuel » writes into the model, so a closed month cannot take it. */
  isEveryMonthDisabled?: boolean;
  onSaved: () => void;
}

/**
 * One sheet for both writing a forecast and correcting one. They ask the same
 * four questions in the same order, and splitting them would have meant two
 * files drifting apart over the wording of "Mensuel".
 */
export function BudgetLineSheet({
  isVisible,
  onDismiss,
  budgetId,
  anchor,
  currency,
  line,
  isEveryMonthDisabled = false,
  onSaved,
}: BudgetLineSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const create = useCreateBudgetLine();
  const update = useUpdateBudgetLine();
  const spread = useCreateSpread();
  const startingDraft = (): BudgetLineDraft =>
    line === undefined
      ? {
          ...emptyBudgetLineDraft(),
          ...(isEveryMonthDisabled && { recurrence: "one_off" as const }),
        }
      : budgetLineDraftFrom(line);
  const [draft, setDraft] = useState<BudgetLineDraft>(startingDraft);
  // Bumped on reset. The amount field holds its own text, so clearing the
  // number behind it is not enough to clear what is on screen.
  const [generation, setGeneration] = useState(0);
  const [isSpread, setSpread] = useState(false);
  const [spreadMode, setSpreadMode] = useState<SpreadMode>("total");
  const [spreadLength, setSpreadLength] = useState(DEFAULT_SPREAD_LENGTH);
  const [deselected, setDeselected] = useState<string[]>([]);
  // One key per intention, replayed unchanged on a retry: a request that fails
  // after the rows were written must not leave a second group behind.
  const [spreadGroupId, setSpreadGroupId] = useState(() => randomUUID());
  const isEditing = line !== undefined;
  const isPlannedWithdrawal = line?.sourceSavingsGoalId != null;
  // A spread is a shape of expense, and a revenue has no shape to spread.
  const canSpread = !isEditing && draft.kind !== "income";
  const cells = spreadWindow(anchor, spreadLength, deselected);
  const isSpreading = isSpread && canSpread;
  const when: When = isSpreading ? "spread" : draft.recurrence;
  // Spreading says which side of the division the amount is on.
  const amountCaption =
    when === "fixed"
      ? "perMonth"
      : when === "spread"
        ? spreadMode === "total"
          ? "inTotal"
          : "perMonth"
        : null;
  const whenOptions: { value: When; label: string; disabled?: boolean }[] = [
    {
      value: "fixed",
      label: t("vocabulary.recurrence.fixed"),
      disabled: isPlannedWithdrawal || isEveryMonthDisabled,
    },
    {
      value: "one_off",
      label: t("vocabulary.recurrence.one_off"),
      disabled: isPlannedWithdrawal,
    },
    ...(canSpread
      ? [{ value: "spread" as const, label: t("budgets.detail.spread") }]
      : []),
  ];
  const mutation = isSpreading ? spread : isEditing ? update : create;

  function change(changes: Partial<BudgetLineDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function reset() {
    setDraft(startingDraft());
    setGeneration((current) => current + 1);
    setSpread(false);
    setSpreadMode("total");
    setSpreadLength(DEFAULT_SPREAD_LENGTH);
    setDeselected([]);
    // A new form is a new intention, so it gets its own idempotency key.
    setSpreadGroupId(randomUUID());
  }

  function dismiss() {
    reset();
    create.reset();
    update.reset();
    spread.reset();
    onDismiss();
  }

  function submit() {
    if (!isBudgetLineDraftSubmittable(draft)) return;

    const onSuccess = () => {
      hapticSuccess();
      reset();
      onSaved();
    };

    if (isSpreading && draft.amount !== null && draft.kind !== "income") {
      if (spreadWindowProblem(cells, 1) !== null) return;
      spread.mutate(
        {
          name: draft.name.trim(),
          kind: draft.kind,
          mode: spreadMode,
          months: selectedPeriods(cells),
          ...(spreadMode === "total"
            ? { totalAmount: draft.amount }
            : { perMonthAmount: draft.amount }),
          spreadGroupId,
        },
        { onSuccess },
      );
      return;
    }

    if (line === undefined) {
      create.mutate(buildBudgetLineCreate(draft, budgetId), { onSuccess });
      return;
    }
    update.mutate(buildBudgetLineUpdate(draft, line), { onSuccess });
  }

  const problem = budgetLineDraftHint(draft);

  return (
    <FormModal
      isVisible={isVisible}
      onDismiss={dismiss}
      isBusy={mutation.isPending}
      title={t(
        `budgets.mutations.forecast.${isEditing ? "editTitle" : "createTitle"}`,
      )}
      footer={
        <>
          {mutation.isError && (
            <FieldError visible>
              {t("budgets.mutations.forecast.error")}
            </FieldError>
          )}

          <Button
            mode="contained"
            onPress={submit}
            disabled={
              !isBudgetLineDraftSubmittable(draft) || mutation.isPending
            }
            loading={mutation.isPending}
          >
            {t(
              `budgets.mutations.${isEditing ? "save" : isSpreading ? "spread" : "add"}`,
            )}
          </Button>

          {problem !== null && (
            <Text
              variant="labelMedium"
              style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
            >
              {t(`budgets.mutations.validation.${problem}`)}
            </Text>
          )}
        </>
      }
    >
      {line !== undefined && (
        <SavingsGoalLinks line={line} onNavigate={dismiss} />
      )}

      <SegmentedPicker
        value={draft.kind}
        onValueChange={(kind) => change({ kind: kind as TransactionKind })}
        buttons={kindOptions(t).map((button) => ({
          ...button,
          disabled: isPlannedWithdrawal,
        }))}
      />

      <AmountField
        key={generation}
        isProminent
        label={
          isSpreading && spreadMode === "total"
            ? t("budgets.mutations.forecast.totalAmount")
            : isSpreading
              ? t("budgets.mutations.forecast.monthlyAmount")
              : t("budgets.mutations.forecast.plannedAmount")
        }
        amount={draft.amount}
        currency={currency}
        onChange={(amount) => change({ amount })}
      />
      <QuickAmountChips
        amount={draft.amount}
        currency={currency}
        onSelect={(amount) => {
          change({ amount });
          // The field holds its own text; only a remount shows the new one.
          setGeneration((current) => current + 1);
        }}
      />

      {amountCaption !== null && (
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t(`budgets.mutations.forecast.${amountCaption}`)}
        </Text>
      )}

      <TextInput
        mode="outlined"
        label={t("budgets.mutations.name")}
        placeholder={t(`budgets.mutations.forecast.placeholders.${draft.kind}`)}
        value={draft.name}
        onChangeText={(name) => change({ name })}
        maxLength={NAME_MAX_LENGTH}
      />

      <View style={styles.when}>
        <Text
          variant="labelLarge"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {t("budgets.mutations.forecast.when")}
        </Text>
        <SegmentedPicker
          value={when}
          accessibilityLabel={t("budgets.mutations.forecast.when")}
          onValueChange={(next) => {
            setSpread(next === "spread");
            if (next !== "spread") change({ recurrence: next });
          }}
          buttons={whenOptions}
        />
      </View>

      {isSpreading && (
        <SpreadFormSection
          cells={cells}
          mode={spreadMode}
          amount={draft.amount}
          currency={currency}
          minimumMonths={1}
          onChangeMode={setSpreadMode}
          onChangeLength={setSpreadLength}
          onToggleMonth={(key) =>
            setDeselected((current) =>
              current.includes(key)
                ? current.filter((other) => other !== key)
                : [...current, key],
            )
          }
        />
      )}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  when: { gap: SPACING.xs },
  hint: { textAlign: "center" },
});
