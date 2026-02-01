import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable } from 'rxjs';

import { ApplicationConfiguration } from '@core/config/application-configuration';

import { generateRandomKeyHex } from './crypto.utils';

interface SaltResponse {
  salt: string;
  kdfIterations: number;
}

interface PasswordChangeResponse {
  success: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class EncryptionApi {
  readonly #http = inject(HttpClient);
  readonly #config = inject(ApplicationConfiguration);

  get #baseUrl(): string {
    return `${this.#config.backendApiUrl()}/v1/encryption`;
  }

  getSalt$(): Observable<SaltResponse> {
    // AuthGuard requires X-Client-Key on all endpoints, but the salt endpoint
    // doesn't use it. We send a random placeholder to satisfy validation since
    // the real clientKey hasn't been derived yet (it depends on the salt).
    return this.#http.get<SaltResponse>(`${this.#baseUrl}/salt`, {
      headers: {
        'X-Client-Key': generateRandomKeyHex(),
      },
    });
  }

  notifyPasswordChange$(
    newClientKeyHex: string,
  ): Observable<PasswordChangeResponse> {
    return this.#http.post<PasswordChangeResponse>(
      `${this.#baseUrl}/password-change`,
      { newClientKey: newClientKeyHex },
    );
  }
}
