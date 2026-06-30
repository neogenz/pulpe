import { describe, it, expect, mock } from 'bun:test';
import { createMockAuthenticatedUser } from '@/test/test-mocks';
import { BusinessException } from '@common/exceptions/business.exception';
import { TransactionController } from './transaction.controller';

function buildController() {
  const searchUseCase = {
    execute: mock(async () => []),
  };

  const controller = new TransactionController(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    searchUseCase as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
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
      ).rejects.toBeInstanceOf(BusinessException);

      expect(searchUseCase.execute).not.toHaveBeenCalled();
    });

    it('rejects too-short scalar queries', async () => {
      const { controller, searchUseCase } = buildController();

      await expect(
        controller.search('c', undefined, createMockAuthenticatedUser()),
      ).rejects.toBeInstanceOf(BusinessException);

      expect(searchUseCase.execute).not.toHaveBeenCalled();
    });
  });
});
