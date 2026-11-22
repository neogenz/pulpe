import { describe, expect, it, jest } from 'bun:test';
import { createMockAuthenticatedUser } from '@/test/test-mocks';
import type { ReconciliationContext } from 'pulpe-shared';
import type { GetReconciliationContextUseCase } from '../../application/get-reconciliation-context.use-case';
import type { UpdateReconciliationStateUseCase } from '../../application/update-reconciliation-state.use-case';
import { ReconciliationController } from './reconciliation.controller';

describe('ReconciliationController', () => {
  const context: ReconciliationContext = {
    startingAmount: 0,
    hasCompletedComparison: false,
    priorCorrection: 0,
    priorItems: [],
  };
  const state = { startingAmount: 3100, hasCompletedComparison: true };
  const getContext = { execute: jest.fn().mockResolvedValue(context) };
  const update = { execute: jest.fn().mockResolvedValue(state) };
  const controller = new ReconciliationController(
    getContext as unknown as GetReconciliationContextUseCase,
    update as unknown as UpdateReconciliationStateUseCase,
  );

  it('should wrap the context of the budget', async () => {
    expect(await controller.getContext('b1')).toEqual({
      success: true,
      data: context,
    });
    expect(getContext.execute).toHaveBeenCalledWith('b1');
  });

  it('should wrap the updated state', async () => {
    const user = createMockAuthenticatedUser();

    expect(
      await controller.updateState(
        { startingAmount: 3100, completed: true },
        user,
      ),
    ).toEqual({ success: true, data: state });
    expect(update.execute).toHaveBeenCalledWith(
      { startingAmount: 3100, completed: true },
      user,
    );
  });
});
