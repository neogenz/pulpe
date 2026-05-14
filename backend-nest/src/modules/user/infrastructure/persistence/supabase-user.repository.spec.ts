import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import { SupabaseService } from '@modules/supabase/supabase.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { SupabaseUserRepository } from './supabase-user.repository';

interface MockUserMetadata {
  firstName?: string;
  lastName?: string;
  payDayOfMonth?: number | null;
  currency?: string;
  showCurrencySelector?: boolean;
  scheduledDeletionAt?: string;
}

function buildAuthenticatedClient(
  metadata: MockUserMetadata,
  userOverrides: Partial<{ id: string; email: string }> = {},
) {
  const updateUser = mock(
    (payload: {
      data: MockUserMetadata;
    }): Promise<{
      data: {
        user: { id: string; email: string; user_metadata: MockUserMetadata };
      };
      error: null;
    }> =>
      Promise.resolve({
        data: {
          user: {
            id: userOverrides.id ?? 'user-1',
            email: userOverrides.email ?? 'test@example.com',
            user_metadata: { ...metadata, ...payload.data },
          },
        },
        error: null,
      }),
  );

  return {
    auth: {
      getUser: mock(() =>
        Promise.resolve({
          data: {
            user: {
              id: userOverrides.id ?? 'user-1',
              email: userOverrides.email ?? 'test@example.com',
              user_metadata: metadata,
            },
          },
          error: null,
        }),
      ),
      updateUser,
    },
  };
}

function buildServiceRoleClient() {
  const updateUserById = mock(
    (
      _userId: string,
      payload: { user_metadata: MockUserMetadata },
    ): Promise<{
      data: { user: { id: string; user_metadata: MockUserMetadata } };
      error: null;
    }> =>
      Promise.resolve({
        data: {
          user: { id: _userId, user_metadata: payload.user_metadata },
        },
        error: null,
      }),
  );

  const signOut = mock(() => Promise.resolve({ error: null }));

  return {
    auth: { admin: { updateUserById, signOut } },
    updateUserById,
    signOut,
  };
}

describe('SupabaseUserRepository', () => {
  let repo: SupabaseUserRepository;
  let authenticatedProvider: AuthenticatedSupabaseProvider;
  let supabaseService: SupabaseService;
  let mockLogger: {
    info: ReturnType<typeof mock>;
    warn: ReturnType<typeof mock>;
  };

  beforeEach(async () => {
    mockLogger = { info: mock(() => {}), warn: mock(() => {}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseUserRepository,
        {
          provide: AuthenticatedSupabaseProvider,
          useValue: { client: undefined as any },
        },
        {
          provide: SupabaseService,
          useValue: { getServiceRoleClient: mock(() => ({})) },
        },
        {
          provide: `INFO_LOGGER:${SupabaseUserRepository.name}`,
          useValue: mockLogger,
        },
      ],
    }).compile();

    repo = module.get(SupabaseUserRepository);
    authenticatedProvider = module.get(AuthenticatedSupabaseProvider);
    supabaseService = module.get(SupabaseService);
  });

  describe('updateProfile', () => {
    it('returns the updated profile when supabase succeeds', async () => {
      const client = buildAuthenticatedClient({});
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => client,
      });

      const result = await repo.updateProfile({
        firstName: 'Jane',
        lastName: 'Doe',
      });

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      });
      expect(client.auth.updateUser).toHaveBeenCalledWith({
        data: { firstName: 'Jane', lastName: 'Doe' },
      });
    });

    it('throws BusinessException when supabase returns an error', async () => {
      const client = {
        auth: {
          updateUser: mock(() =>
            Promise.resolve({
              data: { user: null },
              error: new Error('boom'),
            }),
          ),
        },
      };
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => client,
      });

      await expect(
        repo.updateProfile({ firstName: 'Jane', lastName: 'Doe' }),
      ).rejects.toBeInstanceOf(BusinessException);
    });
  });

  describe('findSettings', () => {
    it('returns parsed settings from user_metadata', async () => {
      const client = buildAuthenticatedClient({
        payDayOfMonth: 15,
        currency: 'EUR',
        showCurrencySelector: true,
      });
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => client,
      });

      const result = await repo.findSettings();

      expect(result).toEqual({
        payDayOfMonth: 15,
        currency: 'EUR',
        showCurrencySelector: true,
      });
    });

    it('falls back to CHF when currency is invalid', async () => {
      const client = buildAuthenticatedClient({ currency: 'XYZ' });
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => client,
      });

      const result = await repo.findSettings();

      expect(result.currency).toBe('CHF');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns null payDayOfMonth and default currency when metadata is missing', async () => {
      const client = buildAuthenticatedClient({});
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => client,
      });

      const result = await repo.findSettings();

      expect(result).toEqual({
        payDayOfMonth: null,
        currency: 'CHF',
        showCurrencySelector: false,
      });
    });
  });

  describe('updateSettings', () => {
    it('preserves existing payDayOfMonth when patch omits it', async () => {
      const authClient = buildAuthenticatedClient({
        firstName: 'Jane',
        payDayOfMonth: 15,
        currency: 'CHF',
      });
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => authClient,
      });

      const serviceRole = buildServiceRoleClient();
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => serviceRole,
      );

      await repo.updateSettings('user-1', { currency: 'EUR' });

      expect(serviceRole.updateUserById).toHaveBeenCalledTimes(1);
      const sentMetadata =
        serviceRole.updateUserById.mock.calls[0]?.[1]?.user_metadata;
      expect(sentMetadata?.payDayOfMonth).toBe(15);
      expect(sentMetadata?.currency).toBe('EUR');
      expect(sentMetadata?.firstName).toBe('Jane');
    });

    it('clears payDayOfMonth when patch sends null explicitly', async () => {
      const authClient = buildAuthenticatedClient({ payDayOfMonth: 15 });
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => authClient,
      });
      const serviceRole = buildServiceRoleClient();
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => serviceRole,
      );

      await repo.updateSettings('user-1', { payDayOfMonth: null });

      const sentMetadata =
        serviceRole.updateUserById.mock.calls[0]?.[1]?.user_metadata;
      expect(sentMetadata?.payDayOfMonth).toBeNull();
    });

    it('throws BusinessException when admin update fails', async () => {
      const authClient = buildAuthenticatedClient({});
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => authClient,
      });

      const serviceRole = {
        auth: {
          admin: {
            updateUserById: mock(() =>
              Promise.resolve({
                data: { user: null },
                error: new Error('admin failure'),
              }),
            ),
          },
        },
      };
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => serviceRole,
      );

      await expect(
        repo.updateSettings('user-1', { currency: 'EUR' }),
      ).rejects.toBeInstanceOf(BusinessException);
    });
  });

  describe('scheduleDeletion', () => {
    it('returns existing scheduledDeletionAt without writing when already scheduled', async () => {
      const existing = '2026-05-08T10:00:00.000Z';
      const authClient = buildAuthenticatedClient({
        scheduledDeletionAt: existing,
      });
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => authClient,
      });
      const serviceRole = buildServiceRoleClient();
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => serviceRole,
      );

      const result = await repo.scheduleDeletion('user-1');

      expect(result).toEqual({
        scheduledDeletionAt: existing,
        alreadyScheduled: true,
      });
      expect(serviceRole.updateUserById).not.toHaveBeenCalled();
    });

    it('writes scheduledDeletionAt and returns alreadyScheduled=false otherwise', async () => {
      const authClient = buildAuthenticatedClient({ firstName: 'Jane' });
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => authClient,
      });
      const serviceRole = buildServiceRoleClient();
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => serviceRole,
      );

      const result = await repo.scheduleDeletion('user-1');

      expect(result.alreadyScheduled).toBe(false);
      expect(typeof result.scheduledDeletionAt).toBe('string');
      expect(serviceRole.updateUserById).toHaveBeenCalledTimes(1);
      const sentMetadata =
        serviceRole.updateUserById.mock.calls[0]?.[1]?.user_metadata;
      expect(sentMetadata?.firstName).toBe('Jane');
      expect(sentMetadata?.scheduledDeletionAt).toBe(
        result.scheduledDeletionAt,
      );
    });
  });

  describe('signOutGlobally', () => {
    it('calls service-role admin signOut with the access token', async () => {
      const serviceRole = buildServiceRoleClient();
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => serviceRole,
      );

      await repo.signOutGlobally('access-token');

      expect(serviceRole.signOut).toHaveBeenCalledWith(
        'access-token',
        'global',
      );
    });

    it('throws BusinessException when admin signOut fails', async () => {
      const serviceRole = {
        auth: {
          admin: {
            signOut: mock(() => Promise.resolve({ error: new Error('boom') })),
          },
        },
      };
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => serviceRole,
      );

      await expect(repo.signOutGlobally('access-token')).rejects.toBeInstanceOf(
        BusinessException,
      );
    });
  });
});
