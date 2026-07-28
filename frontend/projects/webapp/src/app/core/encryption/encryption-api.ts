import { Service, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import {
  type EncryptionSaltResponse,
  type EncryptionSetupRecoveryResponse,
  type EncryptionRecoverResponse,
  type EncryptionChangePinResponse,
  type EncryptionValidateKeyRequest,
  type EncryptionVerifyRecoveryKeyRequest,
  encryptionSaltResponseSchema,
  encryptionSetupRecoveryResponseSchema,
  encryptionValidateKeyRequestSchema,
  encryptionVerifyRecoveryKeyRequestSchema,
  encryptionRecoverRequestSchema,
  encryptionRecoverResponseSchema,
  encryptionChangePinRequestSchema,
  encryptionChangePinResponseSchema,
} from 'pulpe-shared';
import { ApiClient } from '@core/api/api-client';

@Service()
export class EncryptionApi {
  readonly #api = inject(ApiClient);

  getSalt$(): Observable<EncryptionSaltResponse> {
    return this.#api.get$('/encryption/salt', encryptionSaltResponseSchema);
  }

  /**
   * Validates the client key against the stored key_check.
   * Fails closed when no key_check has been initialized.
   */
  validateKey$(clientKeyHex: string): Observable<void> {
    return this.#api.postVoid$<EncryptionValidateKeyRequest>(
      '/encryption/validate-key',
      { clientKey: clientKeyHex },
      encryptionValidateKeyRequestSchema,
    );
  }

  verifyRecoveryKey$(recoveryKey: string): Observable<void> {
    return this.#api.postVoid$<EncryptionVerifyRecoveryKeyRequest>(
      '/encryption/verify-recovery-key',
      { recoveryKey },
      encryptionVerifyRecoveryKeyRequestSchema,
    );
  }

  setupRecoveryKey$(): Observable<EncryptionSetupRecoveryResponse> {
    return this.#api.post$(
      '/encryption/setup-recovery',
      {},
      encryptionSetupRecoveryResponseSchema,
    );
  }

  regenerateRecoveryKey$(): Observable<EncryptionSetupRecoveryResponse> {
    return this.#api.post$(
      '/encryption/regenerate-recovery',
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
      encryptionRecoverRequestSchema,
    );
  }

  changePin$(
    oldClientKey: string,
    newClientKey: string,
  ): Observable<EncryptionChangePinResponse> {
    return this.#api.post$(
      '/encryption/change-pin',
      { oldClientKey, newClientKey },
      encryptionChangePinResponseSchema,
      encryptionChangePinRequestSchema,
    );
  }
}
