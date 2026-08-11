import * as Haptics from "expo-haptics";
import type { SupportedCurrency, TransactionKind } from "pulpe-shared";
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
  draftHint,
  isDraftSubmittable,
  type TransactionDraft,
} from "../add-transaction-payload";
import { useCreateTransaction } from "../create-transaction-mutation";

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

interface AddTransactionSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  budgetId: string;
  currency: SupportedCurrency;
  onAdded: () => void;
}

/**
 * Quick entry for an operation that happened outside the plan. Nothing here is
 * tied to a prévision — allocating a transaction to one belongs to the budget
 * detail, where the envelope being filled is on screen to choose from.
 */
export function AddTransactionSheet({
  isVisible,
  onDismiss,
  budgetId,
  currency,
  onAdded,
}: AddTransactionSheetProps) {
  const theme = useTheme();
  const create = useCreateTransaction();
  // The budget is not part of the draft: it belongs to the screen, and holding
  // a copy in form state is how a sheet ends up posting to last month's budget
  // after a period rolls over while it is open.
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  // Bumped on every reset. The amount field holds its own text so a decimal
  // separator survives typing, which means clearing the number behind it is not
  // enough to clear what is on screen — only a remount is.
  const [generation, setGeneration] = useState(0);
  const draft: TransactionDraft = { ...form, budgetId };

  function update(changes: Partial<FormState>) {
    setForm((current) => ({ ...current, ...changes }));
  }

  function reset() {
    setForm(emptyForm());
    setGeneration((current) => current + 1);
  }

  /** Dismissing means abandoning: a half-filled form must not greet the next open. */
  function dismiss() {
    reset();
    create.reset();
    onDismiss();
  }

  function submit() {
    if (!isDraftSubmittable(draft)) return;
    create.mutate(buildTransactionPayload(draft, new Date()), {
      onSuccess: () => {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        reset();
        onAdded();
      },
    });
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
          <Text variant="titleMedium">Ajouter une opération</Text>

          <SegmentedButtons
            value={draft.kind}
            onValueChange={(kind) => update({ kind: kind as TransactionKind })}
            buttons={KIND_BUTTONS}
          />

          <AmountField
            key={generation}
            label="Montant"
            amount={draft.amount}
            currency={currency}
            onChange={(amount) => update({ amount })}
          />

          <TextInput
            mode="outlined"
            label="Description"
            placeholder={NAME_PLACEHOLDERS[draft.kind]}
            value={draft.name}
            onChangeText={(name) => update({ name })}
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
              onValueChange={(isChecked) => update({ isChecked })}
              accessibilityLabel="Opération déjà pointée"
            />
          </View>

          <TagPicker
            selectedIds={draft.tagIds}
            onChange={(tagIds) => update({ tagIds })}
          />

          {create.isError && (
            <HelperText type="error" visible>
              L&apos;opération n&apos;a pas pu être ajoutée. Réessaie.
            </HelperText>
          )}

          <Button
            mode="contained"
            onPress={submit}
            disabled={!isDraftSubmittable(draft) || create.isPending}
            loading={create.isPending}
          >
            Ajouter
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

      <DatePickerModal
        locale={DATE_LOCALE}
        mode="single"
        visible={isDatePickerVisible}
        onDismiss={() => setDatePickerVisible(false)}
        date={draft.day}
        onConfirm={({ date }) => {
          setDatePickerVisible(false);
          if (date !== undefined) update({ day: date });
        }}
        label="Date de l'opération"
        saveLabel="Valider"
      />
    </Portal>
  );
}

type FormState = Omit<TransactionDraft, "budgetId">;

function emptyForm(): FormState {
  return {
    name: "",
    amount: null,
    kind: "expense",
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
