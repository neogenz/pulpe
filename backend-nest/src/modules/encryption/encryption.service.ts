import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  EncryptionKeyRepository,
  type UserEncryptionKeyFullRow,
} from './encryption-key.repository';

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

export const DEMO_CLIENT_KEY_BUFFER = Buffer.from(
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'hex',
);

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
      // Always use fallback, never throw - this prevents cascading failures
      // when data was encrypted with a different key (e.g., after password change
      // or salt rotation without re-encryption)
      this.#logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
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

  async prepareAmountData(
    amount: number,
    userId: string,
    clientKey: Buffer,
  ): Promise<{ amount: string }> {
    const dek = await this.ensureUserDEK(userId, clientKey);
    const encrypted = this.encryptAmount(amount, dek);
    return { amount: encrypted };
  }

  async prepareAmountsData(
    amounts: number[],
    userId: string,
    clientKey: Buffer,
  ): Promise<Array<{ amount: string }>> {
    const dek = await this.ensureUserDEK(userId, clientKey);
    return amounts.map((amount) => ({
      amount: this.encryptAmount(amount, dek),
    }));
  }

  async ensureUserDEK(userId: string, clientKey: Buffer): Promise<Buffer> {
    const cacheKey = this.#buildCacheKey(userId, clientKey);
    const cached = this.#dekCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.dek;
    }

    const { salt, keyCheck } = await this.#ensureUserSalt(userId);
    const dek = this.#deriveDEK(clientKey, salt, userId);

    if (keyCheck && !this.validateKeyCheck(keyCheck, dek)) {
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED,
      );
    }

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

  async getVaultStatus(
    userId: string,
  ): Promise<{ vaultCodeConfigured: boolean }> {
    const vaultCodeConfigured = await this.#repository.hasVaultCode(userId);
    return { vaultCodeConfigured };
  }

  async getUserSalt(
    userId: string,
  ): Promise<{ salt: string; kdfIterations: number; hasRecoveryKey: boolean }> {
    const { salt, kdfIterations } = await this.#getOrGenerateClientSalt(userId);
    const hasRecoveryKey = await this.#repository.hasRecoveryKey(userId);
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

    if (!row) {
      const dek = await this.ensureUserDEK(userId, clientKey);
      const keyCheck = this.generateKeyCheck(dek);
      await this.#repository.updateKeyCheck(userId, keyCheck);
      return true;
    }

    const salt = Buffer.from(row.salt, 'hex');
    const dek = this.#deriveDEK(clientKey, salt, userId);

    this.#dekCache.set(this.#buildCacheKey(userId, clientKey), {
      dek,
      expiry: Date.now() + DEK_CACHE_TTL_MS,
    });

    if (row.key_check) {
      return this.validateKeyCheck(row.key_check, dek);
    }

    const keyCheck = this.generateKeyCheck(dek);
    await this.#repository.updateKeyCheck(userId, keyCheck);
    return true;
  }

  async storeKeyCheck(userId: string, keyCheck: string): Promise<void> {
    await this.#repository.updateKeyCheck(userId, keyCheck);
  }

  async createRecoveryKey(
    userId: string,
    clientKey: Buffer,
  ): Promise<{ formatted: string }> {
    const existing = await this.#repository.findByUserId(userId);
    if (existing?.wrapped_dek) {
      throw new BusinessException(
        ERROR_DEFINITIONS.RECOVERY_KEY_ALREADY_EXISTS,
      );
    }
    return this.#generateAndStoreRecoveryKey(userId, clientKey, existing);
  }

  async regenerateRecoveryKey(
    userId: string,
    clientKey: Buffer,
  ): Promise<{ formatted: string }> {
    const existing = await this.#repository.findByUserId(userId);
    return this.#generateAndStoreRecoveryKey(userId, clientKey, existing);
  }

  async #generateAndStoreRecoveryKey(
    userId: string,
    clientKey: Buffer,
    existing: UserEncryptionKeyFullRow | null,
  ): Promise<{ formatted: string }> {
    const dek = await this.getUserDEK(userId, clientKey);
    const { raw, formatted } = this.generateRecoveryKey();

    const wrappedDEK = this.wrapDEK(dek, raw);
    await this.#repository.updateWrappedDEK(userId, wrappedDEK);

    if (!existing?.key_check) {
      const keyCheck = this.generateKeyCheck(dek);
      await this.#repository.updateKeyCheck(userId, keyCheck);
    }

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

  async rekeyUserData(
    userId: string,
    oldClientKey: Buffer,
    newClientKey: Buffer,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const oldDek = await this.getUserDEK(userId, oldClientKey);
    const newDek = await this.ensureUserDEK(userId, newClientKey);
    await this.reEncryptAllUserData(userId, oldDek, newDek, supabase);
  }

  async reEncryptAllUserData(
    userId: string,
    oldDek: Buffer,
    newDek: Buffer,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const [budgetIds, templateIds] = await Promise.all([
      this.#fetchUserBudgetIds(userId, supabase),
      this.#fetchUserTemplateIds(userId, supabase),
    ]);

    const [
      budgetLines,
      transactions,
      templateLines,
      savingsGoals,
      monthlyBudgets,
    ] = await Promise.all([
      this.#fetchBudgetLines(budgetIds, supabase),
      this.#fetchTransactions(budgetIds, supabase),
      this.#fetchTemplateLines(templateIds, supabase),
      this.#fetchSavingsGoals(userId, supabase),
      this.#fetchMonthlyBudgets(userId, supabase),
    ]);

    const payloads = this.#buildRekeyPayloads(
      {
        budgetLines,
        transactions,
        templateLines,
        savingsGoals,
        monthlyBudgets,
      },
      oldDek,
      newDek,
    );

    const keyCheck = this.generateKeyCheck(newDek);

    const { error } = await supabase.rpc('rekey_user_encrypted_data', {
      p_budget_lines: payloads.budgetLines,
      p_transactions: payloads.transactions,
      p_template_lines: payloads.templateLines,
      p_savings_goals: payloads.savingsGoals,
      p_monthly_budgets: payloads.monthlyBudgets,
      p_key_check: keyCheck,
    });

    if (error) {
      this.#logger.error(
        { userId, operation: 'rekey.rpc_failure', error: error.message },
        'Atomic rekey RPC failed',
      );
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_REKEY_PARTIAL_FAILURE,
      );
    }

    this.#logger.log(
      {
        userId,
        operation: 'rekey.complete',
        counts: {
          budget_line: payloads.budgetLines.length,
          transaction: payloads.transactions.length,
          template_line: payloads.templateLines.length,
          savings_goal: payloads.savingsGoals.length,
          monthly_budget: payloads.monthlyBudgets.length,
        },
      },
      'All user data re-encrypted',
    );
  }

  #buildRekeyPayloads(
    rows: {
      budgetLines: Array<{
        id: string;
        amount: string | null;
      }>;
      transactions: Array<{
        id: string;
        amount: string | null;
      }>;
      templateLines: Array<{
        id: string;
        amount: string | null;
      }>;
      savingsGoals: Array<{
        id: string;
        target_amount: string | null;
      }>;
      monthlyBudgets: Array<{
        id: string;
        ending_balance: string | null;
      }>;
    },
    oldDek: Buffer,
    newDek: Buffer,
  ) {
    const rekey = (ciphertext: string | null) =>
      ciphertext
        ? this.#reEncryptAmountStrict(ciphertext, oldDek, newDek)
        : null;

    return {
      budgetLines: rows.budgetLines.map((r) => ({
        id: r.id,
        amount: rekey(r.amount),
      })),
      transactions: rows.transactions.map((r) => ({
        id: r.id,
        amount: rekey(r.amount),
      })),
      templateLines: rows.templateLines.map((r) => ({
        id: r.id,
        amount: rekey(r.amount),
      })),
      savingsGoals: rows.savingsGoals.map((r) => ({
        id: r.id,
        target_amount: rekey(r.target_amount),
      })),
      monthlyBudgets: rows.monthlyBudgets.map((r) => ({
        id: r.id,
        ending_balance: rekey(r.ending_balance),
      })),
    };
  }

  #reEncryptAmountStrict(
    ciphertext: string,
    oldDek: Buffer,
    newDek: Buffer,
  ): string {
    const plaintext = this.decryptAmount(ciphertext, oldDek);
    return this.encryptAmount(plaintext, newDek);
  }

  async #fetchUserBudgetIds(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id')
      .eq('user_id', userId);

    if (error) throw error;
    return data?.map((b) => b.id) ?? [];
  }

  async #fetchUserTemplateIds(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from('template')
      .select('id')
      .eq('user_id', userId);

    if (error) throw error;
    return data?.map((t) => t.id) ?? [];
  }

  async #fetchBudgetLines(
    budgetIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ) {
    if (!budgetIds.length) return [];

    const { data, error } = await supabase
      .from('budget_line')
      .select('id, amount')
      .in('budget_id', budgetIds);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchTransactions(
    budgetIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ) {
    if (!budgetIds.length) return [];

    const { data, error } = await supabase
      .from('transaction')
      .select('id, amount')
      .in('budget_id', budgetIds);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchTemplateLines(
    templateIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ) {
    if (!templateIds.length) return [];

    const { data, error } = await supabase
      .from('template_line')
      .select('id, amount')
      .in('template_id', templateIds);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchSavingsGoals(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const { data, error } = await supabase
      .from('savings_goal')
      .select('id, target_amount')
      .eq('user_id', userId);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchMonthlyBudgets(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id, ending_balance')
      .eq('user_id', userId);

    if (error) throw error;
    return data ?? [];
  }

  #invalidateUserDEKCache(userId: string): void {
    for (const key of this.#dekCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.#dekCache.delete(key);
      }
    }
  }

  #buildCacheKey(userId: string, clientKey: Buffer): string {
    const fingerprint = createHash('sha256').update(clientKey).digest('hex');
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

  async #ensureUserSalt(
    userId: string,
  ): Promise<{ salt: Buffer; keyCheck: string | null }> {
    // Check existing first
    const existing = await this.#repository.findSaltByUserId(userId);
    if (existing) {
      return {
        salt: Buffer.from(existing.salt, 'hex'),
        keyCheck: existing.key_check,
      };
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

    return {
      salt: Buffer.from(winner.salt, 'hex'),
      keyCheck: winner.key_check,
    };
  }

  async #getOrGenerateClientSalt(
    userId: string,
  ): Promise<{ salt: string; kdfIterations: number }> {
    const { salt } = await this.#ensureUserSalt(userId);
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
