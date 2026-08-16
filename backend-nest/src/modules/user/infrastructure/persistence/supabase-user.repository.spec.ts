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
  locale?: string;
  scheduledDeletionAt?: string;
}

function buildAuthenticatedClient(
  metadata: MockUserMetadata,
  userOverrides: Partial<{ id: string; email: string }> = {},
  appMetadata: unknown = {},
  localePreference: {
    persistedLocale?: string | null;
    readError?: Error;
    upsertError?: Error;
  } = {},
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

  let upsertedLocale: string | undefined;
  const localeQuery = {
    select: mock(() => localeQuery),
    eq: mock(() => localeQuery),
    maybeSingle: mock(() =>
      Promise.resolve({
        data:
          localePreference.persistedLocale == null
            ? null
            : { locale: localePreference.persistedLocale },
        error: localePreference.readError ?? null,
      }),
    ),
    upsert: mock((row: { user_id: string; locale: string }) => {
      upsertedLocale = row.locale;
      return localeQuery;
    }),
    single: mock(() =>
      Promise.resolve({
        data: localePreference.upsertError ? null : { locale: upsertedLocale },
        error: localePreference.upsertError ?? null,
      }),
    ),
  };

  return {
    auth: {
      getUser: mock(() =>
        Promise.resolve({
          data: {
            user: {
              id: userOverrides.id ?? 'user-1',
              email: userOverrides.email ?? 'test@example.com',
              app_metadata: appMetadata,
              user_metadata: metadata,
            },
          },
          error: null,
        }),
      ),
      updateUser,
    },
    from: mock(() => localeQuery),
    localeQuery,
  };
}

function buildServiceRoleClient() {
  const updateUserById = mock(
    (
      _userId: string,
      payload: {
        user_metadata?: MockUserMetadata;
        app_metadata?: Record<string, unknown>;
      },
    ): Promise<{
      data: {
        user: {
          id: string;
          user_metadata: MockUserMetadata;
          app_metadata: Record<string, unknown>;
        };
      };
      error: null;
    }> =>
      Promise.resolve({
        data: {
          user: {
            id: _userId,
            user_metadata: payload.user_metadata ?? {},
            app_metadata: payload.app_metadata ?? {},
          },
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
    it('returns settings with locale from the dedicated preference table', async () => {
      const client = buildAuthenticatedClient(
        {
          payDayOfMonth: 15,
          currency: 'EUR',
          showCurrencySelector: true,
          locale: 'de',
        },
        {},
        {},
        { persistedLocale: 'it' },
      );
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => client,
      });

      const result = await repo.findSettings();

      expect(result).toEqual({
        payDayOfMonth: 15,
        currency: 'EUR',
        showCurrencySelector: true,
        locale: 'it',
      });
      expect(client.from).toHaveBeenCalledWith('user_locale_preference');
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

    it('ignores a persisted locale that is not supported', async () => {
      const client = buildAuthenticatedClient(
        {},
        {},
        {},
        {
          persistedLocale: 'es',
        },
      );
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => client,
      });

      const result = await repo.findSettings();

      expect(result.locale).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('uses legacy metadata only when no preference row exists', async () => {
      const client = buildAuthenticatedClient({ locale: 'de' });
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => client,
      });

      const result = await repo.findSettings();

      expect(result.locale).toBe('de');
    });

    it('throws BusinessException when the locale query fails', async () => {
      const client = buildAuthenticatedClient(
        {},
        {},
        {},
        {
          readError: new Error('query failure'),
        },
      );
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => client,
      });

      await expect(repo.findSettings()).rejects.toBeInstanceOf(
        BusinessException,
      );
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
      expect(mockLogger.warn).not.toHaveBeenCalled();
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

    it('preserves an existing locale when patch omits it', async () => {
      const authClient = buildAuthenticatedClient(
        { payDayOfMonth: 15 },
        {},
        {},
        { persistedLocale: 'de' },
      );
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => authClient,
      });
      const serviceRole = buildServiceRoleClient();
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => serviceRole,
      );

      const result = await repo.updateSettings('user-1', { payDayOfMonth: 5 });

      const sentMetadata =
        serviceRole.updateUserById.mock.calls[0]?.[1]?.user_metadata;
      expect(sentMetadata?.locale).toBeUndefined();
      expect(result.locale).toBe('de');
    });

    it('upserts locale through RLS without using the service role', async () => {
      const authClient = buildAuthenticatedClient(
        { payDayOfMonth: 15, currency: 'EUR' },
        {},
        {},
        { persistedLocale: 'de' },
      );
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => authClient,
      });
      const serviceRole = buildServiceRoleClient();
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => serviceRole,
      );

      const result = await repo.updateSettings('user-1', { locale: 'it' });

      expect(serviceRole.updateUserById).not.toHaveBeenCalled();
      expect(authClient.localeQuery.upsert).toHaveBeenCalledWith(
        { user_id: 'user-1', locale: 'it' },
        { onConflict: 'user_id' },
      );
      expect(result.locale).toBe('it');
    });

    it('throws BusinessException when the locale upsert fails', async () => {
      const authClient = buildAuthenticatedClient(
        {},
        {},
        {},
        {
          upsertError: new Error('upsert failure'),
        },
      );
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => authClient,
      });

      await expect(
        repo.updateSettings('user-1', { locale: 'it' }),
      ).rejects.toBeInstanceOf(BusinessException);
    });

    it('rejects a settings update for a different user id', async () => {
      const authClient = buildAuthenticatedClient({});
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => authClient,
      });
      const serviceRole = buildServiceRoleClient();
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => serviceRole,
      );

      await expect(
        repo.updateSettings('user-2', { currency: 'EUR' }),
      ).rejects.toBeInstanceOf(BusinessException);
      expect(serviceRole.updateUserById).not.toHaveBeenCalled();
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
      const authClient = buildAuthenticatedClient(
        {},
        {},
        {
          scheduledDeletionAt: existing,
        },
      );
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
      const authClient = buildAuthenticatedClient(
        {},
        {},
        {
          provider: 'email',
        },
      );
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
        serviceRole.updateUserById.mock.calls[0]?.[1]?.app_metadata;
      expect(sentMetadata?.provider).toBe('email');
      expect(sentMetadata?.scheduledDeletionAt).toBe(
        result.scheduledDeletionAt,
      );
    });

    it('ignores a client-owned scheduledDeletionAt value', async () => {
      const authClient = buildAuthenticatedClient({
        scheduledDeletionAt: '2020-01-01T00:00:00.000Z',
      });
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => authClient,
      });
      const serviceRole = buildServiceRoleClient();
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => serviceRole,
      );

      const result = await repo.scheduleDeletion('user-1');

      expect(result.alreadyScheduled).toBe(false);
      expect(serviceRole.updateUserById).toHaveBeenCalledTimes(1);
    });

    it('replaces invalid app_metadata with the server-owned deletion claim', async () => {
      const authClient = buildAuthenticatedClient({}, {}, 'invalid');
      Object.defineProperty(authenticatedProvider, 'client', {
        get: () => authClient,
      });
      const serviceRole = buildServiceRoleClient();
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => serviceRole,
      );

      const result = await repo.scheduleDeletion('user-1');
      const sentMetadata =
        serviceRole.updateUserById.mock.calls[0]?.[1]?.app_metadata;

      expect(sentMetadata).toEqual({
        scheduledDeletionAt: result.scheduledDeletionAt,
      });
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
