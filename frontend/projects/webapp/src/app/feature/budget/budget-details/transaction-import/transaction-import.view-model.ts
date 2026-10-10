import {
  API_ERROR_CODES,
  TRANSACTION_IMPORT_MAX_FILE_BYTES,
  TRANSACTION_IMPORT_MAX_OPERATIONS,
  type TransactionImportBudgetLine,
  type TransactionImportDecision,
  type TransactionImportError,
  type TransactionImportErrorCode,
  type TransactionImportMatchReason,
  type TransactionImportOperation,
  type TransactionImportOperationStatus,
  type TransactionImportResult,
  type TransactionKind,
} from 'pulpe-shared';

/** What a confirmed import hands back to whoever opened the dialog. */
export type TransactionImportOutcome =
  | { readonly status: 'imported'; readonly result: TransactionImportResult }
  /** The Réels exist, but the balances were not refreshed server-side. */
  | { readonly status: 'importedWithWarning'; readonly message: string }
  | {
      readonly status: 'failed';
      readonly message: string;
      readonly code: string | null;
    };

/** The dialog closes only once something was written. */
export type TransactionImportDialogResult = Exclude<
  TransactionImportOutcome,
  { status: 'failed' }
>;

const BYTES_PER_MEGABYTE = 1024 * 1024;

/** The upload ceiling, in whole megabytes, for the "file too large" copy. */
export const TRANSACTION_IMPORT_MAX_FILE_MEGABYTES = Math.floor(
  TRANSACTION_IMPORT_MAX_FILE_BYTES / BYTES_PER_MEGABYTE,
);

export function isFileTooLarge(file: Pick<File, 'size'>): boolean {
  return file.size > TRANSACTION_IMPORT_MAX_FILE_BYTES;
}

export type TransactionImportStatusCounts = Record<
  TransactionImportOperationStatus,
  number
>;

export function countOperationsByStatus(
  operations: readonly Pick<TransactionImportOperation, 'status'>[],
): TransactionImportStatusCounts {
  const counts: TransactionImportStatusCounts = {
    new: 0,
    already_imported: 0,
    outside_period: 0,
    pending: 0,
  };
  for (const operation of operations) counts[operation.status] += 1;
  return counts;
}

export interface StatusSummaryItem {
  readonly status: TransactionImportOperationStatus;
  readonly count: number;
  readonly key: string;
}

/**
 * The counts line above the list. "À importer" always shows — it is what the
 * button acts on — while a skipped status shows only when it occurs.
 */
export function buildStatusSummary(
  counts: TransactionImportStatusCounts,
): StatusSummaryItem[] {
  const items: StatusSummaryItem[] = [
    { status: 'new', count: counts.new, key: 'transactionImport.summaryNew' },
    {
      status: 'already_imported',
      count: counts.already_imported,
      key:
        counts.already_imported === 1
          ? 'transactionImport.summaryAlreadyImportedOne'
          : 'transactionImport.summaryAlreadyImportedMany',
    },
    {
      status: 'outside_period',
      count: counts.outside_period,
      key: 'transactionImport.summaryOutsidePeriod',
    },
    {
      status: 'pending',
      count: counts.pending,
      key: 'transactionImport.summaryPending',
    },
  ];
  return items.filter((item) => item.status === 'new' || item.count > 0);
}

const STATUS_LABEL_KEYS: Record<
  Exclude<TransactionImportOperationStatus, 'new'>,
  string
> = {
  already_imported: 'transactionImport.statusAlreadyImported',
  outside_period: 'transactionImport.statusOutsidePeriod',
  pending: 'transactionImport.statusPending',
};

export interface OperationRow {
  readonly position: number;
  readonly date: string;
  readonly name: string;
  readonly amount: number;
  readonly kind: TransactionImportOperation['kind'];
  readonly kindKey: string;
  /** Null for a `new` operation: only skipped ones carry a status label. */
  readonly statusKey: string | null;
  readonly isNew: boolean;
}

export function toOperationRows(
  operations: readonly TransactionImportOperation[],
): OperationRow[] {
  return operations.map((operation) => ({
    position: operation.position,
    date: operation.date,
    name: operation.name,
    amount: operation.amount,
    kind: operation.kind,
    kindKey: `transactionKind.${operation.kind}`,
    statusKey:
      operation.status === 'new' ? null : STATUS_LABEL_KEYS[operation.status],
    isNew: operation.status === 'new',
  }));
}

const ERROR_CODE_KEYS: Record<TransactionImportErrorCode, string> = {
  unsupported_format: 'transactionImport.errorCode.unsupportedFormat',
  malformed_file: 'transactionImport.errorCode.malformedFile',
  empty_statement: 'transactionImport.errorCode.emptyStatement',
  too_many_operations: 'transactionImport.errorCode.tooManyOperations',
  currency_mismatch: 'transactionImport.errorCode.currencyMismatch',
  missing_date: 'transactionImport.errorCode.missingDate',
  invalid_amount: 'transactionImport.errorCode.invalidAmount',
  missing_direction: 'transactionImport.errorCode.missingDirection',
  missing_label: 'transactionImport.errorCode.missingLabel',
};

export interface ErrorRow {
  readonly key: string;
  readonly params: Record<string, number>;
  /** 1-based operation rank; null when the whole file is at fault. */
  readonly position: number | null;
}

export function toErrorRows(
  errors: readonly TransactionImportError[],
): ErrorRow[] {
  return errors.map((error) => ({
    key: ERROR_CODE_KEYS[error.code],
    params: { max: TRANSACTION_IMPORT_MAX_OPERATIONS },
    position: error.position,
  }));
}

export function confirmLabelKey(newCount: number): string {
  if (newCount === 0) return 'transactionImport.confirmNone';
  return newCount === 1
    ? 'transactionImport.confirmOne'
    : 'transactionImport.confirmMany';
}

/** The snackbar names the pointed Réels only when some were attached. */
export function importSuccessKey(
  result: Pick<TransactionImportResult, 'createdCount' | 'attachedCount'>,
): string {
  const { createdCount, attachedCount } = result;
  if (attachedCount === 0) {
    return createdCount === 1
      ? 'transactionImport.successOne'
      : 'transactionImport.successMany';
  }
  if (createdCount === 1) return 'transactionImport.successOneChecked';
  return attachedCount === 1
    ? 'transactionImport.successManyCheckedOne'
    : 'transactionImport.successManyCheckedMany';
}

/**
 * The server refused the confirmation because the file no longer matches what
 * the preview showed (blocking errors, or an operation imported meanwhile):
 * nothing was written, and a fresh preview of the same file is the way out.
 */
const PREVIEW_STALE_CODES = new Set<string>([
  API_ERROR_CODES.TRANSACTION_IMPORT_CONFLICT,
  API_ERROR_CODES.TRANSACTION_IMPORT_INVALID,
]);

export function isPreviewStale(code: string | null): boolean {
  return code !== null && PREVIEW_STALE_CODES.has(code);
}

// ─── Attachments (CA4–CA6) ────────────────────────────────────────────────
//
// Nothing is ever attached on the user's behalf: every `new` operation starts
// `undecided`, and only an `attached` decision reaches the confirmation. A
// pending suggestion is shown, never sent.

export type AttachmentDecision =
  | { readonly type: 'undecided' }
  | { readonly type: 'refused' }
  | { readonly type: 'attached'; readonly budgetLineId: string };

/** Keyed by operation position; an absent position is `undecided`. */
export type AttachmentDecisions = ReadonlyMap<number, AttachmentDecision>;

const UNDECIDED: AttachmentDecision = { type: 'undecided' };

export function emptyAttachmentDecisions(): AttachmentDecisions {
  return new Map();
}

export function decisionFor(
  decisions: AttachmentDecisions,
  position: number,
): AttachmentDecision {
  return decisions.get(position) ?? UNDECIDED;
}

type AttachableOperation = Pick<
  TransactionImportOperation,
  'position' | 'kind' | 'status' | 'suggestion'
>;

/** Money in goes to a Revenu; money out to a Dépense or an Épargne. */
const COMPATIBLE_LINE_KINDS: Record<
  TransactionImportOperation['kind'],
  readonly TransactionKind[]
> = {
  income: ['income'],
  expense: ['expense', 'saving'],
};

export function isLineCompatible(
  operationKind: TransactionImportOperation['kind'],
  lineKind: TransactionKind,
): boolean {
  return COMPATIBLE_LINE_KINDS[operationKind].includes(lineKind);
}

export function compatibleBudgetLines(
  operation: Pick<TransactionImportOperation, 'kind'>,
  budgetLines: readonly TransactionImportBudgetLine[],
): TransactionImportBudgetLine[] {
  return budgetLines.filter((line) =>
    isLineCompatible(operation.kind, line.kind),
  );
}

/** The suggested Prévision, when it is still offered and can carry the operation. */
function suggestedLine(
  operation: AttachableOperation,
  budgetLines: readonly TransactionImportBudgetLine[],
): TransactionImportBudgetLine | null {
  if (operation.status !== 'new' || !operation.suggestion) return null;
  const { budgetLineId } = operation.suggestion;
  const line = budgetLines.find((candidate) => candidate.id === budgetLineId);
  return line && isLineCompatible(operation.kind, line.kind) ? line : null;
}

function withDecision(
  decisions: AttachmentDecisions,
  position: number,
  decision: AttachmentDecision,
): AttachmentDecisions {
  const next = new Map(decisions);
  next.set(position, decision);
  return next;
}

/** Attaches a `new` operation to a compatible Prévision; anything else is ignored. */
export function attachOperation(
  decisions: AttachmentDecisions,
  operation: AttachableOperation,
  line: TransactionImportBudgetLine,
): AttachmentDecisions {
  if (
    operation.status !== 'new' ||
    !isLineCompatible(operation.kind, line.kind)
  ) {
    return decisions;
  }
  return withDecision(decisions, operation.position, {
    type: 'attached',
    budgetLineId: line.id,
  });
}

export function acceptSuggestion(
  decisions: AttachmentDecisions,
  operation: AttachableOperation,
  budgetLines: readonly TransactionImportBudgetLine[],
): AttachmentDecisions {
  const line = suggestedLine(operation, budgetLines);
  return line ? attachOperation(decisions, operation, line) : decisions;
}

/** Refusing a suggestion and removing an attachment both leave a free Réel. */
export function leaveFree(
  decisions: AttachmentDecisions,
  position: number,
): AttachmentDecisions {
  return withDecision(decisions, position, { type: 'refused' });
}

/** Accepts every suggestion still undecided; refusals and choices stay as they are. */
export function acceptAllSuggestions(
  decisions: AttachmentDecisions,
  operations: readonly AttachableOperation[],
  budgetLines: readonly TransactionImportBudgetLine[],
): AttachmentDecisions {
  let next = decisions;
  for (const operation of operations) {
    if (decisionFor(next, operation.position).type !== 'undecided') continue;
    next = acceptSuggestion(next, operation, budgetLines);
  }
  return next;
}

export function countPendingSuggestions(
  decisions: AttachmentDecisions,
  operations: readonly AttachableOperation[],
  budgetLines: readonly TransactionImportBudgetLine[],
): number {
  return operations.filter(
    (operation) =>
      decisionFor(decisions, operation.position).type === 'undecided' &&
      suggestedLine(operation, budgetLines) !== null,
  ).length;
}

/** The attachment a decision resolves to, or null when the Réel stays free. */
function attachedLine(
  operation: AttachableOperation,
  decision: AttachmentDecision,
  budgetLines: readonly TransactionImportBudgetLine[],
): TransactionImportBudgetLine | null {
  if (operation.status !== 'new' || decision.type !== 'attached') return null;
  const line = budgetLines.find(
    (candidate) => candidate.id === decision.budgetLineId,
  );
  return line && isLineCompatible(operation.kind, line.kind) ? line : null;
}

/** What the confirmation sends: the explicit attachments only, in file order. */
export function toImportDecisions(
  decisions: AttachmentDecisions,
  operations: readonly AttachableOperation[],
  budgetLines: readonly TransactionImportBudgetLine[],
): TransactionImportDecision[] {
  return operations.flatMap((operation) => {
    const line = attachedLine(
      operation,
      decisionFor(decisions, operation.position),
      budgetLines,
    );
    return line
      ? [{ position: operation.position, budgetLineId: line.id }]
      : [];
  });
}

export interface AttachmentPlan {
  /** Created Réels attached to a Prévision, hence pointés. */
  readonly attached: number;
  /** Created Réels left free and À pointer. */
  readonly free: number;
}

export function buildAttachmentPlan(
  decisions: AttachmentDecisions,
  operations: readonly AttachableOperation[],
  budgetLines: readonly TransactionImportBudgetLine[],
): AttachmentPlan {
  const newCount = operations.filter((op) => op.status === 'new').length;
  const attached = toImportDecisions(decisions, operations, budgetLines).length;
  return { attached, free: newCount - attached };
}

export interface AttachmentOptionGroup {
  readonly kind: TransactionKind;
  readonly kindKey: string;
  readonly lines: readonly TransactionImportBudgetLine[];
}

/** The menu of Prévisions an operation may go to, one group per compatible kind. */
export function buildAttachmentOptions(
  operation: Pick<TransactionImportOperation, 'kind'>,
  budgetLines: readonly TransactionImportBudgetLine[],
): AttachmentOptionGroup[] {
  return COMPATIBLE_LINE_KINDS[operation.kind]
    .map((kind) => ({
      kind,
      kindKey: `transactionKind.${kind}`,
      lines: budgetLines.filter((line) => line.kind === kind),
    }))
    .filter((group) => group.lines.length > 0);
}

const MATCH_REASON_KEYS: Record<TransactionImportMatchReason, string> = {
  kind: 'transactionImport.attachment.reason.kind',
  amount: 'transactionImport.attachment.reason.amount',
  label: 'transactionImport.attachment.reason.label',
};

export type AttachmentView =
  | {
      readonly state: 'suggested';
      readonly line: TransactionImportBudgetLine;
      readonly reasonKeys: readonly string[];
      readonly options: readonly AttachmentOptionGroup[];
    }
  | {
      readonly state: 'attached';
      readonly line: TransactionImportBudgetLine;
      readonly options: readonly AttachmentOptionGroup[];
    }
  | {
      readonly state: 'free';
      readonly options: readonly AttachmentOptionGroup[];
    };

/**
 * One view per `new` operation that has something to decide: a suggestion or
 * at least one compatible Prévision. The others need no attachment area.
 */
export function buildAttachmentViews(
  decisions: AttachmentDecisions,
  operations: readonly TransactionImportOperation[],
  budgetLines: readonly TransactionImportBudgetLine[],
): ReadonlyMap<number, AttachmentView> {
  const optionsByKind: Record<
    TransactionImportOperation['kind'],
    AttachmentOptionGroup[]
  > = {
    income: buildAttachmentOptions({ kind: 'income' }, budgetLines),
    expense: buildAttachmentOptions({ kind: 'expense' }, budgetLines),
  };
  const views = new Map<number, AttachmentView>();

  for (const operation of operations) {
    if (operation.status !== 'new') continue;
    const options = optionsByKind[operation.kind];
    const decision = decisionFor(decisions, operation.position);
    const attached = attachedLine(operation, decision, budgetLines);
    const suggested = suggestedLine(operation, budgetLines);

    if (attached) {
      views.set(operation.position, {
        state: 'attached',
        line: attached,
        options,
      });
    } else if (
      decision.type === 'undecided' &&
      suggested &&
      operation.suggestion
    ) {
      views.set(operation.position, {
        state: 'suggested',
        line: suggested,
        reasonKeys: operation.suggestion.reasons.map(
          (reason) => MATCH_REASON_KEYS[reason],
        ),
        options,
      });
    } else if (options.length > 0) {
      views.set(operation.position, { state: 'free', options });
    }
  }
  return views;
}

export interface PlanSummaryItem {
  readonly key: string;
  readonly count: number;
}

/**
 * What the confirmation will do, said before it does it: how many Réels get
 * attached and pointés, how many stay free. "Nothing attached" is said too.
 */
export function buildPlanSummary(plan: AttachmentPlan): PlanSummaryItem[] {
  if (plan.attached === 0) {
    return [
      {
        key: 'transactionImport.attachment.planNothingAttached',
        count: plan.free,
      },
    ];
  }
  const items: PlanSummaryItem[] = [
    {
      key:
        plan.attached === 1
          ? 'transactionImport.attachment.planAttachedOne'
          : 'transactionImport.attachment.planAttachedMany',
      count: plan.attached,
    },
  ];
  if (plan.free > 0) {
    items.push({
      key:
        plan.free === 1
          ? 'transactionImport.attachment.planFreeOne'
          : 'transactionImport.attachment.planFreeMany',
      count: plan.free,
    });
  }
  return items;
}
