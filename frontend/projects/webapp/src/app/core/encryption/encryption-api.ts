import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import {
  type EncryptionSaltResponse,
  type EncryptionRekeyResponse,
  type EncryptionSetupRecoveryResponse,
  type EncryptionRecoverResponse,
  encryptionSaltResponseSchema,
  encryptionRekeyResponseSchema,
  encryptionSetupRecoveryResponseSchema,
  encryptionRecoverResponseSchema,
} from 'pulpe-shared';
import { ApiClient } from '@core/api/api-client';

@Injectable({
  providedIn: 'root',
})
export class EncryptionApi {
  readonly #api = inject(ApiClient);

  getSalt$(): Observable<EncryptionSaltResponse> {
    return this.#api.get$('/encryption/salt', encryptionSaltResponseSchema);
  }

  validateKey$(clientKeyHex: string): Observable<void> {
    return this.#api.postVoid$('/encryption/validate-key', {
      clientKey: clientKeyHex,
    });
  }

  rekeyEncryption$(
    newClientKeyHex: string,
  ): Observable<EncryptionRekeyResponse> {
    return this.#api.post$(
      '/encryption/rekey',
      { newClientKey: newClientKeyHex },
      encryptionRekeyResponseSchema,
    );
  }

  setupRecoveryKey$(): Observable<EncryptionSetupRecoveryResponse> {
    return this.#api.post$(
      '/encryption/setup-recovery',
      {},
      encryptionSetupRecoveryResponseSchema,
    );
  }

  recover$(
    recoveryKey: string,
    newClientKeyHex: string,
  ): Observable<EncryptionRecoverResponse> {
    return this.#api.post$(
      '/encryption/recover',
      { recoveryKey, newClientKey: newClientKeyHex },
      encryptionRecoverResponseSchema,
    );
  }
}
