import {
  ANALYTICS_EVENTS,
  type BudgetLine,
  type BudgetPeriodDates,
  pointingCandidates,
  reconciliationVerdict,
  type SupportedCurrency,
  type Transaction,
  type TransactionCreate,
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
import { randomUUID } from "react-native-quick-crypto";

import { useTranslation } from "@/core/i18n/locale-store";
import { captureEvent } from "@/core/observability/analytics";
import { Amount } from "@/core/ui/amount";
import { formatCurrency, formatSignedCurrency } from "@/core/ui/amount-format";
import { formatDayMonth } from "@/core/ui/date-format";
import { FieldError } from "@/core/ui/field-error";
import { hapticFailure, hapticSuccess } from "@/core/ui/haptics";
import { Notice } from "@/core/ui/notice";
import { FormModal } from "@/core/ui/sheet";
import { RADIUS, SPACING, TOUCH_TARGET } from "@/core/ui/theme";
import { useToggleCheck } from "@/features/budgets/toggle-check-mutation";
import { useFollowAccounts } from "@/features/net-worth/net-worth-queries";
import { loadFirstMovementState } from "@/features/transactions/first-movement-tracker";
import { useCreateTransaction } from "@/features/transactions/transaction-mutations";

import type { RealizedMetrics } from "../current-month-view-model";
import {
  addableGroups,
  type AccountRow,
  assetRow,
  freeAccountsToRemember,
  freeRow,
  isEmptyPlan,
  nextRowId,
  planAccountLinks,
  restoreRows,
  seedRows,
  summarizeRows,
} from "../reconcile-account-links";
import {
  clearReconcileDraft,
  keepReconcileDraft,
  readReconcileDraft,
} from "../reconcile-draft-store";
import { readFreeAccounts, saveFreeAccounts } from "../reconcile-free-accounts";
import { useReconcileLinkedAccounts } from "../reconcile-linked-accounts";
import { buildAdjustmentPayload } from "../reconciliation";
import {
  markReconcileGuideSeen,
  useHasSeenReconcileGuide,
} from "../reconcile-guide-gate";
import {
  type AddAccountChoice,
  ReconcileAddAccountSheet,
} from "./reconcile-add-account-sheet";
import { ReconcileAccountsStep } from "./reconcile-accounts-step";
import { useReconcileGuidePage } from "./reconcile-guide-page";

const LABEL_MAX_LENGTH = 100;

type Step = 1 | 2 | 3;

const FIRST_ROW = freeRow(0, "own");

/** What the loaded month has pointed, and the period it covers. */
export interface ReconcileMonth {
  realized: RealizedMetrics;
  rollover: number;
  period: BudgetPeriodDates;
  /** Its live rows: pointing one from here moves the gap. */
  budgetLines: BudgetLine[];
  transactions: Transaction[];
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
  const create = useCreateTransaction("reconciliation");
  const follow = useFollowAccounts();
  const toggle = useToggleCheck(budgetId);
  // Pointed from here and not settled yet: the gap has already moved, so
  // nothing is written against it before the server keeps the pointing.
  const [pointingIds, setPointingIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [hasPointFailed, setPointFailed] = useState(false);
  const isPointing = pointingIds.size > 0;
  // Asked before the adjustment is saved: afterwards the server always says yes.
  useEffect(() => {
    if (isVisible) void loadFirstMovementState();
  }, [isVisible]);
  const linked = useReconcileLinkedAccounts(isVisible, currency);
  // My accounts as this opening found them: its rows are seeded once, and a
  // refetch never reshuffles them. `undefined` until they are read, `null`
  // when « Mon patrimoine » is off: plain lines, nothing written there.
  const [accounts, setAccounts] = useState<typeof linked>(undefined);
  const [step, setStep] = useState<Step>(1);
  // The guide opens by itself until it has been seen; « ? » replays it, over
  // whatever step the person is on, typed rows untouched.
  const hasSeenGuide = useHasSeenReconcileGuide();
  const [isGuideRequested, setGuideRequested] = useState(false);
  const guide = useReconcileGuidePage({
    currency,
    source: !isVisible
      ? null
      : isGuideRequested
        ? "help"
        : hasSeenGuide
          ? null
          : "auto",
    onFinish: () => {
      markReconcileGuideSeen();
      setGuideRequested(false);
    },
  });
  const [rows, setRows] = useState<AccountRow[]>([FIRST_ROW]);
  // Ids only go up: a row added after another was removed never inherits its
  // « field left » state.
  const [nextId, setNextId] = useState(0);
  const [isAddOpen, setAddOpen] = useState(false);
  // The row just added: its field takes the keyboard, once. Cleared as soon as
  // it has, or the step coming back from the guide or step 2 would take it again.
  const [focusRowId, setFocusRowId] = useState<number | null>(null);
  // Flagged once the field is left, never mid-keystroke: "12." is on its way
  // to "12.50". It never counts in the total either way.
  const [leftRowIds, setLeftRowIds] = useState<ReadonlySet<number>>(new Set());
  // `null` follows the language's own default label until the user edits it.
  const [label, setLabel] = useState<string | null>(null);
  // `isPending` arrives with the next render; a second tap before it must not
  // write a second adjustment.
  const isSubmitting = useRef(false);
  // One id per adjustment, replayed on a retry: a request whose answer was lost
  // may have committed, and `createOnce` reads it back instead of writing twice.
  const attempt = useRef<TransactionCreate | null>(null);

  if (isVisible && accounts === undefined && linked !== undefined) {
    setAccounts(linked);
    // A sheet lost to the auto-lock comes back with what was typed.
    const draft = readReconcileDraft(budgetId);
    const seeded =
      draft === null
        ? seedRows(linked?.assets ?? null, readFreeAccounts())
        : restoreRows(draft, linked);
    setNextId(nextRowId(seeded));
    setRows(seeded);
  }
  useEffect(() => {
    if (isVisible && accounts !== undefined) keepReconcileDraft(budgetId, rows);
  }, [isVisible, accounts, budgetId, rows]);

  const adjustmentLabel = label ?? t("home.reconcile.verdict.defaultLabel");
  const summary = summarizeRows(rows);
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
  // Movements the bank may already hold: pointing them, not an adjustment,
  // closes that part of the gap without counting it twice later.
  const candidates =
    adjustment === null || month === null
      ? []
      : pointingCandidates(
          adjustment.kind === "income" ? adjustment.amount : -adjustment.amount,
          month.budgetLines,
          month.transactions,
        );
  const lineNames = new Map(
    month?.budgetLines.map((line) => [line.id, line.name]),
  );

  function reset() {
    setGuideRequested(false);
    setStep(1);
    setAccounts(undefined);
    setRows([FIRST_ROW]);
    setAddOpen(false);
    setFocusRowId(null);
    clearReconcileDraft();
    setLeftRowIds(new Set());
    setLabel(null);
    setPointFailed(false);
    isSubmitting.current = false;
    attempt.current = null;
    create.reset();
  }

  // `isPending` lands a render after `mutate`: until then only the ref knows a
  // write is out, so every exit asks both.
  function dismiss(): boolean {
    if (isBusy || isSubmitting.current) return false;
    guide?.skip();
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
    if (summary.totalCents === null || step === 3) return;
    // Names and sides stay for next time; « Retirer » forgets a row here.
    if (step === 1) saveFreeAccounts(freeAccountsToRemember(rows));
    setStep((step + 1) as Step);
  }

  function updateRow(
    id: number,
    changes: Partial<Omit<AccountRow, "id" | "account">>,
  ) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    );
  }

  // Seeded and drafted rows took ids of their own: a new one never reuses any.
  function addRow(row: AccountRow) {
    const id = nextId;
    setNextId(id + 1);
    setRows((current) => [...current, { ...row, id }]);
    setFocusRowId(id);
  }

  function choose(choice: AddAccountChoice) {
    setAddOpen(false);
    addRow(
      choice.kind === "asset"
        ? assetRow(0, choice.asset)
        : freeRow(0, choice.side),
    );
  }

  // Completion, and only completion, writes the accounts I finished with to
  // Mon patrimoine. A refusal only says so: the reconciliation stays done.
  function followFinishedAccounts() {
    if (accounts == null) return;
    const plan = planAccountLinks(rows, accounts.assets);
    if (!isEmptyPlan(plan)) follow.mutate(plan);
  }

  function complete(adjustmentKind: "income" | "expense" | "none") {
    captureEvent(ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_COMPLETED, {
      adjustment_kind: adjustmentKind,
    });
  }

  async function point(transaction: Transaction) {
    setPointFailed(false);
    setPointingIds((ids) => new Set(ids).add(transaction.id));
    try {
      await toggle.mutateAsync({
        source: "transaction",
        sourceId: transaction.id,
      });
      hapticSuccess();
    } catch {
      hapticFailure();
      setPointFailed(true);
    } finally {
      setPointingIds((ids) => {
        const next = new Set(ids);
        next.delete(transaction.id);
        return next;
      });
    }
  }

  function record() {
    const name = adjustmentLabel.trim();
    if (adjustment === null || name === "" || isBusy || isPointing) return;
    if (isSubmitting.current) return;
    isSubmitting.current = true;

    const previous = attempt.current;
    const payload =
      previous !== null &&
      previous.name === name &&
      previous.amount === adjustment.amount &&
      previous.kind === adjustment.kind
        ? previous
        : {
            ...buildAdjustmentPayload({
              budgetId,
              name,
              adjustment,
              now: new Date(),
            }),
            id: randomUUID(),
          };
    attempt.current = payload;

    create.mutate(payload, {
      onSuccess: () => {
        complete(adjustment.kind);
        followFinishedAccounts();
        hapticSuccess();
        reset();
        onRecorded();
      },
      // A refusal keeps the step and the label: retrying is one press.
      onSettled: () => {
        isSubmitting.current = false;
      },
    });
  }

  // A write already out ends the flow itself, even once a refresh brings the
  // balance level: Finish waits rather than completing a second time.
  function finish() {
    if (isBusy || isPointing || isSubmitting.current) return;
    if (verdict?.kind !== "upToDate") return;
    complete("none");
    followFinishedAccounts();
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
      <Notice
        visible={hasPointFailed}
        onDismiss={() => setPointFailed(false)}
        wrapperStyle={{ bottom: SPACING.md + 48 }}
        testID="reconcile-point-error-notice"
      >
        {t("home.checking.pointFailure")}
      </Notice>
      <View style={styles.actions}>
        {step > 1 && (
          <Button
            mode="outlined"
            onPress={back}
            disabled={isBusy}
            style={styles.action}
          >
            {t("home.reconcile.back")}
          </Button>
        )}
        {step < 3 ? (
          <Button
            mode="contained"
            onPress={next}
            disabled={summary.totalCents === null}
            style={styles.action}
          >
            {t(
              step === 1
                ? "home.reconcile.accounts.compare"
                : "home.reconcile.continue",
            )}
          </Button>
        ) : verdict?.kind === "upToDate" ? (
          <Button
            mode="contained"
            onPress={finish}
            disabled={isBusy || isPointing}
            style={styles.action}
          >
            {t("home.reconcile.verdict.finish")}
          </Button>
        ) : (
          <Button
            mode="contained"
            onPress={record}
            disabled={
              adjustment === null ||
              isBusy ||
              isPointing ||
              adjustmentLabel.trim() === ""
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
    <>
      <FormModal
        isVisible={isVisible}
        // Out of a replay, the scrim and ✕ go back to the step, typed values kept.
        onDismiss={isGuideRequested && guide !== null ? guide.skip : dismiss}
        onBack={guide === null ? back : guide.skip}
        isBusy={isBusy}
        // The guide has its own title; each step its own question below this name.
        title={guide === null ? t("home.reconcile.title") : undefined}
        hasBodyHeading
        subtitle={
          guide === null && step > 1
            ? t("home.reconcile.stepOf", { step })
            : undefined
        }
        footer={guide === null ? footer : guide.footer}
        fillsHeight
        showsCloseButton={guide === null}
        headerAction={
          guide !== null ? (
            guide.skipAction
          ) : (
            <IconButton
              icon="help-circle-outline"
              disabled={isBusy}
              onPress={() => {
                if (!isSubmitting.current) setGuideRequested(true);
              }}
              accessibilityLabel={t("home.reconcile.guide.help")}
              testID="reconcile-guide-help"
              style={styles.headerButton}
            />
          )
        }
      >
        {guide !== null && guide.body}
        {guide === null && step === 1 && (
          <ReconcileAccountsStep
            rows={accounts === undefined ? null : rows}
            summary={summary}
            currency={currency}
            leftRowIds={leftRowIds}
            focusRowId={focusRowId}
            onFocusTaken={() => setFocusRowId(null)}
            onChange={updateRow}
            onLeaveAmount={(id) => setLeftRowIds((ids) => new Set(ids).add(id))}
            onRemove={(id) =>
              setRows((current) => current.filter((row) => row.id !== id))
            }
            onAddAccount={() => setAddOpen(true)}
            onAddOwe={() => addRow(freeRow(0, "owe"))}
          />
        )}

        {guide === null && step === 2 && month !== null && (
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
                amount={formatCurrency(
                  month.realized.realizedBalance,
                  currency,
                )}
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

        {guide === null &&
          step === 3 &&
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
              {candidates.length > 0 && (
                <View
                  style={[
                    styles.card,
                    { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  <Text variant="titleSmall">
                    {t("home.reconcile.verdict.candidatesTitle")}
                  </Text>
                  {candidates.map(({ transaction, remainingGap }) => (
                    <View key={transaction.id} style={styles.breakdownRow}>
                      <View style={styles.candidateText}>
                        <Text variant="bodyMedium">{transaction.name}</Text>
                        <Text variant="bodySmall" style={muted}>
                          {`${
                            (transaction.budgetLineId === null
                              ? undefined
                              : lineNames.get(transaction.budgetLineId)) ??
                            t("home.movements.unplanned")
                          } · ${
                            remainingGap === 0
                              ? t("home.reconcile.verdict.candidateSameAmount")
                              : t("home.reconcile.verdict.candidateRemaining", {
                                  amount: formatSignedCurrency(
                                    remainingGap,
                                    currency,
                                  ),
                                })
                          }`}
                        </Text>
                      </View>
                      <Amount size="meta">
                        {formatCurrency(transaction.amount, currency)}
                      </Amount>
                      <Button
                        mode="text"
                        compact
                        onPress={() => void point(transaction)}
                        disabled={isPointing || isBusy}
                        accessibilityLabel={t(
                          "home.reconcile.verdict.pointNamed",
                          { name: transaction.name },
                        )}
                      >
                        {t("home.reconcile.verdict.point")}
                      </Button>
                    </View>
                  ))}
                </View>
              )}
              <Text variant="bodyMedium" style={muted}>
                {t(
                  verdict.kind === "income"
                    ? "home.reconcile.verdict.moreMessage"
                    : "home.reconcile.verdict.lessMessage",
                  { amount: formatCurrency(verdict.amount, currency) },
                )}
                {candidates.length > 0 &&
                  ` ${t("home.reconcile.verdict.countsTwice")}`}
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
      <ReconcileAddAccountSheet
        isVisible={isAddOpen && isVisible}
        onDismiss={() => setAddOpen(false)}
        onChoose={choose}
        groups={addableGroups(accounts, rows, month?.budgetLines ?? [])}
      />
      <Notice
        visible={follow.isError}
        onDismiss={() => follow.reset()}
        testID="reconcile-follow-error-notice"
      >
        {t("home.reconcile.followFailed")}
      </Notice>
    </>
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
  // The same 48dp as the sheet's own close button beside it.
  headerButton: { width: TOUCH_TARGET, height: TOUCH_TARGET, margin: 0 },
  card: { borderRadius: RADIUS.card, padding: SPACING.md, gap: SPACING.sm },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  candidateText: { flex: 1 },
  actions: { flexDirection: "row", gap: SPACING.sm },
  action: { flex: 1 },
});
