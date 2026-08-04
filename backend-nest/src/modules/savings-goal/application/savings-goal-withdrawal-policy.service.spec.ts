import { describe, it, expect, beforeEach, jest } from 'bun:test';
import { Test } from '@nestjs/testing';
import { Buffer } from 'node:buffer';
import type { LinkedSavingWithdrawal } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { SavingsGoalWithdrawalPolicyService } from './savings-goal-withdrawal-policy.service';
import { SAVINGS_GOAL_REPOSITORY } from '../domain/ports/savings-goal-repository.port';
import type { SavingsGoal } from '../domain/savings-goal.entity';

const GOAL_ID = 'goal-1';
const REVISION = 7;

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('key'),
};

/**
 * Pot de 10'000 sans aucune prévision liée : `confirmed = initialAmount − Σ
 * retraits`, donc chaque test pilote le solde par ses seuls retraits.
 */
const goal: SavingsGoal = {
  id: GOAL_ID,
  userId: 'user-1',
  name: 'Maison',
  startDate: null,
  targetAmount: 20_000,
  targetDate: '2099-12-15',
  status: 'ACTIVE',
  createdAt: '2026-01-10T08:00:00Z',
  updatedAt: '2026-01-10T08:00:00Z',
  originalTargetAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
  initialAmount: 10_000,
};

function conflict(): BusinessException {
  return new BusinessException(
    ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_CONFLICT,
    undefined,
    { operation: 'test' },
  );
}

describe('SavingsGoalWithdrawalPolicyService', () => {
  let service: SavingsGoalWithdrawalPolicyService;
  let mockRepo: {
    findById: ReturnType<typeof jest.fn>;
    findLinkedContributions: ReturnType<typeof jest.fn>;
    findLinkedWithdrawals: ReturnType<typeof jest.fn>;
    findBalanceRevision: ReturnType<typeof jest.fn>;
  };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn().mockResolvedValue(goal),
      findLinkedContributions: jest
        .fn()
        .mockResolvedValue({ lines: [], transactions: [] }),
      findLinkedWithdrawals: jest.fn().mockResolvedValue([]),
      findBalanceRevision: jest.fn().mockResolvedValue(REVISION),
    };

    const module = await Test.createTestingModule({
      providers: [
        SavingsGoalWithdrawalPolicyService,
        { provide: SAVINGS_GOAL_REPOSITORY, useValue: mockRepo },
      ],
    }).compile();

    service = module.get(SavingsGoalWithdrawalPolicyService);
  });

  it('hands the balance revision it read to the write', async () => {
    const write = jest.fn().mockResolvedValue('written');

    const result = await service.runAgainstBalance({
      goalId: GOAL_ID,
      debit: 4_500,
      user: mockUser,
      write,
    });

    expect(result).toBe('written');
    expect(write).toHaveBeenCalledWith(REVISION);
  });

  it('reads the revision before the rows it certifies', async () => {
    const callOrder: string[] = [];
    mockRepo.findBalanceRevision.mockImplementationOnce(async () => {
      callOrder.push('revision');
      return REVISION;
    });
    mockRepo.findLinkedWithdrawals.mockImplementationOnce(async () => {
      callOrder.push('withdrawals');
      return [];
    });

    await service.runAgainstBalance({
      goalId: GOAL_ID,
      debit: 1,
      user: mockUser,
      write: jest.fn().mockResolvedValue(undefined),
    });

    expect(callOrder).toEqual(['revision', 'withdrawals']);
  });

  it('rejects a goal that has no revision — missing or foreign', async () => {
    mockRepo.findBalanceRevision.mockResolvedValueOnce(null);
    const write = jest.fn();

    const caught = await service
      .runAgainstBalance({
        goalId: GOAL_ID,
        debit: 1,
        user: mockUser,
        write,
      })
      .catch((error: unknown) => error);

    expect((caught as BusinessException).code).toBe(
      ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND.code,
    );
    expect(mockRepo.findById).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  describe('balance rule', () => {
    it('allows a withdrawal equal to the whole balance', async () => {
      const write = jest.fn().mockResolvedValue(undefined);

      await service.runAgainstBalance({
        goalId: GOAL_ID,
        debit: 10_000,
        user: mockUser,
        write,
      });

      expect(write).toHaveBeenCalledTimes(1);
    });

    it('refuses an overshoot of one cent without writing', async () => {
      const write = jest.fn();

      const caught = await service
        .runAgainstBalance({
          goalId: GOAL_ID,
          debit: 10_000.01,
          user: mockUser,
          write,
        })
        .catch((error: unknown) => error);

      expect((caught as BusinessException).code).toBe(
        ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_INSUFFICIENT_BALANCE.code,
      );
      expect(write).not.toHaveBeenCalled();
    });

    it('never carries a figure into the error message', async () => {
      const caught = await service
        .runAgainstBalance({
          goalId: GOAL_ID,
          debit: 99_999,
          user: mockUser,
          write: jest.fn(),
        })
        .catch((error: unknown) => error);

      expect((caught as BusinessException).message).not.toMatch(/\d/);
    });

    it('counts existing withdrawals against the balance', async () => {
      const existing: LinkedSavingWithdrawal[] = [
        { amount: 4_500, month: 1, year: 2026 },
      ];
      mockRepo.findLinkedWithdrawals.mockResolvedValue(existing);
      const write = jest.fn();

      const caught = await service
        .runAgainstBalance({
          goalId: GOAL_ID,
          debit: 5_500.01,
          user: mockUser,
          write,
        })
        .catch((error: unknown) => error);

      expect((caught as BusinessException).code).toBe(
        ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_INSUFFICIENT_BALANCE.code,
      );
      expect(write).not.toHaveBeenCalled();
    });

    it('lets a write through when nothing is drawn, even under a negative stock', async () => {
      // Dépointer une prévision déjà retirée creuse le stock sous zéro — état
      // légitime, non clampé côté calcul. Supprimer le retrait est le geste qui
      // le répare : le refuser laisse la transaction en cul-de-sac.
      mockRepo.findLinkedWithdrawals.mockResolvedValue([
        { amount: 12_000, month: 1, year: 2026 },
      ]);
      const write = jest.fn().mockResolvedValue(undefined);

      await service.runAgainstBalance({
        goalId: GOAL_ID,
        debit: 0,
        user: mockUser,
        write,
      });

      expect(write).toHaveBeenCalledWith(REVISION);
    });

    it('gives an edited withdrawal its own amount back before arbitrating', async () => {
      mockRepo.findLinkedWithdrawals.mockResolvedValue([
        { amount: 10_000, month: 1, year: 2026 },
      ]);
      const write = jest.fn().mockResolvedValue(undefined);

      await service.runAgainstBalance({
        goalId: GOAL_ID,
        debit: 9_000,
        creditBack: 10_000,
        user: mockUser,
        write,
      });

      expect(write).toHaveBeenCalledTimes(1);
    });
  });

  describe('conflict handling', () => {
    it('re-reads and retries once when the revision went stale', async () => {
      const write = jest
        .fn()
        .mockRejectedValueOnce(conflict())
        .mockResolvedValueOnce('written');

      const result = await service.runAgainstBalance({
        goalId: GOAL_ID,
        debit: 100,
        user: mockUser,
        write,
      });

      expect(result).toBe('written');
      expect(mockRepo.findBalanceRevision).toHaveBeenCalledTimes(2);
    });

    it('surfaces the conflict when the second attempt fails too', async () => {
      const write = jest.fn().mockRejectedValue(conflict());

      const caught = await service
        .runAgainstBalance({
          goalId: GOAL_ID,
          debit: 100,
          user: mockUser,
          write,
        })
        .catch((error: unknown) => error);

      expect((caught as BusinessException).code).toBe(
        ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_CONFLICT.code,
      );
      expect(write).toHaveBeenCalledTimes(2);
    });

    it('reports an insufficient balance when the retry finds the pot drained', async () => {
      const write = jest.fn().mockRejectedValueOnce(conflict());
      mockRepo.findLinkedWithdrawals
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ amount: 10_000, month: 1, year: 2026 }]);

      const caught = await service
        .runAgainstBalance({
          goalId: GOAL_ID,
          debit: 6_000,
          user: mockUser,
          write,
        })
        .catch((error: unknown) => error);

      expect((caught as BusinessException).code).toBe(
        ERROR_DEFINITIONS.SAVINGS_GOAL_WITHDRAWAL_INSUFFICIENT_BALANCE.code,
      );
      expect(write).toHaveBeenCalledTimes(1);
    });

    it('does not retry an error that is not a balance conflict', async () => {
      const failure = new Error('constraint violation');
      const write = jest.fn().mockRejectedValue(failure);

      await expect(
        service.runAgainstBalance({
          goalId: GOAL_ID,
          debit: 100,
          user: mockUser,
          write,
        }),
      ).rejects.toThrow(failure);
      expect(write).toHaveBeenCalledTimes(1);
    });
  });
});
