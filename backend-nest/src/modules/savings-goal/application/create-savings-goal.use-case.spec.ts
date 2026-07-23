import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import { Test } from '@nestjs/testing';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import { BUDGET_TEMPLATE_REPOSITORY } from '@modules/budget-template/domain/ports/budget-template-repository.port';
import { TEMPLATE_LINE_PROPAGATION_PORT } from '@modules/budget-template/domain/ports/template-line-propagation.port';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import { CreateSavingsGoalUseCase } from './create-savings-goal.use-case';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const goal = {
  id: 'goal-1',
  userId: user.id,
  name: 'Maison',
  targetAmount: 100_000,
  targetDate: '2030-05-15',
  status: 'ACTIVE' as const,
  createdAt: '2026-07-16T08:00:00Z',
  updatedAt: '2026-07-16T08:00:00Z',
  originalTargetAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  initialAmount: null,
};

const createDto = {
  name: 'Maison',
  targetAmount: 100_000,
  targetDate: '2030-05-15',
  status: 'ACTIVE',
} as const;

describe('CreateSavingsGoalUseCase auto-décomposition (PUL-285 CA1/CA2)', () => {
  let useCase: CreateSavingsGoalUseCase;
  let repo: { insert: ReturnType<typeof jest.fn> };
  let templateRepo: { findDefaultTemplateId: ReturnType<typeof jest.fn> };
  let propagation: { createLineAndPropagate: ReturnType<typeof jest.fn> };
  let logger: {
    info: ReturnType<typeof jest.fn>;
    warn: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    repo = { insert: jest.fn().mockResolvedValue(goal) };
    templateRepo = {
      findDefaultTemplateId: jest.fn().mockResolvedValue('template-1'),
    };
    propagation = {
      createLineAndPropagate: jest.fn().mockResolvedValue({ id: 'line-1' }),
    };
    logger = { info: jest.fn(), warn: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        CreateSavingsGoalUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: repo },
        { provide: BUDGET_TEMPLATE_REPOSITORY, useValue: templateRepo },
        { provide: TEMPLATE_LINE_PROPAGATION_PORT, useValue: propagation },
        {
          provide: `INFO_LOGGER:${CreateSavingsGoalUseCase.name}`,
          useValue: logger,
        },
      ],
    }).compile();
    useCase = module.get(CreateSavingsGoalUseCase);
  });

  it('should create the goal without touching the template when monthlyContribution is absent', async () => {
    const result = await useCase.execute(createDto, user);

    expect(result).toEqual(goal);
    expect(templateRepo.findDefaultTemplateId).not.toHaveBeenCalled();
    expect(propagation.createLineAndPropagate).not.toHaveBeenCalled();
  });

  it('should generate the linked recurring baseline on the default template when opted in', async () => {
    await useCase.execute({ ...createDto, monthlyContribution: 2083.34 }, user);

    expect(propagation.createLineAndPropagate).toHaveBeenCalledWith({
      templateId: 'template-1',
      userId: user.id,
      name: goal.name,
      amount: 2083.34,
      kind: 'saving',
      recurrence: 'fixed',
      savingsGoalId: goal.id,
    });
  });

  it('should still create the goal when the user has no default template', async () => {
    templateRepo.findDefaultTemplateId.mockResolvedValue(null);

    const result = await useCase.execute(
      { ...createDto, monthlyContribution: 2083.34 },
      user,
    );

    expect(result).toEqual(goal);
    expect(propagation.createLineAndPropagate).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('should still return the created goal when baseline propagation fails', async () => {
    propagation.createLineAndPropagate.mockRejectedValue(
      new Error('propagation down'),
    );

    const result = await useCase.execute(
      { ...createDto, monthlyContribution: 2083.34 },
      user,
    );

    expect(result).toEqual(goal);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('should surface a committed baseline recalculation failure', async () => {
    propagation.createLineAndPropagate.mockRejectedValue(
      new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_UPDATE_FAILED,
        undefined,
        {
          partialFailure: true,
          affectedBudgetIds: ['budget-1'],
        },
      ),
    );

    expect(
      useCase.execute({ ...createDto, monthlyContribution: 2083.34 }, user),
    ).rejects.toMatchObject({
      code: 'ERR_SAVINGS_GOAL_BASELINE_RECALCULATION_FAILED',
      loggingContext: {
        partialFailure: true,
        affectedBudgetIds: ['budget-1'],
        savingsGoalId: goal.id,
      },
    });
  });
});
