import * as Haptics from "expo-haptics";
import type {
  SupportedCurrency,
  Transaction,
  TransactionKind,
} from "pulpe-shared";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  HelperText,
  Modal,
  Portal,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";

import { TagPicker } from "@/core/tags/tag-picker";
import { AmountField } from "@/core/ui/amount-field";
import { formatRelativeDay } from "@/core/ui/date-format";
import { RADIUS, SPACING } from "@/core/ui/theme";

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
const DATE_LOCALE = "fr";

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
 * Two of the fields are creation-only, and not by choice of layout — the update
 * endpoint takes neither. Pointing has its own ring on the row, and the
 * envelope an operation answers to is settled when it is written, because
 * moving it would move two consumptions at once.
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

  function change(changes: Partial<FormState>) {
    setForm((current) => ({ ...current, ...changes }));
  }

  function reset() {
    setForm(initialForm(transaction, envelope));
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
    if (!isDraftSubmittable(draft)) return;

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

  const hint = draftHint(draft);

  return (
    <Portal>
      <Modal
        visible={isVisible}
        onDismiss={dismiss}
        contentContainerStyle={[
          styles.sheet,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="titleMedium">
            {isEditing ? "Modifier l'opération" : "Ajouter une opération"}
          </Text>

          {envelope !== undefined && (
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Comptée dans « {envelope.name} »
            </Text>
          )}

          {!isKindLocked && (
            <SegmentedButtons
              value={draft.kind}
              onValueChange={(kind) =>
                change({ kind: kind as TransactionKind })
              }
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

          {mutation.isError && (
            <HelperText type="error" visible>
              L&apos;opération n&apos;a pas pu être enregistrée. Réessaie.
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={submit}
            disabled={!isDraftSubmittable(draft) || mutation.isPending}
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
        </ScrollView>
      </Modal>

      <DatePickerModal
        locale={DATE_LOCALE}
        mode="single"
        visible={isDatePickerVisible}
        onDismiss={() => setDatePickerVisible(false)}
        date={draft.day}
        onConfirm={({ date }) => {
          setDatePickerVisible(false);
          if (date !== undefined) change({ day: date });
        }}
        label="Date de l'opération"
        saveLabel="Valider"
      />
    </Portal>
  );
}

type FormState = Omit<TransactionDraft, "budgetId">;

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
  };
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    maxHeight: "88%",
  },
  content: { padding: SPACING.lg, gap: SPACING.md },
  checkedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  checkedLabels: { flex: 1, gap: SPACING.xxs },
  hint: { textAlign: "center" },
});
