import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Test, type TestingModule } from '@nestjs/testing';
import { SupabaseService } from '@modules/supabase/supabase.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { API_ERROR_CODES } from 'pulpe-shared';
import { SupabaseEncryptionKeyRepository } from './supabase-encryption-key.repository';

const USER_ID = 'user-1';

type Spy = ReturnType<typeof mock>;

interface SupabaseResult<T> {
  data: T | null;
  error: { code?: string; message?: string } | null;
}

interface QueryBuilderSpies {
  select: Spy;
  eq: Spy;
  is: Spy;
  update: Spy;
  upsert: Spy;
  single: Spy;
  maybeSingle: Spy;
}

/**
 * Builds a chainable Supabase query mock. Each fluent method (`select`, `eq`,
 * `is`, `update`, `upsert`) is a *separate* spy returning the same builder, so
 * tests can assert the exact arguments passed at each chain step (catches
 * regressions where `.eq('user_id', userId)` is dropped on a service-role
 * write — that would silently bypass the per-row user filter).
 *
 * Terminators (`single`, `maybeSingle`) resolve to the provided result. Plain
 * awaits on the builder (e.g. `await supabase.from(...).update(...).eq(...)`)
 * also resolve to the result via the `then` shim.
 */
function buildQueryBuilder<T>(result: SupabaseResult<T>): {
  builder: Record<string, unknown>;
  spies: QueryBuilderSpies;
} {
  const builder: Record<string, unknown> = {};
  const spies: QueryBuilderSpies = {
    select: mock(() => builder),
    eq: mock(() => builder),
    is: mock(() => builder),
    update: mock(() => builder),
    upsert: mock(() => builder),
    single: mock(() => Promise.resolve(result)),
    maybeSingle: mock(() => Promise.resolve(result)),
  };
  builder.select = spies.select;
  builder.eq = spies.eq;
  builder.is = spies.is;
  builder.update = spies.update;
  builder.upsert = spies.upsert;
  builder.single = spies.single;
  builder.maybeSingle = spies.maybeSingle;
  // Allow `await builder` (used by `update().eq(...)` paths that don't call
  // `.single()`/`.maybeSingle()`).
  builder.then = (
    onFulfilled: (value: SupabaseResult<T>) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return { builder, spies };
}

function buildServiceRoleClient<T>(result: SupabaseResult<T>) {
  const { builder, spies } = buildQueryBuilder(result);
  const from = mock(() => builder);
  return { from, builder, spies };
}

function expectRepositoryFailure(
  exception: unknown,
  operation: string,
  cause: { code?: string; message?: string },
): asserts exception is BusinessException {
  expect(exception).toBeInstanceOf(BusinessException);
  const ex = exception as BusinessException;
  expect(ex.code).toBe(API_ERROR_CODES.ENCRYPTION_REPOSITORY_FAILURE);
  expect(ex.code).toBe('ERR_ENCRYPTION_REPOSITORY_FAILURE');
  expect(ex.message).toBe('Encryption key store unavailable');
  expect(ex.details).toBeUndefined();
  expect(ex.loggingContext.userId).toBe(USER_ID);
  expect(ex.loggingContext.operation).toBe(operation);
  expect(ex.loggingContext.supabaseCode).toBe(cause.code);
  expect(ex.loggingContext.supabaseMessage).toBe(cause.message);
  expect(ex.cause).toBe(cause);
}

async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    throw new Error('expected promise to reject');
  } catch (error) {
    return error;
  }
}

describe('SupabaseEncryptionKeyRepository', () => {
  let repo: SupabaseEncryptionKeyRepository;
  let supabaseService: SupabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseEncryptionKeyRepository,
        {
          provide: SupabaseService,
          useValue: {
            getServiceRoleClient: mock() as ReturnType<typeof mock>,
          },
        },
      ],
    }).compile();

    repo = module.get(SupabaseEncryptionKeyRepository);
    supabaseService = module.get(SupabaseService);
  });

  describe('findSaltByUserId', () => {
    it('returns the salt projection on success', async () => {
      const row = { salt: 'abc', kdf_iterations: 600_000, key_check: null };
      const { from } = buildServiceRoleClient({ data: row, error: null });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const result = await repo.findSaltByUserId(USER_ID);

      expect(result).toEqual(row);
      expect(from).toHaveBeenCalledWith('user_encryption_key');
    });

    it('returns null on PGRST116 (not found)', async () => {
      const { from } = buildServiceRoleClient({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const result = await repo.findSaltByUserId(USER_ID);

      expect(result).toBeNull();
    });

    it('throws BusinessException with operation context on supabase error', async () => {
      const dbError = { code: '23505', message: 'duplicate key' };
      const { from } = buildServiceRoleClient({ data: null, error: dbError });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const exception = await captureRejection(repo.findSaltByUserId(USER_ID));

      expectRepositoryFailure(exception, 'findSaltByUserId', dbError);
    });

    it('preserves undefined supabaseCode/supabaseMessage when error lacks both fields', async () => {
      const dbError = {} as { code?: string; message?: string };
      const { from } = buildServiceRoleClient({ data: null, error: dbError });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const exception = await captureRejection(repo.findSaltByUserId(USER_ID));

      expect(exception).toBeInstanceOf(BusinessException);
      const ex = exception as BusinessException;
      expect(ex.code).toBe(API_ERROR_CODES.ENCRYPTION_REPOSITORY_FAILURE);
      expect(ex.message).toBe('Encryption key store unavailable');
      expect(ex.loggingContext.supabaseCode).toBeUndefined();
      expect(ex.loggingContext.supabaseMessage).toBeUndefined();
      expect(ex.loggingContext.userId).toBe(USER_ID);
      expect(ex.loggingContext.operation).toBe('findSaltByUserId');
      expect(ex.cause).toBe(dbError);
    });
  });

  describe('upsertSalt', () => {
    it('resolves on success', async () => {
      const { from } = buildServiceRoleClient({ data: null, error: null });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      await repo.upsertSalt(USER_ID, 'deadbeef', 600_000);

      expect(from).toHaveBeenCalledWith('user_encryption_key');
    });

    it('upserts the row keyed on user_id with the salt + iterations payload', async () => {
      const { from, spies } = buildServiceRoleClient({
        data: null,
        error: null,
      });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      await repo.upsertSalt(USER_ID, 'deadbeef', 600_000);

      expect(spies.upsert).toHaveBeenCalledTimes(1);
      expect(spies.upsert).toHaveBeenCalledWith(
        {
          user_id: USER_ID,
          salt: 'deadbeef',
          kdf_iterations: 600_000,
        },
        { onConflict: 'user_id', ignoreDuplicates: true },
      );
    });

    it('throws BusinessException with operation context on supabase error', async () => {
      const dbError = { code: '08006', message: 'connection failure' };
      const { from } = buildServiceRoleClient({ data: null, error: dbError });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const exception = await captureRejection(
        repo.upsertSalt(USER_ID, 'deadbeef', 600_000),
      );

      expectRepositoryFailure(exception, 'upsertSalt', dbError);
    });
  });

  describe('findByUserId', () => {
    it('returns the full projection on success', async () => {
      const row = {
        salt: 'abc',
        kdf_iterations: 600_000,
        wrapped_dek: 'wrapped',
        key_check: 'check',
      };
      const { from } = buildServiceRoleClient({ data: row, error: null });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const result = await repo.findByUserId(USER_ID);

      expect(result).toEqual(row);
    });

    it('returns null on PGRST116', async () => {
      const { from } = buildServiceRoleClient({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const result = await repo.findByUserId(USER_ID);

      expect(result).toBeNull();
    });

    it('throws BusinessException with operation context on supabase error', async () => {
      const dbError = { code: '42P01', message: 'relation missing' };
      const { from } = buildServiceRoleClient({ data: null, error: dbError });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const exception = await captureRejection(repo.findByUserId(USER_ID));

      expectRepositoryFailure(exception, 'findByUserId', dbError);
    });
  });

  describe('hasRecoveryKey', () => {
    it('returns true when a wrapped DEK exists', async () => {
      const { from } = buildServiceRoleClient({
        data: { wrapped_dek: 'wrapped' },
        error: null,
      });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const result = await repo.hasRecoveryKey(USER_ID);

      expect(result).toBe(true);
    });

    it('returns false when wrapped_dek is null', async () => {
      const { from } = buildServiceRoleClient({
        data: { wrapped_dek: null },
        error: null,
      });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const result = await repo.hasRecoveryKey(USER_ID);

      expect(result).toBe(false);
    });

    it('returns false on PGRST116', async () => {
      const { from } = buildServiceRoleClient({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const result = await repo.hasRecoveryKey(USER_ID);

      expect(result).toBe(false);
    });

    it('throws BusinessException with operation context on supabase error', async () => {
      const dbError = { code: '42501', message: 'permission denied' };
      const { from } = buildServiceRoleClient({ data: null, error: dbError });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const exception = await captureRejection(repo.hasRecoveryKey(USER_ID));

      expectRepositoryFailure(exception, 'hasRecoveryKey', dbError);
    });
  });

  describe('updateWrappedDEK', () => {
    it('resolves on success', async () => {
      const { from } = buildServiceRoleClient({ data: null, error: null });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      await repo.updateWrappedDEK(USER_ID, 'wrapped');

      expect(from).toHaveBeenCalledWith('user_encryption_key');
    });

    it('updates wrapped_dek scoped to the userId via .eq("user_id", USER_ID)', async () => {
      const { from, spies } = buildServiceRoleClient({
        data: null,
        error: null,
      });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      await repo.updateWrappedDEK(USER_ID, 'wrapped');

      expect(spies.update).toHaveBeenCalledTimes(1);
      expect(spies.update).toHaveBeenCalledWith({ wrapped_dek: 'wrapped' });
      expect(spies.eq).toHaveBeenCalledTimes(1);
      expect(spies.eq).toHaveBeenCalledWith('user_id', USER_ID);
    });

    it('throws BusinessException with operation context on supabase error', async () => {
      const dbError = { code: '40001', message: 'serialization failure' };
      const { from } = buildServiceRoleClient({ data: null, error: dbError });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const exception = await captureRejection(
        repo.updateWrappedDEK(USER_ID, 'wrapped'),
      );

      expectRepositoryFailure(exception, 'updateWrappedDEK', dbError);
    });
  });

  describe('getVaultStatus', () => {
    it('reports pin + recovery configured when both columns are populated', async () => {
      const { from } = buildServiceRoleClient({
        data: { key_check: 'check', wrapped_dek: 'wrapped' },
        error: null,
      });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const result = await repo.getVaultStatus(USER_ID);

      expect(result).toEqual({
        pinCodeConfigured: true,
        recoveryKeyConfigured: true,
        vaultCodeConfigured: true,
      });
    });

    it('returns all-false on PGRST116 (row missing)', async () => {
      const { from } = buildServiceRoleClient({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const result = await repo.getVaultStatus(USER_ID);

      expect(result).toEqual({
        pinCodeConfigured: false,
        recoveryKeyConfigured: false,
        vaultCodeConfigured: false,
      });
    });

    it('throws BusinessException with operation context on supabase error', async () => {
      const dbError = { code: '53300', message: 'too many connections' };
      const { from } = buildServiceRoleClient({ data: null, error: dbError });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const exception = await captureRejection(repo.getVaultStatus(USER_ID));

      expectRepositoryFailure(exception, 'getVaultStatus', dbError);
    });
  });

  describe('updateKeyCheckIfNull', () => {
    it('resolves on success', async () => {
      const { from } = buildServiceRoleClient({ data: null, error: null });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      await repo.updateKeyCheckIfNull(USER_ID, 'check');

      expect(from).toHaveBeenCalledWith('user_encryption_key');
    });

    it('updates key_check guarded on user_id and is(key_check, null)', async () => {
      const { from, spies } = buildServiceRoleClient({
        data: null,
        error: null,
      });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      await repo.updateKeyCheckIfNull(USER_ID, 'check');

      expect(spies.update).toHaveBeenCalledTimes(1);
      const updatePayload = spies.update.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(updatePayload.key_check).toBe('check');
      expect(typeof updatePayload.updated_at).toBe('string');

      expect(spies.eq).toHaveBeenCalledTimes(1);
      expect(spies.eq).toHaveBeenCalledWith('user_id', USER_ID);

      expect(spies.is).toHaveBeenCalledTimes(1);
      expect(spies.is).toHaveBeenCalledWith('key_check', null);
    });

    it('throws BusinessException with operation context on supabase error', async () => {
      const dbError = { code: '23514', message: 'check violation' };
      const { from } = buildServiceRoleClient({ data: null, error: dbError });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const exception = await captureRejection(
        repo.updateKeyCheckIfNull(USER_ID, 'check'),
      );

      expectRepositoryFailure(exception, 'updateKeyCheckIfNull', dbError);
    });
  });

  describe('updateWrappedDEKIfNull', () => {
    it('returns true when an update occurred', async () => {
      const { from } = buildServiceRoleClient({
        data: { user_id: USER_ID },
        error: null,
      });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const result = await repo.updateWrappedDEKIfNull(USER_ID, 'wrapped');

      expect(result).toBe(true);
    });

    it('updates wrapped_dek guarded on user_id and is(wrapped_dek, null)', async () => {
      const { from, spies } = buildServiceRoleClient({
        data: { user_id: USER_ID },
        error: null,
      });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      await repo.updateWrappedDEKIfNull(USER_ID, 'wrapped');

      expect(spies.update).toHaveBeenCalledTimes(1);
      const updatePayload = spies.update.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(updatePayload.wrapped_dek).toBe('wrapped');
      expect(typeof updatePayload.updated_at).toBe('string');

      expect(spies.eq).toHaveBeenCalledTimes(1);
      expect(spies.eq).toHaveBeenCalledWith('user_id', USER_ID);

      expect(spies.is).toHaveBeenCalledTimes(1);
      expect(spies.is).toHaveBeenCalledWith('wrapped_dek', null);

      expect(spies.select).toHaveBeenCalledTimes(1);
      expect(spies.select).toHaveBeenCalledWith('user_id');
      expect(spies.maybeSingle).toHaveBeenCalledTimes(1);
    });

    it('returns false when no row matched (wrapped_dek not null)', async () => {
      const { from } = buildServiceRoleClient({ data: null, error: null });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const result = await repo.updateWrappedDEKIfNull(USER_ID, 'wrapped');

      expect(result).toBe(false);
    });

    it('throws BusinessException with operation context on supabase error', async () => {
      const dbError = { code: '57P01', message: 'admin shutdown' };
      const { from } = buildServiceRoleClient({ data: null, error: dbError });
      (supabaseService.getServiceRoleClient as ReturnType<typeof mock>) = mock(
        () => ({ from }),
      );

      const exception = await captureRejection(
        repo.updateWrappedDEKIfNull(USER_ID, 'wrapped'),
      );

      expectRepositoryFailure(exception, 'updateWrappedDEKIfNull', dbError);
    });
  });
});
