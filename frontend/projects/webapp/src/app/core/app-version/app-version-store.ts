import { DOCUMENT } from '@angular/common';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';

import { Logger } from '@core/logging/logger';

import { AppVersionApi } from './app-version-api';
import { CURRENT_APP_VERSION } from './current-app-version';
import { isVersionBelow } from './version-compare';

type AppVersionStatus = 'unknown' | 'ok' | 'update-required';

/**
 * Force-update gate for the webapp (web analog of iOS `AppVersionStore`).
 *
 * Compares the running bundle version against the server-published
 * `web.minVersion` on startup and whenever the tab returns to the foreground:
 * `visibilitychange` for tab switches, `pageshow` for iOS Safari bfcache
 * restores (which fire no `visibilitychange`).
 *
 * Fail-open on the first check so a version-endpoint outage never bricks the
 * app. Once a status is known, later fetch errors keep it — going offline
 * cannot dismiss an already-shown gate.
 */
@Injectable({ providedIn: 'root' })
export class AppVersionStore {
  readonly #api = inject(AppVersionApi);
  readonly #logger = inject(Logger);
  readonly #document = inject(DOCUMENT);
  readonly #destroyRef = inject(DestroyRef);
  readonly #currentVersion = inject(CURRENT_APP_VERSION);

  readonly #status = signal<AppVersionStatus>('unknown');
  readonly isUpdateRequired = computed(
    () => this.#status() === 'update-required',
  );

  #isInitialized = false;

  readonly #onVisibilityChange = (): void => {
    if (this.#document.visibilityState === 'visible') {
      void this.check();
    }
  };

  readonly #onPageShow = (event: PageTransitionEvent): void => {
    if (event.persisted) {
      void this.check();
    }
  };

  initialize(): void {
    if (this.#isInitialized) return;
    this.#isInitialized = true;

    const win = this.#document.defaultView!;
    this.#document.addEventListener(
      'visibilitychange',
      this.#onVisibilityChange,
    );
    win.addEventListener('pageshow', this.#onPageShow);

    this.#destroyRef.onDestroy(() => {
      this.#document.removeEventListener(
        'visibilitychange',
        this.#onVisibilityChange,
      );
      win.removeEventListener('pageshow', this.#onPageShow);
    });

    void this.check();
  }

  async check(): Promise<void> {
    try {
      const response = await this.#api.fetchVersion();
      const minVersion = response.data.web.minVersion;
      const isBelow = isVersionBelow(this.#currentVersion, minVersion);

      this.#status.set(isBelow ? 'update-required' : 'ok');

      if (isBelow) {
        this.#logger.warn('[ForceUpdate] Bundle below minimum version', {
          currentVersion: this.#currentVersion,
          minVersion,
        });
      }
    } catch (error) {
      if (this.#status() === 'unknown') {
        this.#status.set('ok');
      }
      this.#logger.warn('[ForceUpdate] Version check failed, failing open', {
        error,
      });
    }
  }
}
