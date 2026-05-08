import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { createMockAuthenticatedUser } from '@/test/test-mocks';
import { USER_REPOSITORY } from '../domain/ports/user-repository.port';
import { UpdateUserSettingsUseCase } from './update-user-settings.use-case';

describe('UpdateUserSettingsUseCase', () => {
  let useCase: UpdateUserSettingsUseCase;
  let mockRepo: { updateSettings: ReturnType<typeof mock> };
  let mockLogger: {
    info: ReturnType<typeof mock>;
    warn: ReturnType<typeof mock>;
  };

  beforeEach(async () => {
    mockRepo = { updateSettings: mock(async () => ({})) };
    mockLogger = { info: mock(() => {}), warn: mock(() => {}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateUserSettingsUseCase,
        { provide: USER_REPOSITORY, useValue: mockRepo },
        {
          provide: `INFO_LOGGER:${UpdateUserSettingsUseCase.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    useCase = module.get(UpdateUserSettingsUseCase);
  });

  it('forwards (userId, patch) to the repository and logs success', async () => {
    const settings = {
      payDayOfMonth: 28,
      currency: 'EUR' as const,
      showCurrencySelector: false,
    };
    mockRepo.updateSettings = mock(async () => settings);

    const user = createMockAuthenticatedUser();
    const result = await useCase.execute({ payDayOfMonth: 28 }, user);

    expect(result).toEqual(settings);
    expect(mockRepo.updateSettings).toHaveBeenCalledWith(user.id, {
      payDayOfMonth: 28,
    });
    expect(mockLogger.info).toHaveBeenCalled();
  });
});
