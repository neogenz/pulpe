import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable } from 'rxjs';

import { ApplicationConfiguration } from '@core/config/application-configuration';

// Deterministic placeholder sent with the salt request. The backend AuthGuard
// requires X-Client-Key on every request, but the salt endpoint doesn't use it
// (chicken-and-egg: we need the salt to derive the real key). Using a fixed
// sentinel avoids leaking random entropy that could be mistaken for a real key.
const SALT_REQUEST_PLACEHOLDER_KEY = '0'.repeat(63) + '1';

interface SaltResponse {
  salt: string;
  kdfIterations: number;
}

interface PasswordChangeResponse {
  success: boolean;
}

interface SetupRecoveryResponse {
  recoveryKey: string;
}

interface RecoverResponse {
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
    return this.#http.get<SaltResponse>(`${this.#baseUrl}/salt`, {
      headers: {
        'X-Client-Key': SALT_REQUEST_PLACEHOLDER_KEY,
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

  setupRecoveryKey$(): Observable<SetupRecoveryResponse> {
    return this.#http.post<SetupRecoveryResponse>(
      `${this.#baseUrl}/setup-recovery`,
      {},
    );
  }

  recover$(
    recoveryKey: string,
    newClientKeyHex: string,
  ): Observable<RecoverResponse> {
    return this.#http.post<RecoverResponse>(`${this.#baseUrl}/recover`, {
      recoveryKey,
      newClientKey: newClientKeyHex,
    });
  }
}
