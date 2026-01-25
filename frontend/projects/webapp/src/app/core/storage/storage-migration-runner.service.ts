import { Injectable, inject } from '@angular/core';
import { Logger } from '../logging/logger';
import { getSchemaConfig } from './storage-schemas';
import { applyMigrations, getMigrationsForKey } from './storage-migrations';
import type { StorageKey } from './storage.service';
import { isStorageEntry, type StorageEntry } from './storage.types';

/**
 * Runs storage migrations at application startup.
 *
 * Scans all pulpe-* keys in localStorage and:
 * - Clears legacy format data (one-time reset)
 * - Migrates versioned data if outdated
 */
@Injectable({
  providedIn: 'root',
})
export class StorageMigrationRunnerService {
  readonly #logger = inject(Logger);

  runMigrations(): void {
    try {
      const pulpeKeys = Object.keys(localStorage).filter((key) =>
        key.startsWith('pulpe'),
      );

      let migratedCount = 0;
      let clearedCount = 0;

      for (const key of pulpeKeys) {
        if (!key.startsWith('pulpe-') && !key.startsWith('pulpe_')) {
          this.#logger.warn(`Invalid storage key format: ${key}`);
          continue;
        }

        const schemaConfig = getSchemaConfig(key);
        if (!schemaConfig) continue;

        const result = this.#processKey(
          key as StorageKey,
          schemaConfig.version,
        );
        if (result === 'migrated') migratedCount++;
        if (result === 'cleared') clearedCount++;
      }

      if (migratedCount > 0 || clearedCount > 0) {
        this.#logger.info(
          `Storage: ${migratedCount} migrated, ${clearedCount} legacy cleared`,
        );
      }
    } catch (error) {
      // Log but don't throw - storage issues should not block app startup.
      // Individual key failures are handled gracefully in #processKey.
      this.#logger.error('Storage migration failed:', error);
    }
  }

  #processKey(
    key: StorageKey,
    targetVersion: number,
  ): 'unchanged' | 'migrated' | 'cleared' {
    const raw = localStorage.getItem(key);
    if (!raw) return 'unchanged';

    try {
      const parsed = JSON.parse(raw) as unknown;

      if (!isStorageEntry(parsed)) {
        // Legacy format - clear it
        localStorage.removeItem(key);
        this.#logger.debug(`Cleared legacy '${key}'`);
        return 'cleared';
      }

      if (parsed.version >= targetVersion) {
        return 'unchanged';
      }

      // Need migration
      const migrations = getMigrationsForKey(
        key,
        parsed.version,
        targetVersion,
      );

      let newData = parsed.data;
      if (migrations.length > 0) {
        const result = applyMigrations(parsed.data, migrations);
        if (!result.ok) {
          localStorage.removeItem(key);
          this.#logger.warn(`Migration failed for '${key}', cleared`, {
            error: result.error,
          });
          return 'cleared';
        }
        newData = result.data;
      }

      const entry: StorageEntry<unknown> = {
        version: targetVersion,
        data: newData,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(entry));

      this.#logger.debug(
        `Migrated '${key}' v${parsed.version}→v${targetVersion}`,
      );
      return 'migrated';
    } catch (error) {
      this.#logger.warn(`Failed to process key '${key}':`, error);
      localStorage.removeItem(key);
      return 'cleared';
    }
  }
}

/**
 * Factory function for APP_INITIALIZER.
 */
export function initializeStorageMigrations(
  migrationRunner: StorageMigrationRunnerService,
): () => void {
  return () => migrationRunner.runMigrations();
}
