import { Injectable } from '@nestjs/common';
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
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
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
  readonly #masterKey: Buffer;
  readonly #dekCache = new Map<string, CachedDEK>();
  readonly #repository: EncryptionKeyRepository;

  constructor(
    @InjectInfoLogger(EncryptionService.name)
    private readonly logger: InfoLogger,
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
      this.logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          ciphertextLength: ciphertext.length,
        },
        'Decryption failed, using fallback amount',
      );
      return fallbackAmount;
    }
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

  async getVaultStatus(userId: string): Promise<{
    pinCodeConfigured: boolean;
    recoveryKeyConfigured: boolean;
    vaultCodeConfigured: boolean;
  }> {
    return this.#repository.getVaultStatus(userId);
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
      await this.#repository.updateKeyCheckIfNull(userId, keyCheck);
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
    await this.#repository.updateKeyCheckIfNull(userId, keyCheck);
    return true;
  }

  async createRecoveryKey(
    userId: string,
    clientKey: Buffer,
  ): Promise<{ formatted: string }> {
    const dek = await this.getUserDEK(userId, clientKey);
    const { raw, formatted } = this.generateRecoveryKey();

    try {
      const wrappedDEK = this.wrapDEK(dek, raw);
      const wasUpdated = await this.#repository.updateWrappedDEKIfNull(
        userId,
        wrappedDEK,
      );

      if (!wasUpdated) {
        throw new BusinessException(
          ERROR_DEFINITIONS.RECOVERY_KEY_ALREADY_EXISTS,
        );
      }

      const keyCheck = this.generateKeyCheck(dek);
      await this.#repository.updateKeyCheckIfNull(userId, keyCheck);
    } finally {
      raw.fill(0);
    }

    return { formatted };
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

    try {
      const wrappedDEK = this.wrapDEK(dek, raw);
      await this.#repository.updateWrappedDEK(userId, wrappedDEK);

      if (!existing?.key_check) {
        const keyCheck = this.generateKeyCheck(dek);
        await this.#repository.updateKeyCheckIfNull(userId, keyCheck);
      }
    } finally {
      raw.fill(0);
    }

    return { formatted };
  }

  async recoverWithKey(
    userId: string,
    recoveryKeyFormatted: string,
    newClientKey: Buffer,
    supabase: AuthenticatedSupabaseClient,
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
      // Invalidate the wrapped DEK BEFORE re-encryption so a compromised recovery
      // key cannot unwrap a valid DEK during the re-encryption window.
      // If the process fails after this point, recovery access is lost — the user
      // will need to regenerate a recovery key from settings.
      await this.#repository.updateWrappedDEK(userId, null);

      await this.reEncryptAllUserData(userId, oldDek, newDek, supabase);

      // Re-wrap with the same recovery key — the frontend will immediately call
      // regenerateRecoveryKey$() to replace it with a fresh one.
      const newWrappedDEK = this.wrapDEK(newDek, recoveryKey);
      await this.#repository.updateWrappedDEK(userId, newWrappedDEK);
    } finally {
      // Zero sensitive material (even on error)
      recoveryKey.fill(0);
      oldDek.fill(0);
      newDek.fill(0);
    }
  }

  async changePinRekey(
    userId: string,
    oldClientKey: Buffer,
    newClientKey: Buffer,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<{ keyCheck: string; recoveryKey: string }> {
    const row = await this.#repository.findByUserId(userId);
    if (!row) {
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED,
        undefined,
        { userId, operation: 'change_pin.missing_encryption_row' },
      );
    }

    const salt = Buffer.from(row.salt, 'hex');
    const oldDek = this.#deriveDEK(oldClientKey, salt, userId);
    let newDek: Buffer | null = null;

    try {
      // Check same-key BEFORE key verification — prevents oracle: if checked after,
      // {old=X, new=X} would return ENCRYPTION_SAME_KEY when X is correct vs
      // ENCRYPTION_KEY_CHECK_FAILED when wrong, leaking PIN validity.
      if (oldClientKey.equals(newClientKey)) {
        throw new BusinessException(
          ERROR_DEFINITIONS.ENCRYPTION_SAME_KEY,
          undefined,
          { userId, operation: 'change_pin.same_key_rejected' },
        );
      }

      if (!row.key_check) {
        throw new BusinessException(
          ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED,
          undefined,
          { userId, operation: 'change_pin.key_check_not_initialized' },
        );
      }

      if (!this.validateKeyCheck(row.key_check, oldDek)) {
        throw new BusinessException(
          ERROR_DEFINITIONS.ENCRYPTION_KEY_CHECK_FAILED,
          undefined,
          { userId, operation: 'change_pin.key_check_failed' },
        );
      }

      newDek = this.#deriveDEK(newClientKey, salt, userId);
      let recoveryKeyFormatted: string = '';

      this.#invalidateUserDEKCache(userId);

      const oldWrappedDEK = row.wrapped_dek;
      await this.#repository.updateWrappedDEK(userId, null);

      let keyCheck: string;
      try {
        keyCheck = await this.reEncryptAllUserData(
          userId,
          oldDek,
          newDek,
          supabase,
        );
      } catch (rekeyError) {
        try {
          await this.#repository.updateWrappedDEK(userId, oldWrappedDEK);
        } catch (restoreError) {
          this.logger.warn(
            {
              userId,
              operation: 'change_pin.restore_wrapped_dek_failed',
              error:
                restoreError instanceof Error
                  ? restoreError.message
                  : String(restoreError),
            },
            'Failed to restore wrapped_dek after rekey failure — stuck at null until recovery key regeneration',
          );
        }
        throw rekeyError;
      }

      // Always generate a new recovery key and wrap the new DEK — ensures every
      // user gets a recovery safety net after PIN change.
      const { raw, formatted } = this.generateRecoveryKey();
      try {
        const newWrappedDEK = this.wrapDEK(newDek, raw);
        await this.#repository.updateWrappedDEK(userId, newWrappedDEK);
        recoveryKeyFormatted = formatted;
      } catch (wrapError) {
        try {
          await this.#repository.updateWrappedDEK(userId, null);
        } catch (nullifyError) {
          this.logger.warn(
            {
              userId,
              operation: 'change_pin.nullify_wrapped_dek_failed',
              error:
                nullifyError instanceof Error
                  ? nullifyError.message
                  : String(nullifyError),
            },
            'Failed to nullify wrapped_dek after wrap failure — stale wrapped_dek may remain until recovery key regeneration',
          );
        }
        throw new BusinessException(
          ERROR_DEFINITIONS.ENCRYPTION_REKEY_PARTIAL_FAILURE,
          undefined,
          { userId, operation: 'pin_change.recovery_wrap_failed' },
          {
            cause:
              wrapError instanceof Error
                ? wrapError
                : new Error(String(wrapError)),
          },
        );
      } finally {
        raw.fill(0);
      }

      return {
        keyCheck,
        recoveryKey: recoveryKeyFormatted,
      };
    } finally {
      oldDek.fill(0);
      newDek?.fill(0);
    }
  }

  async reEncryptAllUserData(
    userId: string,
    oldDek: Buffer,
    newDek: Buffer,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string> {
    const [monthlyBudgets, templateIds] = await Promise.all([
      this.#fetchMonthlyBudgets(userId, supabase),
      this.#fetchUserTemplateIds(userId, supabase),
    ]);

    const budgetIds = monthlyBudgets.map((b) => b.id);

    const [budgetLines, transactions, templateLines, savingsGoals] =
      await Promise.all([
        this.#fetchBudgetLines(budgetIds, supabase),
        this.#fetchTransactions(budgetIds, supabase),
        this.#fetchTemplateLines(templateIds, supabase),
        this.#fetchSavingsGoals(userId, supabase),
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
      throw new BusinessException(
        ERROR_DEFINITIONS.ENCRYPTION_REKEY_FAILED,
        undefined,
        { userId, operation: 'rekey.rpc_failure' },
        { cause: error },
      );
    }

    this.logger.info(
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

    return keyCheck;
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
    for (const [key, entry] of this.#dekCache) {
      if (key.startsWith(`${userId}:`)) {
        if (Buffer.isBuffer(entry.dek)) {
          entry.dek.fill(0);
        }
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
