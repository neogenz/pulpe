import { describe, expect, it, mock } from 'bun:test';
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

describe('migrateScheduledDeletionMetadata', () => {
  it('reports eligible and invalid legacy claims without writing by default', async () => {
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
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('paginates, preserves app metadata, and is idempotent in apply mode', async () => {
    const firstPage = Array.from({ length: 1000 }, () => user('neutral'));
    const eligible = user(
      'eligible',
      { scheduledDeletionAt: isoDate },
      { provider: 'email' },
    );
    const listUsers = mock(async ({ page: pageNumber }: { page: number }) =>
      page(pageNumber === 1 ? firstPage : [eligible]),
    );
    const updateUserById = mock(
      async (
        _id: string,
        attributes: { app_metadata: Record<string, unknown> },
      ) => {
        eligible.app_metadata = attributes.app_metadata;
        return { error: null };
      },
    );
    const admin = {
      listUsers,
      updateUserById,
    } satisfies ScheduledDeletionAdminApi;

    const first = await migrateScheduledDeletionMetadata(admin, true);
    const second = await migrateScheduledDeletionMetadata(admin, true);

    expect([first.migrated, second.migrated]).toEqual([1, 0]);
    expect(eligible.app_metadata).toEqual({
      provider: 'email',
      scheduledDeletionAt: isoDate,
    });
    expect(listUsers.mock.calls.map(([params]) => params.page)).toEqual([
      1, 2, 1, 2,
    ]);
    expect(updateUserById).toHaveBeenCalledTimes(1);
  });

  it('stops on list and update errors', async () => {
    const listFailure = {
      listUsers: mock(async ({ page: pageNumber }: { page: number }) =>
        pageNumber === 1
          ? page(Array.from({ length: 1000 }, () => user('neutral')))
          : { data: null, error: new Error('list failed') },
      ),
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
      updateUserById: mock(async () => ({
        error: new Error('update failed'),
      })),
    } satisfies ScheduledDeletionAdminApi;

    await expect(
      migrateScheduledDeletionMetadata(updateFailure, true),
    ).rejects.toThrow('update failed');
    expect(updateFailure.updateUserById).toHaveBeenCalledTimes(1);
  });
});
