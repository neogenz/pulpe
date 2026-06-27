import type { MatSnackBar } from '@angular/material/snack-bar';
import type { TranslocoService } from '@jsverse/transloco';
import type {
  BudgetLine,
  BudgetLineSpreadCreate,
  BudgetLineSpreadResponse,
  SupportedCurrency,
  Transaction,
} from 'pulpe-shared';

/**
 * Success toast for a smoothed expense (PUL-17). Base line counts the created
 * occurrences; suffixes surface auto-created budgets and months skipped for
 * lack of a default template.
 */
export function computeSpreadSnackbarMessage(
  outcome: Pick<
    BudgetLineSpreadResponse['data'],
    'lines' | 'createdBudgets' | 'skippedMonths'
  >,
  transloco: TranslocoService,
): string {
  let message = transloco.translate('budget.spreadSuccess', {
    count: outcome.lines.length,
  });

  if (outcome.createdBudgets.length > 0) {
    message += transloco.translate('budget.spreadCreatedBudgetsSuffix', {
      count: outcome.createdBudgets.length,
    });
  }

  if (outcome.skippedMonths.length > 0) {
    message += transloco.translate('budget.spreadSkippedMonthsSuffix', {
      count: outcome.skippedMonths.length,
    });
  }

  return message;
}

/**
 * PUL-17 — submit a smoothed expense (additive create) and surface the outcome.
 *
 * On success: the occurrences toast. On failure: a "Réessayer" toast whose action
 * re-submits the SAME DTO — crucially the SAME `spreadGroupId`. That is what makes
 * the idempotency key actually do its job: the retry replays the original group
 * server-side (or heals a balance left stale by a post-commit failure) instead of
 * creating a duplicate. Recurses so each failed retry can be retried again.
 *
 * The mutation is injected as `create` so this stays decoupled from the store; the
 * caller passes `(v) => store.createBudgetLineSpread(v)`.
 */
export async function submitSpreadWithRetry(
  value: BudgetLineSpreadCreate,
  create: (
    value: BudgetLineSpreadCreate,
  ) => Promise<BudgetLineSpreadResponse['data'] | undefined>,
  snackBar: MatSnackBar,
  transloco: TranslocoService,
): Promise<void> {
  const outcome = await create(value);
  if (outcome) {
    snackBar.open(
      computeSpreadSnackbarMessage(outcome, transloco),
      transloco.translate('common.close'),
      { duration: 5000 },
    );
    return;
  }

  const ref = snackBar.open(
    transloco.translate('budgetLine.spread.error'),
    transloco.translate('common.retry'),
    { duration: 8000 },
  );
  ref.onAction().subscribe(() => {
    void submitSpreadWithRetry(value, create, snackBar, transloco);
  });
}

/**
 * PUL-17 — derive the `{amount} sur {count} mois` echo shown in the processing
 * dialog from an additive spread-create DTO. In `total` mode the user typed the
 * total to smooth; in `perMonth` mode the committed total is the per-month
 * figure replicated over every target month.
 */
export function spreadCreateEcho(value: BudgetLineSpreadCreate): {
  amount: number;
  monthCount: number;
} {
  const monthCount = value.months.length;
  const amount =
    value.mode === 'total'
      ? (value.totalAmount ?? 0)
      : (value.perMonthAmount ?? 0) * monthCount;
  return { amount, monthCount };
}

export function computeEnvelopeSnackbarMessage(
  budgetLineId: string,
  budgetLines: BudgetLine[],
  transactions: Transaction[],
  currency: SupportedCurrency,
  transloco: TranslocoService,
): string | null {
  const budgetLine = budgetLines.find((line) => line.id === budgetLineId);
  if (!budgetLine || budgetLine.checkedAt == null) return null;

  const consumed = transactions
    .filter(
      (tx) =>
        tx.budgetLineId === budgetLineId &&
        tx.checkedAt != null &&
        (tx.kind === 'expense' || tx.kind === 'saving'),
    )
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const envelopeAmount = Math.abs(budgetLine.amount);
  const roundedConsumed = Math.round(consumed);
  const roundedEnvelope = Math.round(envelopeAmount);

  if (roundedConsumed > roundedEnvelope) {
    return transloco.translate('budget.snackbar.envelopeOver', {
      consumed: roundedConsumed,
      envelope: roundedEnvelope,
      currency,
    });
  }
  return transloco.translate('budget.snackbar.envelopeWithin', {
    envelope: roundedEnvelope,
    currency,
  });
}

export function computeTransactionSnackbarMessage(
  transactionId: string,
  transactions: Transaction[],
  currency: SupportedCurrency,
  transloco: TranslocoService,
): string | null {
  const transaction = transactions.find((tx) => tx.id === transactionId);
  if (!transaction || transaction.checkedAt == null) return null;

  return transloco.translate('budget.snackbar.transactionChecked', {
    amount: Math.round(Math.abs(transaction.amount)),
    currency,
  });
}
