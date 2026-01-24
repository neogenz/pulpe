import { Injectable, inject } from '@angular/core';
import { Logger } from '../logging/logger';
import { getSchemaConfig } from './storage-schemas';
import { applyMigrations, getMigrationsForKey } from './storage-migrations';
import {
  isStorageEntry,
  type StorageEntry,
  type StorageKey,
  type StorageSchemaConfig,
  type StorageScope,
} from './storage.types';

// Re-export for backwards compatibility
export type { StorageKey } from './storage.types';

/**
 * Centralized localStorage service with type-safe keys, versioning, and Zod validation.
 *
 * ## Versioning
 * Values registered in STORAGE_SCHEMAS are automatically:
 * - Wrapped with version number and timestamp on write
 * - Validated with Zod schema on read
 * - Migrated if stored version differs from current
 *
 * ## Scopes
 * - 'user': Cleared on logout (clearAllUserData)
 * - 'app': Preserved across sessions
 */
@Injectable({
  providedIn: 'root',
})
export class StorageService {
  readonly #logger = inject(Logger);

  /**
   * Get a value from localStorage.
   * Returns null if key doesn't exist, validation fails, or data is legacy format.
   */
  get<T>(key: StorageKey): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return null;
      }

      const parsed = JSON.parse(raw) as unknown;
      const schemaConfig = getSchemaConfig(key);

      if (isStorageEntry(parsed)) {
        return this.#handleVersionedValue<T>(key, parsed, schemaConfig);
      }

      // Legacy format detected - clear and return null
      this.#logger.debug(`Legacy format for '${key}', clearing`);
      this.remove(key);
      return null;
    } catch (error) {
      this.#logger.warn(`Failed to read '${key}' from localStorage:`, error);
      return null;
    }
  }

  #handleVersionedValue<T>(
    key: StorageKey,
    entry: StorageEntry<unknown>,
    schemaConfig: StorageSchemaConfig | undefined,
  ): T | null {
    // No schema registered - return data without validation
    if (!schemaConfig) {
      return entry.data as T;
    }

    if (entry.version < schemaConfig.version) {
      const migrated = this.#migrateIfNeeded(
        key,
        entry.data,
        entry.version,
        schemaConfig,
      );
      return this.#validateAndReturn<T>(migrated, schemaConfig);
    }

    return this.#validateAndReturn<T>(entry.data, schemaConfig);
  }

  #migrateIfNeeded(
    key: StorageKey,
    data: unknown,
    fromVersion: number,
    schemaConfig: StorageSchemaConfig,
  ): unknown {
    if (fromVersion >= schemaConfig.version) {
      return data;
    }

    const migrations = getMigrationsForKey(
      key,
      fromVersion,
      schemaConfig.version,
    );

    if (migrations.length === 0) {
      return data;
    }

    const migrated = applyMigrations(data, migrations);

    if (migrated === null) {
      this.#logger.warn(
        `Migration failed for '${key}' from v${fromVersion} to v${schemaConfig.version}, clearing`,
        { originalData: data },
      );
      this.remove(key);
      return null;
    }

    this.#logger.debug(
      `Migrated '${key}' from v${fromVersion} to v${schemaConfig.version}`,
    );

    this.set(key, migrated);
    return migrated;
  }

  #validateAndReturn<T>(
    data: unknown,
    schemaConfig: StorageSchemaConfig | undefined,
  ): T | null {
    if (!schemaConfig) {
      return null;
    }

    const result = schemaConfig.schema.safeParse(data);

    if (!result.success) {
      this.#logger.warn('Storage validation failed:', result.error.issues);
      return null;
    }

    return result.data as T;
  }

  /**
   * Get a string value from localStorage.
   */
  getString(key: StorageKey): string | null {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return null;
      }

      try {
        const parsed = JSON.parse(raw) as unknown;

        if (isStorageEntry(parsed)) {
          return typeof parsed.data === 'string' ? parsed.data : null;
        }
      } catch {
        // Not JSON - legacy raw string
      }

      // Legacy format - clear and return null
      this.#logger.debug(`Legacy format for '${key}', clearing`);
      this.remove(key);
      return null;
    } catch (error) {
      this.#logger.warn(`Failed to read '${key}' from localStorage:`, error);
      return null;
    }
  }

  /**
   * Set a value in localStorage.
   * If the key has a registered schema, the value is wrapped with version and timestamp.
   */
  set<T>(key: StorageKey, value: T): void {
    try {
      const schemaConfig = getSchemaConfig(key);

      if (schemaConfig) {
        const result = schemaConfig.schema.safeParse(value);
        if (!result.success) {
          this.#logger.warn(
            `Validation failed for '${key}':`,
            result.error.issues,
          );
          return;
        }
      }

      const entry: StorageEntry<T> = {
        version: schemaConfig?.version ?? 1,
        data: value,
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      this.#logger.warn(`Failed to write '${key}' to localStorage:`, error);
    }
  }

  /**
   * Set a string value in localStorage.
   */
  setString(key: StorageKey, value: string): void {
    this.set(key, value);
  }

  /**
   * Remove a value from localStorage.
   */
  remove(key: StorageKey): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      this.#logger.warn(`Failed to remove '${key}' from localStorage:`, error);
    }
  }

  /**
   * Check if a key exists in localStorage with valid format.
   */
  has(key: StorageKey): boolean {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return false;
      }

      const parsed = JSON.parse(raw) as unknown;
      return isStorageEntry(parsed);
    } catch {
      return false;
    }
  }

  /**
   * Clear all USER-scoped data from localStorage.
   * Keys with scope 'app' (like tour progress) are preserved.
   */
  clearAllUserData(): void {
    this.#clearByScope('user');
  }

  /**
   * Clear all APP-scoped data from localStorage.
   */
  clearAllAppData(): void {
    this.#clearByScope('app');
  }

  #clearByScope(targetScope: StorageScope): void {
    try {
      const keysToRemove = Object.keys(localStorage).filter((key) => {
        if (!key.startsWith('pulpe')) return false;

        const schemaConfig = getSchemaConfig(key);
        const effectiveScope: StorageScope = schemaConfig
          ? schemaConfig.scope
          : key.startsWith('pulpe-tour-')
            ? 'app'
            : 'user';

        return effectiveScope === targetScope;
      });

      keysToRemove.forEach((key) => localStorage.removeItem(key));

      this.#logger.debug(
        `Cleared ${keysToRemove.length} ${targetScope} items from localStorage`,
      );
    } catch (error) {
      this.#logger.warn(
        `Failed to clear ${targetScope} data from localStorage:`,
        error,
      );
    }
  }
}
