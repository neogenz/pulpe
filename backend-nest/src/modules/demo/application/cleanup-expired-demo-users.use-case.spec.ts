import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { DEMO_CREDENTIALS_PORT } from '../domain/ports/demo-credentials.port';
import { CleanupExpiredDemoUsersUseCase } from './cleanup-expired-demo-users.use-case';

describe('CleanupExpiredDemoUsersUseCase', () => {
  let useCase: CleanupExpiredDemoUsersUseCase;
  let mockCreds: {
    generateCredentials: ReturnType<typeof mock>;
    createDemoUser: ReturnType<typeof mock>;
    signInDemoUser: ReturnType<typeof mock>;
    deleteUser: ReturnType<typeof mock>;
    listExpiredDemoUsers: ReturnType<typeof mock>;
    bulkDeleteUsers: ReturnType<typeof mock>;
  };
  let module: TestingModule;

  beforeEach(async () => {
    mockCreds = {
      generateCredentials: mock(() => ({})),
      createDemoUser: mock(async () => ({})),
      signInDemoUser: mock(async () => ({})),
      deleteUser: mock(async () => {}),
      listExpiredDemoUsers: mock(async () => []),
      bulkDeleteUsers: mock(async () => ({ fulfilled: [], rejected: [] })),
    };

    module = await Test.createTestingModule({
      providers: [
        CleanupExpiredDemoUsersUseCase,
        { provide: DEMO_CREDENTIALS_PORT, useValue: mockCreds },
        {
          provide: `INFO_LOGGER:${CleanupExpiredDemoUsersUseCase.name}`,
          useValue: { info: mock(() => {}), warn: mock(() => {}) },
        },
      ],
    }).compile();

    useCase = module.get(CleanupExpiredDemoUsersUseCase);
  });

  describe('execute - 24h retention policy', () => {
    it('should only delete users older than 24 hours', async () => {
      const expiredUsers = [
        { id: 'user-1', email: 'demo-1@pulpe.app' },
        { id: 'user-2', email: 'demo-2@pulpe.app' },
      ];
      mockCreds.listExpiredDemoUsers = mock(async () => expiredUsers);
      mockCreds.bulkDeleteUsers = mock(async () => ({
        fulfilled: ['user-1', 'user-2'],
        rejected: [],
      }));

      await useCase.execute();

      expect(mockCreds.listExpiredDemoUsers).toHaveBeenCalledWith(
        expect.any(Date),
        false,
      );
      expect(mockCreds.bulkDeleteUsers).toHaveBeenCalledWith([
        'user-1',
        'user-2',
      ]);
    });

    it('should not call bulkDeleteUsers when no expired users exist', async () => {
      mockCreds.listExpiredDemoUsers = mock(async () => []);

      await useCase.execute();

      expect(mockCreds.bulkDeleteUsers).not.toHaveBeenCalled();
    });
  });

  describe('execute - resilience', () => {
    it('should not throw if listExpiredDemoUsers fails (cron resilience)', async () => {
      mockCreds.listExpiredDemoUsers = mock(async () => {
        throw new Error('Auth API unavailable');
      });

      await expect(useCase.execute()).resolves.toBeUndefined();
    });
  });
});
