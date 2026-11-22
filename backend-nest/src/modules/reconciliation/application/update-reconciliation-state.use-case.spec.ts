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
  it('should ignore a starting amount sent by iOS 1.14.2', async () => {
    const { upsert, useCase, logger } = build();

    const state = await useCase.execute({ startingAmount: 3100 }, user);

    expect(upsert).toHaveBeenCalledWith({});
    expect(state).toEqual({ startingAmount: 0, hasCompletedComparison: true });
    expect(JSON.stringify((logger.info as jest.Mock).mock.calls)).not.toContain(
      '3100',
    );
  });

  it('should send only a completion time', async () => {
    const { upsert, useCase } = build();

    await useCase.execute({ completed: true, startingAmount: 50 }, user);

    const patch = upsert.mock.calls[0]?.[0];
    expect(Object.keys(patch)).toEqual(['lastCompletedAt']);
    expect(Number.isNaN(Date.parse(patch.lastCompletedAt))).toBe(false);
  });
});
