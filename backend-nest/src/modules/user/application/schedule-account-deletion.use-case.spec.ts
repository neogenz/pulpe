import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { createMockAuthenticatedUser } from '@/test/test-mocks';
import { BusinessException } from '@common/exceptions/business.exception';
import { ENCRYPTION_PORT } from '@modules/encryption/domain/ports/encryption.port';
import { USER_REPOSITORY } from '../domain/ports/user-repository.port';
import { ScheduleAccountDeletionUseCase } from './schedule-account-deletion.use-case';

describe('ScheduleAccountDeletionUseCase', () => {
  let useCase: ScheduleAccountDeletionUseCase;
  let mockRepo: {
    scheduleDeletion: ReturnType<typeof mock>;
    signOutGlobally: ReturnType<typeof mock>;
  };
  let mockLogger: {
    info: ReturnType<typeof mock>;
    warn: ReturnType<typeof mock>;
  };
  let mockEncryption: {
    verifyAndEnsureKeyCheck: ReturnType<typeof mock>;
  };

  beforeEach(async () => {
    mockRepo = {
      scheduleDeletion: mock(async () => ({
        scheduledDeletionAt: '2026-05-08T12:00:00.000Z',
        alreadyScheduled: false,
      })),
      signOutGlobally: mock(async () => undefined),
    };
    mockLogger = { info: mock(() => {}), warn: mock(() => {}) };
    mockEncryption = {
      verifyAndEnsureKeyCheck: mock(async () => true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleAccountDeletionUseCase,
        { provide: USER_REPOSITORY, useValue: mockRepo },
        { provide: ENCRYPTION_PORT, useValue: mockEncryption },
        {
          provide: `INFO_LOGGER:${ScheduleAccountDeletionUseCase.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    useCase = module.get(ScheduleAccountDeletionUseCase);
  });

  it('validates the vault key, schedules deletion, then signs out globally', async () => {
    const callOrder: string[] = [];
    mockEncryption.verifyAndEnsureKeyCheck = mock(async () => {
      callOrder.push('verifyKey');
      return true;
    });
    mockRepo.scheduleDeletion = mock(async () => {
      callOrder.push('scheduleDeletion');
      return {
        scheduledDeletionAt: '2026-05-08T12:00:00.000Z',
        alreadyScheduled: false,
      };
    });
    mockRepo.signOutGlobally = mock(async () => {
      callOrder.push('signOutGlobally');
    });

    const user = createMockAuthenticatedUser();
    const result = await useCase.execute(user);

    expect(callOrder).toEqual([
      'verifyKey',
      'scheduleDeletion',
      'signOutGlobally',
    ]);
    expect(mockEncryption.verifyAndEnsureKeyCheck).toHaveBeenCalledWith(
      user.id,
      user.clientKey,
    );
    expect(mockRepo.signOutGlobally).toHaveBeenCalledWith(user.accessToken);
    expect(result.alreadyScheduled).toBe(false);
    expect(result.scheduledDeletionAt).toBe('2026-05-08T12:00:00.000Z');
  });

  it('still signs out when deletion is already scheduled (idempotent path)', async () => {
    mockRepo.scheduleDeletion = mock(async () => ({
      scheduledDeletionAt: '2026-04-01T00:00:00.000Z',
      alreadyScheduled: true,
    }));

    const result = await useCase.execute(createMockAuthenticatedUser());

    expect(result.alreadyScheduled).toBe(true);
    expect(result.scheduledDeletionAt).toBe('2026-04-01T00:00:00.000Z');
    expect(mockRepo.signOutGlobally).toHaveBeenCalledTimes(1);
  });

  it('does not catch signOut errors (let them propagate so the controller can map to 500)', async () => {
    mockRepo.signOutGlobally = mock(async () => {
      throw new Error('admin sign-out failure');
    });

    await expect(
      useCase.execute(createMockAuthenticatedUser()),
    ).rejects.toThrow('admin sign-out failure');
  });

  it('rejects a wrong vault key before scheduling or signing out', async () => {
    mockEncryption.verifyAndEnsureKeyCheck = mock(async () => false);

    await expect(
      useCase.execute(createMockAuthenticatedUser()),
    ).rejects.toBeInstanceOf(BusinessException);

    expect(mockRepo.scheduleDeletion).not.toHaveBeenCalled();
    expect(mockRepo.signOutGlobally).not.toHaveBeenCalled();
  });
});
