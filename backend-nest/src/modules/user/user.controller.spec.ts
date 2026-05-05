import { describe, it, expect, mock } from 'bun:test';
import { UserController } from './user.controller';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  createMockAuthenticatedUser,
  createMockPinoLogger,
} from '@/test/test-mocks';

interface UserMetadata {
  firstName?: string;
  lastName?: string;
  payDayOfMonth?: number | null;
  currency?: string;
  showCurrencySelector?: boolean;
}

function setupController(currentMetadata: UserMetadata) {
  const updateUserById = mock(
    (
      _userId: string,
      payload: { user_metadata: UserMetadata },
    ): Promise<{
      data: { user: { user_metadata: UserMetadata } };
      error: null;
    }> =>
      Promise.resolve({
        data: { user: { user_metadata: payload.user_metadata } },
        error: null,
      }),
  );

  const serviceRoleClient = {
    auth: { admin: { updateUserById } },
  };

  const authenticatedClient = {
    auth: {
      getUser: mock(() =>
        Promise.resolve({
          data: { user: { user_metadata: currentMetadata } },
          error: null,
        }),
      ),
    },
  } as unknown as AuthenticatedSupabaseClient;

  const mockSupabaseService = {
    getServiceRoleClient: mock(() => serviceRoleClient),
  };

  const controller = new UserController(
    createMockPinoLogger() as any,
    mockSupabaseService as any,
  );

  return { controller, updateUserById, authenticatedClient };
}

describe('UserController', () => {
  describe('updateSettings', () => {
    it('should preserve existing payDayOfMonth when PATCH omits it', async () => {
      const existingMetadata: UserMetadata = {
        firstName: 'Jane',
        payDayOfMonth: 15,
        currency: 'CHF',
      };

      const { controller, updateUserById, authenticatedClient } =
        setupController(existingMetadata);

      await controller.updateSettings(
        { currency: 'EUR' } as any,
        createMockAuthenticatedUser(),
        authenticatedClient,
      );

      expect(updateUserById).toHaveBeenCalledTimes(1);
      const sentMetadata = updateUserById.mock.calls[0]?.[1]?.user_metadata;
      expect(sentMetadata?.payDayOfMonth).toBe(15);
      expect(sentMetadata?.currency).toBe('EUR');
    });

    it('should update payDayOfMonth when PATCH provides it', async () => {
      const existingMetadata: UserMetadata = { payDayOfMonth: 15 };

      const { controller, updateUserById, authenticatedClient } =
        setupController(existingMetadata);

      await controller.updateSettings(
        { payDayOfMonth: 28 } as any,
        createMockAuthenticatedUser(),
        authenticatedClient,
      );

      const sentMetadata = updateUserById.mock.calls[0]?.[1]?.user_metadata;
      expect(sentMetadata?.payDayOfMonth).toBe(28);
    });

    it('should clear payDayOfMonth when PATCH explicitly sends null', async () => {
      const existingMetadata: UserMetadata = { payDayOfMonth: 15 };

      const { controller, updateUserById, authenticatedClient } =
        setupController(existingMetadata);

      await controller.updateSettings(
        { payDayOfMonth: null } as any,
        createMockAuthenticatedUser(),
        authenticatedClient,
      );

      const sentMetadata = updateUserById.mock.calls[0]?.[1]?.user_metadata;
      expect(sentMetadata?.payDayOfMonth).toBeNull();
    });

    it('should preserve existing currency when PATCH only sends payDayOfMonth', async () => {
      const existingMetadata: UserMetadata = {
        payDayOfMonth: 15,
        currency: 'EUR',
        showCurrencySelector: true,
      };

      const { controller, updateUserById, authenticatedClient } =
        setupController(existingMetadata);

      await controller.updateSettings(
        { payDayOfMonth: 20 } as any,
        createMockAuthenticatedUser(),
        authenticatedClient,
      );

      const sentMetadata = updateUserById.mock.calls[0]?.[1]?.user_metadata;
      expect(sentMetadata?.currency).toBe('EUR');
      expect(sentMetadata?.showCurrencySelector).toBe(true);
      expect(sentMetadata?.payDayOfMonth).toBe(20);
    });
  });
});
