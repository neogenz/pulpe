import { describe, it, expect, mock } from 'bun:test';
import { createMockAuthenticatedUser } from '@/test/test-mocks';
import {
  TRANSACTION_SEARCH_QUERY_MAX_LENGTH,
  TRANSACTION_SEARCH_QUERY_MIN_LENGTH,
} from 'pulpe-shared';
import { TransactionController } from './transaction.controller';

function buildController() {
  const searchUseCase = {
    execute: mock(async () => []),
  };

  // search() only needs searchUseCase; avoid coupling this focused spec to
  // unrelated controller constructor dependencies.
  const controller = Object.create(
    TransactionController.prototype,
  ) as TransactionController;
  Object.assign(
    controller as unknown as { searchUseCase: typeof searchUseCase },
    {
      searchUseCase,
    },
  );

  return { controller, searchUseCase };
}

describe('TransactionController', () => {
  describe('search', () => {
    it('forwards a scalar query and parsed years to the use case', async () => {
      const { controller, searchUseCase } = buildController();
      const user = createMockAuthenticatedUser();

      const response = await controller.search('ca', ['2025', 'bad'], user);

      expect(response).toEqual({ success: true, data: [] });
      expect(searchUseCase.execute).toHaveBeenCalledWith('ca', user, [2025]);
    });

    it('rejects array query parameters before reaching the use case', async () => {
      const { controller, searchUseCase } = buildController();

      await expect(
        controller.search(
          ['ca', 'cb'],
          undefined,
          createMockAuthenticatedUser(),
        ),
      ).rejects.toMatchObject({
        details: { reason: 'Search query must be a string' },
      });

      expect(searchUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects missing query parameters before reaching the use case', async () => {
      const { controller, searchUseCase } = buildController();

      await expect(
        controller.search(undefined, undefined, createMockAuthenticatedUser()),
      ).rejects.toMatchObject({
        details: { reason: 'Search query is required' },
      });

      expect(searchUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects too-short scalar queries', async () => {
      const { controller, searchUseCase } = buildController();

      await expect(
        controller.search('c', undefined, createMockAuthenticatedUser()),
      ).rejects.toMatchObject({
        details: {
          reason: `Search query must be at least ${TRANSACTION_SEARCH_QUERY_MIN_LENGTH} characters`,
        },
      });

      expect(searchUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects too-long scalar queries', async () => {
      const { controller, searchUseCase } = buildController();

      await expect(
        controller.search(
          'x'.repeat(TRANSACTION_SEARCH_QUERY_MAX_LENGTH + 1),
          undefined,
          createMockAuthenticatedUser(),
        ),
      ).rejects.toMatchObject({
        details: {
          reason: `Search query must be at most ${TRANSACTION_SEARCH_QUERY_MAX_LENGTH} characters`,
        },
      });

      expect(searchUseCase.execute).not.toHaveBeenCalled();
    });
  });
});
