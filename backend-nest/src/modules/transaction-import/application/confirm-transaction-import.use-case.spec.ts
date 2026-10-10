import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { CacheService } from '@modules/cache/cache.service';
import type { BudgetRecalculationPort } from '@modules/budget/domain/ports/budget-recalculation.port';
import type { UserRepositoryPort } from '@modules/user/domain/ports/user-repository.port';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { InfoLogger } from '@common/logger';
import { Camt053Parser } from '../infrastructure/parsers/camt053.parser';
import type { TransactionImportRepositoryPort } from '../domain/ports/transaction-import-repository.port';
import type {
  AttachableLine,
  PlannedImport,
} from '../domain/transaction-import.entity';
import { TransactionImportAnalyzer } from './transaction-import-analyzer';
import { PreviewTransactionImportUseCase } from './preview-transaction-import.use-case';
import { ConfirmTransactionImportUseCase } from './confirm-transaction-import.use-case';

const sample = readFileSync(
  join(
    import.meta.dir,
    '../infrastructure/parsers/__fixtures__/camt053-001-04.xml',
  ),
  'utf8',
);

const BUDGET_ID = '11111111-1111-4111-8111-111111111111';
const SALARY_LINE: AttachableLine = {
  id: 'a1111111-1111-4111-8111-111111111111',
  name: 'Salaire',
  kind: 'income',
  amount: 5200,
};
const GROCERIES_LINE: AttachableLine = {
  id: 'a2222222-2222-4222-8222-222222222222',
  name: 'Courses',
  kind: 'expense',
  amount: 600,
};
const CAFE_LINE: AttachableLine = {
  id: 'a3333333-3333-4333-8333-333333333333',
  name: 'Café',
  kind: 'expense',
  amount: 50,
};
const SAVING_LINE: AttachableLine = {
  id: 'a4444444-4444-4444-8444-444444444444',
  name: 'Épargne vacances',
  kind: 'saving',
  amount: 150,
};
const LINES = [SALARY_LINE, GROCERIES_LINE, CAFE_LINE, SAVING_LINE];
const user = { id: 'user-1' } as AuthenticatedUser;
const logger: InfoLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  debug: mock(() => {}),
  trace: mock(() => {}),
} as unknown as InfoLogger;

function setup(
  options: { imported?: string[]; currency?: 'CHF' | 'EUR' } = {},
) {
  const inserted: PlannedImport[][] = [];
  const repo = {
    findTargetBudget: mock(async () => ({
      id: BUDGET_ID,
      month: 3,
      year: 2026,
    })),
    findAttachableLines: mock(async () => LINES),
    // Deterministic stand-in for the keyed hash: unique per material.
    fingerprint: mock((materials: readonly string[]) =>
      materials.map((material) => `fp:${material}`),
    ),
    findImportedFingerprints: mock(
      async (fingerprints: readonly string[]) =>
        new Set(
          fingerprints.filter((fp) =>
            (options.imported ?? []).some((ref) => fp.includes(ref)),
          ),
        ),
    ),
    insertAll: mock(
      async (_budgetId: string, planned: readonly PlannedImport[]) => {
        inserted.push([...planned]);
      },
    ),
  } satisfies TransactionImportRepositoryPort;
  const users = {
    findSettings: mock(async () => ({
      payDayOfMonth: null,
      currency: options.currency ?? 'CHF',
      showCurrencySelector: false,
    })),
  } as unknown as UserRepositoryPort;
  const cache = { invalidateForUser: mock(async () => {}) };
  const recalculation = { recalculate: mock(async () => {}) };

  const analyzer = new TransactionImportAnalyzer(
    [new Camt053Parser()],
    repo,
    users,
    logger,
  );
  return {
    repo,
    cache,
    recalculation,
    inserted,
    preview: new PreviewTransactionImportUseCase(analyzer),
    confirm: new ConfirmTransactionImportUseCase(
      analyzer,
      repo,
      cache as unknown as CacheService,
      recalculation as BudgetRecalculationPort,
      logger,
    ),
  };
}

async function captureError(
  promise: Promise<unknown>,
): Promise<BusinessException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof BusinessException) return error;
    throw error;
  }
  throw new Error('expected a BusinessException');
}

describe('PreviewTransactionImportUseCase', () => {
  it('lists every recognised operation with what the import will do', async () => {
    const { preview, repo } = setup();

    const result = await preview.execute(sample, BUDGET_ID);

    expect(result.format).toBe('camt053');
    expect(result.currency).toBe('CHF');
    expect(result.period).toEqual({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });
    expect(result.errors).toEqual([]);
    expect(
      result.operations.map(({ position, name, kind, status }) => ({
        position,
        name,
        kind,
        status,
      })),
    ).toEqual([
      { position: 1, name: 'Exemple SA', kind: 'income', status: 'new' },
      {
        position: 2,
        name: 'Supermarché du Centre',
        kind: 'expense',
        status: 'new',
      },
      {
        position: 3,
        name: 'TWINT Café de la Gare',
        kind: 'expense',
        status: 'new',
      },
      {
        position: 4,
        name: 'TWINT Café de la Gare',
        kind: 'expense',
        status: 'new',
      },
      {
        position: 5,
        name: 'ORDRE GROUPE 2 PAIEMENTS',
        kind: 'expense',
        status: 'new',
      },
      {
        position: 6,
        name: 'RESERVATION CARTE STATION SERVICE',
        kind: 'expense',
        status: 'pending',
      },
    ]);
    expect(repo.insertAll).not.toHaveBeenCalled();
  });

  it('suggests a Prévision per new operation and says why (CA4)', async () => {
    const { preview } = setup();

    const result = await preview.execute(sample, BUDGET_ID);

    expect(result.budgetLines).toEqual(LINES);
    expect(result.operations.map((op) => op.suggestion)).toEqual([
      { budgetLineId: SALARY_LINE.id, reasons: ['kind', 'amount'] },
      null,
      { budgetLineId: CAFE_LINE.id, reasons: ['kind', 'label'] },
      { budgetLineId: CAFE_LINE.id, reasons: ['kind', 'label'] },
      { budgetLineId: SAVING_LINE.id, reasons: ['kind', 'amount'] },
      // Pending: it will not be created, so nothing is suggested for it.
      null,
    ]);
  });

  it('marks what a previous import already created', async () => {
    const { preview } = setup({ imported: ['20260325000123456'] });

    const result = await preview.execute(sample, BUDGET_ID);

    expect(result.operations[0].status).toBe('already_imported');
    expect(result.operations[1].status).toBe('new');
  });

  it('matches a bank reference within its own account only', async () => {
    const entry = `<Ntry>
      <Amt Ccy="CHF">10.00</Amt><CdtDbtInd>DBIT</CdtDbtInd><Sts>BOOK</Sts>
      <BookgDt><Dt>2026-03-02</Dt></BookgDt><AcctSvcrRef>SAME-REF</AcctSvcrRef>
      <AddtlNtryInf>Paiement</AddtlNtryInf>
    </Ntry>`;
    const twoAccounts = `<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.04">
  <BkToCstmrStmt>
    <Stmt><Acct><Id><IBAN>CH11</IBAN></Id></Acct>${entry}</Stmt>
    <Stmt><Acct><Id><IBAN>CH22</IBAN></Id></Acct>${entry}</Stmt>
  </BkToCstmrStmt>
</Document>`;
    const { preview } = setup({ imported: ['CH11\u001fref:SAME-REF'] });

    const result = await preview.execute(twoAccounts, BUDGET_ID);

    expect(result.operations.map((op) => op.status)).toEqual([
      'already_imported',
      'new',
    ]);
  });

  it('flags an unknown format without guessing', async () => {
    const { preview } = setup();

    const result = await preview.execute('Date;Libellé;Montant\n', BUDGET_ID);

    expect(result).toMatchObject({
      format: null,
      operations: [],
      errors: [{ code: 'unsupported_format', position: null }],
    });
  });

  it('flags a broken camt.053 as malformed', async () => {
    const { preview } = setup();

    const result = await preview.execute(sample.slice(0, 500), BUDGET_ID);

    expect(result.errors).toEqual([{ code: 'malformed_file', position: null }]);
  });

  it('refuses a statement in another currency than the user’s', async () => {
    const { preview } = setup({ currency: 'EUR' });

    const result = await preview.execute(sample, BUDGET_ID);

    expect(result.errors).toEqual([
      { code: 'currency_mismatch', position: null },
    ]);
  });
});

describe('ConfirmTransactionImportUseCase', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup({ imported: ['20260304000987654'] });
  });

  it('creates the new booked operations in one batch, then refreshes the budget', async () => {
    const result = await ctx.confirm.execute(sample, BUDGET_ID, [], user);

    expect(result).toEqual({
      createdCount: 4,
      attachedCount: 0,
      skippedCount: 2,
    });
    expect(ctx.inserted).toHaveLength(1);
    expect(ctx.inserted[0].map((candidate) => candidate.position)).toEqual([
      1, 3, 4, 5,
    ]);
    expect(ctx.cache.invalidateForUser).toHaveBeenCalledWith('user-1');
    expect(ctx.recalculation.recalculate).toHaveBeenCalledWith(BUDGET_ID);
  });

  it('attaches and checks only the decisions the user sent (CA5, CA6)', async () => {
    ctx = setup();
    const result = await ctx.confirm.execute(
      sample,
      BUDGET_ID,
      [
        { position: 1, budgetLineId: SALARY_LINE.id },
        // Not the suggested Prévision: the user's choice wins.
        { position: 2, budgetLineId: SAVING_LINE.id },
      ],
      user,
    );

    expect(result).toEqual({
      createdCount: 5,
      attachedCount: 2,
      skippedCount: 1,
    });
    const byPosition = new Map(
      ctx.inserted[0].map((entry) => [entry.position, entry]),
    );
    expect(byPosition.get(1)).toMatchObject({
      kind: 'income',
      budgetLineId: SALARY_LINE.id,
      checkedAt: expect.any(String),
    });
    expect(byPosition.get(2)).toMatchObject({
      kind: 'saving',
      budgetLineId: SAVING_LINE.id,
      checkedAt: expect.any(String),
    });
    // Suggested but never accepted: stays a free, unchecked Réel.
    expect(byPosition.get(3)).toMatchObject({
      kind: 'expense',
      budgetLineId: null,
      checkedAt: null,
    });
  });

  it.each([
    ['an operation that will not be created', 6, CAFE_LINE.id],
    ['a Prévision that is gone', 2, 'a9999999-9999-4999-8999-999999999999'],
    ['a Prévision of an incompatible type', 1, GROCERIES_LINE.id],
  ])(
    'refuses the whole import for a decision on %s',
    async (_case, position, budgetLineId) => {
      const error = await captureError(
        ctx.confirm.execute(
          sample,
          BUDGET_ID,
          [{ position, budgetLineId }],
          user,
        ),
      );

      expect(error.code).toBe(
        ERROR_DEFINITIONS.TRANSACTION_IMPORT_INVALID.code,
      );
      expect(ctx.repo.insertAll).not.toHaveBeenCalled();
    },
  );

  it('writes nothing while the file has a blocking error', async () => {
    const broken = sample.replace(
      '<Amt Ccy="CHF">84.35</Amt>',
      '<Amt Ccy="CHF">abc</Amt>',
    );

    const error = await captureError(
      ctx.confirm.execute(broken, BUDGET_ID, [], user),
    );

    expect(error.code).toBe(ERROR_DEFINITIONS.TRANSACTION_IMPORT_INVALID.code);
    expect(ctx.repo.insertAll).not.toHaveBeenCalled();
    expect(ctx.recalculation.recalculate).not.toHaveBeenCalled();
  });

  it('writes nothing when every operation was already imported', async () => {
    ctx = setup({
      imported: [
        '20260325000123456',
        '20260304000987654',
        '20260315000555000',
        'op:',
      ],
    });

    const result = await ctx.confirm.execute(sample, BUDGET_ID, [], user);

    expect(result).toEqual({
      createdCount: 0,
      attachedCount: 0,
      skippedCount: 6,
    });
    expect(ctx.repo.insertAll).not.toHaveBeenCalled();
    expect(ctx.recalculation.recalculate).not.toHaveBeenCalled();
  });

  it('lets a concurrent-import conflict through untouched', async () => {
    const conflict = new BusinessException(
      ERROR_DEFINITIONS.TRANSACTION_IMPORT_CONFLICT,
    );
    ctx.repo.insertAll.mockImplementationOnce(async () => {
      throw conflict;
    });

    const error = await captureError(
      ctx.confirm.execute(sample, BUDGET_ID, [], user),
    );

    expect(error).toBe(conflict);
    expect(ctx.recalculation.recalculate).not.toHaveBeenCalled();
  });

  it('reports a failed recalculation as a partial failure after the write', async () => {
    ctx.recalculation.recalculate.mockImplementationOnce(async () => {
      throw new Error('boom');
    });

    const error = await captureError(
      ctx.confirm.execute(sample, BUDGET_ID, [], user),
    );

    expect(error.code).toBe(
      ERROR_DEFINITIONS.TRANSACTION_IMPORT_RECALCULATION_FAILED.code,
    );
    expect(ctx.cache.invalidateForUser).toHaveBeenCalled();
  });
});
