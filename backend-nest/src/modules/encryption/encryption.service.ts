import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import type { AppClsStore } from '@common/types/cls-store.interface';
import { EncryptionKeyRepository } from './encryption-key.repository';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const KDF_ITERATIONS = 600_000;
const HKDF_DIGEST = 'sha256';
const DEK_CACHE_TTL_MS = 5 * 60 * 1000;

// Base32 alphabet (RFC 4648, no padding) — avoids 0/O and 1/l ambiguity
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Deterministic salt for demo users - no DB persistence needed since demo data is plaintext
const DEMO_SALT = Buffer.alloc(SALT_LENGTH, 0x00);

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
  readonly #cls: ClsService<AppClsStore>;

  constructor(
    configService: ConfigService,
    repository: EncryptionKeyRepository,
    cls: ClsService<AppClsStore>,
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
    this.#cls = cls;
  }

  #isDemo(): boolean {
    return this.#cls.get('isDemo') ?? false;
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
      // Always use fallback, never throw - this prevents cascading failures
      // when data was encrypted with a different key (e.g., after password change
      // or salt rotation without re-encryption)
      this.#logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          fallbackAmount,
          ciphertextLength: ciphertext.length,
        },
        'Decryption failed, using fallback amount',
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

  /**
   * Prepare amount data for database storage based on demo mode.
   * In demo mode: keeps plaintext amount, no encryption
   * In normal mode: zeros plaintext amount, encrypts to amount_encrypted
   */
  async prepareAmountData(
    amount: number,
    userId: string,
    clientKey: Buffer,
  ): Promise<{ amount: number; amount_encrypted: string | null }> {
    if (this.#isDemo()) {
      return { amount, amount_encrypted: null };
    }

    const dek = await this.ensureUserDEK(userId, clientKey);
    const encrypted = this.encryptAmount(amount, dek);
    return { amount: 0, amount_encrypted: encrypted };
  }

  /**
   * Batch version of prepareAmountData for bulk operations.
   * Returns array of { amount, amount_encrypted } matching input order.
   */
  async prepareAmountsData(
    amounts: number[],
    userId: string,
    clientKey: Buffer,
  ): Promise<Array<{ amount: number; amount_encrypted: string | null }>> {
    if (this.#isDemo()) {
      return amounts.map((amount) => ({ amount, amount_encrypted: null }));
    }

    const dek = await this.ensureUserDEK(userId, clientKey);
    return amounts.map((amount) => ({
      amount: 0,
      amount_encrypted: this.encryptAmount(amount, dek),
    }));
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

    // Demo users use deterministic salt without DB lookup
    if (this.#isDemo()) {
      const dek = this.#deriveDEK(clientKey, DEMO_SALT, userId);
      this.#dekCache.set(cacheKey, {
        dek,
        expiry: Date.now() + DEK_CACHE_TTL_MS,
      });
      return dek;
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

  async getUserSalt(
    userId: string,
  ): Promise<{ salt: string; kdfIterations: number; hasRecoveryKey: boolean }> {
    const { salt, kdfIterations } = await this.#getOrGenerateClientSalt(userId);
    // Demo users don't have recovery keys
    const hasRecoveryKey = this.#isDemo()
      ? false
      : await this.#repository.hasRecoveryKey(userId);
    return { salt, kdfIterations, hasRecoveryKey };
  }

  generateRecoveryKey(): { raw: Buffer; formatted: string } {
    const raw = randomBytes(KEY_LENGTH);
    const formatted = formatRecoveryKey(encodeBase32(raw));
    return { raw, formatted };
  }

  wrapDEK(dek: Buffer, recoveryKey: Buffer): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, recoveryKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  unwrapDEK(wrappedDEK: string, recoveryKey: Buffer): Buffer {
    const payload = Buffer.from(wrappedDEK, 'base64');
    const iv = payload.subarray(0, IV_LENGTH);
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, recoveryKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const dek = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    if (dek.length !== KEY_LENGTH) {
      throw new Error('Unwrapped DEK has invalid length');
    }
    return dek;
  }

  generateKeyCheck(dek: Buffer): string {
    return this.encryptAmount(0, dek);
  }

  validateKeyCheck(keyCheck: string, dek: Buffer): boolean {
    try {
      this.decryptAmount(keyCheck, dek);
      return true;
    } catch {
      return false;
    }
  }

  async verifyAndEnsureKeyCheck(
    userId: string,
    clientKey: Buffer,
  ): Promise<boolean> {
    const row = await this.#repository.findByUserId(userId);
    const dek = await this.ensureUserDEK(userId, clientKey);

    if (row?.key_check) {
      return this.validateKeyCheck(row.key_check, dek);
    }

    // No key_check stored yet (existing user before migration) — store it now
    const keyCheck = this.generateKeyCheck(dek);
    await this.#repository.updateKeyCheck(userId, keyCheck);
    return true;
  }

  async storeKeyCheck(userId: string, keyCheck: string): Promise<void> {
    await this.#repository.updateKeyCheck(userId, keyCheck);
  }

  async setupRecoveryKey(
    userId: string,
    clientKey: Buffer,
  ): Promise<{ formatted: string }> {
    const dek = await this.getUserDEK(userId, clientKey);
    const { raw, formatted } = this.generateRecoveryKey();

    const wrappedDEK = this.wrapDEK(dek, raw);
    await this.#repository.updateWrappedDEK(userId, wrappedDEK);

    // Zero recovery key from memory — caller receives only the formatted string
    raw.fill(0);

    return { formatted };
  }

  async recoverWithKey(
    userId: string,
    recoveryKeyFormatted: string,
    newClientKey: Buffer,
    reEncryptUserData: (oldDek: Buffer, newDek: Buffer) => Promise<void>,
  ): Promise<void> {
    const row = await this.#repository.findByUserId(userId);
    if (!row?.wrapped_dek) {
      throw new Error('No recovery key configured for this user');
    }

    const recoveryKey = decodeBase32(recoveryKeyFormatted.replace(/-/g, ''));
    if (recoveryKey.length !== KEY_LENGTH) {
      throw new Error('Invalid recovery key format');
    }

    const oldDek = this.unwrapDEK(row.wrapped_dek, recoveryKey);

    // Reuse existing salt - newClientKey was derived with this salt on frontend
    const existingSalt = Buffer.from(row.salt, 'hex');
    const newDek = this.#deriveDEK(newClientKey, existingSalt, userId);

    this.#invalidateUserDEKCache(userId);

    try {
      // Re-encrypt user data with new DEK (newClientKey produces different DEK)
      await reEncryptUserData(oldDek, newDek);

      // Wrap new DEK with the same recovery key
      const newWrappedDEK = this.wrapDEK(newDek, recoveryKey);
      await this.#repository.updateWrappedDEK(userId, newWrappedDEK);
    } finally {
      // Zero sensitive material (even on error)
      recoveryKey.fill(0);
      oldDek.fill(0);
      newDek.fill(0);
    }
  }

  #invalidateUserDEKCache(userId: string): void {
    for (const key of this.#dekCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.#dekCache.delete(key);
      }
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
    // Demo users use deterministic salt without DB persistence
    if (this.#isDemo()) {
      return DEMO_SALT;
    }

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
    const salt = await this.#ensureUserSalt(userId);
    return { salt: salt.toString('hex'), kdfIterations: KDF_ITERATIONS };
  }
}

function encodeBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let result = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return result;
}

function decodeBase32(encoded: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of encoded.toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

function formatRecoveryKey(base32: string): string {
  const groups: string[] = [];
  for (let i = 0; i < base32.length; i += 4) {
    groups.push(base32.slice(i, i + 4));
  }
  return groups.join('-');
}
