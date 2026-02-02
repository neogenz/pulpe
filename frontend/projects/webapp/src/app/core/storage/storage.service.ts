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
  type StorageType,
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
  readonly #migratedKeys = new Set<StorageKey>();

  /**
   * Get the storage instance for the given type.
   */
  #getStorage(type: StorageType): Storage {
    return type === 'session' ? sessionStorage : localStorage;
  }

  /**
   * Get a value from storage.
   * Returns null if key doesn't exist, validation fails, or data is legacy format.
   */
  get<T>(key: StorageKey, storageType?: StorageType): T | null {
    const storage = this.#getStorage(storageType ?? 'local');
    try {
      const raw = storage.getItem(key);
      if (raw === null) {
        return null;
      }

      const parsed = JSON.parse(raw) as unknown;
      const schemaConfig = getSchemaConfig(key);

      if (isStorageEntry(parsed)) {
        return this.#handleVersionedValue<T>(
          key,
          parsed,
          schemaConfig,
          storageType,
        );
      }

      // Legacy format detected - clear and return null
      this.#logger.debug(`Legacy format for '${key}', clearing`);
      this.remove(key, storageType);
      return null;
    } catch (error) {
      this.#logger.warn(
        `Failed to read '${key}' from ${storage === sessionStorage ? 'sessionStorage' : 'localStorage'}:`,
        error,
      );
      return null;
    }
  }

  #handleVersionedValue<T>(
    key: StorageKey,
    entry: StorageEntry<unknown>,
    schemaConfig: StorageSchemaConfig | undefined,
    storageType: StorageType = 'local',
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
        storageType,
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
    storageType: StorageType = 'local',
  ): unknown {
    if (fromVersion >= schemaConfig.version) {
      return data;
    }

    if (this.#migratedKeys.has(key)) {
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

    const result = applyMigrations(data, migrations);

    if (!result.ok) {
      this.#logger.warn(
        `Migration failed for '${key}' from v${fromVersion} to v${schemaConfig.version}, clearing`,
        { originalData: data, error: result.error },
      );
      this.#migratedKeys.add(key);
      this.remove(key, storageType);
      return null;
    }

    this.#logger.debug(
      `Migrated '${key}' from v${fromVersion} to v${schemaConfig.version}`,
    );

    this.#migratedKeys.add(key);
    this.set(key, result.data, storageType);
    return result.data;
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
   * Get a string value from storage.
   */
  getString(key: StorageKey, storageType?: StorageType): string | null {
    const storage = this.#getStorage(storageType ?? 'local');
    try {
      const raw = storage.getItem(key);
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
      this.remove(key, storageType);
      return null;
    } catch (error) {
      this.#logger.warn(
        `Failed to read '${key}' from ${storage === sessionStorage ? 'sessionStorage' : 'localStorage'}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Set a value in storage.
   * If the key has a registered schema, the value is wrapped with version and timestamp.
   */
  set<T>(key: StorageKey, value: T, storageType?: StorageType): void {
    const storage = this.#getStorage(storageType ?? 'local');
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

      storage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      this.#logger.warn(
        `Failed to write '${key}' to ${storage === sessionStorage ? 'sessionStorage' : 'localStorage'}:`,
        error,
      );
    }
  }

  /**
   * Set a string value in storage.
   */
  setString(key: StorageKey, value: string, storageType?: StorageType): void {
    this.set(key, value, storageType);
  }

  /**
   * Remove a value from storage.
   */
  remove(key: StorageKey, storageType?: StorageType): void {
    const storage = this.#getStorage(storageType ?? 'local');
    try {
      storage.removeItem(key);
    } catch (error) {
      this.#logger.warn(
        `Failed to remove '${key}' from ${storage === sessionStorage ? 'sessionStorage' : 'localStorage'}:`,
        error,
      );
    }
  }

  /**
   * Check if a key exists in storage with valid format.
   */
  has(key: StorageKey, storageType?: StorageType): boolean {
    const storage = this.#getStorage(storageType ?? 'local');
    try {
      const raw = storage.getItem(key);
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
   * Clear all USER-scoped data from both localStorage and sessionStorage.
   * Keys with scope 'app' (like tour progress) are preserved.
   */
  clearAllUserData(): void {
    this.#clearByScope('user', 'local');
    this.#clearByScope('user', 'session');
  }

  /**
   * Clear all APP-scoped data from both localStorage and sessionStorage.
   */
  clearAllAppData(): void {
    this.#clearByScope('app', 'local');
    this.#clearByScope('app', 'session');
  }

  #clearByScope(targetScope: StorageScope, storageType: StorageType): void {
    const storage = this.#getStorage(storageType);
    try {
      const keysToRemove = Object.keys(storage).filter((key) => {
        if (!key.startsWith('pulpe')) return false;

        const schemaConfig = getSchemaConfig(key);
        const effectiveScope: StorageScope = schemaConfig
          ? schemaConfig.scope
          : key.startsWith('pulpe-tour-')
            ? 'app'
            : 'user';

        return effectiveScope === targetScope;
      });

      keysToRemove.forEach((key) => storage.removeItem(key));

      this.#logger.debug(
        `Cleared ${keysToRemove.length} ${targetScope} items from ${storageType}Storage`,
      );
    } catch (error) {
      this.#logger.warn(
        `Failed to clear ${targetScope} data from ${storageType}Storage:`,
        error,
      );
    }
  }
}
