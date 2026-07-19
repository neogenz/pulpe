import { describe, it, expect, mock } from 'bun:test';
import { createMockAuthenticatedUser } from '@/test/test-mocks';
import {
  TRANSACTION_SEARCH_QUERY_MAX_LENGTH,
  TRANSACTION_SEARCH_QUERY_MIN_LENGTH,
} from 'pulpe-shared';
import { TransactionController } from './transaction.controller';

const TAG_ID = '11111111-1111-4111-8111-111111111111';
const user = createMockAuthenticatedUser();

function search(
  controller: TransactionController,
  query?: unknown,
  years?: string | string[],
  tagIds?: unknown,
) {
  return controller.search(query, years, tagIds, user);
}

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

      const response = await search(controller, 'ca', ['2025', 'bad']);

      expect(response).toEqual({ success: true, data: [] });
      expect(searchUseCase.execute).toHaveBeenCalledWith(
        { q: 'ca', years: [2025], tagIds: undefined },
        user,
      );
    });

    it('rejects array query parameters before reaching the use case', async () => {
      const { controller, searchUseCase } = buildController();

      await expect(search(controller, ['ca', 'cb'])).rejects.toMatchObject({
        details: { reason: 'Search query must be a string' },
      });

      expect(searchUseCase.execute).not.toHaveBeenCalled();
    });

    it('forwards tag filters without requiring a text query', async () => {
      const { controller, searchUseCase } = buildController();

      const response = await search(controller, undefined, undefined, TAG_ID);

      expect(response).toEqual({ success: true, data: [] });
      expect(searchUseCase.execute).toHaveBeenCalledWith(
        { q: undefined, years: [], tagIds: [TAG_ID] },
        user,
      );
    });

    it('rejects missing query and tag parameters before reaching the use case', async () => {
      const { controller, searchUseCase } = buildController();

      await expect(search(controller)).rejects.toMatchObject({
        details: { reason: 'Search query or at least one tag is required' },
      });

      expect(searchUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects too-short scalar queries', async () => {
      const { controller, searchUseCase } = buildController();

      await expect(search(controller, 'c')).rejects.toMatchObject({
        details: {
          reason: `Search query must be at least ${TRANSACTION_SEARCH_QUERY_MIN_LENGTH} characters`,
        },
      });

      expect(searchUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects too-long scalar queries', async () => {
      const { controller, searchUseCase } = buildController();

      await expect(
        search(controller, 'x'.repeat(TRANSACTION_SEARCH_QUERY_MAX_LENGTH + 1)),
      ).rejects.toMatchObject({
        details: {
          reason: `Search query must be at most ${TRANSACTION_SEARCH_QUERY_MAX_LENGTH} characters`,
        },
      });

      expect(searchUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects invalid tag ids before reaching the use case', async () => {
      const { controller, searchUseCase } = buildController();

      await expect(
        search(controller, undefined, undefined, ['not-a-uuid']),
      ).rejects.toMatchObject({
        details: { reason: 'Tag ids must be valid UUIDs' },
      });

      expect(searchUseCase.execute).not.toHaveBeenCalled();
    });
  });
});
