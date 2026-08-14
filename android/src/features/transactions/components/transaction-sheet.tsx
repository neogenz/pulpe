import * as Haptics from "expo-haptics";
import type {
  SupportedCurrency,
  Transaction,
  TransactionKind,
} from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  HelperText,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";

import { TagPicker } from "@/core/tags/tag-picker";
import { AmountField } from "@/core/ui/amount-field";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import { formatRelativeDay } from "@/core/ui/date-format";
import { FadingRail } from "@/core/ui/fading-rail";
import { FilterChip } from "@/core/ui/filter-chip";
import { Sheet } from "@/core/ui/sheet";
import { SPACING } from "@/core/ui/theme";
import { useSavingsGoalWithdrawalOptions } from "@/features/savings-goals/goals-queries";

import {
  buildTransactionPayload,
  buildTransactionUpdate,
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

const KIND_BUTTONS: { value: TransactionKind; label: string; icon: string }[] =
  [
    { value: "expense", label: "Dépense", icon: "arrow-up" },
    { value: "income", label: "Revenu", icon: "arrow-down" },
    { value: "saving", label: "Épargne", icon: "piggy-bank-outline" },
  ];

const NAME_PLACEHOLDERS: Record<TransactionKind, string> = {
  expense: "Restaurant, essence…",
  income: "Prime, remboursement…",
  saving: "Virement épargne…",
};

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
  onSaved: () => void;
  onDelete?: () => void;
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
  onSaved,
  onDelete,
}: TransactionSheetProps) {
  const theme = useTheme();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  // The budget is not part of the draft: it belongs to the screen, and holding
  // a copy in form state is how a sheet ends up posting to last month's budget
  // after a period rolls over while it is open.
  const [form, setForm] = useState<FormState>(() =>
    initialForm(transaction, envelope),
  );
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  // Held apart from the chosen goal: "yes, from a goal" and "which one" are two
  // answers, and the block has to stay open between them.
  const [isFromSavingsGoal, setFromSavingsGoal] = useState(false);
  // Bumped on every reset. The amount field holds its own text so a decimal
  // separator survives typing, which means clearing the number behind it is not
  // enough to clear what is on screen — only a remount is.
  const [generation, setGeneration] = useState(0);
  const draft: TransactionDraft = { ...form, budgetId };
  const isEditing = transaction !== undefined;
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
    setForm(initialForm(transaction, envelope));
    setFromSavingsGoal(false);
    setGeneration((current) => current + 1);
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      onSaved();
    };

    if (transaction === undefined) {
      const payload = buildTransactionPayload(draft, new Date());
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

  const hint = draftHint(draft) ?? originProblem;

  return (
    <>
      <Sheet
        isVisible={isVisible}
        onDismiss={dismiss}
        title={isEditing ? "Modifier l'opération" : "Ajouter une opération"}
        subtitle={
          envelope === undefined
            ? undefined
            : `Comptée dans « ${envelope.name} »`
        }
        footer={
          <>
            {mutation.isError && (
              <HelperText type="error" visible>
                L&apos;opération n&apos;a pas pu être enregistrée. Réessaie.
              </HelperText>
            )}

            <Button
              mode="contained"
              onPress={submit}
              disabled={
                !isDraftSubmittable(draft) ||
                originProblem !== null ||
                mutation.isPending
              }
              loading={mutation.isPending}
            >
              {isEditing ? "Enregistrer" : "Ajouter"}
            </Button>

            {hint !== null && (
              <Text
                variant="labelMedium"
                style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
              >
                {hint}
              </Text>
            )}

            {onDelete !== undefined && isEditing && (
              <Button
                mode="text"
                icon="trash-can-outline"
                textColor={theme.colors.error}
                onPress={onDelete}
              >
                Supprimer
              </Button>
            )}
          </>
        }
      >
        {!isKindLocked && (
          <SegmentedButtons
            value={draft.kind}
            onValueChange={(kind) => changeKind(kind as TransactionKind)}
            buttons={KIND_BUTTONS}
          />
        )}

        <AmountField
          key={generation}
          label="Montant"
          amount={draft.amount}
          currency={currency}
          onChange={(amount) => change({ amount })}
        />

        <TextInput
          mode="outlined"
          label="Description"
          placeholder={NAME_PLACEHOLDERS[draft.kind]}
          value={draft.name}
          onChangeText={(name) => change({ name })}
          maxLength={NAME_MAX_LENGTH}
        />

        <Button
          mode="outlined"
          icon="calendar"
          onPress={() => setDatePickerVisible(true)}
          accessibilityLabel="Date de l'opération"
        >
          {formatRelativeDay(draft.day, new Date())}
        </Button>

        {/* An income can be money coming in, or money coming back out of a pot
            the user already filled. Only the second empties a goal, and the
            server needs to be told which one this is. */}
        {isOriginOffered && (
          <View style={styles.origin}>
            <View style={styles.checkedRow}>
              <View style={styles.checkedLabels}>
                <Text variant="bodyLarge">
                  Ce revenu vient d&apos;un objectif d&apos;épargne
                </Text>
                {isFromSavingsGoal && (
                  <Text
                    variant="labelMedium"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Le montant sera retiré de l&apos;objectif choisi.
                  </Text>
                )}
              </View>
              <Switch
                value={isFromSavingsGoal}
                onValueChange={(isOn) => {
                  setFromSavingsGoal(isOn);
                  if (!isOn) change({ sourceSavingsGoalId: null });
                }}
                accessibilityLabel="Revenu venant d'un objectif d'épargne"
              />
            </View>

            {isFromSavingsGoal &&
              (options.isPending ? (
                <ActivityIndicator />
              ) : (options.data ?? []).length === 0 ? (
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Aucun objectif n&apos;a d&apos;argent disponible pour
                  l&apos;instant.
                </Text>
              ) : (
                <FadingRail
                  inset={SHEET_PADDING}
                  background={theme.colors.surface}
                  accessibilityLabel="Objectifs disponibles"
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
              <Text variant="bodyLarge">Déjà pointée</Text>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Compte dans ton solde à date
              </Text>
            </View>
            <Switch
              value={draft.isChecked}
              onValueChange={(isChecked) => change({ isChecked })}
              accessibilityLabel="Opération déjà pointée"
            />
          </View>
        )}

        <TagPicker
          selectedIds={draft.tagIds}
          onChange={(tagIds) => change({ tagIds })}
        />
      </Sheet>

      {/* Android's own dialog, not a full-page calendar: mounting this renders
          nothing and asks the platform to present its picker. */}
      {isDatePickerVisible && (
        <DateTimePicker
          value={draft.day}
          mode="date"
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
}): string | null {
  if (!input.isActive) return null;
  if (!input.hasChosenGoal) return "Choisis l'objectif utilisé";
  if (
    input.remainingAfterWithdrawal !== null &&
    input.remainingAfterWithdrawal < 0
  ) {
    return "Ce montant dépasse ce que contient l'objectif.";
  }
  return null;
}

function initialForm(
  transaction: Transaction | undefined,
  envelope: EnvelopeTarget | undefined,
): FormState {
  if (transaction !== undefined) {
    const { budgetId: _budgetId, ...form } = transactionDraftFrom(transaction);
    return form;
  }

  return {
    name: "",
    amount: null,
    kind: envelope?.kind ?? "expense",
    day: new Date(),
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
