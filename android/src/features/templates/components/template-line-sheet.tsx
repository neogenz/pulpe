import type {
  SupportedCurrency,
  TemplateLine,
  TransactionKind,
  TransactionRecurrence,
} from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  Dialog,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { RECURRENCE_OPTIONS } from "@/core/ui/vocabulary";
import { hapticSuccess } from "@/core/ui/haptics";
import { AmountField } from "@/core/ui/amount-field";
import { Sheet } from "@/core/ui/sheet";
import { SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";
import { useSavingsGoals } from "@/features/savings-goals/goals-queries";

import {
  useBulkTemplateLines,
  useCreateTemplateLine,
  useUpdateTemplateLine,
} from "../template-queries";

const NAME_MAX_LENGTH = 100;

const KIND_BUTTONS: { value: TransactionKind; label: string; icon: string }[] =
  [
    { value: "expense", label: "Dépense", icon: "arrow-up" },
    { value: "income", label: "Revenu", icon: "arrow-down" },
    { value: "saving", label: "Épargne", icon: "piggy-bank-outline" },
  ];

interface TemplateLineSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  templateId: string;
  currency: SupportedCurrency;
  /** How many budgets an edit would reach — decides whether to ask. */
  propagationCount: number;
  /** Absent when adding; the line being corrected otherwise. */
  line?: TemplateLine;
  onSaved: () => void;
}

/**
 * One forecast of the model.
 *
 * Editing an existing one can reach the budgets already generated from the
 * model, so it asks first, exactly as iOS does — and only when there is
 * something to reach. Adding never propagates: a new line joins the months to
 * come on their own generation, and pushing it into open budgets would write
 * into months the user has already arranged.
 */
export function TemplateLineSheet({
  isVisible,
  onDismiss,
  templateId,
  currency,
  propagationCount,
  line,
  onSaved,
}: TemplateLineSheetProps) {
  const theme = useTheme();
  const goals = useSavingsGoals();
  const create = useCreateTemplateLine();
  const update = useUpdateTemplateLine();
  const bulk = useBulkTemplateLines();
  const [name, setName] = useState(line?.name ?? "");
  const [amount, setAmount] = useState<number | null>(line?.amount ?? null);
  const [kind, setKind] = useState<TransactionKind>(line?.kind ?? "expense");
  const [recurrence, setRecurrence] = useState<TransactionRecurrence>(
    line?.recurrence ?? "fixed",
  );
  const [savingsGoalId, setSavingsGoalId] = useState<string | null>(
    line?.savingsGoalId ?? null,
  );
  const [isPropagationVisible, setPropagationVisible] = useState(false);

  const isEditing = line !== undefined;
  const mutation = isEditing ? (bulk.isPending ? bulk : update) : create;
  const isSubmittable =
    name.trim().length > 0 &&
    amount !== null &&
    amount > 0 &&
    !mutation.isPending;
  // The backend guards the same way: only a saving carries a goal.
  const goalLink = kind === "saving" ? savingsGoalId : null;

  function dismiss() {
    setPropagationVisible(false);
    create.reset();
    update.reset();
    bulk.reset();
    onDismiss();
  }

  function succeed() {
    hapticSuccess();
    setPropagationVisible(false);
    onSaved();
  }

  function submit() {
    if (!isSubmittable || amount === null) return;

    if (line === undefined) {
      create.mutate(
        {
          templateId,
          name: name.trim(),
          amount,
          kind,
          recurrence,
          description: "",
          savingsGoalId: goalLink,
        },
        { onSuccess: succeed },
      );
      return;
    }
    if (propagationCount > 0) {
      setPropagationVisible(true);
      return;
    }
    saveTemplateOnly();
  }

  function saveTemplateOnly() {
    if (line === undefined || amount === null) return;
    update.mutate(
      {
        templateId,
        lineId: line.id,
        changes: {
          name: name.trim(),
          amount,
          kind,
          recurrence,
          savingsGoalId: goalLink,
        },
      },
      { onSuccess: succeed },
    );
  }

  function saveAndPropagate() {
    if (line === undefined || amount === null) return;
    bulk.mutate(
      {
        templateId,
        operations: {
          create: [],
          delete: [],
          update: [
            {
              id: line.id,
              name: name.trim(),
              amount,
              kind,
              recurrence,
              savingsGoalId: goalLink,
            },
          ],
          propagateToBudgets: true,
        },
      },
      { onSuccess: succeed },
    );
  }

  return (
    <>
      <Sheet
        isVisible={isVisible && !isPropagationVisible}
        onDismiss={dismiss}
        title={isEditing ? "Modifier la prévision" : "Nouvelle prévision"}
        footer={
          <>
            {mutation.isError && (
              <FieldError visible>
                La prévision n&apos;a pas pu être enregistrée. Réessaie.
              </FieldError>
            )}

            <Button
              mode="contained"
              onPress={submit}
              disabled={!isSubmittable}
              loading={mutation.isPending}
            >
              {isEditing ? "Enregistrer" : "Ajouter"}
            </Button>
            <Button mode="text" onPress={dismiss} disabled={mutation.isPending}>
              Annuler
            </Button>
          </>
        }
      >
        <SegmentedButtons
          value={kind}
          onValueChange={(next) => setKind(next as TransactionKind)}
          buttons={KIND_BUTTONS}
        />

        <AmountField
          label="Montant prévu"
          amount={amount}
          currency={currency}
          onChange={setAmount}
        />

        <TextInput
          mode="outlined"
          label="Nom"
          value={name}
          onChangeText={setName}
          maxLength={NAME_MAX_LENGTH}
        />

        <SegmentedButtons
          value={recurrence}
          onValueChange={(next) => setRecurrence(next as TransactionRecurrence)}
          buttons={RECURRENCE_OPTIONS}
        />

        {kind === "saving" && (goals.data ?? []).length > 0 && (
          <View style={styles.goals}>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Rattacher à un objectif
            </Text>
            <View style={styles.chips}>
              <Chip
                selected={savingsGoalId === null}
                onPress={() => setSavingsGoalId(null)}
              >
                Aucun
              </Chip>
              {(goals.data ?? []).map((goal) => (
                <Chip
                  key={goal.id}
                  selected={savingsGoalId === goal.id}
                  onPress={() => setSavingsGoalId(goal.id)}
                >
                  {goal.name}
                </Chip>
              ))}
            </View>
          </View>
        )}
      </Sheet>

      <Portal>
        <Dialog
          visible={isVisible && isPropagationVisible}
          onDismiss={() => setPropagationVisible(false)}
        >
          <Dialog.Title>Appliquer aux mois suivants ?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Ce modèle est utilisé par {propagationCount}{" "}
              {propagationCount === 1 ? "budget" : "budgets"}. « Appliquer »
              mettra à jour les budgets en cours et futurs. Les prévisions
              modifiées à la main ne seront pas touchées.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setPropagationVisible(false)}>
              Annuler
            </Button>
            <Button onPress={saveTemplateOnly} disabled={mutation.isPending}>
              Modèle uniquement
            </Button>
            <Button
              mode="contained"
              onPress={saveAndPropagate}
              disabled={mutation.isPending}
              loading={bulk.isPending}
            >
              Appliquer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  goals: { gap: SPACING.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  dialogActions: { flexWrap: "wrap", gap: SPACING.xs },
});
