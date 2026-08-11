import {
  type EncryptionChangePinRequest,
  type EncryptionChangePinResponse,
  type EncryptionRecoverRequest,
  type EncryptionRecoverResponse,
  type EncryptionSaltResponse,
  type EncryptionSetupRecoveryResponse,
  type EncryptionValidateKeyRequest,
  type EncryptionVaultStatusResponse,
  type EncryptionVerifyRecoveryKeyRequest,
  encryptionChangePinRequestSchema,
  encryptionChangePinResponseSchema,
  encryptionRecoverRequestSchema,
  encryptionRecoverResponseSchema,
  encryptionSaltResponseSchema,
  encryptionSetupRecoveryResponseSchema,
  encryptionValidateKeyRequestSchema,
  encryptionVaultStatusResponseSchema,
  encryptionVerifyRecoveryKeyRequestSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

/**
 * The vault's HTTP surface, one function per endpoint, mirroring
 * `EncryptionApi` on the web. These are the only calls that legitimately run
 * before the vault is unlocked: none of them reads an encrypted column.
 */

export function fetchVaultStatus(): Promise<EncryptionVaultStatusResponse> {
  return api.get(
    ENDPOINTS.encryptionVaultStatus,
    encryptionVaultStatusResponseSchema,
  );
}

/** Carries the salt and iteration count the PIN must be stretched with. */
export function fetchSalt(): Promise<EncryptionSaltResponse> {
  return api.get(ENDPOINTS.encryptionSalt, encryptionSaltResponseSchema);
}

/**
 * Checks the derived key against the stored key check. Fails closed when no
 * check has been initialized, so a wrong PIN can never be mistaken for a vault
 * that was never set up.
 */
export function validateClientKey(clientKeyHex: string): Promise<void> {
  return api.postVoid<EncryptionValidateKeyRequest>(
    ENDPOINTS.encryptionValidateKey,
    { clientKey: clientKeyHex },
    encryptionValidateKeyRequestSchema,
  );
}

export function verifyRecoveryKey(recoveryKey: string): Promise<void> {
  return api.postVoid<EncryptionVerifyRecoveryKeyRequest>(
    ENDPOINTS.encryptionVerifyRecoveryKey,
    { recoveryKey },
    encryptionVerifyRecoveryKeyRequestSchema,
  );
}

export function setupRecoveryKey(): Promise<EncryptionSetupRecoveryResponse> {
  return api.post(
    ENDPOINTS.encryptionSetupRecovery,
    {},
    encryptionSetupRecoveryResponseSchema,
  );
}

export function regenerateRecoveryKey(): Promise<EncryptionSetupRecoveryResponse> {
  return api.post(
    ENDPOINTS.encryptionRegenerateRecovery,
    {},
    encryptionSetupRecoveryResponseSchema,
  );
}

/** Rewraps the vault under a freshly derived key after a forgotten PIN. */
export function recoverVault(
  recoveryKey: string,
  newClientKeyHex: string,
): Promise<EncryptionRecoverResponse> {
  return api.post<EncryptionRecoverResponse, EncryptionRecoverRequest>(
    ENDPOINTS.encryptionRecover,
    { recoveryKey, newClientKey: newClientKeyHex },
    encryptionRecoverResponseSchema,
    encryptionRecoverRequestSchema,
  );
}

export function changePin(
  oldClientKeyHex: string,
  newClientKeyHex: string,
): Promise<EncryptionChangePinResponse> {
  return api.post<EncryptionChangePinResponse, EncryptionChangePinRequest>(
    ENDPOINTS.encryptionChangePin,
    { oldClientKey: oldClientKeyHex, newClientKey: newClientKeyHex },
    encryptionChangePinResponseSchema,
    encryptionChangePinRequestSchema,
  );
}
