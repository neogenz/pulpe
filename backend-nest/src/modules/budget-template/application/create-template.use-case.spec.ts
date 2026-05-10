import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { CreateTemplateUseCase } from './create-template.use-case';
import { BUDGET_TEMPLATE_REPOSITORY } from '../domain/ports/budget-template-repository.port';
import { CurrencyService } from '@modules/currency/currency.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { API_ERROR_CODES, type BudgetTemplateCreate } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { BudgetTemplate } from '../domain/budget-template.entity';

const mockTemplate: BudgetTemplate = {
  id: 'template-1',
  userId: 'user-1',
  name: 'Mois Standard',
  description: 'Test',
  isDefault: false,
  createdAt: '2026-05-09T00:00:00Z',
  updatedAt: '2026-05-09T00:00:00Z',
};

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const baseDto: BudgetTemplateCreate = {
  name: 'Mois Standard',
  description: 'Test',
  isDefault: false,
  lines: [],
};

describe('CreateTemplateUseCase', () => {
  let useCase: CreateTemplateUseCase;
  let mockRepo: {
    countForUser: ReturnType<typeof jest.fn>;
    resetDefaultTemplates: ReturnType<typeof jest.fn>;
    createTemplateWithLines: ReturnType<typeof jest.fn>;
    findLinesByTemplateId: ReturnType<typeof jest.fn>;
  };
  let mockCurrency: { overrideExchangeRate: ReturnType<typeof jest.fn> };

  beforeEach(async () => {
    mockRepo = {
      countForUser: jest.fn().mockResolvedValue(0),
      resetDefaultTemplates: jest.fn().mockResolvedValue(undefined),
      createTemplateWithLines: jest.fn().mockResolvedValue(mockTemplate),
      findLinesByTemplateId: jest.fn().mockResolvedValue([]),
    };
    mockCurrency = {
      overrideExchangeRate: jest.fn().mockImplementation((dto) => dto),
    };

    const module = await Test.createTestingModule({
      providers: [
        CreateTemplateUseCase,
        { provide: BUDGET_TEMPLATE_REPOSITORY, useValue: mockRepo },
        { provide: CurrencyService, useValue: mockCurrency },
        {
          provide: `INFO_LOGGER:${CreateTemplateUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(CreateTemplateUseCase);
  });

  it('should create a template when below the limit', async () => {
    mockRepo.countForUser.mockResolvedValueOnce(2);

    const result = await useCase.execute(baseDto, mockUser, null);

    expect(result.template.id).toBe('template-1');
    expect(mockRepo.createTemplateWithLines).toHaveBeenCalledTimes(1);
  });

  it('should throw TEMPLATE_LIMIT_EXCEEDED when fast-path count is at the limit', async () => {
    mockRepo.countForUser.mockResolvedValueOnce(5);

    let caught: unknown;
    try {
      await useCase.execute(baseDto, mockUser, null);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(
      API_ERROR_CODES.TEMPLATE_LIMIT_EXCEEDED,
    );
    expect(mockRepo.createTemplateWithLines).not.toHaveBeenCalled();
  });

  it('should propagate TEMPLATE_LIMIT_EXCEEDED from the repository (DB trigger path)', async () => {
    // Simulates the TOCTOU race: count says 4 (below limit), but by the time
    // we INSERT, another request already pushed to the cap. The DB trigger
    // raises P0001 with TEMPLATE_LIMIT_EXCEEDED prefix; the repo translates
    // it to a BusinessException with the canonical error code.
    mockRepo.countForUser.mockResolvedValueOnce(4);
    mockRepo.createTemplateWithLines.mockRejectedValueOnce(
      new BusinessException(
        {
          code: API_ERROR_CODES.TEMPLATE_LIMIT_EXCEEDED,
          message: () => 'Template limit of 5 exceeded',
          httpStatus: 400,
        },
        { limit: 5 },
      ),
    );

    let caught: unknown;
    try {
      await useCase.execute(baseDto, mockUser, null);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BusinessException);
    expect((caught as BusinessException).code).toBe(
      API_ERROR_CODES.TEMPLATE_LIMIT_EXCEEDED,
    );
  });

  it('should reset default templates when isDefault is true', async () => {
    mockRepo.countForUser.mockResolvedValueOnce(0);

    await useCase.execute({ ...baseDto, isDefault: true }, mockUser, null);

    expect(mockRepo.resetDefaultTemplates).toHaveBeenCalledWith('user-1', null);
    expect(mockRepo.createTemplateWithLines).toHaveBeenCalledTimes(1);
  });
});
