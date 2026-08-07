import type { PostgrestError } from '@supabase/supabase-js';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { isRetryableTransactionConflict } from '@common/utils/postgres-conflict';

// Exact messages the withdrawal RPCs and the source-link trigger RAISE (P0001),
// mirrored verbatim from migrations 20260802120000_add_savings_goal_withdrawals
// and 20260805120000_add_planned_savings_goal_withdrawals, and pinned by their
// SQL tests. Keeping them beside the mapping below gives the SQL↔TS coupling a
// single greppable home.
export const WITHDRAWAL_BALANCE_CHANGED_RPC_MESSAGE =
  'Savings goal balance changed';
export const WITHDRAWAL_GOAL_DENIED_RPC_MESSAGE = 'Savings goal access denied';
export const WITHDRAWAL_NOT_FOUND_RPC_MESSAGE =
  'Savings goal withdrawal not found';
export const WITHDRAWAL_KIND_RPC_MESSAGE =
  'Savings goal withdrawal must be an income';
export const WITHDRAWAL_ALLOCATION_MOVED_RPC_MESSAGE =
  'Savings goal withdrawal allocation is immutable';
export const WITHDRAWAL_FOREIGN_FORECAST_RPC_MESSAGE =
  'Savings goal withdrawal must realize its own forecast';
export const WITHDRAWAL_SOURCE_CHANGED_RPC_MESSAGE =
  'Savings goal withdrawal source changed';
export const WITHDRAWAL_BUDGET_DENIED_RPC_MESSAGE = 'Budget access denied';
export const WITHDRAWAL_TAG_DENIED_RPC_MESSAGE = 'Tag access denied';

/**
 * The write would break the shape a withdrawal must keep for its whole life:
 * an income pointing at the goal it was created against, either free or
 * allocated to the one forecast that announced it — and never moved afterwards.
 */
const INVALID_SHAPE_RPC_MESSAGES = [
  WITHDRAWAL_KIND_RPC_MESSAGE,
  WITHDRAWAL_ALLOCATION_MOVED_RPC_MESSAGE,
  WITHDRAWAL_FOREIGN_FORECAST_RPC_MESSAGE,
  WITHDRAWAL_SOURCE_CHANGED_RPC_MESSAGE,
] as const;

type ErrorDefinition =
  (typeof ERROR_DEFINITIONS)[keyof typeof ERROR_DEFINITIONS];

interface WithdrawalRpcFailure {
  error: PostgrestError | null;
  operation: string;
  /** Raised when the message matches nothing known — the RPC failed for a reason of its own. */
  fallbackErrorDef: ErrorDefinition;
  transactionId?: string;
  userId: string;
}

/**
 * Maps a withdrawal RPC failure to the status it deserves.
 *
 * A retryable class-40 abort (deadlock, serialization) becomes the same
 * conflict as a stale revision on purpose: both mean "nothing was written,
 * read again", and that is exactly the one case the withdrawal policy retries.
 */
export function mapWithdrawalRpcError({
  error,
  operation,
  fallbackErrorDef,
  transactionId,
  userId,
}: WithdrawalRpcFailure): BusinessException {
  const message = error?.message ?? '';
  const loggingContext = {
    operation,
    entityType: 'transaction',
    ...(transactionId ? { entityId: transactionId } : {}),
    userId,
    supabaseError: error,
  };
  const options = { cause: error ?? undefined };

  if (
    message.includes(WITHDRAWAL_BALANCE_CHANGED_RPC_MESSAGE) ||
    isRetryableTransactionConflict(error)
  ) {
    return new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_CONFLICT,
      undefined,
      loggingContext,
      options,
    );
  }

  if (message.includes(WITHDRAWAL_GOAL_DENIED_RPC_MESSAGE)) {
    return new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND,
      undefined,
      loggingContext,
      options,
    );
  }

  if (message.includes(WITHDRAWAL_NOT_FOUND_RPC_MESSAGE)) {
    return new BusinessException(
      ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
      { id: transactionId },
      loggingContext,
      options,
    );
  }

  if (message.includes(WITHDRAWAL_BUDGET_DENIED_RPC_MESSAGE)) {
    return new BusinessException(
      ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
      undefined,
      loggingContext,
      options,
    );
  }

  if (message.includes(WITHDRAWAL_TAG_DENIED_RPC_MESSAGE)) {
    return new BusinessException(
      ERROR_DEFINITIONS.TAG_NOT_FOUND,
      undefined,
      loggingContext,
      options,
    );
  }

  const invalidShape = INVALID_SHAPE_RPC_MESSAGES.find((candidate) =>
    message.includes(candidate),
  );
  if (invalidShape) {
    return new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_TRANSACTION_INVALID,
      { reason: invalidShape },
      loggingContext,
      options,
    );
  }

  return new BusinessException(
    fallbackErrorDef,
    transactionId ? { id: transactionId } : undefined,
    loggingContext,
    options,
  );
}
