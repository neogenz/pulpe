import { describe, expect, it, jest } from 'bun:test';
import { Buffer } from 'node:buffer';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { InfoLogger } from '@common/logger';
import type { ReconciliationStateRepositoryPort } from '../domain/ports/reconciliation-state-repository.port';
import { UpdateReconciliationStateUseCase } from './update-reconciliation-state.use-case';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  accessToken: 'token',
  clientKey: Buffer.from('client-key'),
};

function build() {
  const upsert = jest.fn().mockResolvedValue({
    startingAmount: 3100,
    lastCompletedAt: '2026-11-21T10:00:00.000Z',
  });
  const logger = { info: jest.fn() } as unknown as InfoLogger;
  const useCase = new UpdateReconciliationStateUseCase(
    { upsert } as unknown as ReconciliationStateRepositoryPort,
    logger,
  );
  return { upsert, useCase, logger };
}

describe('UpdateReconciliationStateUseCase', () => {
  it('should send only the starting amount when completed is absent', async () => {
    const { upsert, useCase } = build();

    await useCase.execute({ startingAmount: 3100 }, user);

    expect(upsert).toHaveBeenCalledWith({ startingAmount: 3100 });
  });

  it('should round the starting amount to the cent', async () => {
    const { upsert, useCase } = build();

    await useCase.execute({ startingAmount: 10.126 }, user);

    expect(upsert).toHaveBeenCalledWith({ startingAmount: 10.13 });
  });

  it('should send only a completion time when the amount is absent', async () => {
    const { upsert, useCase } = build();

    await useCase.execute({ completed: true }, user);

    const patch = upsert.mock.calls[0]?.[0];
    expect(Object.keys(patch)).toEqual(['lastCompletedAt']);
    expect(Number.isNaN(Date.parse(patch.lastCompletedAt))).toBe(false);
  });

  it('should keep an amount of 0 (an explicit value, not an absent one)', async () => {
    const { upsert, useCase } = build();

    await useCase.execute({ startingAmount: 0 }, user);

    expect(upsert).toHaveBeenCalledWith({ startingAmount: 0 });
  });

  it('should return the state and never log the amount', async () => {
    const { useCase, logger } = build();

    const state = await useCase.execute({ startingAmount: 3100 }, user);

    expect(state).toEqual({
      startingAmount: 3100,
      hasCompletedComparison: true,
    });
    expect(JSON.stringify((logger.info as jest.Mock).mock.calls)).not.toContain(
      '3100',
    );
  });
});
