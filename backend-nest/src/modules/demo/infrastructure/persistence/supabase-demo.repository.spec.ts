import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { SupabaseDemoRepository } from './supabase-demo.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { EncryptionPort } from '@modules/encryption/encryption.tokens';

function createMockSupabase(
  fromFn: (table: string) => unknown,
): AuthenticatedSupabaseClient {
  return { from: fromFn } as unknown as AuthenticatedSupabaseClient;
}

function buildMockEncryption(): EncryptionPort {
  return {
    ensureUserDEK: async () => Buffer.alloc(32),
    getUserDEK: async () => Buffer.alloc(32),
    encryptAmount: (n: number) => `enc-${n}`,
    decryptAmount: (s: string) => Number(s.replace('enc-', '')),
    tryDecryptAmount: (s: string | null, _dek: Buffer, fallback: unknown) => {
      if (!s) return fallback as number;
      return Number(s.replace('enc-', ''));
    },
    decryptRowAmountFields: (row: unknown) =>
      ({ ...(row as object), amount: 0, original_amount: null }) as unknown,
    prepareAmountData: async (n: number) => ({ amount: `enc-${n}` }),
    prepareAmountsData: async (amounts: number[]) =>
      amounts.map((n) => ({ amount: `enc-${n}` })),
    encryptOptionalAmount: async () => null,
  } as unknown as EncryptionPort;
}

describe('SupabaseDemoRepository', () => {
  let repo: SupabaseDemoRepository;
  let encryption: EncryptionPort;

  beforeEach(() => {
    encryption = buildMockEncryption();
    repo = new SupabaseDemoRepository(encryption);
  });

  describe('insertTemplates', () => {
    it('should map seeds to row inserts and return seeded ids', async () => {
      const captured: unknown[] = [];
      const supabase = createMockSupabase(() => ({
        insert: (rows: unknown) => {
          captured.push(rows);
          return {
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'tpl-1' }, { id: 'tpl-2' }],
              error: null,
            }),
          };
        },
      }));

      const result = await repo.insertTemplates(
        [
          {
            userId: 'user-1',
            name: 'Standard',
            description: 'desc',
            isDefault: true,
          },
          {
            userId: 'user-1',
            name: 'Vacation',
            description: 'desc2',
            isDefault: false,
          },
        ],
        supabase,
      );

      expect(result).toEqual([{ id: 'tpl-1' }, { id: 'tpl-2' }]);
      expect(captured[0]).toMatchObject([
        { user_id: 'user-1', name: 'Standard', is_default: true },
        { user_id: 'user-1', name: 'Vacation', is_default: false },
      ]);
    });

    it('should throw BusinessException on supabase error', async () => {
      const supabase = createMockSupabase(() => ({
        insert: () => ({
          select: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection refused' },
          }),
        }),
      }));

      await expect(
        repo.insertTemplates(
          [
            {
              userId: 'user-1',
              name: 'Standard',
              description: '',
              isDefault: true,
            },
          ],
          supabase,
        ),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('insertCanonicalTemplateLines', () => {
    it('should encrypt amounts and decrypt them back on the seeded result', async () => {
      const inserted: unknown[] = [];
      const supabase = createMockSupabase(() => ({
        insert: (rows: unknown) => {
          inserted.push(rows);
          const insertedRows = rows as Array<{
            template_id: string;
            name: string;
            amount: string;
            kind: 'income' | 'expense' | 'saving';
            recurrence: 'fixed' | 'one_off';
          }>;
          return {
            select: jest.fn().mockResolvedValue({
              data: insertedRows.map((r, i) => ({
                ...r,
                id: `tl-${i}`,
              })),
              error: null,
            }),
          };
        },
      }));

      const result = await repo.insertCanonicalTemplateLines(
        {
          standardId: 'tpl-1',
          vacationId: 'tpl-2',
          savingsId: 'tpl-3',
          holidayId: 'tpl-4',
        },
        'user-1',
        supabase,
      );

      expect(result.length).toBeGreaterThan(0);
      for (const line of result) {
        expect(typeof line.amount).toBe('number');
        expect(line.amount).toBeGreaterThan(0);
      }

      const insertedFlat = inserted[0] as Array<{ amount: string }>;
      for (const row of insertedFlat) {
        expect(row.amount).toMatch(/^enc-/);
      }
    });
  });

  describe('insertBudgets', () => {
    it('should map seeds to row inserts and return seeded ids', async () => {
      const supabase = createMockSupabase(() => ({
        insert: () => ({
          select: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'b-1',
                month: 5,
                year: 2026,
                template_id: 'tpl-1',
              },
            ],
            error: null,
          }),
        }),
      }));

      const result = await repo.insertBudgets(
        [
          {
            userId: 'user-1',
            month: 5,
            year: 2026,
            description: 'May',
            templateId: 'tpl-1',
          },
        ],
        supabase,
      );

      expect(result).toEqual([
        { id: 'b-1', month: 5, year: 2026, templateId: 'tpl-1' },
      ]);
    });
  });

  describe('insertBudgetLines', () => {
    it('should resolve without calling supabase when seeds are empty', async () => {
      const fromFn = jest.fn();
      const supabase = createMockSupabase(fromFn);

      await expect(
        repo.insertBudgetLines([], 'user-1', supabase),
      ).resolves.toBeUndefined();
      expect(fromFn).not.toHaveBeenCalled();
    });

    it('should encrypt amount before insert', async () => {
      const captured: unknown[] = [];
      const supabase = createMockSupabase(() => ({
        insert: (rows: unknown) => {
          captured.push(rows);
          return Promise.resolve({ error: null });
        },
      }));

      await repo.insertBudgetLines(
        [
          {
            budgetId: 'b-1',
            templateLineId: 'tl-1',
            name: 'Test',
            amount: 100,
            kind: 'expense',
            recurrence: 'fixed',
          },
        ],
        'user-1',
        supabase,
      );

      const inserted = captured[0] as Array<{
        amount: string;
        budget_id: string;
      }>;
      expect(inserted[0].amount).toBe('enc-100');
      expect(inserted[0].budget_id).toBe('b-1');
    });

    it('should throw BusinessException on supabase error', async () => {
      const supabase = createMockSupabase(() => ({
        insert: jest
          .fn()
          .mockResolvedValue({ error: { message: 'Insert failed' } }),
      }));

      await expect(
        repo.insertBudgetLines(
          [
            {
              budgetId: 'b-1',
              templateLineId: null,
              name: 'Test',
              amount: 50,
              kind: 'expense',
              recurrence: 'fixed',
            },
          ],
          'user-1',
          supabase,
        ),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('insertTransactions', () => {
    it('should resolve without calling supabase when seeds are empty', async () => {
      const fromFn = jest.fn();
      const supabase = createMockSupabase(fromFn);

      await expect(
        repo.insertTransactions([], 'user-1', supabase),
      ).resolves.toBeUndefined();
      expect(fromFn).not.toHaveBeenCalled();
    });

    it('should encrypt amount before insert', async () => {
      const captured: unknown[] = [];
      const supabase = createMockSupabase(() => ({
        insert: (rows: unknown) => {
          captured.push(rows);
          return Promise.resolve({ error: null });
        },
      }));

      await repo.insertTransactions(
        [
          {
            budgetId: 'b-1',
            name: 'Coffee',
            amount: 4.5,
            kind: 'expense',
            category: 'Food',
            transactionDate: '2026-05-08T12:00:00Z',
          },
        ],
        'user-1',
        supabase,
      );

      const inserted = captured[0] as Array<{ amount: string; name: string }>;
      expect(inserted[0].amount).toBe('enc-4.5');
      expect(inserted[0].name).toBe('Coffee');
    });
  });
});
