import { describe, expect, it } from 'vitest';
import {
  TRANSACTION_IMPORT_MAX_FILE_BYTES,
  TRANSACTION_IMPORT_MAX_OPERATIONS,
  type TransactionImportBudgetLine,
  type TransactionImportOperation,
} from 'pulpe-shared';
import {
  acceptAllSuggestions,
  acceptSuggestion,
  attachOperation,
  buildAttachmentOptions,
  buildAttachmentPlan,
  buildAttachmentViews,
  buildPlanSummary,
  buildStatusSummary,
  compatibleBudgetLines,
  countPendingSuggestions,
  decisionFor,
  emptyAttachmentDecisions,
  leaveFree,
  toImportDecisions,
  confirmLabelKey,
  countOperationsByStatus,
  importSuccessKey,
  isFileTooLarge,
  isPreviewStale,
  toErrorRows,
  toOperationRows,
} from './transaction-import.view-model';

function operation(
  overrides: Partial<TransactionImportOperation> = {},
): TransactionImportOperation {
  return {
    position: 1,
    date: '2026-03-04',
    name: 'Migros',
    amount: 42.5,
    kind: 'expense',
    status: 'new',
    suggestion: null,
    ...overrides,
  };
}

const RENT_ID = '00000000-0000-4000-8000-0000000000a1';
const SALARY_ID = '00000000-0000-4000-8000-0000000000a2';
const SAVINGS_ID = '00000000-0000-4000-8000-0000000000a3';
const GROCERIES_ID = '00000000-0000-4000-8000-0000000000a4';

const rent: TransactionImportBudgetLine = {
  id: RENT_ID,
  name: 'Loyer',
  kind: 'expense',
  amount: 1500,
};
const salary: TransactionImportBudgetLine = {
  id: SALARY_ID,
  name: 'Salaire',
  kind: 'income',
  amount: 6000,
};
const savings: TransactionImportBudgetLine = {
  id: SAVINGS_ID,
  name: '3e pilier',
  kind: 'saving',
  amount: 588,
};
const groceries: TransactionImportBudgetLine = {
  id: GROCERIES_ID,
  name: 'Courses',
  kind: 'expense',
  amount: 600,
};
const budgetLines = [rent, salary, savings, groceries];

function suggested(
  position: number,
  budgetLineId: string,
  overrides: Partial<TransactionImportOperation> = {},
): TransactionImportOperation {
  return operation({
    position,
    suggestion: { budgetLineId, reasons: ['kind', 'amount'] },
    ...overrides,
  });
}

describe('transaction import view model', () => {
  describe('isFileTooLarge', () => {
    it('should accept a file exactly at the ceiling', () => {
      expect(isFileTooLarge({ size: TRANSACTION_IMPORT_MAX_FILE_BYTES })).toBe(
        false,
      );
    });

    it('should refuse a file one byte over the ceiling', () => {
      expect(
        isFileTooLarge({ size: TRANSACTION_IMPORT_MAX_FILE_BYTES + 1 }),
      ).toBe(true);
    });
  });

  describe('countOperationsByStatus', () => {
    it('should count every status, zero included', () => {
      const counts = countOperationsByStatus([
        operation({ status: 'new' }),
        operation({ status: 'new' }),
        operation({ status: 'already_imported' }),
        operation({ status: 'pending' }),
      ]);

      expect(counts).toEqual({
        new: 2,
        already_imported: 1,
        outside_period: 0,
        pending: 1,
      });
    });
  });

  describe('buildStatusSummary', () => {
    it('should always show the count to import and hide absent skipped statuses', () => {
      const summary = buildStatusSummary({
        new: 0,
        already_imported: 0,
        outside_period: 3,
        pending: 0,
      });

      expect(summary.map((item) => item.status)).toEqual([
        'new',
        'outside_period',
      ]);
    });

    it('should pick the singular or plural key for already imported operations', () => {
      const one = buildStatusSummary({
        new: 1,
        already_imported: 1,
        outside_period: 0,
        pending: 0,
      });
      const many = buildStatusSummary({
        new: 1,
        already_imported: 2,
        outside_period: 0,
        pending: 0,
      });

      expect(one[1].key).toBe('transactionImport.summaryAlreadyImportedOne');
      expect(many[1].key).toBe('transactionImport.summaryAlreadyImportedMany');
    });
  });

  describe('toOperationRows', () => {
    it('should label only skipped operations with their status', () => {
      const rows = toOperationRows([
        operation({ position: 1, status: 'new', kind: 'income' }),
        operation({ position: 2, status: 'outside_period' }),
      ]);

      expect(rows[0]).toMatchObject({
        isNew: true,
        statusKey: null,
        kindKey: 'transactionKind.income',
      });
      expect(rows[1]).toMatchObject({
        isNew: false,
        statusKey: 'transactionImport.statusOutsidePeriod',
        kindKey: 'transactionKind.expense',
      });
    });
  });

  describe('toErrorRows', () => {
    it('should translate each code and keep its position', () => {
      const rows = toErrorRows([
        { code: 'missing_date', position: 4 },
        { code: 'too_many_operations', position: null },
      ]);

      expect(rows).toEqual([
        {
          key: 'transactionImport.errorCode.missingDate',
          params: { max: TRANSACTION_IMPORT_MAX_OPERATIONS },
          position: 4,
        },
        {
          key: 'transactionImport.errorCode.tooManyOperations',
          params: { max: TRANSACTION_IMPORT_MAX_OPERATIONS },
          position: null,
        },
      ]);
    });
  });

  describe('labels', () => {
    it.each([
      [0, 'transactionImport.confirmNone'],
      [1, 'transactionImport.confirmOne'],
      [5, 'transactionImport.confirmMany'],
    ])('should label the confirm button for %i operations', (count, key) => {
      expect(confirmLabelKey(count)).toBe(key);
    });

    it.each([
      [1, 0, 'transactionImport.successOne'],
      [3, 0, 'transactionImport.successMany'],
      [1, 1, 'transactionImport.successOneChecked'],
      [3, 1, 'transactionImport.successManyCheckedOne'],
      [3, 2, 'transactionImport.successManyCheckedMany'],
    ])(
      'should pick the success key for %i created, %i pointés',
      (createdCount, attachedCount, key) => {
        expect(importSuccessKey({ createdCount, attachedCount })).toBe(key);
      },
    );
  });

  describe('isPreviewStale', () => {
    it.each([
      ['ERR_TRANSACTION_IMPORT_CONFLICT', true],
      ['ERR_TRANSACTION_IMPORT_INVALID', true],
      ['ERR_TRANSACTION_IMPORT_FAILED', false],
      [null, false],
    ])('should flag %s as stale: %s', (code, expected) => {
      expect(isPreviewStale(code)).toBe(expected);
    });
  });

  describe('attachments', () => {
    const empty = emptyAttachmentDecisions();

    it('should leave every operation undecided by default', () => {
      expect(decisionFor(empty, 1)).toEqual({ type: 'undecided' });
    });

    it('should send nothing while a suggestion is only pending', () => {
      const operations = [suggested(1, RENT_ID)];

      expect(toImportDecisions(empty, operations, budgetLines)).toEqual([]);
      expect(countPendingSuggestions(empty, operations, budgetLines)).toBe(1);
    });

    it('should attach the suggested Prévision once accepted', () => {
      const op = suggested(1, RENT_ID);

      const decisions = acceptSuggestion(empty, op, budgetLines);

      expect(decisionFor(decisions, 1)).toEqual({
        type: 'attached',
        budgetLineId: RENT_ID,
      });
      expect(toImportDecisions(decisions, [op], budgetLines)).toEqual([
        { position: 1, budgetLineId: RENT_ID },
      ]);
    });

    it('should leave a refused suggestion out of the confirmation', () => {
      const op = suggested(1, RENT_ID);

      const decisions = leaveFree(empty, 1);

      expect(decisionFor(decisions, 1)).toEqual({ type: 'refused' });
      expect(toImportDecisions(decisions, [op], budgetLines)).toEqual([]);
      expect(countPendingSuggestions(decisions, [op], budgetLines)).toBe(0);
    });

    it('should send the Prévision the user chose instead of the suggestion', () => {
      const op = suggested(1, RENT_ID);

      const decisions = attachOperation(empty, op, groceries);

      expect(toImportDecisions(decisions, [op], budgetLines)).toEqual([
        { position: 1, budgetLineId: GROCERIES_ID },
      ]);
    });

    it('should let an operation without suggestion be attached', () => {
      const op = operation({ position: 4 });

      const decisions = attachOperation(empty, op, savings);

      expect(toImportDecisions(decisions, [op], budgetLines)).toEqual([
        { position: 4, budgetLineId: SAVINGS_ID },
      ]);
    });

    it('should keep a chosen Prévision when accepting all suggestions', () => {
      const op = suggested(1, RENT_ID);
      const decisions = attachOperation(empty, op, groceries);

      expect(acceptAllSuggestions(decisions, [op], budgetLines)).toBe(
        decisions,
      );
    });

    describe('kind compatibility', () => {
      it('should offer only Revenus to money in', () => {
        expect(
          compatibleBudgetLines({ kind: 'income' }, budgetLines).map(
            (line) => line.id,
          ),
        ).toEqual([SALARY_ID]);
      });

      it('should offer Dépenses and Épargnes to money out, grouped by kind', () => {
        const groups = buildAttachmentOptions({ kind: 'expense' }, budgetLines);

        expect(
          groups.map((group) => [group.kind, group.lines.map((l) => l.id)]),
        ).toEqual([
          ['expense', [RENT_ID, GROCERIES_ID]],
          ['saving', [SAVINGS_ID]],
        ]);
      });

      it('should refuse to attach money in to a Dépense', () => {
        const op = operation({ position: 1, kind: 'income' });

        expect(attachOperation(empty, op, rent)).toBe(empty);
      });

      it('should ignore a suggestion pointing at an incompatible Prévision', () => {
        const op = suggested(1, SALARY_ID);

        expect(acceptSuggestion(empty, op, budgetLines)).toBe(empty);
        expect(countPendingSuggestions(empty, [op], budgetLines)).toBe(0);
      });

      it('should never attach an operation that will not be created', () => {
        const op = operation({ position: 1, status: 'already_imported' });

        expect(attachOperation(empty, op, rent)).toBe(empty);
      });
    });

    describe('acceptAllSuggestions', () => {
      it('should accept only the suggestions still undecided', () => {
        const operations = [
          suggested(1, RENT_ID),
          suggested(2, GROCERIES_ID),
          suggested(3, SALARY_ID, { kind: 'income' }),
          operation({ position: 4 }),
        ];
        const decisions = leaveFree(empty, 2);

        const accepted = acceptAllSuggestions(
          decisions,
          operations,
          budgetLines,
        );

        expect(toImportDecisions(accepted, operations, budgetLines)).toEqual([
          { position: 1, budgetLineId: RENT_ID },
          { position: 3, budgetLineId: SALARY_ID },
        ]);
        expect(decisionFor(accepted, 2)).toEqual({ type: 'refused' });
        expect(decisionFor(accepted, 4)).toEqual({ type: 'undecided' });
      });
    });

    describe('toImportDecisions', () => {
      it('should drop an attachment to a Prévision no longer offered', () => {
        const op = operation({ position: 1 });
        const decisions = attachOperation(empty, op, rent);

        expect(toImportDecisions(decisions, [op], [groceries])).toEqual([]);
      });
    });

    describe('plan', () => {
      it('should count attached and free Réels among the new operations', () => {
        const operations = [
          suggested(1, RENT_ID),
          operation({ position: 2 }),
          operation({ position: 3 }),
          operation({ position: 4, status: 'pending' }),
        ];
        const decisions = acceptSuggestion(empty, operations[0], budgetLines);

        const plan = buildAttachmentPlan(decisions, operations, budgetLines);

        expect(plan).toEqual({ attached: 1, free: 2 });
        expect(buildPlanSummary(plan)).toEqual([
          { key: 'transactionImport.attachment.planAttachedOne', count: 1 },
          { key: 'transactionImport.attachment.planFreeMany', count: 2 },
        ]);
      });

      it('should say so when nothing is attached', () => {
        expect(buildPlanSummary({ attached: 0, free: 3 })).toEqual([
          {
            key: 'transactionImport.attachment.planNothingAttached',
            count: 3,
          },
        ]);
      });

      it('should hide the free part when everything is attached', () => {
        expect(buildPlanSummary({ attached: 2, free: 0 })).toEqual([
          { key: 'transactionImport.attachment.planAttachedMany', count: 2 },
        ]);
      });
    });

    describe('buildAttachmentViews', () => {
      it('should show a pending suggestion with its reasons', () => {
        const views = buildAttachmentViews(
          empty,
          [suggested(1, RENT_ID)],
          budgetLines,
        );

        expect(views.get(1)).toMatchObject({
          state: 'suggested',
          line: rent,
          reasonKeys: [
            'transactionImport.attachment.reason.kind',
            'transactionImport.attachment.reason.amount',
          ],
        });
      });

      it('should show an accepted suggestion as attached and a refused one as free', () => {
        const operations = [suggested(1, RENT_ID), suggested(2, GROCERIES_ID)];
        let decisions = acceptSuggestion(empty, operations[0], budgetLines);
        decisions = leaveFree(decisions, 2);

        const views = buildAttachmentViews(decisions, operations, budgetLines);

        expect(views.get(1)).toMatchObject({ state: 'attached', line: rent });
        expect(views.get(2)?.state).toBe('free');
      });

      it('should skip operations that will not be created or cannot be attached', () => {
        const views = buildAttachmentViews(
          empty,
          [
            operation({ position: 1, status: 'outside_period' }),
            operation({ position: 2, kind: 'income' }),
          ],
          [rent],
        );

        expect(views.size).toBe(0);
      });
    });
  });
});
