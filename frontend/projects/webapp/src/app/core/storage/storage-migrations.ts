import { STORAGE_KEYS } from './storage-keys';
import type { Migration, StorageKey } from './storage.types';

/**
 * Migration registry for storage keys.
 *
 * ## Adding a migration:
 * 1. Increment the version in STORAGE_SCHEMAS for the affected key
 * 2. Add a migration entry here with fromVersion and toVersion
 * 3. The migrate function transforms old data shape to new shape
 *
 * ## Example:
 * ```typescript
 * [STORAGE_KEYS.CURRENT_BUDGET]: [
 *   {
 *     fromVersion: 1,
 *     toVersion: 2,
 *     migrate: (oldData: { id: string }) => ({ budgetId: oldData.id }),
 *   },
 * ],
 * ```
 */
export const STORAGE_MIGRATIONS: Partial<Record<StorageKey, Migration[]>> = {
  [STORAGE_KEYS.DEMO_MODE]: [
    {
      fromVersion: 1,
      toVersion: 2,
      migrate: (oldData: unknown) =>
        typeof oldData === 'string' ? oldData === 'true' : false,
    },
  ],
};

/**
 * Get migrations for a specific key that apply to a version upgrade.
 * Returns migrations forming a continuous chain from fromVersion to toVersion.
 * Returns empty array if no continuous chain exists.
 */
export function getMigrationsForKey(
  key: StorageKey,
  fromVersion: number,
  toVersion: number,
): Migration[] {
  if (fromVersion >= toVersion) {
    return [];
  }

  const allMigrations = STORAGE_MIGRATIONS[key] ?? [];
  if (allMigrations.length === 0) {
    return [];
  }

  // Build a continuous chain from fromVersion to toVersion
  const chain: Migration[] = [];
  let currentVersion = fromVersion;

  while (currentVersion < toVersion) {
    const nextMigration = allMigrations.find(
      (m) => m.fromVersion === currentVersion,
    );

    if (!nextMigration) {
      // Gap in migration chain - no migration from currentVersion
      // Return empty array to signal upgrade without data transformation
      return [];
    }

    chain.push(nextMigration);
    currentVersion = nextMigration.toVersion;
  }

  return chain;
}

export type MigrationResult =
  | { ok: true; data: unknown }
  | { ok: false; error: unknown };

/**
 * Apply migrations sequentially to transform data from one version to another.
 * Returns { ok: false, error } if any migration fails (data should be reset).
 */
export function applyMigrations(
  data: unknown,
  migrations: Migration[],
): MigrationResult {
  let result = data;

  for (const migration of migrations) {
    try {
      result = migration.migrate(result);
    } catch (error) {
      return { ok: false, error };
    }
  }

  return { ok: true, data: result };
}
