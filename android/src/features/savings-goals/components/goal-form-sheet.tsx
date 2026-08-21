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
import { useTranslation } from "@/core/i18n/locale-store";
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
  const { locale, t } = useTranslation();
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
        title={t(`goals.form.${isEditing ? "editTitle" : "createTitle"}`)}
        // The longest form in the app — name, two amounts, two dates, a toggle
        // and a monthly amount. Scrolled with the body, its own button would sit
        // a screen and a half below the first field.
        footer={
          <>
            {mutation.isError && (
              <FieldError visible>{t("goals.form.saveError")}</FieldError>
            )}

            <Button
              mode="contained"
              onPress={submit}
              disabled={
                !isSavingsGoalDraftSubmittable(draft) || mutation.isPending
              }
              loading={mutation.isPending}
            >
              {t(`goals.form.${isEditing ? "save" : "create"}`)}
            </Button>

            {hint !== null && (
              <Text
                variant="labelMedium"
                style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
              >
                {t(`goals.form.validation.${hint}`)}
              </Text>
            )}
          </>
        }
      >
        <TextInput
          mode="outlined"
          label={t("goals.form.name")}
          placeholder={t("goals.form.namePlaceholder")}
          value={draft.name}
          onChangeText={(name) => change({ name })}
          maxLength={NAME_MAX_LENGTH}
        />

        <AmountField
          key={`target-${generation}`}
          label={t("goals.form.target")}
          amount={draft.targetAmount}
          currency={currency}
          onChange={(targetAmount) => change({ targetAmount })}
        />

        <AmountField
          key={`initial-${generation}`}
          label={t("goals.form.initial")}
          amount={draft.initialAmount}
          currency={currency}
          onChange={(initialAmount) => change({ initialAmount })}
        />

        <DateRow
          label={t("goals.form.start")}
          value={draft.startDate}
          emptyHint={t("goals.form.startHint")}
          locale={locale}
          onPress={() => setPickingDate("startDate")}
          onClear={() => change({ startDate: null })}
        />

        <DateRow
          label={t("goals.form.deadline")}
          value={draft.targetDate}
          emptyHint={t("goals.form.deadlineHint")}
          locale={locale}
          onPress={() => setPickingDate("targetDate")}
          onClear={() => change({ targetDate: null })}
        />

        {isDecomposable && (
          <>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLabels}>
                <Text variant="bodyLarge">{t("goals.form.decompose")}</Text>
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("goals.form.decomposeHint")}
                </Text>
              </View>
              <Switch
                value={draft.isDecomposed}
                onValueChange={(isDecomposed) => change({ isDecomposed })}
                accessibilityLabel={t("goals.form.decompose")}
              />
            </View>

            {draft.isDecomposed && (
              <>
                <AmountField
                  key={`monthly-${generation}-${suggestion}`}
                  label={t("goals.form.monthly")}
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
                    ? t("goals.form.monthlyHint")
                    : t("goals.form.suggestion", {
                        amount: formatCurrency(suggestion, currency),
                      })}
                </Text>
              </>
            )}
          </>
        )}

        {isManual && (
          <>
            <AmountField
              key={`manual-${generation}`}
              label={t("goals.form.monthlyOptional")}
              amount={draft.monthlyOverride}
              currency={currency}
              onChange={(monthlyOverride) => change({ monthlyOverride })}
            />
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {draft.targetDate === null
                ? t("goals.form.monthlyNoDeadline")
                : t("goals.form.monthlyUntilDeadline")}
            </Text>
          </>
        )}

        {isEditing && (
          <SegmentedButtons
            value={draft.status}
            onValueChange={(status) =>
              change({ status: status as SavingsGoalStatus })
            }
            buttons={(["ACTIVE", "PAUSED", "COMPLETED"] as const).map(
              (value) => ({ value, label: t(`goals.status.${value}`) }),
            )}
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
  locale,
  onPress,
  onClear,
}: {
  label: string;
  value: string | null;
  emptyHint: string;
  locale: string;
  onPress: () => void;
  onClear: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.dateRow}>
      <View style={styles.toggleLabels}>
        <Text variant="bodyLarge">{label}</Text>
        <Text
          variant="labelMedium"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {value === null ? emptyHint : formatIsoDate(value, locale)}
        </Text>
      </View>
      <View style={styles.dateActions}>
        {value !== null && (
          <Button mode="text" onPress={onClear} compact>
            {t("common.clear")}
          </Button>
        )}
        <Button mode="outlined" onPress={onPress} icon="calendar" compact>
          {t(`common.${value === null ? "choose" : "edit"}`)}
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
