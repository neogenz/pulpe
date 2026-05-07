import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { CreateTemplateLineUseCase } from './create-template-line.use-case';
import { BUDGET_TEMPLATE_REPOSITORY } from '../domain/ports/budget-template-repository.port';
import { ENCRYPTION_PORT } from '@modules/encryption/encryption.tokens';
import { CurrencyService } from '@modules/currency/currency.service';
import { BudgetTemplateMapper } from '../infrastructure/mappers/budget-template.mapper';
import type { TemplateLineCreateWithoutTemplateId } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { Tables } from '../../../types/database.types';

const mockTemplateLineRow: Tables<'template_line'> = {
  id: 'line-1',
  template_id: 'template-1',
  name: 'Salaire',
  amount: 'encrypted-5000',
  kind: 'income',
  recurrence: 'fixed',
  description: 'Salaire mensuel',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  original_amount: null,
  original_currency: null,
  target_currency: null,
  exchange_rate: null,
};

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

describe('CreateTemplateLineUseCase', () => {
  let useCase: CreateTemplateLineUseCase;
  let mockRepo: {
    validateAccess: ReturnType<typeof jest.fn>;
    insertLine: ReturnType<typeof jest.fn>;
  };
  let mockEncryption: {
    prepareAmountData: ReturnType<typeof jest.fn>;
    encryptOptionalAmount: ReturnType<typeof jest.fn>;
    getUserDEK: ReturnType<typeof jest.fn>;
    tryDecryptAmount: ReturnType<typeof jest.fn>;
  };
  let mockCurrency: { overrideExchangeRate: ReturnType<typeof jest.fn> };
  let mockSupabase: AuthenticatedSupabaseClient;

  beforeEach(async () => {
    mockRepo = {
      validateAccess: jest.fn().mockResolvedValue(undefined),
      insertLine: jest.fn().mockResolvedValue(mockTemplateLineRow),
    };
    mockEncryption = {
      prepareAmountData: jest
        .fn()
        .mockResolvedValue({ amount: 'encrypted-5000' }),
      encryptOptionalAmount: jest.fn().mockResolvedValue(null),
      getUserDEK: jest.fn().mockResolvedValue(Buffer.from('dek')),
      tryDecryptAmount: jest.fn().mockReturnValue(5000),
    };
    mockCurrency = {
      overrideExchangeRate: jest.fn().mockImplementation((dto) => dto),
    };
    mockSupabase = {} as AuthenticatedSupabaseClient;

    const module = await Test.createTestingModule({
      providers: [
        CreateTemplateLineUseCase,
        { provide: BUDGET_TEMPLATE_REPOSITORY, useValue: mockRepo },
        { provide: ENCRYPTION_PORT, useValue: mockEncryption },
        { provide: CurrencyService, useValue: mockCurrency },
        { provide: BudgetTemplateMapper, useClass: BudgetTemplateMapper },
        {
          provide: `INFO_LOGGER:${CreateTemplateLineUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(CreateTemplateLineUseCase);
  });

  it('should create a template line and return decrypted response', async () => {
    const dto: TemplateLineCreateWithoutTemplateId = {
      name: 'Salaire',
      amount: 5000,
      kind: 'income',
      recurrence: 'fixed',
      description: 'Salaire mensuel',
    };

    const result = await useCase.execute(
      'template-1',
      dto,
      mockUser,
      mockSupabase,
    );

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Salaire');
    expect(mockRepo.validateAccess).toHaveBeenCalledWith(
      'template-1',
      mockUser.id,
      mockSupabase,
    );
    expect(mockRepo.insertLine).toHaveBeenCalledTimes(1);
    expect(mockEncryption.prepareAmountData).toHaveBeenCalledTimes(1);
  });

  it('should validate template access before inserting', async () => {
    const dto: TemplateLineCreateWithoutTemplateId = {
      name: 'Loyer',
      amount: 1200,
      kind: 'expense',
      recurrence: 'fixed',
      description: '',
    };
    mockRepo.validateAccess.mockRejectedValueOnce(new Error('Access denied'));

    await expect(
      useCase.execute('template-99', dto, mockUser, mockSupabase),
    ).rejects.toThrow('Access denied');

    expect(mockRepo.insertLine).not.toHaveBeenCalled();
  });

  it('should encrypt the amount before inserting', async () => {
    const dto: TemplateLineCreateWithoutTemplateId = {
      name: 'Transport',
      amount: 150,
      kind: 'expense',
      recurrence: 'fixed',
      description: '',
    };

    await useCase.execute('template-1', dto, mockUser, mockSupabase);

    expect(mockEncryption.prepareAmountData).toHaveBeenCalledWith(
      150,
      mockUser.id,
      mockUser.clientKey,
    );
  });

  it('should override exchange rate via CurrencyService', async () => {
    const dto: TemplateLineCreateWithoutTemplateId = {
      name: 'Netflix',
      amount: 15,
      kind: 'expense',
      recurrence: 'fixed',
      description: '',
    };

    await useCase.execute('template-1', dto, mockUser, mockSupabase);

    expect(mockCurrency.overrideExchangeRate).toHaveBeenCalledTimes(1);
  });
});
