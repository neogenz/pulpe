import { describe, it, expect, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { SupabaseBudgetTemplateRepository } from './supabase-budget-template.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import type {
  TemplateLineRow,
  TemplateRow,
} from '../../domain/budget-template.entity';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { EncryptionPort } from '@modules/encryption/encryption.tokens';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { InfoLogger } from '@common/logger';

const VALID_CIPHERTEXT =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
const LINE_ONE_ID = '8a0f6c80-1234-4e5f-89ab-111111111111';
const LINE_TWO_ID = '8a0f6c80-1234-4e5f-89ab-222222222222';
const TAG_ONE_ID = '8a0f6c80-1234-4e5f-89ab-333333333333';
const TAG_TWO_ID = '8a0f6c80-1234-4e5f-89ab-444444444444';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('client-key'),
};

const mockTemplateRow: TemplateRow = {
  id: 'template-1',
  user_id: 'user-1',
  name: 'Standard',
  description: 'Default',
  is_default: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const mockTemplateLineRow: TemplateLineRow = {
  id: 'line-1',
  template_id: 'template-1',
  savings_goal_id: null,
  name: 'Loyer',
  amount: VALID_CIPHERTEXT,
  original_amount: null,
  original_currency: null,
  target_currency: null,
  exchange_rate: null,
  kind: 'expense',
  recurrence: 'fixed',
  description: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function createMockProvider(
  fromFn: (table: string) => unknown,
  rpcFn?: jest.Mock,
): AuthenticatedSupabaseProvider {
  const client = {
    from: fromFn,
    rpc: rpcFn ?? jest.fn(),
  } as unknown as AuthenticatedSupabaseClient;

  return {
    get client() {
      return client;
    },
    get user() {
      return mockUser;
    },
  } as unknown as AuthenticatedSupabaseProvider;
}

function createMockEncryption(): EncryptionPort {
  return {
    getUserDEK: jest.fn().mockResolvedValue(Buffer.from('dek')),
    ensureUserDEK: jest.fn().mockResolvedValue(Buffer.from('dek')),
    getDekFor: jest.fn().mockResolvedValue(Buffer.from('dek')),
    decryptAmount: jest.fn().mockReturnValue(5000),
    tryDecryptAmount: jest.fn().mockReturnValue(5000),
    encryptAmount: jest.fn().mockReturnValue(VALID_CIPHERTEXT),
    decryptRowAmountFields: jest.fn().mockImplementation((row) => ({
      ...row,
      amount: 5000,
      original_amount: null,
    })),
    prepareAmountData: jest
      .fn()
      .mockResolvedValue({ amount: VALID_CIPHERTEXT }),
    prepareAmountsData: jest
      .fn()
      .mockResolvedValue([{ amount: VALID_CIPHERTEXT }]),
    encryptOptionalAmount: jest.fn().mockResolvedValue(null),
  } as unknown as EncryptionPort;
}

function createMockLogger(): InfoLogger {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    trace: jest.fn(),
  } as unknown as InfoLogger;
}

describe('SupabaseBudgetTemplateRepository', () => {
  describe('findById', () => {
    it('should return entity on success', async () => {
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest
              .fn()
              .mockResolvedValue({ data: mockTemplateRow, error: null }),
          }),
        }),
      }));
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.findById('template-1', 'user-1');

      expect(result.id).toBe('template-1');
      expect(result.name).toBe('Standard');
      expect(result.userId).toBe('user-1');
    });

    it('should throw BusinessException when not found', async () => {
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      }));
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(repo.findById('missing', 'user-1')).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('validateAccess', () => {
    it('should throw TEMPLATE_ACCESS_FORBIDDEN when user_id mismatches', async () => {
      const provider = createMockProvider(() => ({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: { ...mockTemplateRow, user_id: 'other-user' },
              error: null,
            }),
          }),
        }),
      }));
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(repo.validateAccess('template-1', 'user-1')).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('insertLine', () => {
    it('should create the line and tags in one atomic RPC', async () => {
      const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
      const from = jest.fn(() => ({
        select: () => ({
          in: jest
            .fn()
            .mockImplementation((_column: string, ids: string[]) => ({
              data: [
                {
                  ...mockTemplateLineRow,
                  id: ids[0],
                  template_line_tag: [{ tag_id: TAG_ONE_ID }],
                },
              ],
              error: null,
            })),
        }),
      }));
      const provider = createMockProvider(from, rpc as unknown as jest.Mock);
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.insertLine({
          templateId: 'template-1',
          name: 'Loyer',
          amount: 1200,
          kind: 'expense',
          recurrence: 'fixed',
          description: '',
          tagIds: [TAG_ONE_ID],
        }),
      ).resolves.toMatchObject({ tagIds: [TAG_ONE_ID] });

      const rpcArgs = rpc.mock.calls[0]?.[1] as {
        p_created_lines: Array<{ id: string }>;
        p_line_tag_pairs: Array<{
          template_line_id: string;
          tag_ids: string[];
        }>;
      };
      expect(rpc).toHaveBeenCalledWith(
        'apply_template_line_operations_with_tags',
        expect.objectContaining({
          p_template_id: 'template-1',
          p_budget_ids: [],
          p_delete_ids: [],
          p_updated_lines: [],
        }),
      );
      expect(rpcArgs.p_line_tag_pairs).toEqual([
        {
          template_line_id: rpcArgs.p_created_lines[0].id,
          tag_ids: [TAG_ONE_ID],
        },
      ]);
      expect(from).toHaveBeenCalledTimes(1);
    });

    it('should map tag-link failures without direct insert or cleanup queries', async () => {
      const tagError = { code: '23503', message: 'FK violation' };
      const from = jest.fn();
      const rpc = jest.fn().mockResolvedValue({ data: null, error: tagError });
      const provider = createMockProvider(from, rpc as unknown as jest.Mock);
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.insertLine({
          templateId: 'template-1',
          name: 'Loyer',
          amount: 1200,
          kind: 'expense',
          recurrence: 'fixed',
          description: '',
          tagIds: [TAG_TWO_ID],
        }),
      ).rejects.toMatchObject({
        code: 'ERR_TAG_NOT_FOUND',
        loggingContext: { operation: 'insertLine' },
      });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(from).not.toHaveBeenCalled();
    });
  });

  describe('updateLine', () => {
    it('should update scalar fields and tags in one atomic RPC', async () => {
      const from = jest.fn();
      const rpc = jest
        .fn()
        .mockResolvedValue({ data: mockTemplateLineRow, error: null });
      const provider = createMockProvider(from, rpc);
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.updateLine('line-1', {
        name: 'Updated',
        amount: 4500,
        tagIds: [TAG_ONE_ID],
      });

      expect(rpc).toHaveBeenCalledWith('update_template_line_with_tags', {
        p_template_line_id: 'line-1',
        p_patch: { amount: VALID_CIPHERTEXT, name: 'Updated' },
        p_tag_ids: [TAG_ONE_ID],
      });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(from).not.toHaveBeenCalled();
      expect(result.tagIds).toEqual([TAG_ONE_ID]);
    });

    it('should use the same atomic RPC for a tags-only patch', async () => {
      const from = jest.fn();
      const rpc = jest
        .fn()
        .mockResolvedValue({ data: mockTemplateLineRow, error: null });
      const provider = createMockProvider(from, rpc);
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.updateLine('line-1', {
        tagIds: [TAG_ONE_ID],
      });

      expect(rpc).toHaveBeenCalledWith('update_template_line_with_tags', {
        p_template_line_id: 'line-1',
        p_patch: {},
        p_tag_ids: [TAG_ONE_ID],
      });
      expect(from).not.toHaveBeenCalled();
      expect(result.tagIds).toEqual([TAG_ONE_ID]);
    });

    it('should not fall back to a scalar update when the atomic RPC rejects a tag', async () => {
      const from = jest.fn();
      const rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { code: '23503', message: 'FK violation' },
      });
      const provider = createMockProvider(from, rpc);
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.updateLine('line-1', {
          name: 'Updated',
          tagIds: ['missing-tag'],
        }),
      ).rejects.toMatchObject({
        code: 'ERR_TAG_NOT_FOUND',
        loggingContext: { operation: 'updateLine' },
      });
      expect(from).not.toHaveBeenCalled();
    });
  });

  describe('createTemplateWithLines', () => {
    it('should encrypt amounts and validate RPC payload before invocation', async () => {
      const rpc = jest
        .fn()
        .mockResolvedValue({ data: mockTemplateRow, error: null });
      const provider = createMockProvider(
        () => ({}) as never,
        rpc as unknown as jest.Mock,
      );
      const encryption = createMockEncryption();
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        encryption,
        createMockLogger(),
      );

      const result = await repo.createTemplateWithLines({
        userId: 'user-1',
        name: 'My Template',
        description: 'desc',
        isDefault: false,
        lines: [
          {
            name: 'Salaire',
            amount: 5000,
            originalAmount: null,
            originalCurrency: null,
            targetCurrency: null,
            exchangeRate: null,
            kind: 'income',
            recurrence: 'fixed',
            description: 'monthly',
            tagIds: [TAG_ONE_ID],
          },
        ],
      });

      expect(result.id).toBe('template-1');
      expect(encryption.prepareAmountsData).toHaveBeenCalledWith(
        [5000],
        mockUser.id,
        mockUser.clientKey,
      );
      expect(rpc).toHaveBeenCalledWith(
        'create_template_with_lines',
        expect.objectContaining({
          p_user_id: 'user-1',
          p_name: 'My Template',
          p_is_default: false,
          p_lines: expect.arrayContaining([
            expect.objectContaining({
              name: 'Salaire',
              amount: VALID_CIPHERTEXT,
              tag_ids: [TAG_ONE_ID],
            }),
          ]),
        }),
      );
    });

    it('should reject RPC payload with invalid shape (Zod)', async () => {
      const rpc = jest
        .fn()
        .mockResolvedValue({ data: mockTemplateRow, error: null });
      const provider = createMockProvider(
        () => ({}) as never,
        rpc as unknown as jest.Mock,
      );
      const encryption = createMockEncryption();
      // Force prepareAmountsData to return an empty string — schema rejects empty amount
      (encryption.prepareAmountsData as jest.Mock).mockResolvedValue([
        { amount: '' },
      ]);
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        encryption,
        createMockLogger(),
      );

      await expect(
        repo.createTemplateWithLines({
          userId: 'user-1',
          name: 'My Template',
          description: undefined,
          isDefault: false,
          lines: [
            {
              name: 'Salaire',
              amount: 5000,
              originalAmount: null,
              originalCurrency: null,
              targetCurrency: null,
              exchangeRate: null,
              kind: 'income',
              recurrence: 'fixed',
              description: 'monthly',
            },
          ],
        }),
      ).rejects.toThrow(BusinessException);
      expect(rpc).not.toHaveBeenCalled();
    });

    it('should map an RPC tag ownership rejection to TAG_NOT_FOUND', async () => {
      const rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'Tag access denied' },
      });
      const repo = new SupabaseBudgetTemplateRepository(
        createMockProvider(() => ({}) as never, rpc as unknown as jest.Mock),
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.createTemplateWithLines({
          userId: 'user-1',
          name: 'My Template',
          description: undefined,
          isDefault: false,
          lines: [],
        }),
      ).rejects.toMatchObject({ code: 'ERR_TAG_NOT_FOUND' });
    });

    it.each(['23503', '42501'])(
      'should map an RPC tag junction rejection (%s) to TAG_NOT_FOUND',
      async (code) => {
        const tagError = { code, message: 'Tag junction rejected' };
        const rpc = jest
          .fn()
          .mockResolvedValue({ data: null, error: tagError });
        const repo = new SupabaseBudgetTemplateRepository(
          createMockProvider(() => ({}) as never, rpc as unknown as jest.Mock),
          createMockEncryption(),
          createMockLogger(),
        );

        await expect(
          repo.createTemplateWithLines({
            userId: 'user-1',
            name: 'My Template',
            description: undefined,
            isDefault: false,
            lines: [],
          }),
        ).rejects.toMatchObject({
          code: 'ERR_TAG_NOT_FOUND',
          cause: tagError,
          loggingContext: {
            operation: 'createTemplateWithLines',
            entityType: 'template_line_tag',
          },
        });
      },
    );

    it('should keep savings-goal rejection mapping distinct from tags', async () => {
      const rpc = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'Savings goal access denied' },
      });
      const repo = new SupabaseBudgetTemplateRepository(
        createMockProvider(() => ({}) as never, rpc as unknown as jest.Mock),
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.createTemplateWithLines({
          userId: 'user-1',
          name: 'My Template',
          description: undefined,
          isDefault: false,
          lines: [],
        }),
      ).rejects.toMatchObject({ code: 'ERR_SAVINGS_GOAL_NOT_FOUND' });
    });
  });

  describe('resetDefaultTemplates', () => {
    it('should resolve when update succeeds', async () => {
      const finalThenable = {
        then: (
          resolve: (value: { data: null; error: null }) => void,
        ): unknown => resolve({ data: null, error: null }),
      };
      const neq = jest.fn().mockReturnValue(finalThenable);
      const eqIsDefault = jest.fn().mockReturnValue({
        neq,
        ...finalThenable,
      });
      const eqUserId = jest.fn().mockReturnValue({ eq: eqIsDefault });
      const update = jest.fn().mockReturnValue({ eq: eqUserId });
      const provider = createMockProvider(
        () => ({ update }) as unknown as ReturnType<typeof Object>,
      );
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.resetDefaultTemplates('user-1', 'template-2'),
      ).resolves.toBeUndefined();

      expect(update).toHaveBeenCalledWith({ is_default: false });
      expect(eqUserId).toHaveBeenCalledWith('user_id', 'user-1');
      expect(eqIsDefault).toHaveBeenCalledWith('is_default', true);
      expect(neq).toHaveBeenCalledWith('id', 'template-2');
    });

    it('should throw BusinessException when update fails (HI-25 regression)', async () => {
      const dbError = { message: 'RLS denied' };
      const finalThenable = {
        then: (
          resolve: (value: { data: null; error: typeof dbError }) => void,
        ): unknown => resolve({ data: null, error: dbError }),
      };
      const eqIsDefault = jest.fn().mockReturnValue(finalThenable);
      const eqUserId = jest.fn().mockReturnValue({ eq: eqIsDefault });
      const update = jest.fn().mockReturnValue({ eq: eqUserId });
      const provider = createMockProvider(
        () => ({ update }) as unknown as ReturnType<typeof Object>,
      );
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      let caught: unknown;
      try {
        await repo.resetDefaultTemplates('user-1', null);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(BusinessException);
      expect((caught as BusinessException).code).toBe(
        'ERR_TEMPLATE_UPDATE_FAILED',
      );
      expect((caught as BusinessException).cause).toBe(dbError);
    });
  });

  describe('bulkApplyTemplateLineOperations', () => {
    it('should map an invalid update RPC payload to TEMPLATE_UPDATE_FAILED', async () => {
      const rpc = jest.fn();
      const repo = new SupabaseBudgetTemplateRepository(
        createMockProvider(() => ({}) as never, rpc as unknown as jest.Mock),
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.bulkApplyTemplateLineOperations({
          templateId: 'template-1',
          budgetIds: [],
          deleteIds: [],
          updatedLines: [{ id: 'invalid-id' }],
          createdLines: [],
        }),
      ).rejects.toMatchObject({
        code: 'ERR_TEMPLATE_UPDATE_FAILED',
        loggingContext: {
          operation: 'bulkApplyTemplateLineOperations.updated',
        },
      });
      expect(rpc).not.toHaveBeenCalled();
    });

    it('should pass through with no budget mutations and only deletes', async () => {
      const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
      const provider = createMockProvider(
        () => ({}) as never,
        rpc as unknown as jest.Mock,
      );
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      const result = await repo.bulkApplyTemplateLineOperations({
        templateId: 'template-1',
        budgetIds: [],
        deleteIds: ['line-1'],
        updatedLines: [],
        createdLines: [],
      });

      expect(result.affectedBudgetIds).toEqual([]);
      expect(rpc).toHaveBeenCalledWith(
        'apply_template_line_operations_with_tags',
        {
          p_template_id: 'template-1',
          p_budget_ids: [],
          p_delete_ids: ['line-1'],
          p_updated_lines: [],
          p_created_lines: [],
          p_line_tag_pairs: [],
        },
      );
      expect(rpc).toHaveBeenCalledTimes(1);
    });

    it('should encrypt amounts on apply RPC lines when propagating', async () => {
      const rpc = jest
        .fn()
        .mockResolvedValue({ data: ['budget-1'], error: null });
      const fromFn = (_table: string) => ({
        select: () => ({
          in: jest.fn().mockResolvedValue({
            data: [
              {
                id: '8a0f6c80-1234-4e5f-89ab-111111111111',
                template_id: 'template-1',
                name: 'Loyer',
                amount: VALID_CIPHERTEXT,
                original_amount: null,
                original_currency: null,
                target_currency: null,
                exchange_rate: null,
                kind: 'expense',
                recurrence: 'fixed',
                description: null,
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z',
              },
            ],
            error: null,
          }),
        }),
      });
      const provider = createMockProvider(
        fromFn as never,
        rpc as unknown as jest.Mock,
      );
      const encryption = createMockEncryption();
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        encryption,
        createMockLogger(),
      );

      const result = await repo.bulkApplyTemplateLineOperations({
        templateId: 'template-1',
        budgetIds: ['budget-1'],
        deleteIds: [],
        updatedLines: [],
        createdLines: [
          {
            id: '8a0f6c80-1234-4e5f-89ab-111111111111',
            excludedBudgetIds: ['8a0f6c80-1234-4e5f-89ab-333333333333'],
            name: 'Loyer',
            amount: 1200,
            originalAmount: null,
            originalCurrency: null,
            targetCurrency: null,
            exchangeRate: null,
            kind: 'expense',
            recurrence: 'fixed',
          },
        ],
      });

      expect(result.affectedBudgetIds).toEqual(['budget-1']);
      expect(encryption.encryptAmount).toHaveBeenCalled();
      expect(rpc).toHaveBeenCalledWith(
        'apply_template_line_operations_with_tags',
        expect.objectContaining({
          p_created_lines: expect.arrayContaining([
            expect.objectContaining({
              id: '8a0f6c80-1234-4e5f-89ab-111111111111',
              amount: VALID_CIPHERTEXT,
              excluded_budget_ids: ['8a0f6c80-1234-4e5f-89ab-333333333333'],
            }),
          ]),
        }),
      );
    });

    it('should map tag failures without issuing a compensation RPC', async () => {
      const tagError = { code: '23503', message: 'FK violation' };
      const rpc = jest.fn().mockResolvedValue({ data: null, error: tagError });
      const provider = createMockProvider(
        () => ({}) as never,
        rpc as unknown as jest.Mock,
      );
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await expect(
        repo.bulkApplyTemplateLineOperations({
          templateId: 'template-1',
          budgetIds: ['budget-1'],
          deleteIds: [],
          updatedLines: [],
          createdLines: [
            {
              id: LINE_ONE_ID,
              name: 'Loyer',
              amount: 1200,
              originalAmount: null,
              originalCurrency: null,
              targetCurrency: null,
              exchangeRate: null,
              kind: 'expense',
              recurrence: 'fixed',
              tagIds: [TAG_ONE_ID],
            },
          ],
        }),
      ).rejects.toMatchObject({
        code: 'ERR_TAG_NOT_FOUND',
        loggingContext: { operation: 'bulkApplyTemplateLineOperations' },
      });

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith(
        'apply_template_line_operations_with_tags',
        expect.objectContaining({
          p_created_lines: expect.arrayContaining([
            expect.objectContaining({ id: LINE_ONE_ID }),
          ]),
          p_line_tag_pairs: [
            { template_line_id: LINE_ONE_ID, tag_ids: [TAG_ONE_ID] },
          ],
        }),
      );
    });

    it('should send scalar operations and all tag sets in one RPC call', async () => {
      const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
      const provider = createMockProvider(
        () => ({
          select: () => ({
            in: jest.fn().mockResolvedValue({
              data: [
                { ...mockTemplateLineRow, id: LINE_ONE_ID },
                { ...mockTemplateLineRow, id: LINE_TWO_ID },
              ],
              error: null,
            }),
          }),
        }),
        rpc as unknown as jest.Mock,
      );
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        createMockEncryption(),
        createMockLogger(),
      );

      await repo.bulkApplyTemplateLineOperations({
        templateId: 'template-1',
        budgetIds: ['budget-1'],
        deleteIds: [],
        updatedLines: [
          { id: LINE_ONE_ID, tagIds: [TAG_ONE_ID] },
          { id: LINE_TWO_ID, tagIds: [TAG_TWO_ID] },
        ],
        createdLines: [],
      });

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith(
        'apply_template_line_operations_with_tags',
        {
          p_template_id: 'template-1',
          p_budget_ids: ['budget-1'],
          p_delete_ids: [],
          p_updated_lines: [{ id: LINE_ONE_ID }, { id: LINE_TWO_ID }],
          p_created_lines: [],
          p_line_tag_pairs: [
            { template_line_id: LINE_ONE_ID, tag_ids: [TAG_ONE_ID] },
            { template_line_id: LINE_TWO_ID, tag_ids: [TAG_TWO_ID] },
          ],
        },
      );
    });
  });
});
