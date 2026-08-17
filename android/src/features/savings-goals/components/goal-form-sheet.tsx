import type {
  SavingsGoal,
  SavingsGoalStatus,
  SupportedCurrency,
} from "pulpe-shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";

import { hapticSuccess } from "@/core/ui/haptics";
import { AmountField } from "@/core/ui/amount-field";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatIsoDate, parseIsoDate, toIsoDate } from "@/core/ui/date-format";
import { Sheet } from "@/core/ui/sheet";
import { SPACING } from "@/core/ui/theme";
import { FieldError } from "@/core/ui/field-error";

import {
  buildSavingsGoalCreate,
  buildSavingsGoalUpdate,
  canDecompose,
  emptySavingsGoalDraft,
  isSavingsGoalDraftSubmittable,
  savingsGoalDraftFrom,
  savingsGoalDraftHint,
  suggestedMonthly,
  usesManualMonthly,
  type SavingsGoalDraft,
} from "../goal-draft";
import { useCreateSavingsGoal, useUpdateSavingsGoal } from "../goals-queries";

const NAME_MAX_LENGTH = 100;

const STATUS_BUTTONS: { value: SavingsGoalStatus; label: string }[] = [
  { value: "ACTIVE", label: "En cours" },
  { value: "PAUSED", label: "En pause" },
  { value: "COMPLETED", label: "Atteint" },
];

/** Which of the two optional dates the calendar is currently answering. */
type DateField = "startDate" | "targetDate";

interface GoalFormSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  currency: SupportedCurrency;
  payDayOfMonth: number | null;
  /** Absent when creating; the goal being corrected otherwise. */
  goal?: SavingsGoal;
  onSaved: () => void;
}

/**
 * One sheet for setting a goal and for correcting one.
 *
 * The monthly amount is the only field that thinks for itself: with a target
 * and a date it pre-fills with what the target divides into, and the moment the
 * user types their own number the suggestion steps back. Editing never re-runs
 * the decomposition — the forecasts already exist, and regenerating them behind
 * the user's back is what the plan simulator is for.
 */
export function GoalFormSheet({
  isVisible,
  onDismiss,
  currency,
  payDayOfMonth,
  goal,
  onSaved,
}: GoalFormSheetProps) {
  const theme = useTheme();
  const create = useCreateSavingsGoal();
  const update = useUpdateSavingsGoal();
  const [draft, setDraft] = useState<SavingsGoalDraft>(() =>
    goal === undefined ? emptySavingsGoalDraft() : savingsGoalDraftFrom(goal),
  );
  // Bumped on reset — the amount fields hold their own text, so clearing the
  // numbers behind them is not enough to clear what is on screen.
  const [generation, setGeneration] = useState(0);
  const [pickingDate, setPickingDate] = useState<DateField | null>(null);

  const isEditing = goal !== undefined;
  const mutation = isEditing ? update : create;
  const suggestion = suggestedMonthly(draft, payDayOfMonth);
  const isDecomposable = !isEditing && canDecompose(draft);
  const isManual = !isEditing && usesManualMonthly(draft);
  const hint = savingsGoalDraftHint(draft);

  function change(changes: Partial<SavingsGoalDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function reset() {
    setDraft(
      goal === undefined ? emptySavingsGoalDraft() : savingsGoalDraftFrom(goal),
    );
    setGeneration((current) => current + 1);
    setPickingDate(null);
  }

  function dismiss() {
    reset();
    create.reset();
    update.reset();
    onDismiss();
  }

  function submit() {
    if (!isSavingsGoalDraftSubmittable(draft)) return;

    const onSuccess = () => {
      hapticSuccess();
      reset();
      onSaved();
    };

    if (goal === undefined) {
      create.mutate(buildSavingsGoalCreate(draft, payDayOfMonth), {
        onSuccess,
      });
      return;
    }
    update.mutate(
      { goalId: goal.id, changes: buildSavingsGoalUpdate(draft, goal) },
      { onSuccess },
    );
  }

  return (
    <>
      <Sheet
        isVisible={isVisible}
        onDismiss={dismiss}
        isBusy={mutation.isPending}
        title={isEditing ? "Modifier l'objectif" : "Nouvel objectif"}
        // The longest form in the app — name, two amounts, two dates, a toggle
        // and a monthly amount. Scrolled with the body, its own button would sit
        // a screen and a half below the first field.
        footer={
          <>
            {mutation.isError && (
              <FieldError visible>
                L&apos;objectif n&apos;a pas pu être enregistré. Réessaie.
              </FieldError>
            )}

            <Button
              mode="contained"
              onPress={submit}
              disabled={
                !isSavingsGoalDraftSubmittable(draft) || mutation.isPending
              }
              loading={mutation.isPending}
            >
              {isEditing ? "Enregistrer" : "Créer mon objectif"}
            </Button>

            {hint !== null && (
              <Text
                variant="labelMedium"
                style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
              >
                {hint}
              </Text>
            )}
          </>
        }
      >
        <TextInput
          mode="outlined"
          label="Nom de l'objectif"
          placeholder="Voyage, appart, coussin de sécurité…"
          value={draft.name}
          onChangeText={(name) => change({ name })}
          maxLength={NAME_MAX_LENGTH}
        />

        <AmountField
          key={`target-${generation}`}
          label="Cible (optionnelle)"
          amount={draft.targetAmount}
          currency={currency}
          onChange={(targetAmount) => change({ targetAmount })}
        />

        <AmountField
          key={`initial-${generation}`}
          label="Montant de départ (optionnel)"
          amount={draft.initialAmount}
          currency={currency}
          onChange={(initialAmount) => change({ initialAmount })}
        />

        <DateRow
          label="Début"
          value={draft.startDate}
          emptyHint="À partir de ce mois-ci"
          onPress={() => setPickingDate("startDate")}
          onClear={() => change({ startDate: null })}
        />

        <DateRow
          label="Échéance"
          value={draft.targetDate}
          emptyHint="Sans date limite"
          onPress={() => setPickingDate("targetDate")}
          onClear={() => change({ targetDate: null })}
        />

        {isDecomposable && (
          <>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLabels}>
                <Text variant="bodyLarge">Décomposer en mensualités</Text>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Une épargne prévue sur chacun de tes budgets, jusqu&apos;à
                  l&apos;échéance
                </Text>
              </View>
              <Switch
                value={draft.isDecomposed}
                onValueChange={(isDecomposed) => change({ isDecomposed })}
                accessibilityLabel="Décomposer en mensualités"
              />
            </View>

            {draft.isDecomposed && (
              <>
                <AmountField
                  key={`monthly-${generation}-${suggestion}`}
                  label="Épargne mensuelle"
                  amount={draft.monthlyOverride ?? suggestion}
                  currency={currency}
                  onChange={(monthlyOverride) =>
                    change({
                      monthlyOverride:
                        monthlyOverride === suggestion ? null : monthlyOverride,
                    })
                  }
                />
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {suggestion === null
                    ? "Ce montant sera prévu chaque mois."
                    : `Pré-rempli avec ${formatCurrency(suggestion, currency)} — cible ÷ mois restants.`}
                </Text>
              </>
            )}
          </>
        )}

        {isManual && (
          <>
            <AmountField
              key={`manual-${generation}`}
              label="Épargne mensuelle (optionnelle)"
              amount={draft.monthlyOverride}
              currency={currency}
              onChange={(monthlyOverride) => change({ monthlyOverride })}
            />
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {draft.targetDate === null
                ? "Ce montant alimentera ton pot chaque mois, sans échéance imposée."
                : "Ce montant sera prévu chaque mois, jusqu'à l'échéance."}
            </Text>
          </>
        )}

        {isEditing && (
          <SegmentedButtons
            value={draft.status}
            onValueChange={(status) =>
              change({ status: status as SavingsGoalStatus })
            }
            buttons={STATUS_BUTTONS}
          />
        )}
      </Sheet>

      {/* Android's own dialog, not a full-page calendar: mounting this renders
          nothing and asks the platform to present its picker. */}
      {pickingDate !== null && (
        <DateTimePicker
          value={
            draft[pickingDate] !== null
              ? parseIsoDate(draft[pickingDate])
              : new Date()
          }
          mode="date"
          onChange={(event, date) => {
            const field = pickingDate;
            setPickingDate(null);
            if (event.type !== "set" || date === undefined) return;
            change({ [field]: toIsoDate(date) });
          }}
        />
      )}
    </>
  );
}

function DateRow({
  label,
  value,
  emptyHint,
  onPress,
  onClear,
}: {
  label: string;
  value: string | null;
  emptyHint: string;
  onPress: () => void;
  onClear: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.dateRow}>
      <View style={styles.toggleLabels}>
        <Text variant="bodyLarge">{label}</Text>
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {value === null ? emptyHint : formatIsoDate(value)}
        </Text>
      </View>
      <View style={styles.dateActions}>
        {value !== null && (
          <Button mode="text" onPress={onClear} compact>
            Effacer
          </Button>
        )}
        <Button mode="outlined" onPress={onPress} icon="calendar" compact>
          {value === null ? "Choisir" : "Modifier"}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  toggleLabels: { flex: 1, gap: SPACING.xxs },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  dateActions: { flexDirection: "row", alignItems: "center" },
  hint: { textAlign: "center" },
});
