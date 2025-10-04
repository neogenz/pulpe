import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Logger } from '@core/logging/logger';

/**
 * Service managing demo mode state using reactive signals
 * Provides centralized state management for demo mode across the application
 */
@Injectable({
  providedIn: 'root',
})
export class DemoModeService {
  readonly #logger = inject(Logger);

  // Private writable signals
  readonly #isDemoModeSignal = signal<boolean>(this.#readDemoModeFromStorage());
  readonly #demoUserEmailSignal = signal<string | null>(
    this.#readDemoUserEmailFromStorage(),
  );

  // Public readonly signals
  readonly isDemoMode = this.#isDemoModeSignal.asReadonly();
  readonly demoUserEmail = this.#demoUserEmailSignal.asReadonly();

  // Computed signal for display purposes
  readonly demoUserDisplayName = computed(() => {
    const email = this.#demoUserEmailSignal();
    if (!email) return null;
    // Extract name part before @ (e.g., "demo-123@pulpe.app" -> "demo-123")
    return email.split('@')[0];
  });

  constructor() {
    // Sync signal changes to localStorage
    effect(() => {
      const isDemoMode = this.#isDemoModeSignal();
      const email = this.#demoUserEmailSignal();

      if (isDemoMode && email) {
        this.#writeDemoModeToStorage(true);
        this.#writeDemoUserEmailToStorage(email);
        this.#logger.debug('Demo mode state synchronized to localStorage', {
          isDemoMode,
          email,
        });
      } else {
        this.#clearDemoModeFromStorage();
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

  // Private methods for localStorage access

  #readDemoModeFromStorage(): boolean {
    try {
      return localStorage.getItem('pulpe-demo-mode') === 'true';
    } catch (error) {
      this.#logger.warn('Failed to read demo mode from localStorage', error);
      return false;
    }
  }

  #readDemoUserEmailFromStorage(): string | null {
    try {
      return localStorage.getItem('pulpe-demo-user-email');
    } catch (error) {
      this.#logger.warn(
        'Failed to read demo user email from localStorage',
        error,
      );
      return null;
    }
  }

  #writeDemoModeToStorage(value: boolean): void {
    try {
      localStorage.setItem('pulpe-demo-mode', value.toString());
    } catch (error) {
      this.#logger.warn('Failed to write demo mode to localStorage', error);
    }
  }

  #writeDemoUserEmailToStorage(email: string): void {
    try {
      localStorage.setItem('pulpe-demo-user-email', email);
    } catch (error) {
      this.#logger.warn(
        'Failed to write demo user email to localStorage',
        error,
      );
    }
  }

  #clearDemoModeFromStorage(): void {
    try {
      localStorage.removeItem('pulpe-demo-mode');
      localStorage.removeItem('pulpe-demo-user-email');
    } catch (error) {
      this.#logger.warn('Failed to clear demo mode from localStorage', error);
    }
  }
}
