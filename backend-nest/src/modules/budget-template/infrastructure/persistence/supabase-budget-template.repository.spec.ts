import { describe, it, expect, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { SupabaseBudgetTemplateRepository } from './supabase-budget-template.repository';
import { BusinessException } from '@common/exceptions/business.exception';
import type { TemplateRow } from '../../domain/budget-template.entity';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { EncryptionPort } from '@modules/encryption/encryption.tokens';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

const VALID_CIPHERTEXT =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

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
      );

      await expect(repo.validateAccess('template-1', 'user-1')).rejects.toThrow(
        BusinessException,
      );
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
      const repo = new SupabaseBudgetTemplateRepository(provider, encryption);

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
      const repo = new SupabaseBudgetTemplateRepository(provider, encryption);

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
    it('should pass through with no budget mutations and only deletes', async () => {
      const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
      const provider = createMockProvider(
        () => ({}) as never,
        rpc as unknown as jest.Mock,
      );
      const repo = new SupabaseBudgetTemplateRepository(
        provider,
        createMockEncryption(),
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
        'apply_template_line_operations',
        expect.objectContaining({
          template_id: 'template-1',
          budget_ids: [],
          delete_ids: ['line-1'],
          updated_lines: [],
          created_lines: [],
        }),
      );
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
      const repo = new SupabaseBudgetTemplateRepository(provider, encryption);

      const result = await repo.bulkApplyTemplateLineOperations({
        templateId: 'template-1',
        budgetIds: ['budget-1'],
        deleteIds: [],
        updatedLines: [],
        createdLines: [
          {
            id: '8a0f6c80-1234-4e5f-89ab-111111111111',
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
        'apply_template_line_operations',
        expect.objectContaining({
          created_lines: expect.arrayContaining([
            expect.objectContaining({
              id: '8a0f6c80-1234-4e5f-89ab-111111111111',
              amount: VALID_CIPHERTEXT,
            }),
          ]),
        }),
      );
    });
  });
});
