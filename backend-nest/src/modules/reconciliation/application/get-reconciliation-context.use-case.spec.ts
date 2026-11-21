import { describe, expect, it, jest } from 'bun:test';
import { BusinessException } from '@common/exceptions/business.exception';
import type { ReconciliationStateRepositoryPort } from '../domain/ports/reconciliation-state-repository.port';
import { GetReconciliationContextUseCase } from './get-reconciliation-context.use-case';

function build(exists: boolean, lastCompletedAt: string | null = null) {
  const repo = {
    budgetExists: jest.fn().mockResolvedValue(exists),
    get: jest.fn().mockResolvedValue({ startingAmount: 3100, lastCompletedAt }),
  } as unknown as ReconciliationStateRepositoryPort;
  return { repo, useCase: new GetReconciliationContextUseCase(repo) };
}

describe('GetReconciliationContextUseCase', () => {
  it('should return the stored state with an empty prior part', async () => {
    const { useCase } = build(true, '2026-11-01T10:00:00.000Z');

    expect(await useCase.execute('b1')).toEqual({
      startingAmount: 3100,
      hasCompletedComparison: true,
      priorCorrection: 0,
      priorItems: [],
    });
  });

  it('should report no completed comparison without a completion time', async () => {
    const { useCase } = build(true);

    expect((await useCase.execute('b1')).hasCompletedComparison).toBe(false);
  });

  it('should refuse a budget that is not the person’s and read nothing else', async () => {
    const { repo, useCase } = build(false);

    await expect(useCase.execute('other')).rejects.toBeInstanceOf(
      BusinessException,
    );
    expect(repo.get).not.toHaveBeenCalled();
  });
});
