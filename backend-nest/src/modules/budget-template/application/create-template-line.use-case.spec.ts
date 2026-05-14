import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { CreateTemplateLineUseCase } from './create-template-line.use-case';
import { BUDGET_TEMPLATE_REPOSITORY } from '../domain/ports/budget-template-repository.port';
import { CurrencyService } from '@modules/currency/currency.service';
import type { TemplateLineCreateWithoutTemplateId } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { TemplateLine } from '../domain/budget-template.entity';

const mockTemplateLine: TemplateLine = {
  id: 'line-1',
  templateId: 'template-1',
  name: 'Salaire',
  amount: 5000,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'income',
  recurrence: 'fixed',
  description: 'Salaire mensuel',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
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
  let mockCurrency: { overrideExchangeRate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      validateAccess: jest.fn().mockResolvedValue(undefined),
      insertLine: jest.fn().mockResolvedValue(mockTemplateLine),
    };
    mockCurrency = {
      overrideExchangeRate: jest.fn().mockImplementation((dto) => dto),
    };

    const module = await Test.createTestingModule({
      providers: [
        CreateTemplateLineUseCase,
        { provide: BUDGET_TEMPLATE_REPOSITORY, useValue: mockRepo },
        { provide: CurrencyService, useValue: mockCurrency },
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

  it('should create a template line and return the decrypted entity', async () => {
    const dto: TemplateLineCreateWithoutTemplateId = {
      name: 'Salaire',
      amount: 5000,
      kind: 'income',
      recurrence: 'fixed',
      description: 'Salaire mensuel',
    };

    const result = await useCase.execute('template-1', dto, mockUser);

    expect(result.id).toBe('line-1');
    expect(result.name).toBe('Salaire');
    expect(result.amount).toBe(5000);
    expect(mockRepo.validateAccess).toHaveBeenCalledWith(
      'template-1',
      mockUser.id,
    );
    expect(mockRepo.insertLine).toHaveBeenCalledTimes(1);
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

    await expect(useCase.execute('template-99', dto, mockUser)).rejects.toThrow(
      'Access denied',
    );

    expect(mockRepo.insertLine).not.toHaveBeenCalled();
  });

  it('should pass plain amount to repo (repo encrypts internally)', async () => {
    const dto: TemplateLineCreateWithoutTemplateId = {
      name: 'Transport',
      amount: 150,
      kind: 'expense',
      recurrence: 'fixed',
      description: '',
    };

    await useCase.execute('template-1', dto, mockUser);

    expect(mockRepo.insertLine).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'template-1',
        name: 'Transport',
        amount: 150,
      }),
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

    await useCase.execute('template-1', dto, mockUser);

    expect(mockCurrency.overrideExchangeRate).toHaveBeenCalledTimes(1);
  });
});
