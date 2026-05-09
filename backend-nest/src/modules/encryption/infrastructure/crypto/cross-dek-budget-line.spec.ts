/**
 * Regression test for the cross-DEK bug:
 *
 * create_budget_from_template copies template_line.amount (ciphertext) verbatim
 * into budget_line.amount. When the template was owned by a different user (or is
 * a public template with user_id IS NULL), the ciphertext was encrypted under
 * UserA's DEK. When UserB reads the budget line, decryption fails silently and
 * tryDecryptAmount returns the fallback value (0).
 *
 * This test proves the silent-zero behaviour WITHOUT a live Supabase instance by
 * directly exercising AesGcmCryptoService — the same code path the repository
 * calls through decryptRowAmountFields → tryDecryptAmount.
 */
import { describe, expect, it, mock } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { AesGcmCryptoService } from '@modules/encryption/infrastructure/crypto/aes-gcm.crypto-service';

const MASTER_KEY = randomBytes(32).toString('hex');
const USER_A_CLIENT_KEY = randomBytes(32);
const USER_B_CLIENT_KEY = randomBytes(32);
const USER_A_ID = 'user-a-00000000-0000-0000-0000-000000000000';
const USER_B_ID = 'user-b-00000000-0000-0000-0000-000000000000';
const PLAINTEXT_AMOUNT = 100;

const createMockLogger = () => ({
  info: mock(() => {}),
  warn: mock(() => {}),
  debug: mock(() => {}),
  trace: mock(() => {}),
});

function makeSaltRepo(userId: string, salt: Buffer) {
  const saltHex = salt.toString('hex');
  return {
    findSaltByUserId: mock((id: string) =>
      Promise.resolve(
        id === userId ? { salt: saltHex, key_check: null } : null,
      ),
    ),
    findByUserId: mock(() => Promise.resolve(null)),
    upsertSalt: mock(() => Promise.resolve()),
    updateWrappedDEK: mock(() => Promise.resolve()),
    updateWrappedDEKIfNull: mock(() => Promise.resolve(true)),
    hasRecoveryKey: mock(() => Promise.resolve(false)),
    updateKeyCheckIfNull: mock(() => Promise.resolve()),
    getVaultStatus: mock(() =>
      Promise.resolve({
        pinCodeConfigured: false,
        recoveryKeyConfigured: false,
        vaultCodeConfigured: false,
      }),
    ),
  };
}

function makeConfigService() {
  return {
    get: (key: string) =>
      key === 'ENCRYPTION_MASTER_KEY' ? MASTER_KEY : undefined,
  };
}

describe('cross-DEK budget_line bug — create_budget_from_template', () => {
  it('should silently return 0 when budget_line.amount was encrypted with a different user DEK', async () => {
    // Arrange — UserA has a unique salt → unique DEK
    const userASalt = randomBytes(16);
    const userBSalt = randomBytes(16);

    const serviceA = new AesGcmCryptoService(
      createMockLogger() as any,
      makeConfigService() as any,
      makeSaltRepo(USER_A_ID, userASalt) as any,
    );
    const serviceB = new AesGcmCryptoService(
      createMockLogger() as any,
      makeConfigService() as any,
      makeSaltRepo(USER_B_ID, userBSalt) as any,
    );

    // UserA encrypts a template_line.amount = 100
    const dekA = await serviceA.ensureUserDEK(USER_A_ID, USER_A_CLIENT_KEY);
    const ciphertextFromTemplateA = serviceA.encryptAmount(
      PLAINTEXT_AMOUNT,
      dekA,
    );

    // The RPC copies ciphertextFromTemplateA verbatim into budget_line.amount for UserB.
    // UserB then reads back via decryptRowAmountFields (calls tryDecryptAmount with fallback 0).
    const dekB = await serviceB.ensureUserDEK(USER_B_ID, USER_B_CLIENT_KEY);
    const decryptedByB = serviceB.tryDecryptAmount(
      ciphertextFromTemplateA,
      dekB,
      0,
    );

    // BUG CONFIRMED: amount silently becomes 0 instead of 100
    expect(decryptedByB).toBe(0);
  });

  it('should successfully decrypt when ciphertext was encrypted by the same user DEK (sanity check)', async () => {
    // Arrange — same user, same DEK → normal path must work
    const userASalt = randomBytes(16);

    const service = new AesGcmCryptoService(
      createMockLogger() as any,
      makeConfigService() as any,
      makeSaltRepo(USER_A_ID, userASalt) as any,
    );

    const dek = await service.ensureUserDEK(USER_A_ID, USER_A_CLIENT_KEY);
    const ciphertext = service.encryptAmount(PLAINTEXT_AMOUNT, dek);
    const decrypted = service.tryDecryptAmount(ciphertext, dek, 0);

    expect(decrypted).toBe(PLAINTEXT_AMOUNT);
  });
});
