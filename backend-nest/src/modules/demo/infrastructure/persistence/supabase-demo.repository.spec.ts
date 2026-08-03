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
    ensureDemoUserDEK: async () => Buffer.alloc(32),
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
    function createBudgetLineSupabase(captured: unknown[]) {
      return createMockSupabase(() => ({
        insert: (rows: unknown) => {
          captured.push(rows);
          const insertedRows = rows as Array<Record<string, unknown>>;
          return {
            select: jest.fn().mockResolvedValue({
              data: insertedRows.map((r, i) => ({ ...r, id: `bl-${i}` })),
              error: null,
            }),
          };
        },
      }));
    }

    it('should resolve to an empty list without calling supabase when seeds are empty', async () => {
      const fromFn = jest.fn();
      const supabase = createMockSupabase(fromFn);

      await expect(
        repo.insertBudgetLines([], 'user-1', supabase),
      ).resolves.toEqual([]);
      expect(fromFn).not.toHaveBeenCalled();
    });

    it('should encrypt amount before insert', async () => {
      const captured: unknown[] = [];
      const supabase = createBudgetLineSupabase(captured);

      await repo.insertBudgetLines(
        [
          {
            budgetId: 'b-1',
            templateLineId: 'tl-1',
            name: 'Test',
            amount: 100,
            kind: 'expense',
            recurrence: 'fixed',
            checkedAt: null,
            spreadGroupId: null,
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

    it('should write the spread group id in clear, never encrypted', async () => {
      const captured: unknown[] = [];
      const supabase = createBudgetLineSupabase(captured);

      await repo.insertBudgetLines(
        [
          {
            budgetId: 'b-1',
            templateLineId: null,
            name: 'Prime assurance auto',
            amount: 180.84,
            kind: 'expense',
            recurrence: 'one_off',
            checkedAt: null,
            spreadGroupId: 'group-uuid',
          },
        ],
        'user-1',
        supabase,
      );

      const inserted = captured[0] as Array<{ spread_group_id: string | null }>;
      expect(inserted[0].spread_group_id).toBe('group-uuid');
    });

    it('should persist the seeded pointage instead of forcing it unchecked', async () => {
      const captured: unknown[] = [];
      const supabase = createBudgetLineSupabase(captured);

      await repo.insertBudgetLines(
        [
          {
            budgetId: 'b-1',
            templateLineId: 'tl-1',
            name: 'Closed month',
            amount: 100,
            kind: 'expense',
            recurrence: 'fixed',
            checkedAt: '2026-05-31T00:00:00.000Z',
            spreadGroupId: null,
          },
          {
            budgetId: 'b-2',
            templateLineId: 'tl-2',
            name: 'Open month',
            amount: 50,
            kind: 'expense',
            recurrence: 'fixed',
            checkedAt: null,
            spreadGroupId: null,
          },
        ],
        'user-1',
        supabase,
      );

      const inserted = captured[0] as Array<{ checked_at: string | null }>;
      expect(inserted[0].checked_at).toBe('2026-05-31T00:00:00.000Z');
      expect(inserted[1].checked_at).toBeNull();
    });

    it('should return the inserted lines with their generated id', async () => {
      const supabase = createBudgetLineSupabase([]);

      const result = await repo.insertBudgetLines(
        [
          {
            budgetId: 'b-1',
            templateLineId: 'tl-1',
            name: 'Courses alimentaires',
            amount: 600,
            kind: 'expense',
            recurrence: 'one_off',
            checkedAt: null,
            spreadGroupId: null,
          },
        ],
        'user-1',
        supabase,
      );

      expect(result).toEqual([
        {
          id: 'bl-0',
          budgetId: 'b-1',
          name: 'Courses alimentaires',
          kind: 'expense',
        },
      ]);
    });

    it('should throw BusinessException on supabase error', async () => {
      const supabase = createMockSupabase(() => ({
        insert: () => ({
          select: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Insert failed' },
          }),
        }),
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
              checkedAt: null,
              spreadGroupId: null,
            },
          ],
          'user-1',
          supabase,
        ),
      ).rejects.toThrow(BusinessException);
    });

    /**
     * postgrest-js turns a bodyless 404 into a 204 and leaves both fields null,
     * so an errorless null is a real answer, not a typing artefact. Returning
     * the empty list would hand every later step zero envelopes and seed the
     * blank demo this module exists to prevent.
     */
    it('should throw when supabase returns no rows and no error', async () => {
      const supabase = createMockSupabase(() => ({
        insert: () => ({
          select: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
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
              checkedAt: null,
              spreadGroupId: null,
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

    it('should encrypt amount before insert and link the seeded tag', async () => {
      const capturedTransactions: unknown[] = [];
      const capturedTags: unknown[] = [];
      const capturedLinks: unknown[] = [];
      const supabase = createMockSupabase((table: string) => {
        if (table === 'transaction') {
          return {
            insert: (rows: unknown) => {
              capturedTransactions.push(rows);
              return {
                select: () =>
                  Promise.resolve({ data: [{ id: 'tx-1' }], error: null }),
              };
            },
          };
        }
        if (table === 'tag') {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
            insert: (rows: unknown) => {
              capturedTags.push(rows);
              return {
                select: () =>
                  Promise.resolve({
                    data: [{ id: 'tag-1', name: 'Food' }],
                    error: null,
                  }),
              };
            },
          };
        }
        return {
          insert: (rows: unknown) => {
            capturedLinks.push(rows);
            return Promise.resolve({ error: null });
          },
        };
      });

      await repo.insertTransactions(
        [
          {
            budgetId: 'b-1',
            budgetLineId: 'bl-9',
            name: 'Coffee',
            amount: 4.5,
            kind: 'expense',
            tagName: 'Food',
            transactionDate: '2026-05-08T12:00:00Z',
            checkedAt: '2026-05-08T12:00:00Z',
          },
        ],
        'user-1',
        supabase,
      );

      const inserted = capturedTransactions[0] as Array<{
        amount: string;
        name: string;
        budget_line_id: string | null;
        checked_at: string | null;
      }>;
      expect(inserted[0].amount).toBe('enc-4.5');
      expect(inserted[0].name).toBe('Coffee');
      expect(inserted[0].budget_line_id).toBe('bl-9');
      expect(inserted[0].checked_at).toBe('2026-05-08T12:00:00Z');
      expect(capturedTags[0]).toEqual([{ user_id: 'user-1', name: 'Food' }]);
      expect(capturedLinks[0]).toEqual([
        { transaction_id: 'tx-1', tag_id: 'tag-1' },
      ]);
    });

    it('should reuse an existing tag with different case', async () => {
      const capturedTags: unknown[] = [];
      const capturedLinks: unknown[] = [];
      const filterByOwner = jest.fn().mockResolvedValue({
        data: [{ id: 'tag-existing', name: 'courses' }],
        error: null,
      });
      const supabase = createMockSupabase((table: string) => {
        if (table === 'transaction') {
          return {
            insert: () => ({
              select: () =>
                Promise.resolve({ data: [{ id: 'tx-1' }], error: null }),
            }),
          };
        }
        if (table === 'tag') {
          return {
            select: () => ({
              eq: filterByOwner,
            }),
            insert: (rows: unknown) => {
              capturedTags.push(rows);
              return {
                select: () =>
                  Promise.resolve({
                    data: null,
                    error: { code: '23505', message: 'duplicate tag' },
                  }),
              };
            },
          };
        }
        return {
          insert: (rows: unknown) => {
            capturedLinks.push(rows);
            return Promise.resolve({ error: null });
          },
        };
      });

      await repo.insertTransactions(
        [
          {
            budgetId: 'b-1',
            budgetLineId: null,
            name: 'Supermarket',
            amount: 42,
            kind: 'expense',
            tagName: 'Courses',
            transactionDate: '2026-05-08T12:00:00Z',
            checkedAt: null,
          },
        ],
        'user-1',
        supabase,
      );

      expect(filterByOwner).toHaveBeenCalledWith('user_id', 'user-1');
      expect(capturedTags).toHaveLength(0);
      expect(capturedLinks[0]).toEqual([
        { transaction_id: 'tx-1', tag_id: 'tag-existing' },
      ]);
    });
  });

  describe('insertSavingsGoals', () => {
    const housingGoal = {
      userId: 'user-1',
      name: 'Apport logement',
      targetAmount: 80000,
      initialAmount: 15000,
      status: 'ACTIVE' as const,
      startDate: '2026-02-01',
      targetDate: '2027-08-01',
    };

    it('should resolve to an empty list without calling supabase when seeds are empty', async () => {
      const fromFn = jest.fn();
      const supabase = createMockSupabase(fromFn);

      await expect(
        repo.insertSavingsGoals([], 'user-1', supabase),
      ).resolves.toEqual([]);
      expect(fromFn).not.toHaveBeenCalled();
    });

    it('should encrypt both amounts before insert and return the seeded goals', async () => {
      const captured: unknown[] = [];
      const supabase = createMockSupabase(() => ({
        insert: (rows: unknown) => {
          captured.push(rows);
          const insertedRows = rows as Array<Record<string, unknown>>;
          return {
            select: jest.fn().mockResolvedValue({
              data: insertedRows.map((r, i) => ({ ...r, id: `goal-${i}` })),
              error: null,
            }),
          };
        },
      }));

      const result = await repo.insertSavingsGoals(
        [housingGoal],
        'user-1',
        supabase,
      );

      const inserted = captured[0] as Array<{
        target_amount: string;
        initial_amount: string;
        created_at: string | undefined;
        start_date: string | null;
        target_date: string | null;
      }>;
      expect(inserted[0].target_amount).toBe('enc-80000');
      expect(inserted[0].initial_amount).toBe('enc-15000');
      expect(inserted[0].start_date).toBe('2026-02-01');
      expect(inserted[0].target_date).toBe('2027-08-01');
      expect(inserted[0].created_at).toBe('2026-02-01');
      expect(result).toEqual([{ id: 'goal-0', name: 'Apport logement' }]);
    });

    it('should throw BusinessException on supabase error', async () => {
      const supabase = createMockSupabase(() => ({
        insert: () => ({
          select: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Insert failed' },
          }),
        }),
      }));

      await expect(
        repo.insertSavingsGoals([housingGoal], 'user-1', supabase),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('linkBudgetLinesToSavingsGoal', () => {
    it('should resolve without calling supabase when no line feeds the goal', async () => {
      const fromFn = jest.fn();
      const supabase = createMockSupabase(fromFn);

      await expect(
        repo.linkBudgetLinesToSavingsGoal([], 'goal-1', supabase),
      ).resolves.toBeUndefined();
      expect(fromFn).not.toHaveBeenCalled();
    });

    it('should point the given lines at the goal', async () => {
      const captured: unknown[] = [];
      const filterByIds = jest.fn().mockResolvedValue({ error: null });
      const supabase = createMockSupabase(() => ({
        update: (values: unknown) => {
          captured.push(values);
          return { in: filterByIds };
        },
      }));

      await repo.linkBudgetLinesToSavingsGoal(
        ['bl-1', 'bl-2'],
        'goal-1',
        supabase,
      );

      expect(captured[0]).toEqual({ savings_goal_id: 'goal-1' });
      expect(filterByIds).toHaveBeenCalledWith('id', ['bl-1', 'bl-2']);
    });

    it('should throw BusinessException on supabase error', async () => {
      const supabase = createMockSupabase(() => ({
        update: () => ({
          in: jest.fn().mockResolvedValue({ error: { message: 'nope' } }),
        }),
      }));

      await expect(
        repo.linkBudgetLinesToSavingsGoal(['bl-1'], 'goal-1', supabase),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('linkTemplateLinesToSavingsGoal', () => {
    it('should resolve without calling supabase when no recurring line feeds the goal', async () => {
      const fromFn = jest.fn();
      const supabase = createMockSupabase(fromFn);

      await expect(
        repo.linkTemplateLinesToSavingsGoal([], 'goal-1', supabase),
      ).resolves.toBeUndefined();
      expect(fromFn).not.toHaveBeenCalled();
    });

    it('should point the given Mois Type lines at the goal', async () => {
      const captured: unknown[] = [];
      const tables: unknown[] = [];
      const filterByIds = jest.fn().mockResolvedValue({ error: null });
      const supabase = createMockSupabase((table: unknown) => {
        tables.push(table);
        return {
          update: (values: unknown) => {
            captured.push(values);
            return { in: filterByIds };
          },
        };
      });

      await repo.linkTemplateLinesToSavingsGoal(
        ['tl-1', 'tl-2'],
        'goal-1',
        supabase,
      );

      expect(tables[0]).toBe('template_line');
      expect(captured[0]).toEqual({ savings_goal_id: 'goal-1' });
      expect(filterByIds).toHaveBeenCalledWith('id', ['tl-1', 'tl-2']);
    });

    it('should throw BusinessException on supabase error', async () => {
      const supabase = createMockSupabase(() => ({
        update: () => ({
          in: jest.fn().mockResolvedValue({ error: { message: 'nope' } }),
        }),
      }));

      await expect(
        repo.linkTemplateLinesToSavingsGoal(['tl-1'], 'goal-1', supabase),
      ).rejects.toThrow(BusinessException);
    });
  });
});
