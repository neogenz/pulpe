import type {
  UserEncryptionKey,
  UserEncryptionSalt,
  VaultStatus,
} from '../encryption.entity';

export const ENCRYPTION_KEY_REPOSITORY = Symbol('ENCRYPTION_KEY_REPOSITORY');

/**
 * Persistence port for `user_encryption_key` rows. Service-role only —
 * no RLS. Used by the encryption module's crypto adapter and by the
 * application-layer use cases that orchestrate key check / recovery key
 * / pin change flows.
 */
export interface EncryptionKeyRepositoryPort {
  /** Salt-only projection. Returns null if the user has no encryption row yet. */
  findSaltByUserId(userId: string): Promise<UserEncryptionSalt | null>;

  /**
   * Insert salt + kdf iterations for a user. Idempotent
   * (`onConflict: 'user_id', ignoreDuplicates: true`) — concurrent requests
   * race safely; the repository's caller re-reads to fetch the winning salt.
   */
  upsertSalt(
    userId: string,
    saltHex: string,
    kdfIterations: number,
  ): Promise<void>;

  /** Full row projection (salt + kdf iterations + wrapped DEK + key check). */
  findByUserId(userId: string): Promise<UserEncryptionKey | null>;

  /** True if a wrapped DEK is currently stored for the user. */
  hasRecoveryKey(userId: string): Promise<boolean>;

  /** Unconditional update of `wrapped_dek` (may be set to null for invalidation). */
  updateWrappedDEK(userId: string, wrappedDEK: string | null): Promise<void>;

  /**
   * Conditional update: writes `wrapped_dek` only when the column is null.
   * Returns whether an update actually occurred (used to detect existing
   * recovery keys without TOCTOU).
   */
  updateWrappedDEKIfNull(userId: string, wrappedDEK: string): Promise<boolean>;

  /** Public-facing vault configuration status. */
  getVaultStatus(userId: string): Promise<VaultStatus>;

  /**
   * Conditional update: writes `key_check` only when the column is null.
   * Used to lazily initialize the key-check canary on first successful
   * client-key validation.
   */
  updateKeyCheckIfNull(userId: string, keyCheck: string): Promise<void>;
}
