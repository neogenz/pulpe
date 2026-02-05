import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable } from 'rxjs';

import { ApplicationConfiguration } from '@core/config/application-configuration';

interface SaltResponse {
  salt: string;
  kdfIterations: number;
  hasRecoveryKey: boolean;
}

interface RekeyResponse {
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

  /**
   * Re-encrypt all user data with a new client key.
   * Used during migration when existing users set up vault code for the first time.
   * NOT used for password changes (password and vault code are independent).
   */
  rekeyEncryption$(newClientKeyHex: string): Observable<RekeyResponse> {
    return this.#http.post<RekeyResponse>(`${this.#baseUrl}/rekey`, {
      newClientKey: newClientKeyHex,
    });
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
