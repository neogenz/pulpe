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

import { kindOptions, recurrenceOptions } from "@/core/ui/vocabulary";
import { useTranslation } from "@/core/i18n/locale-store";
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

const KIND_ICONS = {
  expense: "arrow-up",
  income: "arrow-down",
  saving: "piggy-bank-outline",
} as const;

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
  const { t } = useTranslation();
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
        isBusy={mutation.isPending}
        title={t(`templates.lines.${isEditing ? "editTitle" : "createTitle"}`)}
        footer={
          <>
            {mutation.isError && (
              <FieldError visible>{t("templates.lines.error")}</FieldError>
            )}

            <Button
              mode="contained"
              onPress={submit}
              disabled={!isSubmittable}
              loading={mutation.isPending}
            >
              {t(`templates.lines.${isEditing ? "save" : "add"}`)}
            </Button>
            <Button mode="text" onPress={dismiss} disabled={mutation.isPending}>
              {t("common.cancel")}
            </Button>
          </>
        }
      >
        <SegmentedButtons
          value={kind}
          onValueChange={(next) => setKind(next as TransactionKind)}
          buttons={kindOptions(t).map((button) => ({
            ...button,
            icon: KIND_ICONS[button.value],
          }))}
        />

        <AmountField
          label={t("templates.lines.amount")}
          amount={amount}
          currency={currency}
          onChange={setAmount}
        />

        <TextInput
          mode="outlined"
          label={t("templates.form.name")}
          value={name}
          onChangeText={setName}
          maxLength={NAME_MAX_LENGTH}
        />

        <SegmentedButtons
          value={recurrence}
          onValueChange={(next) => setRecurrence(next as TransactionRecurrence)}
          buttons={recurrenceOptions(t)}
        />

        {kind === "saving" && (goals.data ?? []).length > 0 && (
          <View style={styles.goals}>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {t("templates.lines.linkGoal")}
            </Text>
            <View style={styles.chips}>
              <Chip
                selected={savingsGoalId === null}
                onPress={() => setSavingsGoalId(null)}
              >
                {t("templates.lines.noGoal")}
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
          dismissable={!mutation.isPending}
        >
          <Dialog.Title>{t("templates.lines.propagationTitle")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t("templates.lines.propagationBody", {
                count: propagationCount,
              })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={() => setPropagationVisible(false)}
              disabled={mutation.isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button onPress={saveTemplateOnly} disabled={mutation.isPending}>
              {t("templates.lines.templateOnly")}
            </Button>
            <Button
              mode="contained"
              onPress={saveAndPropagate}
              disabled={mutation.isPending}
              loading={bulk.isPending}
            >
              {t("templates.lines.apply")}
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
