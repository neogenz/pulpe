import { inject, Service } from '@angular/core';
import { ANALYTICS_EVENTS, type SupportedLocale } from 'pulpe-shared';
import { AnalyticsService } from '../analytics/analytics';
import { AuthStore } from '../auth/auth-store';
import { Logger } from '../logging/logger';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { StorageService } from '../storage/storage.service';
import { UserSettingsStore } from '../user-settings/user-settings-store';

/** Where the user changed language, so a wrong auto-detection is traceable. */
export type LanguageChangeSurface = 'settings' | 'welcome';

/**
 * Changing language reloads the page.
 *
 * `LOCALE_ID` is resolved once by a synchronous DI factory and Angular cannot
 * swap it at runtime, so a live switch would leave dates, plain numbers and the
 * 342 imperative `translate()` calls evaluated at component construction on the
 * old language. The reload is what makes the switch total instead of partial.
 */
@Service()
export class LanguageService {
  readonly #analytics = inject(AnalyticsService);
  readonly #authStore = inject(AuthStore);
  readonly #logger = inject(Logger);
  readonly #storage = inject(StorageService);
  readonly #userSettings = inject(UserSettingsStore);

  /**
   * Persists the choice, records it, then reloads.
   *
   * The snapshot is written before the API call: it is what the next boot
   * reads, and it must survive a request that fails or a user who closes the
   * tab mid-flight. The server copy is what follows the account to another
   * device; the two disagreeing for a while is fine, the snapshot loses on the
   * next load.
   */
  async change(
    next: SupportedLocale,
    surface: LanguageChangeSurface,
  ): Promise<void> {
    const previous = this.#userSettings.locale();
    if (next === previous) return;

    this.#storage.setString(STORAGE_KEYS.SETTINGS_LANGUAGE, next);

    // `send_instantly` because the reload below discards the batched queue.
    this.#analytics.captureEvent(
      ANALYTICS_EVENTS.LANGUAGE_CHANGED,
      { from: previous, to: next, surface },
      { send_instantly: true },
    );

    if (this.#authStore.isAuthenticated()) {
      try {
        await this.#userSettings.updateSettings({ locale: next });
      } catch (error) {
        // The snapshot already holds the choice, so the reload still lands in
        // the right language. Only the sync to other devices is missing.
        this.#logger.error('Failed to persist the language preference', error);
      }
    }

    window.location.reload();
  }
}
