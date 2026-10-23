import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { DuplicateTemplateUseCase } from './duplicate-template.use-case';
import { BUDGET_TEMPLATE_REPOSITORY } from '../domain/ports/budget-template-repository.port';
import { API_ERROR_CODES } from 'pulpe-shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type {
  BudgetTemplate,
  TemplateLine,
} from '../domain/budget-template.entity';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const source: BudgetTemplate = {
  id: 'source-1',
  userId: 'user-1',
  name: 'Mois standard',
  description: 'Mon mois habituel',
  isDefault: true,
  createdAt: '2026-05-09T00:00:00Z',
  updatedAt: '2026-05-09T00:00:00Z',
};

const copy: BudgetTemplate = { ...source, id: 'copy-1', isDefault: false };

const line = (overrides: Partial<TemplateLine>): TemplateLine => ({
  id: 'line-1',
  templateId: 'source-1',
  savingsGoalId: null,
  name: 'Loyer',
  amount: 1500,
  originalAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  kind: 'expense',
  recurrence: 'fixed',
  description: null,
  tagIds: [],
  createdAt: '2026-05-09T00:00:00Z',
  updatedAt: '2026-05-09T00:00:00Z',
  ...overrides,
});

describe('DuplicateTemplateUseCase', () => {
  let useCase: DuplicateTemplateUseCase;
  let mockRepo: {
    validateAccess: ReturnType<typeof jest.fn>;
    countForUser: ReturnType<typeof jest.fn>;
    findLinesByTemplateId: ReturnType<typeof jest.fn>;
    createTemplateWithLines: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      validateAccess: jest.fn().mockResolvedValue(source),
      countForUser: jest.fn().mockResolvedValue(1),
      findLinesByTemplateId: jest.fn().mockResolvedValue([]),
      createTemplateWithLines: jest.fn().mockResolvedValue(copy),
    };

    const module = await Test.createTestingModule({
      providers: [
        DuplicateTemplateUseCase,
        { provide: BUDGET_TEMPLATE_REPOSITORY, useValue: mockRepo },
        {
          provide: `INFO_LOGGER:${DuplicateTemplateUseCase.name}`,
          useValue: { info: () => {} },
        },
      ],
    }).compile();

    useCase = module.get(DuplicateTemplateUseCase);
  });

  it('copies every line exactly, tags and FX metadata included, under the new name and never as the default', async () => {
    const tagId = '22222222-2222-4222-8222-222222222222';
    const goalId = '11111111-1111-4111-8111-111111111111';
    mockRepo.findLinesByTemplateId
      .mockResolvedValueOnce([
        line({
          name: 'Épargne voyage',
          kind: 'saving',
          savingsGoalId: goalId,
          tagIds: [tagId],
          originalAmount: 100,
          originalCurrency: 'EUR',
          targetCurrency: 'CHF',
          exchangeRate: 0.93,
          amount: 93,
          description: 'Voyage',
        }),
        line({ id: 'line-2', description: null }),
      ])
      .mockResolvedValueOnce([line({ templateId: 'copy-1' })]);

    const result = await useCase.execute('source-1', 'Mois été', mockUser);

    expect(mockRepo.createTemplateWithLines).toHaveBeenCalledWith({
      userId: 'user-1',
      name: 'Mois été',
      description: 'Mon mois habituel',
      isDefault: false,
      lines: [
        {
          name: 'Épargne voyage',
          amount: 93,
          kind: 'saving',
          recurrence: 'fixed',
          savingsGoalId: goalId,
          tagIds: [tagId],
          description: 'Voyage',
          originalAmount: 100,
          originalCurrency: 'EUR',
          targetCurrency: 'CHF',
          exchangeRate: 0.93,
        },
        {
          name: 'Loyer',
          amount: 1500,
          kind: 'expense',
          recurrence: 'fixed',
          savingsGoalId: null,
          tagIds: [],
          description: '',
          originalAmount: null,
          originalCurrency: null,
          targetCurrency: null,
          exchangeRate: null,
        },
      ],
    });
    expect(result.template.id).toBe('copy-1');
    expect(result.lines[0].templateId).toBe('copy-1');
  });

  it('refuses at the template limit and writes nothing', async () => {
    mockRepo.countForUser.mockResolvedValue(5);

    await expect(
      useCase.execute('source-1', 'Mois été', mockUser),
    ).rejects.toMatchObject({ code: API_ERROR_CODES.TEMPLATE_LIMIT_EXCEEDED });
    expect(mockRepo.createTemplateWithLines).not.toHaveBeenCalled();
  });

  it('refuses an unknown or foreign source before reading anything else', async () => {
    mockRepo.validateAccess.mockRejectedValue(new Error('not found'));

    await expect(useCase.execute('nope', 'Mois été', mockUser)).rejects.toThrow(
      'not found',
    );
    expect(mockRepo.countForUser).not.toHaveBeenCalled();
    expect(mockRepo.createTemplateWithLines).not.toHaveBeenCalled();
  });
});
