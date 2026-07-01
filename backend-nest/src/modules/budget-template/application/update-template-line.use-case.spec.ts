import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { UpdateTemplateLineUseCase } from './update-template-line.use-case';
import { BUDGET_TEMPLATE_REPOSITORY } from '../domain/ports/budget-template-repository.port';
import { CurrencyService } from '@modules/currency/currency.service';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { TemplateLine } from '../domain/budget-template.entity';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const templateLine: TemplateLine = {
  id: 'line-1',
  templateId: 'template-1',
  savingsGoalId: null,
  name: 'Salaire',
  amount: 5000,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'income',
  recurrence: 'fixed',
  description: '',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('UpdateTemplateLineUseCase', () => {
  let useCase: UpdateTemplateLineUseCase;
  let mockRepo: {
    validateLineAccess: ReturnType<typeof jest.fn>;
    updateLine: ReturnType<typeof jest.fn>;
  };
  let mockCurrency: { overrideExchangeRate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      validateLineAccess: jest.fn().mockResolvedValue(templateLine),
      updateLine: jest.fn().mockResolvedValue(templateLine),
    };
    mockCurrency = {
      overrideExchangeRate: jest.fn().mockImplementation((dto) => dto),
    };

    const module = await Test.createTestingModule({
      providers: [
        UpdateTemplateLineUseCase,
        { provide: BUDGET_TEMPLATE_REPOSITORY, useValue: mockRepo },
        { provide: CurrencyService, useValue: mockCurrency },
        {
          provide: `INFO_LOGGER:${UpdateTemplateLineUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(UpdateTemplateLineUseCase);
  });

  it('uses the current kind to reject link-only patches on non-saving lines', async () => {
    await useCase.execute(
      templateLine.id,
      { savingsGoalId: '8a0f6c80-1234-4e5f-89ab-333333333333' },
      mockUser,
    );

    expect(mockRepo.updateLine).toHaveBeenCalledWith(
      templateLine.id,
      expect.objectContaining({ savingsGoalId: null }),
    );
  });
});
