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

export interface ScheduledDeletionAdminApi {
  listUsers(params: { page: number; perPage: number }): Promise<{
    data: { users: MigrationUser[] } | null;
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
    const { data, error } = await admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error || !data) {
      throw new Error(
        `Scheduled deletion metadata list failed on page ${page}: ${error?.message ?? 'empty response'}`,
      );
    }

    for (const user of data.users) {
      summary.scanned += 1;
      const appMetadata = asRecord(user.app_metadata);
      if (Object.hasOwn(appMetadata, 'scheduledDeletionAt')) {
        summary.alreadyOwned += 1;
        continue;
      }

      const legacyDate = asRecord(user.user_metadata).scheduledDeletionAt;
      if (legacyDate === undefined) continue;
      if (!isCanonicalIsoDate(legacyDate)) {
        summary.invalidLegacy += 1;
        continue;
      }

      summary.eligible += 1;
      if (!apply) continue;
      const update = await admin.updateUserById(user.id, {
        app_metadata: {
          ...appMetadata,
          scheduledDeletionAt: legacyDate,
        },
      });
      if (update.error) {
        throw new Error(
          `Scheduled deletion metadata update failed on page ${page}: ${update.error.message}`,
        );
      }
      summary.migrated += 1;
    }

    if (data.users.length < PER_PAGE) return summary;
  }

  throw new Error(`Scheduled deletion metadata exceeded ${MAX_PAGES} pages`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply') || args.length > 1) {
    throw new Error('Usage: migrate-scheduled-deletion-metadata.ts [--apply]');
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
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
    console.error(error instanceof Error ? error.message : 'Migration failed');
    process.exitCode = 1;
  });
}
