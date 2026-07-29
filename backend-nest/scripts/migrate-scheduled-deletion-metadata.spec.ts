import { describe, expect, it, mock } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  migrateScheduledDeletionMetadata,
  type ScheduledDeletionAdminApi,
} from './migrate-scheduled-deletion-metadata';

const isoDate = '2026-07-01T12:00:00.000Z';
const user = (
  id: string,
  userMetadata: Record<string, unknown> = {},
  appMetadata: Record<string, unknown> = {},
) => ({
  id,
  user_metadata: userMetadata,
  app_metadata: appMetadata,
});
const page = (users: ReturnType<typeof user>[]) => ({
  data: { users },
  error: null,
});
const current = (value: ReturnType<typeof user>) => ({
  data: { user: value },
  error: null,
});

describe('migrateScheduledDeletionMetadata', () => {
  it('executes the package CLI and fails closed without credentials', () => {
    const result = spawnSync(
      process.execPath,
      ['run', 'migrate:scheduled-deletion'],
      {
        cwd: resolve(__dirname, '..'),
        encoding: 'utf8',
        env: {
          ...process.env,
          SUPABASE_URL: '',
          SUPABASE_SERVICE_ROLE_KEY: '',
        },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
    );
  });

  it('reports eligible and invalid legacy claims without writing by default', async () => {
    const getUserById = mock(async () => current(user('unused')));
    const updateUserById = mock(async () => ({ error: null }));
    const admin = {
      listUsers: mock(async () =>
        page([
          user('eligible', { scheduledDeletionAt: isoDate }),
          user('invalid', { scheduledDeletionAt: 'not-an-iso-date' }),
          user(
            'owned',
            { scheduledDeletionAt: isoDate },
            { scheduledDeletionAt: isoDate },
          ),
        ]),
      ),
      getUserById,
      updateUserById,
    } satisfies ScheduledDeletionAdminApi;

    expect(await migrateScheduledDeletionMetadata(admin)).toEqual({
      mode: 'dry-run',
      scanned: 3,
      eligible: 1,
      invalidLegacy: 1,
      alreadyOwned: 1,
      migrated: 0,
    });
    expect(getUserById).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('paginates, preserves app metadata, and is idempotent in apply mode', async () => {
    const firstPage = Array.from({ length: 1000 }, () => user('neutral'));
    const eligible = user(
      'eligible',
      { scheduledDeletionAt: isoDate },
      { provider: 'email' },
    );
    const freshEligible = user(
      'eligible',
      { scheduledDeletionAt: isoDate },
      { provider: 'email', role: 'member' },
    );
    const listUsers = mock(async ({ page: pageNumber }: { page: number }) =>
      page(pageNumber === 1 ? firstPage : [eligible]),
    );
    const getUserById = mock(async () => current(freshEligible));
    const updateUserById = mock(
      async (
        _id: string,
        attributes: { app_metadata: Record<string, unknown> },
      ) => {
        eligible.app_metadata = attributes.app_metadata;
        freshEligible.app_metadata = attributes.app_metadata;
        return { error: null };
      },
    );
    const admin = {
      listUsers,
      getUserById,
      updateUserById,
    } satisfies ScheduledDeletionAdminApi;

    const first = await migrateScheduledDeletionMetadata(admin, true);
    const second = await migrateScheduledDeletionMetadata(admin, true);

    expect([first.migrated, second.migrated]).toEqual([1, 0]);
    expect(eligible.app_metadata).toEqual({
      provider: 'email',
      role: 'member',
      scheduledDeletionAt: isoDate,
    });
    expect(listUsers.mock.calls.map(([params]) => params.page)).toEqual([
      1, 2, 1, 2,
    ]);
    expect(getUserById).toHaveBeenCalledTimes(1);
    expect(updateUserById).toHaveBeenCalledTimes(1);
  });

  it('stops on list and update errors', async () => {
    const listFailure = {
      listUsers: mock(async ({ page: pageNumber }: { page: number }) =>
        pageNumber === 1
          ? page(Array.from({ length: 1000 }, () => user('neutral')))
          : { data: null, error: new Error('list failed') },
      ),
      getUserById: mock(async () => current(user('unused'))),
      updateUserById: mock(async () => ({ error: null })),
    } satisfies ScheduledDeletionAdminApi;

    await expect(migrateScheduledDeletionMetadata(listFailure)).rejects.toThrow(
      'page 2',
    );

    const updateFailure = {
      listUsers: mock(async () =>
        page([
          user('first', { scheduledDeletionAt: isoDate }),
          user('second', { scheduledDeletionAt: isoDate }),
        ]),
      ),
      getUserById: mock(async (id: string) =>
        current(user(id, { scheduledDeletionAt: isoDate })),
      ),
      updateUserById: mock(async () => ({
        error: new Error('update failed'),
      })),
    } satisfies ScheduledDeletionAdminApi;

    await expect(
      migrateScheduledDeletionMetadata(updateFailure, true),
    ).rejects.toThrow('Scheduled deletion metadata update failed on page 1');
    expect(updateFailure.updateUserById).toHaveBeenCalledTimes(1);
  });

  it('re-reads an apply candidate and preserves a server-owned claim created after listing', async () => {
    const listed = user('candidate', { scheduledDeletionAt: isoDate });
    const current = user(
      'candidate',
      { scheduledDeletionAt: isoDate },
      {
        provider: 'email',
        scheduledDeletionAt: '2026-07-02T12:00:00.000Z',
      },
    );
    const getUserById = mock(async () => ({
      data: { user: current },
      error: null,
    }));
    const updateUserById = mock(async () => ({ error: null }));
    const admin = {
      listUsers: mock(async () => page([listed])),
      getUserById,
      updateUserById,
    } satisfies ScheduledDeletionAdminApi;

    expect(await migrateScheduledDeletionMetadata(admin, true)).toEqual({
      mode: 'apply',
      scanned: 1,
      eligible: 0,
      invalidLegacy: 0,
      alreadyOwned: 1,
      migrated: 0,
    });
    expect(getUserById).toHaveBeenCalledWith('candidate');
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('re-evaluates a removed or invalid legacy claim from fresh metadata', async () => {
    const listed = [
      user('removed', { scheduledDeletionAt: isoDate }),
      user('invalid', { scheduledDeletionAt: isoDate }),
    ];
    const getUserById = mock(async (id: string) =>
      current(
        id === 'removed'
          ? user(id)
          : user(id, { scheduledDeletionAt: 'not-an-iso-date' }),
      ),
    );
    const updateUserById = mock(async () => ({ error: null }));
    const admin = {
      listUsers: mock(async () => page(listed)),
      getUserById,
      updateUserById,
    } satisfies ScheduledDeletionAdminApi;

    expect(await migrateScheduledDeletionMetadata(admin, true)).toEqual({
      mode: 'apply',
      scanned: 2,
      eligible: 0,
      invalidLegacy: 1,
      alreadyOwned: 0,
      migrated: 0,
    });
    expect(getUserById).toHaveBeenCalledTimes(2);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('never includes returned or rejected provider messages in migration errors', async () => {
    const sentinel = 'person@example.com user-uuid-private';
    const candidate = user('candidate', { scheduledDeletionAt: isoDate });
    const createAdmin = (): ScheduledDeletionAdminApi => ({
      listUsers: mock(async () => page([candidate])),
      getUserById: mock(async () => current(candidate)),
      updateUserById: mock(async () => ({ error: null })),
    });
    const cases: Array<{
      stage: 'list' | 'read' | 'update';
      configure: (admin: ScheduledDeletionAdminApi) => void;
    }> = [
      {
        stage: 'list',
        configure: (admin) => {
          admin.listUsers = mock(async () => ({
            data: null,
            error: new Error(sentinel),
          }));
        },
      },
      {
        stage: 'list',
        configure: (admin) => {
          admin.listUsers = mock(async () => {
            throw new Error(sentinel);
          });
        },
      },
      {
        stage: 'read',
        configure: (admin) => {
          admin.getUserById = mock(async () => ({
            data: { user: null },
            error: new Error(sentinel),
          }));
        },
      },
      {
        stage: 'read',
        configure: (admin) => {
          admin.getUserById = mock(async () => {
            throw new Error(sentinel);
          });
        },
      },
      {
        stage: 'update',
        configure: (admin) => {
          admin.updateUserById = mock(async () => ({
            error: new Error(sentinel),
          }));
        },
      },
      {
        stage: 'update',
        configure: (admin) => {
          admin.updateUserById = mock(async () => {
            throw new Error(sentinel);
          });
        },
      },
    ];

    for (const testCase of cases) {
      const admin = createAdmin();
      testCase.configure(admin);
      let caught: unknown;
      try {
        await migrateScheduledDeletionMetadata(admin, true);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe(
        `Scheduled deletion metadata ${testCase.stage} failed on page 1`,
      );
      expect((caught as Error).message).not.toContain(sentinel);
    }
  });
});
