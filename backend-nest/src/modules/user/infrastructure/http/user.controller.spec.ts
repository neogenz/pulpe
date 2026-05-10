import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockAuthenticatedUser } from '@/test/test-mocks';
import { UserController } from './user.controller';
import type { GetUserProfileUseCase } from '../../application/get-user-profile.use-case';
import type { UpdateUserProfileUseCase } from '../../application/update-user-profile.use-case';
import type { GetUserSettingsUseCase } from '../../application/get-user-settings.use-case';
import type { UpdateUserSettingsUseCase } from '../../application/update-user-settings.use-case';
import type { ScheduleAccountDeletionUseCase } from '../../application/schedule-account-deletion.use-case';

function buildController() {
  const getProfile = {
    execute: mock(() => ({
      id: 'user-1',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
    })),
  };
  const updateProfile = {
    execute: mock(async () => ({
      id: 'user-1',
      email: 'jane@example.com',
      firstName: 'Updated',
      lastName: 'Doe',
    })),
  };
  const getSettings = {
    execute: mock(async () => ({
      payDayOfMonth: 15,
      currency: 'EUR' as const,
      showCurrencySelector: true,
    })),
  };
  const updateSettings = {
    execute: mock(async () => ({
      payDayOfMonth: 20,
      currency: 'CHF' as const,
      showCurrencySelector: false,
    })),
  };
  const scheduleDeletion = {
    execute: mock(async () => ({
      scheduledDeletionAt: '2026-05-08T12:00:00.000Z',
      alreadyScheduled: false,
    })),
  };

  const controller = new UserController(
    getProfile as unknown as GetUserProfileUseCase,
    updateProfile as unknown as UpdateUserProfileUseCase,
    getSettings as unknown as GetUserSettingsUseCase,
    updateSettings as unknown as UpdateUserSettingsUseCase,
    scheduleDeletion as unknown as ScheduleAccountDeletionUseCase,
  );

  return {
    controller,
    getProfile,
    updateProfile,
    getSettings,
    updateSettings,
    scheduleDeletion,
  };
}

describe('UserController (HTTP wiring)', () => {
  let helpers: ReturnType<typeof buildController>;

  beforeEach(() => {
    helpers = buildController();
  });

  describe('GET /users/me', () => {
    it('wraps the use-case result in { success: true, user }', () => {
      const user = createMockAuthenticatedUser();
      const response = helpers.controller.getProfile(user);

      expect(response.success).toBe(true);
      expect(response.user).toEqual({
        id: 'user-1',
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      });
      expect(helpers.getProfile.execute).toHaveBeenCalledWith(user);
    });
  });

  describe('PUT /users/profile', () => {
    it('calls UpdateUserProfileUseCase and wraps the result', async () => {
      const user = createMockAuthenticatedUser();
      const response = await helpers.controller.updateProfile(
        { firstName: 'Updated', lastName: 'Doe' } as any,
        user,
      );

      expect(response.success).toBe(true);
      expect(response.user.firstName).toBe('Updated');
      expect(helpers.updateProfile.execute).toHaveBeenCalledWith(
        { firstName: 'Updated', lastName: 'Doe' },
        user,
      );
    });
  });

  describe('GET /users/settings', () => {
    it('wraps settings in { success: true, data }', async () => {
      const response = await helpers.controller.getSettings();

      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        payDayOfMonth: 15,
        currency: 'EUR',
        showCurrencySelector: true,
      });
    });
  });

  describe('PUT /users/settings', () => {
    it('forwards patch + user to the use case', async () => {
      const user = createMockAuthenticatedUser();
      const response = await helpers.controller.updateSettings(
        { payDayOfMonth: 20 } as any,
        user,
      );

      expect(response.success).toBe(true);
      expect(response.data.payDayOfMonth).toBe(20);
      expect(helpers.updateSettings.execute).toHaveBeenCalledWith(
        { payDayOfMonth: 20 },
        user,
      );
    });
  });

  describe('DELETE /users/account', () => {
    it('returns the not-yet-scheduled French message when alreadyScheduled=false', async () => {
      const response = await helpers.controller.deleteAccount(
        createMockAuthenticatedUser(),
      );

      expect(response.success).toBe(true);
      expect(response.message).toBe('Ton compte sera supprimé dans 3 jours');
      expect(response.scheduledDeletionAt).toBe('2026-05-08T12:00:00.000Z');
    });

    it('returns the already-scheduled French message when alreadyScheduled=true', async () => {
      helpers.scheduleDeletion.execute = mock(async () => ({
        scheduledDeletionAt: '2026-04-01T00:00:00.000Z',
        alreadyScheduled: true,
      }));

      const response = await helpers.controller.deleteAccount(
        createMockAuthenticatedUser(),
      );

      expect(response.message).toBe(
        'Ton compte est déjà programmé pour suppression',
      );
      expect(response.scheduledDeletionAt).toBe('2026-04-01T00:00:00.000Z');
    });
  });
});
