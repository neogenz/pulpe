import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { ACCOUNT_DELETION_REPOSITORY } from '../domain/ports/account-deletion-repository.port';
import { POSTHOG_PERSON_DELETION_PORT } from '../domain/ports/posthog-person-deletion.port';
import { CleanupExpiredDeletionsUseCase } from './cleanup-expired-deletions.use-case';

describe('CleanupExpiredDeletionsUseCase', () => {
  let useCase: CleanupExpiredDeletionsUseCase;
  let mockRepo: {
    listExpiredScheduledUsers: ReturnType<typeof mock>;
    deleteUser: ReturnType<typeof mock>;
  };
  let mockPosthog: {
    deletePerson: ReturnType<typeof mock>;
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
    mockPosthog = {
      deletePerson: mock(async () => ({ ok: true, statusCode: 202 })),
    };
    mockLogger = { info: mock(() => {}), warn: mock(() => {}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupExpiredDeletionsUseCase,
        { provide: ACCOUNT_DELETION_REPOSITORY, useValue: mockRepo },
        { provide: POSTHOG_PERSON_DELETION_PORT, useValue: mockPosthog },
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

    it('continues processing remaining users when one deletion fails', async () => {
      mockRepo.listExpiredScheduledUsers = mock(async () => [
        { id: 'user-1', email: 'a@example.com' },
        { id: 'user-2', email: 'b@example.com' },
        { id: 'user-3', email: 'c@example.com' },
      ]);
      mockRepo.deleteUser = mock(async (userId: string) => {
        if (userId === 'user-2') throw new Error('Delete failed');
      });

      await expect(useCase.execute()).resolves.toBeUndefined();

      expect(mockRepo.deleteUser).toHaveBeenCalledTimes(3);
    });

    it('logs summary with severity=critical and failed count when any deletion fails', async () => {
      mockRepo.listExpiredScheduledUsers = mock(async () => [
        { id: 'user-1', email: 'a@example.com' },
        { id: 'user-2', email: 'b@example.com' },
      ]);
      mockRepo.deleteUser = mock(async (userId: string) => {
        if (userId === 'user-2') throw new Error('Delete failed');
      });

      await useCase.execute();

      const summaryWarnCall = mockLogger.warn.mock.calls.find(
        ([payload]) =>
          typeof payload === 'object' &&
          payload !== null &&
          'op' in payload &&
          payload.op === 'accountDeletion.cleanup.summary',
      );
      expect(summaryWarnCall).toBeDefined();
      const [payload] = summaryWarnCall!;
      expect(payload.severity).toBe('critical');
      expect(payload.failedCount).toBe(1);
      expect(payload.deletedCount).toBe(1);
      expect(payload.scheduledCount).toBe(2);
    });

    it('logs summary with severity=normal at info level when all deletions succeed', async () => {
      mockRepo.listExpiredScheduledUsers = mock(async () => [
        { id: 'user-1', email: 'a@example.com' },
        { id: 'user-2', email: 'b@example.com' },
      ]);

      await useCase.execute();

      const summaryInfoCall = mockLogger.info.mock.calls.find(
        ([payload]) =>
          typeof payload === 'object' &&
          payload !== null &&
          'op' in payload &&
          payload.op === 'accountDeletion.cleanup.summary',
      );
      expect(summaryInfoCall).toBeDefined();
      const [payload] = summaryInfoCall!;
      expect(payload.severity).toBe('normal');
      expect(payload.failedCount).toBe(0);
      expect(payload.deletedCount).toBe(2);
      expect(payload.scheduledCount).toBe(2);
    });

    it('does not throw when listExpiredScheduledUsers fails (cron resilience)', async () => {
      mockRepo.listExpiredScheduledUsers = mock(async () => {
        throw new Error('Auth API unavailable');
      });

      await expect(useCase.execute()).resolves.toBeUndefined();
    });

    it('logs catch-all failure with severity=critical and op tag for alerting', async () => {
      mockRepo.listExpiredScheduledUsers = mock(async () => {
        throw new Error('Auth API unavailable');
      });

      await useCase.execute();

      const failureWarnCall = mockLogger.warn.mock.calls.find(
        ([payload]) =>
          typeof payload === 'object' &&
          payload !== null &&
          'op' in payload &&
          payload.op === 'accountDeletion.cleanup.fatal',
      );
      expect(failureWarnCall).toBeDefined();
      const [payload] = failureWarnCall!;
      expect(payload.severity).toBe('critical');
      expect(payload.err).toBeInstanceOf(Error);
    });

    it('calls PostHog deletePerson once per successfully deleted user', async () => {
      mockRepo.listExpiredScheduledUsers = mock(async () => [
        { id: 'user-1', email: 'a@example.com' },
        { id: 'user-2', email: 'b@example.com' },
      ]);

      await useCase.execute();

      expect(mockPosthog.deletePerson).toHaveBeenCalledTimes(2);
      expect(mockPosthog.deletePerson).toHaveBeenCalledWith('user-1');
      expect(mockPosthog.deletePerson).toHaveBeenCalledWith('user-2');
    });

    it('emits a critical warn but does not roll back Supabase delete when PostHog fails', async () => {
      mockRepo.listExpiredScheduledUsers = mock(async () => [
        { id: 'user-1', email: 'a@example.com' },
      ]);
      mockPosthog.deletePerson = mock(async () => ({
        ok: false,
        reason: 'http_error' as const,
        statusCode: 500,
      }));

      await useCase.execute();

      expect(mockRepo.deleteUser).toHaveBeenCalledWith('user-1');
      const posthogFailedWarn = mockLogger.warn.mock.calls.find(
        ([payload]) =>
          typeof payload === 'object' &&
          payload !== null &&
          'op' in payload &&
          payload.op === 'accountDeletion.posthog.failed',
      );
      expect(posthogFailedWarn).toBeDefined();
      const [payload] = posthogFailedWarn!;
      expect(payload.severity).toBe('critical');
      expect(payload.userId).toBe('user-1');
      expect(payload.reason).toBe('http_error');
      expect(payload.statusCode).toBe(500);

      const summaryInfoCall = mockLogger.info.mock.calls.find(
        ([p]) =>
          typeof p === 'object' &&
          p !== null &&
          'op' in p &&
          p.op === 'accountDeletion.cleanup.summary',
      );
      expect(summaryInfoCall).toBeDefined();
      const [summary] = summaryInfoCall!;
      expect(summary.deletedCount).toBe(1);
      expect(summary.failedCount).toBe(0);
    });

    it('silently skips PostHog warn when integration is disabled', async () => {
      mockRepo.listExpiredScheduledUsers = mock(async () => [
        { id: 'user-1', email: 'a@example.com' },
      ]);
      mockPosthog.deletePerson = mock(async () => ({
        ok: false,
        reason: 'disabled' as const,
      }));

      await useCase.execute();

      expect(mockRepo.deleteUser).toHaveBeenCalledWith('user-1');
      const posthogFailedWarn = mockLogger.warn.mock.calls.find(
        ([payload]) =>
          typeof payload === 'object' &&
          payload !== null &&
          'op' in payload &&
          payload.op === 'accountDeletion.posthog.failed',
      );
      expect(posthogFailedWarn).toBeUndefined();
    });

    it('should count Supabase deletion as fulfilled even when PostHog port unexpectedly throws', async () => {
      mockRepo.listExpiredScheduledUsers = mock(async () => [
        { id: 'user-1', email: 'a@example.com' },
      ]);
      mockPosthog.deletePerson = mock(async () => {
        throw new Error('boom');
      });

      await useCase.execute();

      expect(mockRepo.deleteUser).toHaveBeenCalledWith('user-1');

      const summaryInfoCall = mockLogger.info.mock.calls.find(
        ([payload]) =>
          typeof payload === 'object' &&
          payload !== null &&
          'op' in payload &&
          payload.op === 'accountDeletion.cleanup.summary',
      );
      expect(summaryInfoCall).toBeDefined();
      const [summary] = summaryInfoCall!;
      expect(summary.deletedCount).toBe(1);
      expect(summary.failedCount).toBe(0);

      const sideEffectWarn = mockLogger.warn.mock.calls.find(
        ([, message]) =>
          typeof message === 'string' &&
          message === 'Post-deletion side-effect failed unexpectedly',
      );
      expect(sideEffectWarn).toBeDefined();
    });
  });
});
