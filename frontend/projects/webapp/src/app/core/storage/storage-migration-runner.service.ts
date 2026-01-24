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

  runMigrations(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const pulpeKeys = Object.keys(localStorage).filter((key) =>
          key.startsWith('pulpe'),
        );

        let migratedCount = 0;
        let clearedCount = 0;

        for (const key of pulpeKeys) {
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
        this.#logger.error('Storage migration failed:', error);
      }

      resolve();
    });
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
        const migrated = applyMigrations(parsed.data, migrations);
        if (migrated === null) {
          localStorage.removeItem(key);
          this.#logger.warn(`Migration failed for '${key}', cleared`);
          return 'cleared';
        }
        newData = migrated;
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
): () => Promise<void> {
  return () => migrationRunner.runMigrations();
}
