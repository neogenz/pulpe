import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { SupabaseDemoRepository } from './supabase-demo.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';

function createMockSupabase(
  fromFn: (table: string) => unknown,
): AuthenticatedSupabaseClient {
  return { from: fromFn } as unknown as AuthenticatedSupabaseClient;
}

describe('SupabaseDemoRepository', () => {
  let repo: SupabaseDemoRepository;

  beforeEach(() => {
    repo = new SupabaseDemoRepository();
  });

  describe('insertTemplates', () => {
    it('should return inserted template rows', async () => {
      const mockTemplates = [
        {
          id: 'tpl-1',
          user_id: 'user-1',
          name: 'Standard',
          description: null,
          is_default: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];
      const supabase = createMockSupabase(() => ({
        insert: () => ({
          select: jest
            .fn()
            .mockResolvedValue({ data: mockTemplates, error: null }),
        }),
      }));

      const result = await repo.insertTemplates(
        [
          {
            user_id: 'user-1',
            name: 'Standard',
            description: '',
            is_default: true,
          },
        ],
        supabase,
      );

      expect(result).toEqual(mockTemplates);
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
              user_id: 'user-1',
              name: 'Standard',
              description: '',
              is_default: true,
            },
          ],
          supabase,
        ),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('insertBudgetLines', () => {
    it('should resolve without calling supabase when rows is empty', async () => {
      const fromFn = jest.fn();
      const supabase = createMockSupabase(fromFn);

      await expect(
        repo.insertBudgetLines([], supabase),
      ).resolves.toBeUndefined();
      expect(fromFn).not.toHaveBeenCalled();
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
              budget_id: 'b-1',
              name: 'Test',
              amount: 'enc',
              kind: 'expense' as const,
              recurrence: 'fixed' as const,
              is_manually_adjusted: false,
              checked_at: null,
              exchange_rate: null,
              original_amount: null,
              original_currency: null,
              savings_goal_id: null,
              target_currency: null,
              template_line_id: null,
            },
          ],
          supabase,
        ),
      ).rejects.toThrow(BusinessException);
    });
  });

  describe('insertTransactions', () => {
    it('should resolve without calling supabase when rows is empty', async () => {
      const fromFn = jest.fn();
      const supabase = createMockSupabase(fromFn);

      await expect(
        repo.insertTransactions([], supabase),
      ).resolves.toBeUndefined();
      expect(fromFn).not.toHaveBeenCalled();
    });
  });
});
