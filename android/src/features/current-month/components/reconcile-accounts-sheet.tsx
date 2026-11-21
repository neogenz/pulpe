import {
  ANALYTICS_EVENTS,
  type BudgetLine,
  type SupportedCurrency,
  type Transaction,
  type TransactionCreate,
} from "pulpe-shared";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { Button, IconButton } from "react-native-paper";
import { randomUUID } from "react-native-quick-crypto";

import { useTranslation } from "@/core/i18n/locale-store";
import { captureEvent } from "@/core/observability/analytics";
import { hapticFailure, hapticSuccess } from "@/core/ui/haptics";
import { Notice } from "@/core/ui/notice";
import { FormModal } from "@/core/ui/sheet";
import { SPACING, TOUCH_TARGET } from "@/core/ui/theme";
import {
  useChecksSettled,
  useToggleCheck,
} from "@/features/budgets/toggle-check-mutation";
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
import {
  buildAdjustmentPayload,
  buildComparison,
  type SuggestionRow,
} from "../reconciliation";
import { completeReconciliation } from "../reconciliation-api";
import {
  forgetReconciliationContext,
  useReconciliationContext,
} from "../reconciliation-queries";
import {
  markReconcileGuideSeen,
  useHasSeenReconcileGuide,
} from "../reconcile-guide-gate";
import {
  type AddAccountChoice,
  ReconcileAddAccountSheet,
} from "./reconcile-add-account-sheet";
import { ReconcileAccountsStep } from "./reconcile-accounts-step";
import {
  ReconcileCompareActions,
  ReconcileCompareStep,
} from "./reconcile-compare-step";
import { useReconcileGuidePage } from "./reconcile-guide-page";

type Step = 1 | 2;

const FIRST_ROW = freeRow(0, "own");

/** What the loaded month has pointed, and what it leaves to spend. */
export interface ReconcileMonth {
  realized: RealizedMetrics;
  /** « Disponible à dépenser ». */
  available: number;
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
 * The bank's balances against what Pulpe holds as checked, in two steps: what
 * the accounts hold, then the comparison and what explains the gap. The gap
 * becomes one checked entry at most — never a saving, never more than one per
 * comparison.
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
  const { t } = useTranslation();
  const create = useCreateTransaction("reconciliation");
  const follow = useFollowAccounts();
  const toggle = useToggleCheck(budgetId);
  // A previous month's item lives in another budget: no row here to flip before the server.
  const togglePrior = useToggleCheck(null);
  const checksSettled = useChecksSettled();
  // One check at a time, from the tap to the context read after it: the gap
  // moves with each one, so nothing is written or ended meanwhile.
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [hasPointFailed, setPointFailed] = useState(false);
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
  const context = useReconciliationContext(budgetId, isVisible && step === 2);
  // The compared figure before the first check of this comparison: struck through after it.
  const [comparedBefore, setComparedBefore] = useState<number | null>(null);
  // « Aucune … ne correspond » was tapped in this comparison.
  const [isDismissed, setDismissed] = useState(false);
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
  // `isPending` arrives with the next render; a second tap before it must not
  // write a second adjustment.
  const isSubmitting = useRef(false);
  // One id per adjustment, replayed on a retry: a request whose answer was lost
  // may have committed, and `createOnce` reads it back instead of writing twice.
  const attempt = useRef<TransactionCreate | null>(null);
  // Completion is sent once per comparison; only « Comparer » starts a new one,
  // so a second « Terminer » in the same render finds it already sent.
  const isCompleted = useRef(false);
  // A comparison of this sheet was completed: its balances are saved on close.
  const hasCompleted = useRef(false);

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

  const summary = summarizeRows(rows);
  // A refresh keeps the figures on screen; a failed one stops the comparison.
  const contextData = context.isError ? undefined : context.data;
  const comparison =
    step !== 2 ||
    summary.totalCents === null ||
    month === null ||
    contextData === undefined
      ? null
      : buildComparison({
          onAccountsCents: summary.totalCents,
          realizedBalance: month.realized.realizedBalance,
          available: month.available,
          budgetLines: month.budgetLines,
          transactions: month.transactions,
          context: contextData,
          comparedBefore,
          isDismissed,
        });
  // Offered even when the card is the only account: removing it then goes back to step 1.
  const oweTotal =
    summary.hasOwe && comparison !== null && comparison.gap < 0
      ? summary.oweCents / 100
      : null;
  const isBusy = create.isPending || checkingId !== null;

  // The accounts I finished with, written to Mon patrimoine. A refusal only
  // says so: the reconciliation stays done.
  function followFinishedAccounts() {
    if (accounts == null) return;
    const plan = planAccountLinks(rows, accounts.assets);
    if (!isEmptyPlan(plan)) follow.mutate(plan);
  }

  // Every way out ends here. Mon patrimoine gets the balances once per sheet, as
  // the rows stand when it closes, and only after a completed comparison.
  function reset() {
    if (hasCompleted.current) followFinishedAccounts();
    hasCompleted.current = false;
    setGuideRequested(false);
    setStep(1);
    setAccounts(undefined);
    setRows([FIRST_ROW]);
    setAddOpen(false);
    setFocusRowId(null);
    clearReconcileDraft();
    setLeftRowIds(new Set());
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
    setStep(1);
  }

  // Each « Comparer » starts a comparison of its own, read fresh from the server.
  function next() {
    if (summary.totalCents === null || step === 2) return;
    // Names and sides stay for next time; « Retirer » forgets a row here.
    saveFreeAccounts(freeAccountsToRemember(rows));
    forgetReconciliationContext(budgetId);
    setComparedBefore(null);
    setDismissed(false);
    isCompleted.current = false;
    setStep(2);
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

  // Once per comparison: the server learns it happened. `false` when it already was.
  function complete(adjustmentKind: "income" | "expense" | "none"): boolean {
    if (isCompleted.current) return false;
    isCompleted.current = true;
    hasCompleted.current = true;
    captureEvent(ANALYTICS_EVENTS.ACCOUNT_RECONCILIATION_COMPLETED, {
      adjustment_kind: adjustmentKind,
    });
    // A lost completion only asks the « first comparison » question once more.
    completeReconciliation().catch(() => undefined);
    return true;
  }

  // The stored item, by id: the server flips it, and it was unchecked when ranked.
  async function check(row: SuggestionRow) {
    if (comparison === null || isBusy || isSubmitting.current) return;
    setPointFailed(false);
    setCheckingId(row.id);
    setComparedBefore((before) => before ?? comparison.compared);
    try {
      // A refused check re-reads too: the rows come back as the server holds them.
      await (row.monthsAgo === 0 ? toggle : togglePrior).mutateAsync({
        source: row.source,
        sourceId: row.id,
      });
      hapticSuccess();
    } catch {
      hapticFailure();
      setPointFailed(true);
    } finally {
      // Its re-read may wait behind another check: the rows stay put until it lands.
      await checksSettled();
      setCheckingId(null);
    }
  }

  function record() {
    if (comparison === null || comparison.gap === 0) return;
    if (isBusy || isSubmitting.current || isCompleted.current) return;
    isSubmitting.current = true;

    const adjustment = {
      kind: comparison.gap > 0 ? "income" : "expense",
      amount: Math.abs(comparison.gap),
    } as const;
    const previous = attempt.current;
    const payload =
      previous !== null &&
      previous.amount === adjustment.amount &&
      previous.kind === adjustment.kind
        ? previous
        : {
            ...buildAdjustmentPayload({
              budgetId,
              name: t("home.reconcile.compare.entryName"),
              adjustment,
              now: new Date(),
            }),
            id: randomUUID(),
          };
    attempt.current = payload;

    create.mutate(payload, {
      onSuccess: () => {
        complete(adjustment.kind);
        hapticSuccess();
        reset();
        onRecorded();
      },
      // A refusal keeps the screen: retrying is one press.
      onSettled: () => {
        isSubmitting.current = false;
      },
    });
  }

  // [Terminer], « Laisser comme ça » and « Non, laisser comme ça ».
  function leave() {
    if (comparison === null || isBusy || isSubmitting.current) return;
    if (!complete("none")) return;
    reset();
    onDismiss();
  }

  function removeOwe() {
    if (isBusy) return;
    const kept = rows.filter((row) => row.side !== "owe");
    setRows(kept);
    // Another total: the figure struck through belonged to the old one.
    setComparedBefore(null);
    // Nothing typed is left to compare: back to the balances.
    if (summarizeRows(kept).totalCents === null) setStep(1);
  }

  function viewItemsToCheck() {
    if (isBusy || isSubmitting.current) return;
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
      {step === 1 ? (
        <Button
          mode="contained"
          onPress={next}
          disabled={summary.totalCents === null}
        >
          {t("home.reconcile.accounts.compare")}
        </Button>
      ) : (
        comparison !== null && (
          <ReconcileCompareActions
            comparison={comparison}
            currency={currency}
            isBusy={isBusy}
            isRecording={create.isPending}
            onLeave={leave}
            onDismiss={() => setDismissed(true)}
            onRecord={record}
          />
        )
      )}
    </>
  );

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
        footer={guide === null ? footer : guide.footer}
        fillsHeight
        // Step 2 goes back to step 1 by its arrow; the scrim still leaves.
        showsBackButton={guide === null && step === 2}
        showsCloseButton={guide === null && step === 1}
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

        {guide === null && step === 2 && (
          <ReconcileCompareStep
            comparison={comparison}
            isUnavailable={context.isError && !context.isFetching}
            onRetry={() => void context.refetch()}
            currency={currency}
            hasOwe={summary.hasOwe}
            oweTotal={oweTotal}
            checkingId={checkingId}
            isBusy={isBusy}
            onCheck={(row) => void check(row)}
            onRemoveOwe={removeOwe}
            onViewOthers={viewItemsToCheck}
          />
        )}
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

const styles = StyleSheet.create({
  // The same 48dp as the sheet's own close button beside it.
  headerButton: { width: TOUCH_TARGET, height: TOUCH_TARGET, margin: 0 },
});
