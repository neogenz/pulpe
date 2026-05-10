import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { createMockAuthenticatedUser } from '@/test/test-mocks';
import { BusinessException } from '@common/exceptions/business.exception';
import { USER_REPOSITORY } from '../domain/ports/user-repository.port';
import { UpdateUserProfileUseCase } from './update-user-profile.use-case';

describe('UpdateUserProfileUseCase', () => {
  let useCase: UpdateUserProfileUseCase;
  let mockRepo: { updateProfile: ReturnType<typeof mock> };
  let mockLogger: {
    info: ReturnType<typeof mock>;
    warn: ReturnType<typeof mock>;
  };

  beforeEach(async () => {
    mockRepo = { updateProfile: mock(async () => ({})) };
    mockLogger = { info: mock(() => {}), warn: mock(() => {}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateUserProfileUseCase,
        { provide: USER_REPOSITORY, useValue: mockRepo },
        {
          provide: `INFO_LOGGER:${UpdateUserProfileUseCase.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    useCase = module.get(UpdateUserProfileUseCase);
  });

  it('validates input then delegates to the repository', async () => {
    const expected = {
      id: 'user-1',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
    };
    mockRepo.updateProfile = mock(async () => expected);

    const result = await useCase.execute(
      { firstName: 'Jane', lastName: 'Doe' },
      createMockAuthenticatedUser(),
    );

    expect(result).toEqual(expected);
    expect(mockRepo.updateProfile).toHaveBeenCalledWith({
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('throws BusinessException without calling the repository when invariants fail', async () => {
    await expect(
      useCase.execute(
        { firstName: '', lastName: 'Doe' },
        createMockAuthenticatedUser(),
      ),
    ).rejects.toBeInstanceOf(BusinessException);
    expect(mockRepo.updateProfile).not.toHaveBeenCalled();
  });
});
