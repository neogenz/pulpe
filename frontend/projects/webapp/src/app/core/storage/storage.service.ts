import { Injectable, inject } from '@angular/core';
import { Logger } from '../logging/logger';

/**
 * Type-safe storage key that MUST start with 'pulpe-' or 'pulpe_' prefix.
 * This ensures all app storage keys are cleaned on logout.
 *
 * @example
 * const key: StorageKey = 'pulpe-current-budget'; // OK
 * const key: StorageKey = 'other-key'; // Compile error
 */
export type StorageKey = `pulpe-${string}` | `pulpe_${string}`;

/**
 * Wrapper for cached values with TTL support.
 * The `ttl` field contains the expiration timestamp (Date.now() + ttlMs).
 */
interface CachedValue<T> {
  value: T;
  ttl: number;
}

/**
 * Centralized localStorage service with type-safe keys.
 *
 * All storage keys MUST use the 'pulpe-' or 'pulpe_' prefix to ensure
 * they are properly cleaned on user logout.
 *
 * @example
 * // Set a value
 * storage.set('pulpe-current-budget', budget);
 *
 * // Get a typed value
 * const budget = storage.get<Budget>('pulpe-current-budget');
 *
 * // Remove a value
 * storage.remove('pulpe-current-budget');
 *
 * // Clear all user data (on logout)
 * storage.clearAll();
 */
@Injectable({
  providedIn: 'root',
})
export class StorageService {
  readonly #logger = inject(Logger);

  /**
   * Get a value from localStorage.
   * Returns null if the key doesn't exist, parsing fails, or value is expired.
   *
   * @param key Storage key
   * @param ttlMs Optional TTL in milliseconds. If provided and the stored value
   *              is in legacy format (no TTL wrapper), it will be considered expired.
   */
  get<T>(key: StorageKey, ttlMs?: number): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return null;
      }

      const parsed = JSON.parse(raw) as unknown;

      // Check if it's a TTL-wrapped value
      if (this.#isCachedValue(parsed)) {
        if (Date.now() > parsed.ttl) {
          this.remove(key);
          return null;
        }
        return parsed.value as T;
      }

      // Legacy format (no TTL wrapper)
      // If ttlMs is provided, treat legacy as expired (caller expects TTL behavior)
      if (ttlMs !== undefined) {
        return null;
      }

      return parsed as T;
    } catch (error) {
      this.#logger.warn(`Failed to read '${key}' from localStorage:`, error);
      return null;
    }
  }

  #isCachedValue(value: unknown): value is CachedValue<unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'value' in value &&
      'ttl' in value &&
      typeof (value as CachedValue<unknown>).ttl === 'number'
    );
  }

  /**
   * Get a raw string value from localStorage.
   * Handles both TTL-wrapped values and legacy raw strings.
   *
   * @param key Storage key
   * @param ttlMs Optional TTL in milliseconds. If provided and the stored value
   *              is in legacy format (no TTL wrapper), it will be considered expired.
   */
  getString(key: StorageKey, ttlMs?: number): string | null {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return null;
      }

      // Try to parse as JSON to check for TTL wrapper
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (this.#isCachedValue(parsed)) {
          if (Date.now() > parsed.ttl) {
            this.remove(key);
            return null;
          }
          return typeof parsed.value === 'string' ? parsed.value : null;
        }
      } catch {
        // Not JSON, treat as raw string (legacy format)
      }

      // Legacy raw string format
      // If ttlMs is provided, treat legacy as expired
      if (ttlMs !== undefined) {
        return null;
      }

      return raw;
    } catch (error) {
      this.#logger.warn(`Failed to read '${key}' from localStorage:`, error);
      return null;
    }
  }

  /**
   * Set a value in localStorage.
   * The value is automatically JSON-serialized.
   *
   * @param key Storage key
   * @param value Value to store
   * @param ttlMs Optional TTL in milliseconds. If provided, the value is wrapped
   *              with an expiration timestamp.
   */
  set<T>(key: StorageKey, value: T, ttlMs?: number): void {
    try {
      const toStore =
        ttlMs !== undefined
          ? ({ value, ttl: Date.now() + ttlMs } satisfies CachedValue<T>)
          : value;
      localStorage.setItem(key, JSON.stringify(toStore));
    } catch (error) {
      this.#logger.warn(`Failed to write '${key}' to localStorage:`, error);
    }
  }

  /**
   * Set a raw string value in localStorage.
   *
   * @param key Storage key
   * @param value String value to store
   * @param ttlMs Optional TTL in milliseconds. If provided, the value is wrapped
   *              with an expiration timestamp (stored as JSON).
   */
  setString(key: StorageKey, value: string, ttlMs?: number): void {
    try {
      if (ttlMs !== undefined) {
        const wrapped: CachedValue<string> = { value, ttl: Date.now() + ttlMs };
        localStorage.setItem(key, JSON.stringify(wrapped));
      } else {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      this.#logger.warn(`Failed to write '${key}' to localStorage:`, error);
    }
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
   * Check if a key exists in localStorage and is not expired.
   *
   * @param key Storage key
   * @param ttlMs Optional TTL in milliseconds. If provided and the stored value
   *              is in legacy format (no TTL wrapper), it will be considered not present.
   */
  has(key: StorageKey, ttlMs?: number): boolean {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) {
        return false;
      }

      // If no TTL check required, just check existence
      if (ttlMs === undefined) {
        // Still need to check if it's a TTL-wrapped value that's expired
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (this.#isCachedValue(parsed)) {
            if (Date.now() > parsed.ttl) {
              this.remove(key);
              return false;
            }
          }
        } catch {
          // Not JSON, treat as raw value
        }
        return true;
      }

      // TTL check required - use get() logic
      return this.get(key, ttlMs) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Clear ALL app data from localStorage except persistent keys.
   * This removes all keys starting with 'pulpe-' or 'pulpe_'.
   *
   * Tour keys (pulpe-tour-*) are handled specially:
   * - If currentUserId is provided: only preserve that user's tour keys
   * - If currentUserId is NOT provided: remove ALL tour keys
   *
   * Called on user logout to prevent data leakage between users.
   */
  clearAll(currentUserId?: string): void {
    try {
      const keysToRemove = Object.keys(localStorage).filter((key) => {
        if (!key.startsWith('pulpe')) return false;

        // Tour keys: preserve only current user's, remove others
        if (key.startsWith('pulpe-tour-')) {
          if (!currentUserId) return true; // No user = remove all tour keys
          return !key.endsWith(`-${currentUserId}`); // Keep only this user's
        }

        return true; // Remove all other pulpe keys
      });

      keysToRemove.forEach((key) => localStorage.removeItem(key));

      this.#logger.debug(
        `Cleared ${keysToRemove.length} items from localStorage`,
      );
    } catch (error) {
      this.#logger.warn('Failed to clear user data from localStorage:', error);
    }
  }
}
