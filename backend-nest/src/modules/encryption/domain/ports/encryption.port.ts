import type { Buffer } from 'node:buffer';

/**
 * EncryptionPort — port interface used by application use cases for encryption operations.
 *
 * The concrete implementation is `EncryptionService`. Use cases inject this port via DI token
 * to keep the application layer decoupled from the concrete service. (See encryption.module.ts wiring.)
 *
 * NOTE: this interface is the SUPPORTED surface — methods on EncryptionService not listed here
 * are reserved for the encryption controller (recovery flows, PIN change, key wrap/unwrap, etc.).
 */
export interface EncryptionPort {
  /** Derive (or retrieve from cache) the user's DEK. Validates keyCheck on cache miss. */
  ensureUserDEK(userId: string, clientKey: Buffer): Promise<Buffer>;
  /** Retrieve cached DEK; skip keyCheck validation. Use after `ensureUserDEK` already ran. */
  getUserDEK(userId: string, clientKey: Buffer): Promise<Buffer>;
  /** Convenience wrapper around getUserDEK for an authenticated user. */
  getDekFor(user: {
    readonly id: string;
    readonly clientKey: Buffer;
  }): Promise<Buffer>;

  /** Decrypt amount; throw on failure. */
  decryptAmount(ciphertext: string, dek: Buffer): number;
  /** Decrypt amount with fallback; never throw. */
  tryDecryptAmount(
    ciphertext: string,
    dek: Buffer,
    fallbackAmount: number,
  ): number;
  tryDecryptAmount(
    ciphertext: string | null,
    dek: Buffer,
    fallbackAmount: number,
  ): number;
  tryDecryptAmount(ciphertext: string, dek: Buffer, fallbackAmount: null): null;
  /** Encrypt amount as base64. */
  encryptAmount(amount: number, dek: Buffer): string;

  /** Decrypt `amount` and `original_amount` fields on a row. */
  decryptRowAmountFields<
    T extends { amount: string | null; original_amount: string | null },
  >(
    row: T,
    dek: Buffer,
  ): Omit<T, 'amount' | 'original_amount'> & {
    amount: number;
    original_amount: number | null;
  };

  /** Encrypt amount + return DB shape `{ amount: ciphertext }` for inserts. */
  prepareAmountData(
    amount: number,
    userId: string,
    clientKey: Buffer,
  ): Promise<{ amount: string }>;
  /** Encrypt multiple amounts at once (batch). */
  prepareAmountsData(
    amounts: number[],
    userId: string,
    clientKey: Buffer,
  ): Promise<{ amount: string }[]>;
  /** Encrypt optional amount; null/undefined input → null output. */
  encryptOptionalAmount(
    amount: number | null | undefined,
    userId: string,
    clientKey: Buffer,
  ): Promise<string | null>;
}

export const ENCRYPTION_PORT = Symbol('ENCRYPTION_PORT');
