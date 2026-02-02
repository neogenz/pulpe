import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable } from 'rxjs';

import { ApplicationConfiguration } from '@core/config/application-configuration';

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
    return `${this.#config.backendApiUrl()}/encryption`;
  }

  getSalt$(): Observable<SaltResponse> {
    return this.#http.get<SaltResponse>(`${this.#baseUrl}/salt`);
  }

  validateKey$(clientKeyHex: string): Observable<void> {
    return this.#http.post<void>(`${this.#baseUrl}/validate-key`, {
      clientKey: clientKeyHex,
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
