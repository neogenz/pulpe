import { createClient } from '@supabase/supabase-js';

const PER_PAGE = 1000;
const MAX_PAGES = 100;

interface MigrationUser {
  id: string;
  app_metadata?: unknown;
  user_metadata?: unknown;
}

interface AdminError {
  message: string;
}

type AdminOperation = 'list' | 'read' | 'update';

class ScheduledDeletionMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduledDeletionMigrationError';
  }
}

export interface ScheduledDeletionAdminApi {
  listUsers(params: { page: number; perPage: number }): Promise<{
    data: { users: MigrationUser[] } | null;
    error: AdminError | null;
  }>;
  getUserById(id: string): Promise<{
    data: { user: MigrationUser | null };
    error: AdminError | null;
  }>;
  updateUserById(
    id: string,
    attributes: { app_metadata: Record<string, unknown> },
  ): Promise<{ error: AdminError | null }>;
}

export interface MigrationSummary {
  mode: 'dry-run' | 'apply';
  scanned: number;
  eligible: number;
  invalidLegacy: number;
  alreadyOwned: number;
  migrated: number;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const isCanonicalIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const adminFailure = (
  operation: AdminOperation,
  page: number,
): ScheduledDeletionMigrationError =>
  new ScheduledDeletionMigrationError(
    `Scheduled deletion metadata ${operation} failed on page ${page}`,
  );

async function runAdminOperation<T extends { error: AdminError | null }>(
  operation: AdminOperation,
  page: number,
  call: () => Promise<T>,
): Promise<T> {
  let result: T;
  try {
    result = await call();
  } catch {
    throw adminFailure(operation, page);
  }
  if (result.error) throw adminFailure(operation, page);
  return result;
}

export async function migrateScheduledDeletionMetadata(
  admin: ScheduledDeletionAdminApi,
  apply = false,
): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    mode: apply ? 'apply' : 'dry-run',
    scanned: 0,
    eligible: 0,
    invalidLegacy: 0,
    alreadyOwned: 0,
    migrated: 0,
  };

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data } = await runAdminOperation('list', page, () =>
      admin.listUsers({
        page,
        perPage: PER_PAGE,
      }),
    );
    if (!data) throw adminFailure('list', page);

    for (const user of data.users) {
      summary.scanned += 1;
      const listedAppMetadata = asRecord(user.app_metadata);
      if (Object.hasOwn(listedAppMetadata, 'scheduledDeletionAt')) {
        summary.alreadyOwned += 1;
        continue;
      }

      const listedLegacyDate = asRecord(user.user_metadata).scheduledDeletionAt;
      if (listedLegacyDate === undefined) continue;
      if (!isCanonicalIsoDate(listedLegacyDate)) {
        summary.invalidLegacy += 1;
        continue;
      }

      if (!apply) {
        summary.eligible += 1;
        continue;
      }

      const { data: freshData } = await runAdminOperation('read', page, () =>
        admin.getUserById(user.id),
      );
      if (!freshData.user) throw adminFailure('read', page);

      const freshAppMetadata = asRecord(freshData.user.app_metadata);
      if (Object.hasOwn(freshAppMetadata, 'scheduledDeletionAt')) {
        summary.alreadyOwned += 1;
        continue;
      }

      const freshLegacyDate = asRecord(
        freshData.user.user_metadata,
      ).scheduledDeletionAt;
      if (freshLegacyDate === undefined) continue;
      if (!isCanonicalIsoDate(freshLegacyDate)) {
        summary.invalidLegacy += 1;
        continue;
      }

      summary.eligible += 1;
      await runAdminOperation('update', page, () =>
        admin.updateUserById(user.id, {
          app_metadata: {
            ...freshAppMetadata,
            scheduledDeletionAt: freshLegacyDate,
          },
        }),
      );
      summary.migrated += 1;
    }

    if (data.users.length < PER_PAGE) return summary;
  }

  throw new ScheduledDeletionMigrationError(
    `Scheduled deletion metadata exceeded ${MAX_PAGES} pages`,
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply') || args.length > 1) {
    throw new ScheduledDeletionMigrationError(
      'Usage: migrate-scheduled-deletion-metadata.ts [--apply]',
    );
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new ScheduledDeletionMigrationError(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }).auth.admin;
  const summary = await migrateScheduledDeletionMetadata(
    admin,
    args[0] === '--apply',
  );
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof ScheduledDeletionMigrationError
        ? error.message
        : 'Scheduled deletion metadata migration failed',
    );
    process.exitCode = 1;
  });
}
