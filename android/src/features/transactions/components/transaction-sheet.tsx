import {
  type BudgetPeriodDates,
  type SupportedCurrency,
  type Transaction,
  type TransactionCreate,
  type TransactionKind,
} from "pulpe-shared";
import { useEffect, useRef, useState } from "react";
import { randomUUID } from "react-native-quick-crypto";
import { Keyboard, StyleSheet, View } from "react-native";
import { Button, Switch, Text, TextInput, useTheme } from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";

import { hapticSuccess } from "@/core/ui/haptics";
import { useAmountMasking } from "@/core/ui/amount-visibility";
import { SegmentedPicker } from "@/core/ui/segmented-picker";
import { useBudgetDetails } from "@/features/budgets/budget-queries";
import { useTranslation } from "@/core/i18n/locale-store";
import { kindOptions } from "@/core/ui/vocabulary";
import { TagPicker } from "@/features/tags/tag-picker";
import { QuickAmountChips } from "@/core/ui/quick-amount-chips";
import { AmountField } from "@/core/ui/amount-field";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatRelativeDay } from "@/core/ui/date-format";
import { FormModal } from "@/core/ui/sheet";
import { EMPHASIS, SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";
import { useUserSettings } from "@/core/user-settings/user-settings-queries";
import { useCurrencyRate } from "@/features/account/currency-queries";
import { useSavingsGoalWithdrawalOptions } from "@/features/savings-goals/goals-queries";

import {
  computeMovementImpact,
  movementImpactContent,
} from "../movement-impact";
import {
  eligibleLines,
  lineSections,
  suggestedLine,
} from "../movement-line-choices";
import { ImpactBlock } from "@/features/budget-details/components/impact-confirm-sheet";
import {
  loadFirstMovementState,
  type FirstMovementSource,
} from "../first-movement-tracker";
import { convertMovementAmount, withConversion } from "../movement-conversion";
import { MovementCurrencyField } from "./movement-currency-field";
import { MovementLinePicker } from "./movement-line-picker";
import { MovementLineQuestion } from "./movement-line-question";
import { MovementOrigin } from "./movement-origin";

import {
  initialForm,
  originProblemOf,
  type EnvelopeTarget,
  type FormState,
} from "../movement-form";
import {
  buildTransactionPayload,
  buildTransactionUpdate,
  defaultOperationDay,
  draftHint,
  isDraftSubmittable,
  type TransactionDraft,
} from "../transaction-draft";
import {
  isUnsavedCreate,
  useCreateTransaction,
  useRefreshAfterTransactionWrite,
  useUpdateTransaction,
} from "../transaction-mutations";

const NAME_MAX_LENGTH = 100;

/** The gutter `core/ui/sheet` keeps, and so the one the rail has to give back. */
const SHEET_PADDING = SPACING.lg;

interface TransactionSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  budgetId: string;
  currency: SupportedCurrency;
  /** Absent when writing a new operation; the one being corrected otherwise. */
  transaction?: Transaction;
  /** Present when the operation fills an envelope, whose kind it then takes. */
  envelope?: EnvelopeTarget;
  /**
   * The days the budget covers: a new operation starts inside them, and the
   * calendar offers no other.
   */
  period?: BudgetPeriodDates;
  /**
   * Opens a new income already « depuis mon épargne », this goal chosen
   * (« Faire un retrait » on a goal). Ignored when editing or with an envelope.
   */
  withdrawFromGoalId?: string;
  /** Which surface opened the sheet, for `first_transaction_created`. */
  source?: FirstMovementSource;
  onSaved: () => void;
  onDelete?: () => void;
  /**
   * The deletion asked from this sheet is in flight. The sheet is a separate
   * window above the screen, so it has to say so itself: the screen's own
   * notices are drawn underneath it.
   */
  isDeleting?: boolean;
  /** The deletion asked from this sheet failed and can be asked again. */
  hasDeleteFailed?: boolean;
}

/**
 * Writing an operation and correcting one, in a single form: they ask for the
 * same amount, the same name, the same day and the same tags.
 *
 * Three of the fields are creation-only, and not by choice of layout — the
 * update endpoint takes none of them. Pointing has its own ring on the row, the
 * envelope an operation answers to is settled when it is written because moving
 * it would move two consumptions at once, and the goal an income came out of is
 * an origin, not an attribute to be edited afterwards.
 */
export function TransactionSheet({
  isVisible,
  onDismiss,
  budgetId,
  currency,
  transaction,
  envelope,
  period,
  withdrawFromGoalId,
  source,
  onSaved,
  onDelete,
  isDeleting = false,
  hasDeleteFailed = false,
}: TransactionSheetProps) {
  const theme = useTheme();
  useAmountMasking();
  const isEditing = transaction !== undefined;
  const prefilledGoalId =
    isEditing || envelope !== undefined ? undefined : withdrawFromGoalId;
  const { locale, t } = useTranslation();
  const details = useBudgetDetails(budgetId);
  const create = useCreateTransaction(source);
  const update = useUpdateTransaction();
  const refreshAfterWrite = useRefreshAfterTransactionWrite();
  // The budget is not part of the draft: it belongs to the screen, and holding
  // a copy in form state is how a sheet ends up posting to last month's budget
  // after a period rolls over while it is open.
  const [form, setForm] = useState<FormState>(() =>
    initialForm(transaction, envelope, period, prefilledGoalId),
  );
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  // Held apart from the chosen goal: "yes, from a goal" and "which one" are two
  // answers, and the block has to stay open between them.
  const [isFromSavingsGoal, setFromSavingsGoal] = useState(
    prefilledGoalId !== undefined,
  );
  // The answer to « C'était prévu dans ton budget ? »: null is the untouched
  // « imprévu », and a suggestion is only ever offered, never picked for the user.
  const [pickedLineId, setPickedLineId] = useState<string | null>(null);
  const [isPickingLine, setPickingLine] = useState(false);
  // Bumped on every reset. The amount field holds its own text so a decimal
  // separator survives typing, which means clearing the number behind it is not
  // enough to clear what is on screen — only a remount is.
  const [generation, setGeneration] = useState(0);
  // One id per operation being written, replayed unchanged on a retry, so a
  // request whose answer was lost cannot write it twice.
  const [createId, setCreateId] = useState(() => randomUUID());
  const [submittedCreate, setSubmittedCreate] =
    useState<TransactionCreate | null>(null);
  // The ref captures even two presses in one render; the state shows the
  // exact submitted values while the request is pending or being retried.
  const createAttempt = useRef<TransactionCreate | null>(null);
  // An attempt whose answer never came may still land, possibly after a later
  // one is refused: from then on the submitted values stay as they are.
  const hasUncertainAttempt = useRef(false);
  const draft: TransactionDraft = { ...form, budgetId };
  const settings = useUserSettings();
  // Entered in the other currency, converted on the way out: an edit keeps the
  // currency the row was booked in.
  const canPickCurrency =
    !isEditing && settings.data?.showCurrencySelector === true;
  const [pickedCurrency, setPickedCurrency] = useState(currency);
  const inputCurrency = canPickCurrency ? pickedCurrency : currency;
  const rate = useCurrencyRate(inputCurrency, currency);
  const conversion = convertMovementAmount(
    draft.amount,
    inputCurrency,
    currency,
    rate.data?.rate,
  );
  const isRatePending =
    inputCurrency !== currency &&
    draft.amount !== null &&
    draft.amount > 0 &&
    conversion === null;
  // What the budget will hold, whichever currency it was typed in.
  const bookedAmount = conversion?.amount ?? draft.amount;
  // A sheet that stays mounted keeps the day it was mounted on: opened two
  // days later, it booked the operation on the wrong day — possibly in the
  // previous month — unless the user happened to look at the date. A new
  // operation is dated the day the sheet opens.
  const [wasVisible, setWasVisible] = useState(isVisible);
  if (isVisible !== wasVisible) {
    setWasVisible(isVisible);
    if (isVisible && !isEditing) {
      setForm((current) => ({
        ...current,
        day: defaultOperationDay(new Date(), period),
      }));
    }
  }
  // Asked before the first create: once it is saved, the server always says yes.
  useEffect(() => {
    if (isVisible && !isEditing) void loadFirstMovementState();
  }, [isVisible, isEditing]);
  const mutation = isEditing ? update : create;
  // An allocated operation must keep its envelope's kind: the server refuses
  // the mismatch, and the envelope is the reason the user opened this form.
  const isKindLocked =
    envelope !== undefined || (transaction?.budgetLineId ?? null) !== null;
  // Only a free income can name its origin, and only at creation: the update
  // endpoint does not take the field, and an allocated one is answered for by
  // the forecast it fills.
  const isOriginOffered =
    !isEditing && envelope === undefined && draft.kind === "income";
  const options = useSavingsGoalWithdrawalOptions(
    isOriginOffered && isFromSavingsGoal,
  );
  const chosenOption =
    options.data?.find(
      (option) => option.goalId === draft.sourceSavingsGoalId,
    ) ?? null;
  const remainingAfterWithdrawal =
    chosenOption === null || bookedAmount === null
      ? null
      : chosenOption.availableAmount - bookedAmount;
  const originProblem = originProblemOf({
    isActive: isOriginOffered && isFromSavingsGoal,
    hasChosenGoal: draft.sourceSavingsGoalId !== null,
    remainingAfterWithdrawal,
  });

  const lines = details.data?.budgetLines ?? [];
  const transactions = details.data?.transactions ?? [];
  // Savings drawn from a goal are free by backend rule: they carry no prévision.
  const isQuestionLocked = isEditing || (isOriginOffered && isFromSavingsGoal);
  const selectedLineId = isEditing
    ? (transaction.budgetLineId ?? null)
    : envelope !== undefined
      ? envelope.id
      : isQuestionLocked
        ? null
        : pickedLineId;
  const selectedLine = lines.find((line) => line.id === selectedLineId);
  const hasEligibleLines = eligibleLines(lines, draft.kind).length > 0;
  const showsQuestion =
    envelope === undefined && (hasEligibleLines || isEditing);
  // The first chip: the user's own pick, else the suggestion; an edit shows
  // the prévision it already sits in.
  const shownLine = isEditing
    ? selectedLine
    : (lines.find((line) => line.id === pickedLineId) ??
      suggestedLine({
        lines,
        transactions,
        kind: draft.kind,
        name: draft.name,
      }) ??
      undefined);
  const isUnchangedEdit =
    transaction !== undefined &&
    transaction.amount === draft.amount &&
    transaction.kind === draft.kind;
  const impact =
    details.data === undefined ||
    bookedAmount === null ||
    bookedAmount <= 0 ||
    isUnchangedEdit
      ? null
      : computeMovementImpact({
          lines,
          transactions,
          rollover: details.data.budget.rollover ?? 0,
          replacingId: transaction?.id,
          draft: {
            kind: draft.kind,
            amount: bookedAmount,
            lineId: selectedLineId,
          },
        });

  function change(changes: Partial<FormState>) {
    setForm((current) => ({ ...current, ...changes }));
  }

  function changeKind(kind: TransactionKind) {
    change({
      kind,
      ...(kind === "income" ? {} : { sourceSavingsGoalId: null }),
    });
    setPickedLineId(null);
    if (kind !== "income") setFromSavingsGoal(false);
  }

  function reset() {
    setForm(initialForm(transaction, envelope, period, prefilledGoalId));
    setPickedCurrency(currency);
    setFromSavingsGoal(prefilledGoalId !== undefined);
    setPickedLineId(null);
    setPickingLine(false);
    setGeneration((current) => current + 1);
    setCreateId(randomUUID());
    setSubmittedCreate(null);
    createAttempt.current = null;
    hasUncertainAttempt.current = false;
  }

  /** Dismissing means abandoning: a half-filled form must not greet the next open. */
  function dismiss() {
    // The retry copy says this one may already be saved; closing instead of
    // retrying must not leave the budget hiding it.
    if (submittedCreate !== null && create.isError) refreshAfterWrite();
    reset();
    create.reset();
    update.reset();
    onDismiss();
  }

  function submit() {
    if (
      createAttempt.current === null &&
      (!isDraftSubmittable(draft) || originProblem !== null || isRatePending)
    ) {
      return;
    }

    const onSuccess = () => {
      hapticSuccess();
      reset();
      onSaved();
    };

    if (transaction === undefined) {
      const payload = createAttempt.current ?? {
        ...withConversion(
          buildTransactionPayload(draft, new Date()),
          conversion,
        ),
        id: createId,
        ...(selectedLineId === null ? {} : { budgetLineId: selectedLineId }),
      };
      createAttempt.current = payload;
      setSubmittedCreate(payload);
      setDatePickerVisible(false);
      Keyboard.dismiss();
      create.mutate(payload, {
        onSuccess,
        onError: (error) => {
          // Refused, and nothing stored under its id: the form opens again
          // on the same values, so a wrong amount or goal can be corrected.
          if (isUnsavedCreate(error) && !hasUncertainAttempt.current) {
            createAttempt.current = null;
            setSubmittedCreate(null);
          } else {
            hasUncertainAttempt.current = true;
          }
        },
      });
      return;
    }

    update.mutate(
      {
        id: transaction.id,
        changes: buildTransactionUpdate(draft, transaction),
      },
      { onSuccess },
    );
  }

  const problem =
    submittedCreate === null ? (draftHint(draft) ?? originProblem) : null;

  return (
    <>
      <FormModal
        isVisible={isVisible}
        onDismiss={dismiss}
        onBack={isPickingLine ? () => setPickingLine(false) : undefined}
        isBusy={mutation.isPending || isDeleting}
        title={
          isPickingLine
            ? t("budgets.mutations.activity.picker.title")
            : t(
                `budgets.mutations.activity.${isEditing ? "editTitles" : "titles"}.${draft.kind}`,
              )
        }
        subtitle={
          envelope === undefined
            ? undefined
            : t("budgets.mutations.activity.allocatedIn", {
                name: envelope.name,
              })
        }
        footer={
          isPickingLine ? undefined : (
            <>
              {mutation.isError && (
                <FieldError visible>
                  {t("budgets.mutations.activity.error")}
                </FieldError>
              )}

              <Button
                testID="transaction-submit"
                mode="contained"
                onPress={submit}
                disabled={
                  (submittedCreate === null &&
                    (!isDraftSubmittable(draft) ||
                      originProblem !== null ||
                      isRatePending)) ||
                  mutation.isPending
                }
                loading={mutation.isPending}
              >
                {submittedCreate !== null && create.isError
                  ? t("common.retry")
                  : isEditing
                    ? t("budgets.mutations.save")
                    : draft.amount !== null && draft.amount > 0
                      ? t("budgets.mutations.activity.addAmount", {
                          amount: formatCurrency(draft.amount, inputCurrency),
                        })
                      : t("budgets.mutations.add")}
              </Button>

              {problem !== null && (
                <Text
                  variant="labelMedium"
                  style={[
                    styles.hint,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {t(`budgets.mutations.validation.${problem}`)}
                </Text>
              )}

              {onDelete !== undefined && isEditing && (
                <>
                  {hasDeleteFailed && (
                    <FieldError visible>
                      {t("budgets.mutations.removal.deleteError")}
                    </FieldError>
                  )}
                  <Button
                    testID="transaction-delete"
                    mode="text"
                    icon="trash-can-outline"
                    textColor={theme.colors.error}
                    onPress={onDelete}
                    // One request at a time: a second tap used to send a second
                    // DELETE for a row the first one had already removed.
                    disabled={isDeleting || mutation.isPending}
                    loading={isDeleting}
                  >
                    {t("budgets.mutations.delete")}
                  </Button>
                </>
              )}
            </>
          )
        }
      >
        {isPickingLine ? (
          <MovementLinePicker
            sections={lineSections(lines, transactions, draft.kind)}
            transactions={transactions}
            kind={draft.kind}
            currency={currency}
            selectedLineId={selectedLineId}
            onPick={(lineId) => {
              setPickedLineId(lineId);
              setPickingLine(false);
            }}
          />
        ) : submittedCreate !== null ? (
          <View style={styles.submitted}>
            {create.isError && (
              <Text variant="bodyMedium">
                {t("budgets.mutations.activity.retryUnchanged")}
              </Text>
            )}
            <Text variant="titleMedium">{submittedCreate.name}</Text>
            <Text variant="bodyMedium">
              {t(`vocabulary.kind.${submittedCreate.kind}`)}
            </Text>
            <Text variant="headlineMedium">
              {formatCurrency(submittedCreate.amount, currency)}
            </Text>
            <Text variant="bodyMedium">
              {formatRelativeDay(
                new Date(submittedCreate.transactionDate ?? ""),
                new Date(),
                locale,
              )}
            </Text>
          </View>
        ) : (
          <>
            {!isKindLocked && (
              <SegmentedPicker
                value={draft.kind}
                onValueChange={changeKind}
                buttons={kindOptions(t)}
              />
            )}

            {canPickCurrency && (
              <MovementCurrencyField
                inputCurrency={inputCurrency}
                onChange={setPickedCurrency}
                currency={currency}
                rate={rate}
                conversion={conversion}
              />
            )}
            <AmountField
              key={generation}
              isProminent
              label={t("budgets.mutations.amount")}
              amount={draft.amount}
              currency={inputCurrency}
              onChange={(amount) => change({ amount })}
            />
            <QuickAmountChips
              amount={draft.amount}
              currency={inputCurrency}
              onSelect={(amount) => {
                change({ amount });
                // The field holds its own text; only a remount shows the new one.
                setGeneration((current) => current + 1);
              }}
            />

            {impact !== null && (
              <ImpactBlock
                {...movementImpactContent(t, impact, selectedLine, currency)}
                currency={currency}
              />
            )}

            <TextInput
              testID="transaction-description"
              mode="outlined"
              label={t("budgets.mutations.description")}
              placeholder={t(
                `budgets.mutations.activity.placeholders.${draft.kind}`,
              )}
              value={draft.name}
              onChangeText={(name) => change({ name })}
              maxLength={NAME_MAX_LENGTH}
            />

            {showsQuestion && (
              <MovementLineQuestion
                isEditing={isEditing}
                isLocked={isQuestionLocked}
                shownLine={shownLine}
                selectedLineId={selectedLineId}
                hasEligibleLines={hasEligibleLines}
                transactions={transactions}
                currency={currency}
                onPick={setPickedLineId}
                onPickOther={() => setPickingLine(true)}
              />
            )}

            <Button
              mode="outlined"
              icon="calendar"
              onPress={() => setDatePickerVisible(true)}
              accessibilityLabel={t("budgets.mutations.activity.date")}
            >
              {formatRelativeDay(draft.day, new Date(), locale)}
            </Button>

            {isOriginOffered && (
              <MovementOrigin
                isFromSavingsGoal={isFromSavingsGoal}
                onToggle={(isOn) => {
                  setFromSavingsGoal(isOn);
                  if (!isOn) change({ sourceSavingsGoalId: null });
                }}
                options={options}
                selectedGoalId={draft.sourceSavingsGoalId}
                chosenOption={chosenOption}
                onPick={(goalId) => change({ sourceSavingsGoalId: goalId })}
                remaining={remainingAfterWithdrawal}
                railInset={SHEET_PADDING}
              />
            )}

            {!isEditing && (
              <View style={styles.checkedRow}>
                <View style={styles.checkedLabels}>
                  <Text variant="bodyLarge">
                    {t("budgets.mutations.activity.alreadyChecked")}
                  </Text>
                  <Text
                    variant="labelMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {t("budgets.mutations.activity.alreadyCheckedHint")}
                  </Text>
                </View>
                <Switch
                  value={draft.isChecked}
                  onValueChange={(isChecked) => change({ isChecked })}
                  accessibilityLabel={t(
                    "budgets.mutations.activity.alreadyCheckedAccessibility",
                  )}
                />
              </View>
            )}

            <TagPicker
              selectedIds={draft.tagIds}
              onChange={(tagIds) => change({ tagIds })}
            />
          </>
        )}
      </FormModal>

      {/* Android's own dialog, not a full-page calendar: mounting this renders
          nothing and asks the platform to present its picker. */}
      {isDatePickerVisible && (
        <DateTimePicker
          value={draft.day}
          mode="date"
          minimumDate={period?.startDate}
          maximumDate={period?.endDate}
          onChange={(event, date) => {
            setDatePickerVisible(false);
            if (event.type !== "set" || date === undefined) return;
            change({ day: date });
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  checkedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  checkedLabels: { flex: 1, gap: SPACING.xxs },
  submitted: { gap: SPACING.sm },
  question: { gap: SPACING.sm },
  locked: { opacity: EMPHASIS.disabled },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  origin: { gap: SPACING.sm },
  hint: { textAlign: "center" },
});
