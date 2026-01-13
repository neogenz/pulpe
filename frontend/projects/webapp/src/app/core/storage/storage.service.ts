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
   * Returns null if the key doesn't exist or parsing fails.
   */
  get<T>(key: StorageKey): T | null {
    try {
      const value = localStorage.getItem(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      this.#logger.warn(`Failed to read '${key}' from localStorage:`, error);
      return null;
    }
  }

  /**
   * Get a raw string value from localStorage (without JSON parsing).
   * Useful for simple string values like 'true' or 'false'.
   */
  getString(key: StorageKey): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      this.#logger.warn(`Failed to read '${key}' from localStorage:`, error);
      return null;
    }
  }

  /**
   * Set a value in localStorage.
   * The value is automatically JSON-serialized.
   */
  set<T>(key: StorageKey, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      this.#logger.warn(`Failed to write '${key}' to localStorage:`, error);
    }
  }

  /**
   * Set a raw string value in localStorage (without JSON serialization).
   * Useful for simple string values like 'true' or 'false'.
   */
  setString(key: StorageKey, value: string): void {
    try {
      localStorage.setItem(key, value);
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
   * Check if a key exists in localStorage.
   */
  has(key: StorageKey): boolean {
    try {
      return localStorage.getItem(key) !== null;
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
