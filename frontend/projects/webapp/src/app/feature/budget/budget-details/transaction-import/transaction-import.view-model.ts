import {
  API_ERROR_CODES,
  TRANSACTION_IMPORT_MAX_FILE_BYTES,
  TRANSACTION_IMPORT_MAX_OPERATIONS,
  type TransactionImportError,
  type TransactionImportErrorCode,
  type TransactionImportOperation,
  type TransactionImportOperationStatus,
  type TransactionImportResult,
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

export function importSuccessKey(createdCount: number): string {
  return createdCount === 1
    ? 'transactionImport.successOne'
    : 'transactionImport.successMany';
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
