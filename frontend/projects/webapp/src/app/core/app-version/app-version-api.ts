import { inject, Injectable } from '@angular/core';

import {
  appVersionResponseSchema,
  type AppVersionResponse,
  REQUEST_ID_HEADER,
} from 'pulpe-shared';

import { ApplicationConfiguration } from '../config/application-configuration';
import { NGROK_SKIP_HEADER } from '../config/ngrok.constants';

/**
 * Fetches the server-published minimum-supported-version payload.
 * Uses native fetch instead of HttpClient: the endpoint is public (no auth)
 * and the gate must work before interceptors/auth are fully initialized.
 *
 * No client-side TTL cache: the backend sends `Cache-Control: public,
 * max-age=300`, so repeated checks within 5 minutes are served from the
 * browser HTTP cache.
 */
@Injectable({
  providedIn: 'root',
})
export class AppVersionApi {
  readonly #config = inject(ApplicationConfiguration);
  #inFlight: Promise<AppVersionResponse> | null = null;

  async fetchVersion(): Promise<AppVersionResponse> {
    if (this.#inFlight) return this.#inFlight;

    this.#inFlight = this.#fetchVersion().finally(() => {
      this.#inFlight = null;
    });

    return this.#inFlight;
  }

  async #fetchVersion(): Promise<AppVersionResponse> {
    const url = `${this.#config.backendApiUrl()}/app/version`;
    const isNgrok = url.includes('ngrok');

    const response = await fetch(url, {
      headers: {
        [REQUEST_ID_HEADER]: crypto.randomUUID(),
        ...(isNgrok ? NGROK_SKIP_HEADER : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`App version check failed: ${response.status}`);
    }

    return appVersionResponseSchema.parse(await response.json());
  }
}
