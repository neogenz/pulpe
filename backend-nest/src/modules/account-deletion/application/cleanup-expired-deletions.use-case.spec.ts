import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { ACCOUNT_DELETION_REPOSITORY } from '../domain/ports/account-deletion-repository.port';
import { CleanupExpiredDeletionsUseCase } from './cleanup-expired-deletions.use-case';

describe('CleanupExpiredDeletionsUseCase', () => {
  let useCase: CleanupExpiredDeletionsUseCase;
  let mockRepo: {
    listExpiredScheduledUsers: ReturnType<typeof mock>;
    deleteUser: ReturnType<typeof mock>;
  };
  let mockLogger: {
    info: ReturnType<typeof mock>;
    warn: ReturnType<typeof mock>;
  };

  beforeEach(async () => {
    mockRepo = {
      listExpiredScheduledUsers: mock(async () => []),
      deleteUser: mock(async () => {}),
    };
    mockLogger = { info: mock(() => {}), warn: mock(() => {}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupExpiredDeletionsUseCase,
        { provide: ACCOUNT_DELETION_REPOSITORY, useValue: mockRepo },
        {
          provide: `INFO_LOGGER:${CleanupExpiredDeletionsUseCase.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    useCase = module.get(CleanupExpiredDeletionsUseCase);
  });

  describe('execute', () => {
    it('returns early without deleting when no users are expired', async () => {
      mockRepo.listExpiredScheduledUsers = mock(async () => []);

      await useCase.execute();

      expect(mockRepo.deleteUser).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'No expired scheduled deletions to process',
      );
    });

    it('deletes every expired user returned by the repository', async () => {
      const expiredUsers = [
        { id: 'user-1', email: 'a@example.com' },
        { id: 'user-2', email: 'b@example.com' },
      ];
      mockRepo.listExpiredScheduledUsers = mock(async () => expiredUsers);

      await useCase.execute();

      expect(mockRepo.deleteUser).toHaveBeenCalledWith('user-1');
      expect(mockRepo.deleteUser).toHaveBeenCalledWith('user-2');
    });

    it('logs partial failures without throwing', async () => {
      mockRepo.listExpiredScheduledUsers = mock(async () => [
        { id: 'user-1', email: 'a@example.com' },
        { id: 'user-2', email: 'b@example.com' },
      ]);
      let calls = 0;
      mockRepo.deleteUser = mock(async () => {
        calls += 1;
        if (calls === 2) throw new Error('Delete failed');
      });

      await expect(useCase.execute()).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('does not throw when listExpiredScheduledUsers fails (cron resilience)', async () => {
      mockRepo.listExpiredScheduledUsers = mock(async () => {
        throw new Error('Auth API unavailable');
      });

      await expect(useCase.execute()).resolves.toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
