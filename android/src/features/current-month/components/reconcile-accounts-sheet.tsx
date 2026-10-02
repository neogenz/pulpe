import {
  ANALYTICS_EVENTS,
  type BudgetPeriodDates,
  CURRENCY_METADATA,
  parseAccountAmount,
  reconciliationVerdict,
  summarizeAccounts,
  type SupportedCurrency,
} from "pulpe-shared";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { captureEvent } from "@/core/observability/analytics";
import { Amount } from "@/core/ui/amount";
import { formatCurrency } from "@/core/ui/amount-format";
import { formatDayMonth } from "@/core/ui/date-format";
import { FieldError } from "@/core/ui/field-error";
import { hapticSuccess } from "@/core/ui/haptics";
import { Notice } from "@/core/ui/notice";
import { FormModal } from "@/core/ui/sheet";
import { RADIUS, SPACING } from "@/core/ui/theme";
import { useCreateTransaction } from "@/features/transactions/transaction-mutations";

import type { RealizedMetrics } from "../current-month-view-model";
import { buildAdjustmentPayload } from "../reconciliation";

const LABEL_MAX_LENGTH = 100;
const ACCOUNT_NAME_MAX_LENGTH = 60;
const CENTS_PER_UNIT = 100;
const LEADING_MINUS = /^\s*[-−]/;

type Step = 1 | 2 | 3;

interface AccountRow {
  id: number;
  label: string;
  amountText: string;
}

const FIRST_ROW: AccountRow = { id: 0, label: "", amountText: "" };

/** What the loaded month has pointed, and the period it covers. */
export interface ReconcileMonth {
  realized: RealizedMetrics;
  rollover: number;
  period: BudgetPeriodDates;
}

interface ReconcileAccountsSheetProps {
  isVisible: boolean;
  onDismiss: () => void;
  /** The adjustment is written and the flow is over; the screen says so. */
  onRecorded: () => void;
  /**
   * A write refused after the screen left its month: the sheet closes, and
   * its own notice with it, so the screen says so instead.
   */
  onRecordFailed: () => void;
  onViewItemsToCheck: () => void;
  /** The month this opening was made on: the only one it ever writes to. */
  budgetId: string;
  /** `null` once the screen no longer holds that month, or holds none. */
  month: ReconcileMonth | null;
  currency: SupportedCurrency;
}

/**
 * The bank's balances against the pointed balance of the month, in three
 * steps: what the accounts hold, what the month has pointed, and the gap. The
 * gap becomes one checked entry — never a saving, never more than one per flow.
 *
 * Nothing typed here outlives the sheet: every way out resets it, so the next
 * opening starts from one empty amount.
 */
export function ReconcileAccountsSheet({
  isVisible,
  onDismiss,
  onRecorded,
  onRecordFailed,
  onViewItemsToCheck,
  budgetId,
  month,
  currency,
}: ReconcileAccountsSheetProps) {
  const theme = useTheme();
  const { locale, t } = useTranslation();
  const create = useCreateTransaction();
  const [step, setStep] = useState<Step>(1);
  const [rows, setRows] = useState<AccountRow[]>([FIRST_ROW]);
  // Flagged once the field is left, never mid-keystroke: "12." is on its way
  // to "12.50". It never counts in the total either way.
  const [leftRowIds, setLeftRowIds] = useState<ReadonlySet<number>>(new Set());
  // `null` follows the language's own default label until the user edits it.
  const [label, setLabel] = useState<string | null>(null);
  const nextRowId = useRef(1);
  // `isPending` arrives with the next render; a second tap before it must not
  // write a second adjustment.
  const isSubmitting = useRef(false);

  const adjustmentLabel = label ?? t("home.reconcile.verdict.defaultLabel");
  const summary = summarizeAccounts(rows.map((row) => row.amountText));
  const verdict =
    summary.totalCents === null || month === null
      ? null
      : reconciliationVerdict(
          summary.totalCents,
          month.realized.realizedBalance,
        );
  const adjustment =
    verdict === null || verdict.kind === "upToDate" ? null : verdict;
  const isBusy = create.isPending;

  function reset() {
    setStep(1);
    setRows([FIRST_ROW]);
    setLeftRowIds(new Set());
    setLabel(null);
    nextRowId.current = 1;
    isSubmitting.current = false;
    create.reset();
  }

  // `isPending` lands a render after `mutate`: until then only the ref knows a
  // write is out, so every exit asks both.
  function dismiss(): boolean {
    if (isBusy || isSubmitting.current) return false;
    reset();
    onDismiss();
    return true;
  }

  // The screen no longer holds the month this opening was made on, or holds
  // none: nothing is left to hold the accounts against, so the sheet closes —
  // once a write already out has settled, on the month it was aimed at. A
  // refusal of that write is handed to the screen, since its notice is here.
  const isOffMonth = isVisible && month === null;
  const closeOffMonth = useEffectEvent(() => {
    const hasFailed = create.isError;
    if (dismiss() && hasFailed) onRecordFailed();
  });
  useEffect(() => {
    if (isOffMonth && !isBusy) closeOffMonth();
  }, [isOffMonth, isBusy]);

  function back() {
    if (isBusy || isSubmitting.current) return;
    if (step === 1) {
      dismiss();
      return;
    }
    setStep((step - 1) as Step);
  }

  function next() {
    if (!summary.canContinue || step === 3) return;
    setStep((step + 1) as Step);
  }

  function updateRow(id: number, changes: Partial<Omit<AccountRow, "id">>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    );
  }

  // Most keypads have no minus key, so the sign is a button. It edits the
  // typed text itself: what the field shows is what gets summed.
  function toggleNegative(row: AccountRow) {
    updateRow(row.id, {
      amountText: LEADING_MINUS.test(row.amountText)
        ? row.amountText.replace(LEADING_MINUS, "")
        : `-${row.amountText.trim()}`,
    });
  }

  function addAccount() {
    const id = nextRowId.current;
    nextRowId.current += 1;
    setRows((current) => [...current, { id, label: "", amountText: "" }]);
  }

  function complete(adjustmentKind: "income" | "expense" | "none") {
    captureEvent(ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_COMPLETED, {
      adjustment_kind: adjustmentKind,
    });
  }

  function record() {
    const name = adjustmentLabel.trim();
    if (adjustment === null || name === "" || isBusy) return;
    if (isSubmitting.current) return;
    isSubmitting.current = true;

    create.mutate(
      buildAdjustmentPayload({ budgetId, name, adjustment, now: new Date() }),
      {
        onSuccess: () => {
          complete(adjustment.kind);
          hapticSuccess();
          reset();
          onRecorded();
        },
        // A refusal keeps the step and the label: retrying is one press.
        onSettled: () => {
          isSubmitting.current = false;
        },
      },
    );
  }

  // A write already out ends the flow itself, even once a refresh brings the
  // balance level: Finish waits rather than completing a second time.
  function finish() {
    if (isBusy || isSubmitting.current || verdict?.kind !== "upToDate") return;
    complete("none");
    reset();
    onDismiss();
  }

  function viewItemsToCheck() {
    reset();
    onViewItemsToCheck();
  }

  const footer = (
    <>
      <Notice
        visible={create.isError}
        onDismiss={() => create.reset()}
        wrapperStyle={{ bottom: SPACING.md + 48 }}
        testID="reconcile-error-notice"
      >
        {t("budgets.mutations.activity.error")}
      </Notice>
      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={back}
          disabled={isBusy}
          style={styles.action}
        >
          {t("home.reconcile.back")}
        </Button>
        {step < 3 ? (
          <Button
            mode="contained"
            onPress={next}
            disabled={!summary.canContinue}
            style={styles.action}
          >
            {t("home.reconcile.continue")}
          </Button>
        ) : verdict?.kind === "upToDate" ? (
          <Button
            mode="contained"
            onPress={finish}
            disabled={isBusy}
            style={styles.action}
          >
            {t("home.reconcile.verdict.finish")}
          </Button>
        ) : (
          <Button
            mode="contained"
            onPress={record}
            disabled={
              adjustment === null || isBusy || adjustmentLabel.trim() === ""
            }
            loading={isBusy}
            style={styles.action}
          >
            {t("home.reconcile.verdict.record")}
          </Button>
        )}
      </View>
    </>
  );

  const muted = { color: theme.colors.onSurfaceVariant };

  return (
    <FormModal
      isVisible={isVisible}
      onDismiss={dismiss}
      onBack={back}
      isBusy={isBusy}
      title={t("home.reconcile.title")}
      subtitle={t("home.reconcile.stepOf", { step })}
      footer={footer}
    >
      {step === 1 && (
        <>
          <Text variant="titleMedium">
            {t("home.reconcile.accounts.heading")}
          </Text>
          <Text variant="bodyMedium" style={muted}>
            {t("home.reconcile.accounts.hint")}
          </Text>
          {rows.map((row, index) => {
            const isNegative = LEADING_MINUS.test(row.amountText);
            const isUnreadable =
              leftRowIds.has(row.id) &&
              parseAccountAmount(row.amountText).status === "invalid";
            const name = row.label.trim();
            return (
              <View key={row.id} style={styles.account}>
                {index > 0 && (
                  <TextInput
                    mode="outlined"
                    label={t("home.reconcile.accounts.accountName")}
                    value={row.label}
                    onChangeText={(value) =>
                      updateRow(row.id, { label: value })
                    }
                    maxLength={ACCOUNT_NAME_MAX_LENGTH}
                  />
                )}
                <View style={styles.amountRow}>
                  <TextInput
                    mode="outlined"
                    style={styles.amountInput}
                    label={t(
                      index === 0
                        ? "home.reconcile.accounts.firstAmount"
                        : "home.reconcile.accounts.amount",
                    )}
                    value={row.amountText}
                    onChangeText={(value) =>
                      updateRow(row.id, { amountText: value })
                    }
                    onBlur={() =>
                      setLeftRowIds((ids) => new Set(ids).add(row.id))
                    }
                    // Signed on Android, so a keypad that has a minus key
                    // offers it; the sign button covers the ones that do not.
                    keyboardType="numeric"
                    error={isUnreadable}
                    right={
                      <TextInput.Affix
                        text={CURRENCY_METADATA[currency].symbol}
                      />
                    }
                  />
                  <IconButton
                    icon="plus-minus-variant"
                    selected={isNegative}
                    onPress={() => toggleNegative(row)}
                    accessibilityLabel={t("home.reconcile.accounts.negative")}
                    accessibilityState={{ selected: isNegative }}
                  />
                  {index > 0 && (
                    <IconButton
                      icon="trash-can-outline"
                      onPress={() =>
                        setRows((current) =>
                          current.filter((other) => other.id !== row.id),
                        )
                      }
                      accessibilityLabel={
                        name === ""
                          ? t("home.reconcile.accounts.removeNumbered", {
                              index: index + 1,
                            })
                          : t("home.reconcile.accounts.removeNamed", { name })
                      }
                    />
                  )}
                </View>
                {isUnreadable && (
                  <FieldError visible>
                    {t("home.reconcile.accounts.invalidAmount")}
                  </FieldError>
                )}
              </View>
            );
          })}
          <Button
            mode="text"
            icon="plus"
            onPress={addAccount}
            style={styles.addAccount}
          >
            {t("home.reconcile.accounts.addAccount")}
          </Button>
          <View
            testID="reconcile-total"
            style={styles.totalRow}
            accessibilityLiveRegion="polite"
          >
            <Text variant="titleSmall">
              {t("home.reconcile.accounts.total")}
            </Text>
            <Amount size="row">
              {summary.totalCents === null
                ? "—"
                : formatCurrency(summary.totalCents / CENTS_PER_UNIT, currency)}
            </Amount>
          </View>
        </>
      )}

      {step === 2 && month !== null && (
        <>
          <Text variant="titleMedium">
            {t("home.reconcile.realized.heading")}
          </Text>
          {/* A period on the calendar month is named by the month alone. */}
          {month.period.startDate.getDate() !== 1 && (
            <Text variant="bodyMedium" style={muted}>
              {t("home.reconcile.realized.period", {
                start: formatDayMonth(month.period.startDate, locale),
                end: formatDayMonth(month.period.endDate, locale),
              })}
            </Text>
          )}
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <BreakdownRow
              label={t("home.reconcile.realized.checkedIncome")}
              amount={formatCurrency(month.realized.realizedIncome, currency)}
            />
            <BreakdownRow
              label={t("home.reconcile.realized.checkedOutflows")}
              amount={formatCurrency(
                0 - month.realized.realizedExpenses,
                currency,
              )}
            />
            <BreakdownRow
              testID="reconcile-rollover"
              label={t("home.reconcile.realized.rollover")}
              amount={formatCurrency(month.rollover, currency)}
            />
            <BreakdownRow
              testID="reconcile-realized-balance"
              label={t("home.reconcile.realized.balance")}
              amount={formatCurrency(month.realized.realizedBalance, currency)}
              isTotal
            />
          </View>
          <Text variant="bodyMedium" style={muted}>
            {t("home.reconcile.realized.hint")}
          </Text>
          <Button mode="text" icon="arrow-right" onPress={viewItemsToCheck}>
            {t("home.reconcile.realized.viewItemsToCheck")}
          </Button>
        </>
      )}

      {step === 3 &&
        verdict !== null &&
        (verdict.kind === "upToDate" ? (
          <>
            <Text variant="titleMedium">
              {t("home.reconcile.verdict.upToDateTitle")}
            </Text>
            <Text variant="bodyMedium" style={muted}>
              {t("home.reconcile.verdict.upToDateMessage")}
            </Text>
          </>
        ) : (
          <>
            <Text variant="titleMedium">
              {t(
                verdict.kind === "income"
                  ? "home.reconcile.verdict.moreTitle"
                  : "home.reconcile.verdict.lessTitle",
                { amount: formatCurrency(verdict.amount, currency) },
              )}
            </Text>
            <Text variant="bodyMedium" style={muted}>
              {t(
                verdict.kind === "income"
                  ? "home.reconcile.verdict.moreMessage"
                  : "home.reconcile.verdict.lessMessage",
                { amount: formatCurrency(verdict.amount, currency) },
              )}
            </Text>
            <TextInput
              mode="outlined"
              label={t("home.reconcile.verdict.label")}
              value={adjustmentLabel}
              onChangeText={setLabel}
              maxLength={LABEL_MAX_LENGTH}
              error={adjustmentLabel.trim() === ""}
            />
            {adjustmentLabel.trim() === "" && (
              <FieldError visible>
                {t("home.reconcile.verdict.labelRequired")}
              </FieldError>
            )}
          </>
        ))}
    </FormModal>
  );
}

function BreakdownRow({
  label,
  amount,
  isTotal = false,
  testID,
}: {
  label: string;
  amount: string;
  isTotal?: boolean;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.breakdownRow}>
      <Text variant={isTotal ? "titleSmall" : "bodyMedium"}>{label}</Text>
      <Amount size={isTotal ? "row" : "meta"}>{amount}</Amount>
    </View>
  );
}

const styles = StyleSheet.create({
  account: { gap: SPACING.xs },
  amountRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xxs },
  amountInput: { flex: 1 },
  addAccount: { alignSelf: "flex-start" },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  card: { borderRadius: RADIUS.card, padding: SPACING.md, gap: SPACING.sm },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  actions: { flexDirection: "row", gap: SPACING.sm },
  action: { flex: 1 },
});
