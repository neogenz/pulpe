import type {
  TransactionImportDecision,
  TransactionImportMatchReason,
  TransactionImportSuggestion,
  TransactionKind,
} from 'pulpe-shared';
import type { ImportedKind } from './bank-statement.entity';
import type {
  AttachableLine,
  ImportCandidate,
  PlannedImport,
} from './transaction-import.entity';

/** Money in only fills a Revenu; money out a Dépense or an Épargne. */
const ATTACHABLE_KINDS: Readonly<
  Record<ImportedKind, readonly TransactionKind[]>
> = {
  income: ['income'],
  expense: ['expense', 'saving'],
};

/** Shorter words ("de", "la", "sa") carry no meaning in a bank label. */
const SIGNIFICANT_WORD_MIN_LENGTH = 3;
const IGNORED_WORDS = new Set(['les', 'des', 'une', 'pour', 'avec', 'sur']);

const LABEL_SCORE = 2;
const AMOUNT_SCORE = 1;

export function canAttach(kind: ImportedKind, line: AttachableLine): boolean {
  return ATTACHABLE_KINDS[kind].includes(line.kind);
}

/**
 * The Prévision that stands out for an operation, with the criteria it meets
 * (CA4). The month is implicit — every line belongs to the target budget —
 * and the type is a precondition. Then a name found in the bank label weighs
 * more than an equal amount, since recurring amounts often coincide. Two
 * Prévisions scoring the same yield no suggestion: guessing between equals
 * would be a silent choice.
 */
export function suggestMatch(
  operation: Pick<ImportCandidate, 'name' | 'amount' | 'kind'>,
  lines: readonly AttachableLine[],
): TransactionImportSuggestion | null {
  const operationWords = new Set(significantWords(operation.name));
  const scored = lines
    .filter((line) => canAttach(operation.kind, line))
    .map((line) => {
      const isLabelMatch = labelMatches(operationWords, line.name);
      const isAmountMatch = toCents(line.amount) === toCents(operation.amount);
      return {
        line,
        isLabelMatch,
        isAmountMatch,
        score:
          (isLabelMatch ? LABEL_SCORE : 0) + (isAmountMatch ? AMOUNT_SCORE : 0),
      };
    })
    .filter((candidate) => candidate.score > 0);

  const bestScore = Math.max(0, ...scored.map((candidate) => candidate.score));
  const best = scored.filter((candidate) => candidate.score === bestScore);
  if (best.length !== 1) return null;

  const [{ line, isLabelMatch, isAmountMatch }] = best;
  const reasons: TransactionImportMatchReason[] = ['kind'];
  if (isAmountMatch) reasons.push('amount');
  if (isLabelMatch) reasons.push('label');
  return { budgetLineId: line.id, reasons };
}

/** Every significant word of the Prévision's name appears in the bank label. */
function labelMatches(
  operationWords: ReadonlySet<string>,
  lineName: string,
): boolean {
  const lineWords = significantWords(lineName);
  return (
    lineWords.length > 0 && lineWords.every((word) => operationWords.has(word))
  );
}

/** Lowercase, accent-free words: "Café" in a Prévision matches "CAFE" from the bank. */
function significantWords(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (word) =>
        word.length >= SIGNIFICANT_WORD_MIN_LENGTH && !IGNORED_WORDS.has(word),
    );
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export type DecisionProblem =
  | 'operation_not_importable'
  | 'budget_line_unavailable'
  | 'kind_incompatible';

/**
 * Applies the attachments the user accepted or chose (CA5, CA6). Every other
 * candidate stays a free, unchecked Réel: suggestions the user did not accept
 * are never applied. A decision that no longer fits — the operation is not
 * new any more, the Prévision is gone or cannot take it — refuses the whole
 * plan rather than importing it differently from what the user confirmed.
 */
export function planImport(input: {
  candidates: readonly ImportCandidate[];
  decisions: readonly TransactionImportDecision[];
  lines: readonly AttachableLine[];
  checkedAt: string;
}):
  | { planned: PlannedImport[] }
  | { problem: DecisionProblem; position: number } {
  const linesById = new Map(input.lines.map((line) => [line.id, line]));
  const candidatesByPosition = new Map(
    input.candidates.map((candidate) => [candidate.position, candidate]),
  );
  const attachments = new Map<number, AttachableLine>();

  for (const decision of input.decisions) {
    const candidate = candidatesByPosition.get(decision.position);
    if (!candidate) {
      return {
        problem: 'operation_not_importable',
        position: decision.position,
      };
    }
    const line = linesById.get(decision.budgetLineId);
    if (!line) {
      return {
        problem: 'budget_line_unavailable',
        position: decision.position,
      };
    }
    if (!canAttach(candidate.kind, line)) {
      return { problem: 'kind_incompatible', position: decision.position };
    }
    attachments.set(decision.position, line);
  }

  return {
    planned: input.candidates.map((candidate) => {
      const line = attachments.get(candidate.position);
      return {
        ...candidate,
        kind: line?.kind ?? candidate.kind,
        budgetLineId: line?.id ?? null,
        checkedAt: line ? input.checkedAt : null,
      };
    }),
  };
}
