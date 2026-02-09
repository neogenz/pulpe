import { inject, Injectable } from '@angular/core';
import { ApplicationConfiguration } from '../config/application-configuration';
import { NGROK_SKIP_HEADER } from '../config/ngrok.constants';

export interface MaintenanceStatus {
  maintenanceMode: boolean;
}

/**
 * Service for checking maintenance mode status.
 * Uses native fetch instead of HttpClient to avoid interceptor loops,
 * since this is called before Angular interceptors are fully initialized.
 */
@Injectable({
  providedIn: 'root',
})
export class MaintenanceApi {
  readonly #config = inject(ApplicationConfiguration);

  async checkStatus(): Promise<MaintenanceStatus> {
    const url = `${this.#config.backendApiUrl()}/maintenance/status`;
    const isNgrok = url.includes('ngrok');

    const response = await fetch(
      url,
      isNgrok ? { headers: NGROK_SKIP_HEADER } : {},
    );

    if (!response.ok) {
      throw new Error(`Maintenance check failed: ${response.status}`);
    }

    return (await response.json()) as MaintenanceStatus;
  }
}
