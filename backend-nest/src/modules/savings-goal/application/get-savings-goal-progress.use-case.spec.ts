import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import { GetSavingsGoalProgressUseCase } from './get-savings-goal-progress.use-case';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import { BUDGET_TEMPLATE_REPOSITORY } from '@modules/budget-template/domain/ports/budget-template-repository.port';
import type { SavingsPlanTimelineMonth } from 'pulpe-shared';
import type { SavingsGoal } from '../domain/savings-goal.entity';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

const goal: SavingsGoal = {
  id: 'goal-1',
  userId: 'user-1',
  name: 'Maison',
  startDate: null,
  targetAmount: 12_000,
  targetDate: '2099-12-15',
  status: 'ACTIVE',
  createdAt: '2026-01-10T08:00:00Z',
  updatedAt: '2026-01-10T08:00:00Z',
  originalTargetAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  initialAmount: null,
};

describe('GetSavingsGoalProgressUseCase', () => {
  let useCase: GetSavingsGoalProgressUseCase;
  let mockRepo: {
    findById: ReturnType<typeof jest.fn>;
    findLinkedContributions: ReturnType<typeof jest.fn>;
    findMaterializedPeriods: ReturnType<typeof jest.fn>;
  };
  let mockTemplateRepo: {
    findDefaultTemplateId: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn().mockResolvedValue(goal),
      findLinkedContributions: jest
        .fn()
        .mockResolvedValue({ lines: [], transactions: [] }),
      findMaterializedPeriods: jest.fn().mockResolvedValue([]),
    };
    mockTemplateRepo = {
      findDefaultTemplateId: jest.fn().mockResolvedValue(null),
    };

    const module = await Test.createTestingModule({
      providers: [
        GetSavingsGoalProgressUseCase,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: mockRepo },
        { provide: BUDGET_TEMPLATE_REPOSITORY, useValue: mockTemplateRepo },
        {
          provide: `INFO_LOGGER:${GetSavingsGoalProgressUseCase.name}`,
          useValue: {
            info: () => {},
            debug: () => {},
            warn: () => {},
            trace: () => {},
          },
        },
      ],
    }).compile();

    useCase = module.get(GetSavingsGoalProgressUseCase);
  });

  it('computes the two layers from the decrypted linked contributions', async () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    mockRepo.findLinkedContributions.mockResolvedValue({
      lines: [
        {
          id: 'line-1',
          amount: 500,
          kind: 'saving',
          checkedAt: '2026-06-01T00:00:00Z',
          month: currentMonth,
          year: currentYear,
        },
      ],
      transactions: [],
    });

    const { goal: returnedGoal, computed } = await useCase.execute(
      'goal-1',
      mockUser,
    );

    expect(returnedGoal).toEqual(goal);
    expect(computed.plannedCumulative).toBe(500);
    expect(computed.confirmed).toBe(500); // ligne pointée → enveloppe
    expect(computed.linkedLineCount).toBe(1);
    expect(mockRepo.findLinkedContributions).toHaveBeenCalledWith('goal-1');
  });

  it('lifts confirmed by initialAmount (stock) without moving confirmedPace (flux) — PUL-293', async () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const linkedLines = [
      {
        id: 'line-1',
        amount: 500,
        kind: 'saving' as const,
        checkedAt: '2026-06-01T00:00:00Z',
        month: currentMonth,
        year: currentYear,
      },
    ];
    mockRepo.findLinkedContributions.mockResolvedValue({
      lines: linkedLines,
      transactions: [],
    });

    const { computed: withoutInitial } = await useCase.execute(
      'goal-1',
      mockUser,
    );

    mockRepo.findById.mockResolvedValue({ ...goal, initialAmount: 5000 });
    const { computed: withInitial } = await useCase.execute('goal-1', mockUser);

    expect(withInitial.confirmed).toBe(withoutInitial.confirmed + 5000);
    expect(withInitial.confirmedPace).toBe(withoutInitial.confirmedPace);
    expect(withInitial.initialAmount).toBe(5000);
    expect(withoutInitial.initialAmount).toBe(0);
  });

  it('is payDay-aware: forwards the user payDayOfMonth to the formulas', async () => {
    // Ancrage attendu recalculé via le même helper payDay-aware que la prod —
    // déterministe quel que soit le jour où la suite tourne.
    const { getBudgetPeriodForDate } = await import('pulpe-shared');
    const payDay = 25;
    const now = new Date();
    const created = new Date(now.getFullYear(), now.getMonth() - 3, 28);
    mockRepo.findById.mockResolvedValue({
      ...goal,
      createdAt: created.toISOString(),
    });

    const { computed } = await useCase.execute('goal-1', {
      ...mockUser,
      payDayOfMonth: payDay,
    });

    const index = (p: { month: number; year: number }) => p.year * 12 + p.month;
    const expectedElapsed = Math.max(
      1,
      index(getBudgetPeriodForDate(now, payDay)) -
        index(getBudgetPeriodForDate(created, payDay)) +
        1,
    );
    expect(computed.monthsElapsed).toBe(expectedElapsed);
  });

  // Use case métier (PUL-12): une prévision Épargne existante est rattachée à
  // l'objectif via son modèle puis propagée sur TOUS les budgets — le suivi
  // doit se calculer sans erreur: seuls les mois ≤ courant comptent dans le
  // prévu cumulé, rien n'est confirmé tant que rien n'est pointé.
  it('computes progress for a goal linked through template propagation (many future months, no transactions)', async () => {
    const now = new Date();
    const lines = Array.from({ length: 37 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return {
        id: `line-${i}`,
        amount: 500,
        kind: 'saving' as const,
        checkedAt: null,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
      };
    });
    mockRepo.findLinkedContributions.mockResolvedValue({
      lines,
      transactions: [],
    });

    const { computed } = await useCase.execute('goal-1', mockUser);

    expect(computed.linkedLineCount).toBe(37);
    // Seul le mois courant est écoulé — les 36 lignes futures n'entrent pas.
    expect(computed.plannedCumulative).toBe(500);
    expect(computed.confirmed).toBe(0);
    expect(computed.achievementPercent).toBe(0);
  });

  it('propagates NOT_FOUND from the repository (missing or foreign goal)', async () => {
    const error = new Error('SAVINGS_GOAL_NOT_FOUND');
    mockRepo.findById.mockRejectedValueOnce(error);

    await expect(useCase.execute('missing', mockUser)).rejects.toThrow(error);
    expect(mockRepo.findLinkedContributions).not.toHaveBeenCalled();
  });

  it('returns only applicable metrics for an objective without target or deadline', async () => {
    mockRepo.findById.mockResolvedValue({
      ...goal,
      targetAmount: null,
      targetDate: null,
    });

    const { computed } = await useCase.execute('goal-1', mockUser);

    expect(computed.achievementPercent).toBeNull();
    expect(computed.monthsRemaining).toBeNull();
    expect(computed.required).toBeNull();
    expect(computed.projected).toBeNull();
    expect(computed.paceStatus).toBeNull();
    expect(computed.suggestCompletion).toBeNull();
  });

  it('marks only truly missing periods as provisionable', async () => {
    const now = new Date();
    const currentIndex = now.getFullYear() * 12 + now.getMonth() + 1;
    const period = (offset: number) => {
      const index = currentIndex + offset;
      const year = Math.floor((index - 1) / 12);
      return { month: index - year * 12, year };
    };
    const current = period(0);
    const materializedGap = period(1);
    const missing = period(2);
    mockRepo.findById.mockResolvedValue({
      ...goal,
      createdAt: now.toISOString(),
      targetDate: `${missing.year}-${String(missing.month).padStart(2, '0')}-15`,
    });
    mockRepo.findLinkedContributions.mockResolvedValue({
      lines: [
        {
          id: 'line-current',
          amount: 500,
          kind: 'saving',
          checkedAt: null,
          month: current.month,
          year: current.year,
        },
      ],
      transactions: [],
    });
    mockRepo.findMaterializedPeriods.mockResolvedValue([
      current,
      materializedGap,
    ]);
    mockTemplateRepo.findDefaultTemplateId.mockResolvedValue('template-1');

    const { months } = await useCase.execute(goal.id, mockUser);

    expect(
      months.find(
        (month) =>
          month.month === materializedGap.month &&
          month.year === materializedGap.year,
      )?.isProvisionable,
    ).toBe(false);
    expect(
      months.find(
        (month) => month.month === missing.month && month.year === missing.year,
      )?.isProvisionable,
    ).toBe(true);
  });

  it('needs only a default template to make a missing month provisionable', async () => {
    const now = new Date();
    const currentIndex = now.getFullYear() * 12 + now.getMonth() + 1;
    const period = (offset: number) => {
      const index = currentIndex + offset;
      const year = Math.floor((index - 1) / 12);
      return { month: index - year * 12, year };
    };
    const current = period(0);
    const missing = period(2);
    mockRepo.findById.mockResolvedValue({
      ...goal,
      createdAt: now.toISOString(),
      targetDate: `${missing.year}-${String(missing.month).padStart(2, '0')}-15`,
    });
    mockRepo.findLinkedContributions.mockResolvedValue({
      lines: [
        {
          id: 'line-current',
          amount: 500,
          kind: 'saving',
          checkedAt: null,
          month: current.month,
          year: current.year,
        },
      ],
      transactions: [],
    });
    mockRepo.findMaterializedPeriods.mockResolvedValue([current]);
    mockTemplateRepo.findDefaultTemplateId.mockResolvedValue(null);

    const withoutTemplate = await useCase.execute(goal.id, mockUser);
    mockTemplateRepo.findDefaultTemplateId.mockResolvedValue('template-1');
    const withTemplate = await useCase.execute(goal.id, mockUser);

    const provisionable = (result: { months: SavingsPlanTimelineMonth[] }) =>
      result.months.find(
        (month) => month.month === missing.month && month.year === missing.year,
      )?.isProvisionable;
    expect(provisionable(withoutTemplate)).toBe(false);
    expect(provisionable(withTemplate)).toBe(true);
  });
});
