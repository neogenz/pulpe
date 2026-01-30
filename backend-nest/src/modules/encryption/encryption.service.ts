import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { EncryptionKeyRepository } from './encryption-key.repository';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const KDF_ITERATIONS = 600_000;
const HKDF_DIGEST = 'sha256';
const DEK_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedDEK {
  dek: Buffer;
  expiry: number;
}

@Injectable()
export class EncryptionService {
  readonly #logger = new Logger(EncryptionService.name);
  readonly #masterKey: Buffer;
  readonly #dekCache = new Map<string, CachedDEK>();
  readonly #repository: EncryptionKeyRepository;
  readonly #passwordChangeLocks = new Map<string, Promise<void>>();

  constructor(
    configService: ConfigService,
    repository: EncryptionKeyRepository,
  ) {
    const masterKeyHex = configService.get<string>('ENCRYPTION_MASTER_KEY');
    if (!masterKeyHex) {
      throw new Error('ENCRYPTION_MASTER_KEY must be defined');
    }
    this.#masterKey = Buffer.from(masterKeyHex, 'hex');
    if (this.#masterKey.length !== KEY_LENGTH) {
      throw new Error(
        `ENCRYPTION_MASTER_KEY must be exactly ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars), got ${this.#masterKey.length} bytes`,
      );
    }
    this.#repository = repository;
  }

  encryptAmount(amount: number, dek: Buffer): string {
    const plaintext = amount.toString();
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, dek, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decryptAmount(ciphertext: string, dek: Buffer): number {
    const payload = Buffer.from(ciphertext, 'base64');

    const iv = payload.subarray(0, IV_LENGTH);
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, dek, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    const value = parseFloat(decrypted.toString('utf8'));
    if (Number.isNaN(value)) {
      throw new Error('Decrypted amount is not a valid number');
    }
    return value;
  }

  tryDecryptAmount(
    ciphertext: string,
    dek: Buffer,
    fallbackAmount: number,
  ): number {
    try {
      return this.decryptAmount(ciphertext, dek);
    } catch (error) {
      this.#logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Decryption failed, using plaintext fallback',
      );
      return fallbackAmount;
    }
  }

  encryptAmounts(amounts: number[], dek: Buffer): string[] {
    return amounts.map((amount) => this.encryptAmount(amount, dek));
  }

  decryptAmounts(ciphertexts: string[], dek: Buffer): number[] {
    return ciphertexts.map((ct) => this.decryptAmount(ct, dek));
  }

  async ensureUserDEK(userId: string, clientKey: Buffer): Promise<Buffer> {
    const cacheKey = this.#buildCacheKey(userId, clientKey);
    const cached = this.#dekCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.dek;
    }

    const salt = await this.#ensureUserSalt(userId);
    const dek = this.#deriveDEK(clientKey, salt, userId);

    this.#dekCache.set(cacheKey, {
      dek,
      expiry: Date.now() + DEK_CACHE_TTL_MS,
    });

    return dek;
  }

  async getUserDEK(userId: string, clientKey: Buffer): Promise<Buffer> {
    const cacheKey = this.#buildCacheKey(userId, clientKey);
    const cached = this.#dekCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.dek;
    }

    const row = await this.#repository.findSaltByUserId(userId);
    if (!row) {
      throw new Error(`No encryption key found for user ${userId}`);
    }

    const salt = Buffer.from(row.salt, 'hex');
    const dek = this.#deriveDEK(clientKey, salt, userId);

    this.#dekCache.set(cacheKey, {
      dek,
      expiry: Date.now() + DEK_CACHE_TTL_MS,
    });

    return dek;
  }

  getUserSalt(
    userId: string,
  ): Promise<{ salt: string; kdfIterations: number }> {
    return this.#getOrGenerateClientSalt(userId);
  }

  async onPasswordChange(
    userId: string,
    oldClientKey: Buffer,
    newClientKey: Buffer,
    reEncryptUserData: (oldDek: Buffer, newDek: Buffer) => Promise<void>,
  ): Promise<void> {
    // Chain onto existing lock to serialize password changes per user.
    // The lock is set BEFORE the operation starts to prevent race conditions
    // between checking and setting.
    const existing = this.#passwordChangeLocks.get(userId);
    const operation = (existing ?? Promise.resolve())
      .catch(() => {
        // Ignore errors from previous operation — each caller handles its own
      })
      .then(() =>
        this.#executePasswordChange(
          userId,
          oldClientKey,
          newClientKey,
          reEncryptUserData,
        ),
      );

    this.#passwordChangeLocks.set(userId, operation);
    try {
      await operation;
    } finally {
      // Only delete if this is still the latest operation in the chain
      if (this.#passwordChangeLocks.get(userId) === operation) {
        this.#passwordChangeLocks.delete(userId);
      }
    }
  }

  async #executePasswordChange(
    userId: string,
    oldClientKey: Buffer,
    newClientKey: Buffer,
    reEncryptUserData: (oldDek: Buffer, newDek: Buffer) => Promise<void>,
  ): Promise<void> {
    const row = await this.#repository.findSaltByUserId(userId);
    if (!row) {
      throw new Error(`No encryption key found for user ${userId}`);
    }

    const oldSalt = Buffer.from(row.salt, 'hex');
    const oldDek = this.#deriveDEK(oldClientKey, oldSalt, userId);

    const newSalt = randomBytes(SALT_LENGTH);
    const newDek = this.#deriveDEK(newClientKey, newSalt, userId);

    // Invalidate cached DEKs BEFORE salt update to prevent concurrent requests
    // from using stale cache during re-encryption window
    for (const key of this.#dekCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.#dekCache.delete(key);
      }
    }

    // Update salt BEFORE re-encryption for atomicity.
    // If re-encryption fails, rollback salt to old value.
    await this.#repository.updateSalt(userId, newSalt.toString('hex'));

    try {
      await reEncryptUserData(oldDek, newDek);
    } catch (error) {
      try {
        await this.#repository.updateSalt(userId, oldSalt.toString('hex'));
      } catch (rollbackError) {
        this.#logger.error(
          {
            userId,
            originalError:
              error instanceof Error ? error.message : String(error),
            rollbackError:
              rollbackError instanceof Error
                ? rollbackError.message
                : String(rollbackError),
          },
          'Salt rollback failed after re-encryption error',
        );
      }
      throw error;
    }
  }

  #buildCacheKey(userId: string, clientKey: Buffer): string {
    const fingerprint = createHash('sha256')
      .update(clientKey)
      .digest('hex')
      .slice(0, 32);
    return `${userId}:${fingerprint}`;
  }

  #deriveDEK(clientKey: Buffer, salt: Buffer, userId: string): Buffer {
    const ikm = Buffer.concat([clientKey, this.#masterKey]);
    const info = `pulpe-dek-${userId}`;
    const derived = hkdfSync(HKDF_DIGEST, ikm, salt, info, KEY_LENGTH);
    // Defense-in-depth: zero the concatenated copy to reduce key material lifetime in memory.
    // The original clientKey and masterKey remain — clientKey is zeroed by ClientKeyCleanupInterceptor.
    ikm.fill(0);
    return Buffer.from(derived);
  }

  async #ensureUserSalt(userId: string): Promise<Buffer> {
    // Check existing first
    const existing = await this.#repository.findSaltByUserId(userId);
    if (existing) {
      return Buffer.from(existing.salt, 'hex');
    }

    // Generate and upsert (ignoreDuplicates handles race condition)
    const salt = randomBytes(SALT_LENGTH);
    await this.#repository.upsertSalt(
      userId,
      salt.toString('hex'),
      KDF_ITERATIONS,
    );

    // Re-read to get the winning salt (in case of concurrent insert)
    const winner = await this.#repository.findSaltByUserId(userId);
    if (!winner) {
      throw new Error(`Failed to retrieve salt for user ${userId}`);
    }

    return Buffer.from(winner.salt, 'hex');
  }

  async #getOrGenerateClientSalt(
    userId: string,
  ): Promise<{ salt: string; kdfIterations: number }> {
    const row = await this.#repository.findSaltByUserId(userId);
    if (row) {
      return { salt: row.salt, kdfIterations: row.kdf_iterations };
    }

    const salt = randomBytes(SALT_LENGTH).toString('hex');
    return { salt, kdfIterations: KDF_ITERATIONS };
  }
}
