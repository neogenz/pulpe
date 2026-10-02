import type {
  BudgetPeriodDates,
  SupportedCurrency,
  Transaction,
  TransactionKind,
} from "pulpe-shared";
import { useState } from "react";
import { randomUUID } from "react-native-quick-crypto";
import { StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";

import { hapticSuccess } from "@/core/ui/haptics";
import { useTranslation } from "@/core/i18n/locale-store";
import { kindOptions } from "@/core/ui/vocabulary";
import { TagPicker } from "@/features/tags/tag-picker";
import { QuickAmountChips } from "@/core/ui/quick-amount-chips";
import { AmountField } from "@/core/ui/amount-field";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { formatRelativeDay } from "@/core/ui/date-format";
import { FadingRail } from "@/core/ui/fading-rail";
import { FilterChip } from "@/core/ui/filter-chip";
import { FormModal } from "@/core/ui/sheet";
import { SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";
import { useSavingsGoalWithdrawalOptions } from "@/features/savings-goals/goals-queries";

import {
  buildTransactionPayload,
  buildTransactionUpdate,
  defaultOperationDay,
  draftHint,
  isDraftSubmittable,
  transactionDraftFrom,
  type TransactionDraft,
} from "../transaction-draft";
import {
  useCreateTransaction,
  useUpdateTransaction,
} from "../transaction-mutations";

const NAME_MAX_LENGTH = 100;

/** The gutter `core/ui/sheet` keeps, and so the one the rail has to give back. */
const SHEET_PADDING = SPACING.lg;

const KIND_ICONS = {
  expense: "arrow-up",
  income: "arrow-down",
  saving: "piggy-bank-outline",
} as const;

/** What an operation can be attached to, as far as this form is concerned. */
export interface EnvelopeTarget {
  id: string;
  name: string;
  kind: TransactionKind;
}

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
  onSaved,
  onDelete,
  isDeleting = false,
  hasDeleteFailed = false,
}: TransactionSheetProps) {
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  // The budget is not part of the draft: it belongs to the screen, and holding
  // a copy in form state is how a sheet ends up posting to last month's budget
  // after a period rolls over while it is open.
  const [form, setForm] = useState<FormState>(() =>
    initialForm(transaction, envelope, period),
  );
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  // Held apart from the chosen goal: "yes, from a goal" and "which one" are two
  // answers, and the block has to stay open between them.
  const [isFromSavingsGoal, setFromSavingsGoal] = useState(false);
  // Bumped on every reset. The amount field holds its own text so a decimal
  // separator survives typing, which means clearing the number behind it is not
  // enough to clear what is on screen — only a remount is.
  const [generation, setGeneration] = useState(0);
  // One id per operation being written, replayed unchanged on a retry, so a
  // request whose answer was lost cannot write it twice.
  const [createId, setCreateId] = useState(() => randomUUID());
  const draft: TransactionDraft = { ...form, budgetId };
  const isEditing = transaction !== undefined;
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
    chosenOption === null || draft.amount === null
      ? null
      : chosenOption.availableAmount - draft.amount;
  const originProblem = originProblemOf({
    isActive: isOriginOffered && isFromSavingsGoal,
    hasChosenGoal: draft.sourceSavingsGoalId !== null,
    remainingAfterWithdrawal,
  });

  function change(changes: Partial<FormState>) {
    setForm((current) => ({ ...current, ...changes }));
  }

  function changeKind(kind: TransactionKind) {
    change({
      kind,
      ...(kind === "income" ? {} : { sourceSavingsGoalId: null }),
    });
    if (kind !== "income") setFromSavingsGoal(false);
  }

  function reset() {
    setForm(initialForm(transaction, envelope, period));
    setFromSavingsGoal(false);
    setGeneration((current) => current + 1);
    setCreateId(randomUUID());
  }

  /** Dismissing means abandoning: a half-filled form must not greet the next open. */
  function dismiss() {
    reset();
    create.reset();
    update.reset();
    onDismiss();
  }

  function submit() {
    if (!isDraftSubmittable(draft) || originProblem !== null) return;

    const onSuccess = () => {
      hapticSuccess();
      reset();
      onSaved();
    };

    if (transaction === undefined) {
      const payload = {
        ...buildTransactionPayload(draft, new Date()),
        id: createId,
      };
      create.mutate(
        envelope === undefined
          ? payload
          : { ...payload, budgetLineId: envelope.id },
        { onSuccess },
      );
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

  const problem = draftHint(draft) ?? originProblem;

  return (
    <>
      <FormModal
        isVisible={isVisible}
        onDismiss={dismiss}
        isBusy={mutation.isPending || isDeleting}
        title={t(
          `budgets.mutations.activity.${isEditing ? "editTitle" : "createTitle"}`,
        )}
        subtitle={
          envelope === undefined
            ? undefined
            : t("budgets.mutations.activity.allocatedIn", {
                name: envelope.name,
              })
        }
        footer={
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
                !isDraftSubmittable(draft) ||
                originProblem !== null ||
                mutation.isPending
              }
              loading={mutation.isPending}
            >
              {t(`budgets.mutations.${isEditing ? "save" : "add"}`)}
            </Button>

            {problem !== null && (
              <Text
                variant="labelMedium"
                style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
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
        }
      >
        {!isKindLocked && (
          <SegmentedButtons
            value={draft.kind}
            onValueChange={(kind) => changeKind(kind as TransactionKind)}
            buttons={kindOptions(t).map((button) => ({
              ...button,
              icon: KIND_ICONS[button.value],
            }))}
          />
        )}

        <AmountField
          key={generation}
          isProminent
          label={t("budgets.mutations.amount")}
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

        <Button
          mode="outlined"
          icon="calendar"
          onPress={() => setDatePickerVisible(true)}
          accessibilityLabel={t("budgets.mutations.activity.date")}
        >
          {formatRelativeDay(draft.day, new Date(), locale)}
        </Button>

        {/* An income can be money coming in, or money coming back out of a pot
            the user already filled. Only the second empties a goal, and the
            server needs to be told which one this is. */}
        {isOriginOffered && (
          <View style={styles.origin}>
            <View style={styles.checkedRow}>
              <View style={styles.checkedLabels}>
                <Text variant="bodyLarge">
                  {t("budgets.mutations.activity.originTitle")}
                </Text>
                {isFromSavingsGoal && (
                  <Text
                    variant="labelMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {t("budgets.mutations.activity.originHint")}
                  </Text>
                )}
              </View>
              <Switch
                value={isFromSavingsGoal}
                onValueChange={(isOn) => {
                  setFromSavingsGoal(isOn);
                  if (!isOn) change({ sourceSavingsGoalId: null });
                }}
                accessibilityLabel={t(
                  "budgets.mutations.activity.originAccessibility",
                )}
              />
            </View>

            {isFromSavingsGoal &&
              (options.isPending ? (
                <ActivityIndicator accessibilityLabel={t("common.loading")} />
              ) : (options.data ?? []).length === 0 ? (
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("budgets.mutations.activity.noGoals")}
                </Text>
              ) : (
                <FadingRail
                  inset={SHEET_PADDING}
                  background={theme.colors.surface}
                  accessibilityLabel={t(
                    "budgets.mutations.activity.goalsAvailable",
                  )}
                >
                  {(options.data ?? []).map((option) => (
                    <FilterChip
                      key={option.goalId}
                      selected={option.goalId === draft.sourceSavingsGoalId}
                      icon="piggy-bank-outline"
                      onPress={() =>
                        change({ sourceSavingsGoalId: option.goalId })
                      }
                      accessibilityState={{
                        selected: option.goalId === draft.sourceSavingsGoalId,
                      }}
                    >
                      {`${option.name} · ${formatCompactCurrency(
                        option.availableAmount,
                        option.currency,
                      )}`}
                    </FilterChip>
                  ))}
                </FadingRail>
              ))}

            {/* What the goal has left afterwards, which is the number the
                choice is actually made on. */}
            {isFromSavingsGoal &&
              chosenOption !== null &&
              remainingAfterWithdrawal !== null && (
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {`${chosenOption.name} · ${formatCompactCurrency(
                    chosenOption.availableAmount,
                    chosenOption.currency,
                  )} → ${formatCompactCurrency(
                    remainingAfterWithdrawal,
                    chosenOption.currency,
                  )}`}
                </Text>
              )}
          </View>
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

type FormState = Omit<TransactionDraft, "budgetId">;

/**
 * The two ways an announced withdrawal is not ready to send, in the order the
 * user meets them. Both are refusals the server would state itself, and neither
 * is worth a round trip to hear.
 */
function originProblemOf(input: {
  isActive: boolean;
  hasChosenGoal: boolean;
  remainingAfterWithdrawal: number | null;
}): "goal" | "exceedsGoal" | null {
  if (!input.isActive) return null;
  if (!input.hasChosenGoal) return "goal";
  if (
    input.remainingAfterWithdrawal !== null &&
    input.remainingAfterWithdrawal < 0
  ) {
    return "exceedsGoal";
  }
  return null;
}

function initialForm(
  transaction: Transaction | undefined,
  envelope: EnvelopeTarget | undefined,
  period: BudgetPeriodDates | undefined,
): FormState {
  if (transaction !== undefined) {
    const { budgetId: _budgetId, ...form } = transactionDraftFrom(transaction);
    return form;
  }

  return {
    name: "",
    amount: null,
    kind: envelope?.kind ?? "expense",
    day: defaultOperationDay(new Date(), period),
    // An operation entered by hand is one the user has just seen happen, so it
    // arrives pointed; the toggle is there for the one they are anticipating.
    isChecked: true,
    tagIds: [],
    sourceSavingsGoalId: null,
  };
}

const styles = StyleSheet.create({
  checkedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  checkedLabels: { flex: 1, gap: SPACING.xxs },
  origin: { gap: SPACING.sm },
  hint: { textAlign: "center" },
});
