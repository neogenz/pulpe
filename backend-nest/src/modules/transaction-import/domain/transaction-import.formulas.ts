import {
  TRANSACTION_IMPORT_MAX_OPERATIONS,
  getBudgetPeriodDates,
  type SupportedCurrency,
  type TransactionImportError,
  type TransactionImportOperation,
  type TransactionImportOperationStatus,
} from 'pulpe-shared';
import type {
  BankStatement,
  ImportedKind,
  StatementOperation,
} from './bank-statement.entity';
import type {
  AttachableLine,
  ImportCandidate,
  ImportPeriod,
} from './transaction-import.entity';
import { suggestMatch } from './transaction-import.matching';

/** Same bound as a Réel's name (`transactionCreateSchema`). */
const NAME_MAX_LENGTH = 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Bump when the material changes: old fingerprints then stop matching. */
const FINGERPRINT_VERSION = 'v1';
const FIELD_SEPARATOR = '\u001f';

/** An operation every field of which passed validation. */
export interface ValidOperation {
  position: number;
  date: string;
  amount: number;
  kind: ImportedKind;
  name: string;
  isBooked: boolean;
  bankReference: string | null;
  accountId: string | null;
}

export function budgetPeriodBounds(
  month: number,
  year: number,
  payDayOfMonth: number | null,
): ImportPeriod {
  const { startDate, endDate } = getBudgetPeriodDates(
    month,
    year,
    payDayOfMonth,
  );
  return { startDate: toIsoDate(startDate), endDate: toIsoDate(endDate) };
}

/** `getBudgetPeriodDates` builds local dates: read them back with local getters. */
function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Errors about the file as a whole; when any applies, operations are not listed. */
export function findStatementErrors(
  statement: BankStatement,
): TransactionImportError[] {
  if (statement.operations.length === 0) {
    return [{ code: 'empty_statement', position: null }];
  }
  if (statement.operations.length > TRANSACTION_IMPORT_MAX_OPERATIONS) {
    return [{ code: 'too_many_operations', position: null }];
  }
  return [];
}

/**
 * Validates each operation. A file entirely in another currency yields one
 * file-level error and nothing else: the only useful fix is another export,
 * so listing its other line errors would only add noise.
 */
export function validateOperations(
  operations: readonly StatementOperation[],
  currency: SupportedCurrency,
): { valid: ValidOperation[]; errors: TransactionImportError[] } {
  const valid: ValidOperation[] = [];
  const errors: TransactionImportError[] = [];

  for (const operation of operations) {
    const operationErrors = operationErrorCodes(operation, currency).map(
      (code) => ({ code, position: operation.position }),
    );
    if (operationErrors.length > 0) {
      errors.push(...operationErrors);
      continue;
    }
    valid.push({
      position: operation.position,
      date: operation.date!,
      amount: roundToCents(operation.amount!),
      kind: operation.direction!,
      name: toDisplayName(operation.label!),
      isBooked: operation.isBooked,
      bankReference: operation.bankReference,
      accountId: operation.accountId,
    });
  }

  const mismatches = errors.filter(
    (error) => error.code === 'currency_mismatch',
  );
  if (mismatches.length === operations.length) {
    return { valid, errors: [{ code: 'currency_mismatch', position: null }] };
  }
  return { valid, errors };
}

function operationErrorCodes(
  operation: StatementOperation,
  currency: SupportedCurrency,
): TransactionImportError['code'][] {
  const codes: TransactionImportError['code'][] = [];
  if (!isValidIsoDate(operation.date)) codes.push('missing_date');
  if (
    operation.amount === null ||
    !Number.isFinite(operation.amount) ||
    roundToCents(operation.amount) <= 0
  ) {
    codes.push('invalid_amount');
  }
  if (operation.direction === null) codes.push('missing_direction');
  if (!operation.label || toDisplayName(operation.label) === '') {
    codes.push('missing_label');
  }
  if (operation.currency !== null && operation.currency !== currency) {
    codes.push('currency_mismatch');
  }
  return codes;
}

function isValidIsoDate(value: string | null): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Bank labels carry padding and line breaks; a Réel name is one short line. */
function toDisplayName(label: string): string {
  const collapsed = label.replace(/\s+/g, ' ').trim();
  return collapsed.length <= NAME_MAX_LENGTH
    ? collapsed
    : `${collapsed.slice(0, NAME_MAX_LENGTH - 1).trimEnd()}…`;
}

/**
 * What identifies a bank operation across exports. The bank's own reference
 * wins when present. Without one, the content stands in, plus its rank among
 * identical operations of the file: two identical coffees on the same day are
 * two operations, and re-exporting the same days yields the same ranks.
 *
 * The material holds amounts and labels in clear: it only ever goes through
 * the keyed hash, never to storage or logs.
 */
export function fingerprintMaterials(
  format: BankStatement['format'],
  operations: readonly ValidOperation[],
): string[] {
  const occurrences = new Map<string, number>();
  return operations.map((operation) => {
    const identity = operation.bankReference
      ? `ref:${operation.bankReference}`
      : contentIdentity(operation, occurrences);
    return [
      FINGERPRINT_VERSION,
      format,
      operation.accountId ?? '',
      identity,
    ].join(FIELD_SEPARATOR);
  });
}

function contentIdentity(
  operation: ValidOperation,
  occurrences: Map<string, number>,
): string {
  const key = [
    operation.accountId ?? '',
    operation.date,
    operation.kind,
    Math.round(operation.amount * 100),
    operation.name.toLowerCase(),
  ].join(FIELD_SEPARATOR);
  const occurrence = (occurrences.get(key) ?? 0) + 1;
  occurrences.set(key, occurrence);
  return `op:${key}${FIELD_SEPARATOR}${occurrence}`;
}

/**
 * Decides what the confirmation does with each operation. Precedence:
 * pending, then already imported, then outside the period; the rest is new.
 * `fingerprints` is aligned with `operations`. Only a new operation gets a
 * suggested Prévision: the others will not be created at all.
 */
export function classifyOperations(input: {
  operations: readonly ValidOperation[];
  fingerprints: readonly string[];
  importedFingerprints: ReadonlySet<string>;
  period: ImportPeriod;
  lines: readonly AttachableLine[];
}): {
  operations: TransactionImportOperation[];
  candidates: ImportCandidate[];
} {
  const operations: TransactionImportOperation[] = [];
  const candidates: ImportCandidate[] = [];
  // A bank reference listed twice (overlapping statements in one file) is one
  // operation: once a listing will be created, the next counts as already
  // imported. Only creations count — a pending listing followed by the booked
  // one must still create the booked one.
  const created = new Set<string>();

  input.operations.forEach((operation, index) => {
    const fingerprint = input.fingerprints[index];
    const status = statusOf(
      operation,
      input.importedFingerprints.has(fingerprint) || created.has(fingerprint),
      input.period,
    );
    if (status === 'new') created.add(fingerprint);
    operations.push({
      position: operation.position,
      date: operation.date,
      name: operation.name,
      amount: operation.amount,
      kind: operation.kind,
      status,
      suggestion:
        status === 'new' ? suggestMatch(operation, input.lines) : null,
    });
    if (status === 'new') {
      candidates.push({
        position: operation.position,
        date: operation.date,
        name: operation.name,
        amount: operation.amount,
        kind: operation.kind,
        fingerprint,
      });
    }
  });

  return { operations, candidates };
}

function statusOf(
  operation: ValidOperation,
  isAlreadyImported: boolean,
  period: ImportPeriod,
): TransactionImportOperationStatus {
  if (!operation.isBooked) return 'pending';
  if (isAlreadyImported) return 'already_imported';
  // ISO calendar dates compare correctly as strings.
  if (operation.date < period.startDate || operation.date > period.endDate) {
    return 'outside_period';
  }
  return 'new';
}

/**
 * Noon UTC keeps the booking day on the same calendar day in every European
 * time zone, which is how the clients read `transactionDate` back.
 */
export function toTransactionDate(isoDate: string): string {
  return `${isoDate}T12:00:00.000Z`;
}
