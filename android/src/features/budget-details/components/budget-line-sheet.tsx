import * as Haptics from "expo-haptics";
import type {
  BudgetLine,
  SupportedCurrency,
  TransactionKind,
  TransactionRecurrence,
} from "pulpe-shared";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import {
  Button,
  HelperText,
  Modal,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { AmountField } from "@/core/ui/amount-field";
import { RADIUS, SPACING } from "@/core/ui/theme";

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

const NAME_MAX_LENGTH = 100;

const KIND_BUTTONS: { value: TransactionKind; label: string; icon: string }[] =
  [
    { value: "expense", label: "Dépense", icon: "arrow-up" },
    { value: "income", label: "Revenu", icon: "arrow-down" },
    { value: "saving", label: "Épargne", icon: "piggy-bank-outline" },
  ];

const RECURRENCE_BUTTONS: { value: TransactionRecurrence; label: string }[] = [
  { value: "fixed", label: "Récurrent" },
  { value: "one_off", label: "Prévu" },
];

const NAME_PLACEHOLDERS: Record<TransactionKind, string> = {
  expense: "Loyer, courses…",
  income: "Salaire, allocation…",
  saving: "Épargne vacances…",
};

interface BudgetLineSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  budgetId: string;
  currency: SupportedCurrency;
  /** Absent when creating; the line being corrected otherwise. */
  line?: BudgetLine;
  onSaved: () => void;
}

/**
 * One sheet for both writing a forecast and correcting one. They ask the same
 * four questions in the same order, and splitting them would have meant two
 * files drifting apart over the wording of "Récurrent".
 */
export function BudgetLineSheet({
  isVisible,
  onDismiss,
  budgetId,
  currency,
  line,
  onSaved,
}: BudgetLineSheetProps) {
  const theme = useTheme();
  const create = useCreateBudgetLine();
  const update = useUpdateBudgetLine();
  const [draft, setDraft] = useState<BudgetLineDraft>(() =>
    line === undefined ? emptyBudgetLineDraft() : budgetLineDraftFrom(line),
  );
  // Bumped on reset. The amount field holds its own text, so clearing the
  // number behind it is not enough to clear what is on screen.
  const [generation, setGeneration] = useState(0);
  const isEditing = line !== undefined;
  const mutation = isEditing ? update : create;

  function change(changes: Partial<BudgetLineDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function reset() {
    setDraft(
      line === undefined ? emptyBudgetLineDraft() : budgetLineDraftFrom(line),
    );
    setGeneration((current) => current + 1);
  }

  function dismiss() {
    reset();
    create.reset();
    update.reset();
    onDismiss();
  }

  function submit() {
    if (!isBudgetLineDraftSubmittable(draft)) return;

    const onSuccess = () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      onSaved();
    };

    if (line === undefined) {
      create.mutate(buildBudgetLineCreate(draft, budgetId), { onSuccess });
      return;
    }
    update.mutate(buildBudgetLineUpdate(draft, line), { onSuccess });
  }

  const hint = budgetLineDraftHint(draft);

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
            {isEditing ? "Modifier la prévision" : "Nouvelle prévision"}
          </Text>

          <SegmentedButtons
            value={draft.kind}
            onValueChange={(kind) => change({ kind: kind as TransactionKind })}
            buttons={KIND_BUTTONS}
          />

          <AmountField
            key={generation}
            label="Montant prévu"
            amount={draft.amount}
            currency={currency}
            onChange={(amount) => change({ amount })}
          />

          <TextInput
            mode="outlined"
            label="Nom"
            placeholder={NAME_PLACEHOLDERS[draft.kind]}
            value={draft.name}
            onChangeText={(name) => change({ name })}
            maxLength={NAME_MAX_LENGTH}
          />

          <SegmentedButtons
            value={draft.recurrence}
            onValueChange={(recurrence) =>
              change({ recurrence: recurrence as TransactionRecurrence })
            }
            buttons={RECURRENCE_BUTTONS}
          />

          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {draft.recurrence === "fixed"
              ? "Revient chaque mois dans tes budgets suivants."
              : "N'existe que dans ce mois-ci."}
          </Text>

          {mutation.isError && (
            <HelperText type="error" visible>
              La prévision n&apos;a pas pu être enregistrée. Réessaie.
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={submit}
            disabled={
              !isBudgetLineDraftSubmittable(draft) || mutation.isPending
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
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    maxHeight: "88%",
  },
  content: { padding: SPACING.lg, gap: SPACING.md },
  hint: { textAlign: "center" },
});
