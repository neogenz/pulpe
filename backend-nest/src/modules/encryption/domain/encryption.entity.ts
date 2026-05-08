/**
 * Domain entities for the encryption module. These types describe the shape of
 * the data stored in `user_encryption_key` (DB) and the public-facing vault
 * status returned by `GET /encryption/vault-status`. All fields are camelCase
 * plain values (no Supabase row leakage).
 */

/**
 * Salt-only projection of `user_encryption_key`. Used by the DEK derivation
 * path that does not need the wrapped DEK column.
 */
export interface UserEncryptionSalt {
  salt: string;
  kdf_iterations: number;
  key_check: string | null;
}

/**
 * Full projection of `user_encryption_key` (salt + kdf iterations + wrapped
 * DEK + key check canary). Used by recovery / pin-change / vault-status flows.
 */
export interface UserEncryptionKey {
  salt: string;
  kdf_iterations: number;
  wrapped_dek: string | null;
  key_check: string | null;
}

/**
 * Public-facing vault configuration status. Returned by
 * `GET /encryption/vault-status`.
 */
export interface VaultStatus {
  pinCodeConfigured: boolean;
  recoveryKeyConfigured: boolean;
  vaultCodeConfigured: boolean;
}

/**
 * Result of generating a recovery key. `raw` is the 32-byte key buffer used
 * to wrap the DEK, `formatted` is the base32-grouped string shown to the
 * user. Callers MUST `raw.fill(0)` after wrapping to scrub the buffer.
 */
export interface GeneratedRecoveryKey {
  raw: Buffer;
  formatted: string;
}
