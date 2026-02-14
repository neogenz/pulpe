import { inject, Injectable } from '@angular/core';

import { z } from 'zod';

import { ApplicationConfiguration } from '../config/application-configuration';
import { NGROK_SKIP_HEADER } from '../config/ngrok.constants';

const maintenanceStatusSchema = z.object({
  maintenanceMode: z.boolean(),
});

export type MaintenanceStatus = z.infer<typeof maintenanceStatusSchema>;

const CACHE_TTL_MS = 10_000;

/**
 * Service for checking maintenance mode status.
 * Uses native fetch instead of HttpClient to avoid interceptor loops,
 * since this is called before Angular interceptors are fully initialized.
 *
 * Caches the result for 10s to avoid duplicate requests during navigation bursts
 * (the guard runs on every route activation).
 */
@Injectable({
  providedIn: 'root',
})
export class MaintenanceApi {
  readonly #config = inject(ApplicationConfiguration);
  #cached: { status: MaintenanceStatus; timestamp: number } | null = null;
  #inFlight: Promise<MaintenanceStatus> | null = null;

  async checkStatus(): Promise<MaintenanceStatus> {
    if (this.#cached && Date.now() - this.#cached.timestamp < CACHE_TTL_MS) {
      return this.#cached.status;
    }

    if (this.#inFlight) return this.#inFlight;

    this.#inFlight = this.#fetchStatus().finally(() => {
      this.#inFlight = null;
    });

    return this.#inFlight;
  }

  async #fetchStatus(): Promise<MaintenanceStatus> {
    const url = `${this.#config.backendApiUrl()}/maintenance/status`;
    const isNgrok = url.includes('ngrok');

    const response = await fetch(
      url,
      isNgrok ? { headers: NGROK_SKIP_HEADER } : {},
    );

    if (!response.ok) {
      throw new Error(`Maintenance check failed: ${response.status}`);
    }

    const status = maintenanceStatusSchema.parse(await response.json());
    this.#cached = { status, timestamp: Date.now() };
    return status;
  }
}
