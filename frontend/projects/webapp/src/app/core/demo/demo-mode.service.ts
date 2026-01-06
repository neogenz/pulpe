import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Logger } from '@core/logging/logger';
import { StorageService, STORAGE_KEYS } from '@core/storage';

/**
 * Service managing demo mode state using reactive signals
 * Provides centralized state management for demo mode across the application
 */
@Injectable({
  providedIn: 'root',
})
export class DemoModeService {
  readonly #logger = inject(Logger);
  readonly #storageService = inject(StorageService);

  // Private writable signals
  readonly #isDemoModeSignal = signal<boolean>(
    this.#storageService.getString(STORAGE_KEYS.DEMO_MODE) === 'true',
  );
  readonly #demoUserEmailSignal = signal<string | null>(
    this.#storageService.getString(STORAGE_KEYS.DEMO_USER_EMAIL),
  );

  // Public readonly signals
  readonly isDemoMode = this.#isDemoModeSignal.asReadonly();
  readonly demoUserEmail = this.#demoUserEmailSignal.asReadonly();

  // Computed signal for display purposes
  readonly demoUserDisplayName = computed(() => {
    const email = this.#demoUserEmailSignal();
    if (!email) return null;
    // Extract name part before @ (e.g., "demo-123@pulpe.app" -> "demo-123")
    const username = email.split('@')[0];
    return username || null;
  });

  constructor() {
    // Sync signal changes to localStorage
    effect(() => {
      const isDemoMode = this.#isDemoModeSignal();
      const email = this.#demoUserEmailSignal();

      if (isDemoMode && email) {
        this.#storageService.setString(STORAGE_KEYS.DEMO_MODE, 'true');
        this.#storageService.setString(STORAGE_KEYS.DEMO_USER_EMAIL, email);
        this.#logger.debug('Demo mode state synchronized to localStorage', {
          isDemoMode,
          email,
        });
      } else {
        this.#storageService.remove(STORAGE_KEYS.DEMO_MODE);
        this.#storageService.remove(STORAGE_KEYS.DEMO_USER_EMAIL);
        this.#logger.debug('Demo mode state cleared from localStorage');
      }
    });
  }

  /**
   * Activate demo mode with a given user email
   */
  activateDemoMode(userEmail: string): void {
    this.#logger.info('Activating demo mode', { userEmail });
    this.#demoUserEmailSignal.set(userEmail);
    this.#isDemoModeSignal.set(true);
  }

  /**
   * Deactivate demo mode and clear all demo-related data
   */
  deactivateDemoMode(): void {
    this.#logger.info('Deactivating demo mode');
    this.#isDemoModeSignal.set(false);
    this.#demoUserEmailSignal.set(null);
  }
}
