import { describe, expect, it } from 'bun:test';
import { EncryptionModule } from './encryption.module';
import { ENCRYPTION_PORT } from './domain/ports/encryption.port';
import { AesGcmCryptoService } from './infrastructure/crypto/aes-gcm.crypto-service';

/**
 * CR-03 regression guard.
 *
 * EncryptionModule MUST expose only ENCRYPTION_PORT to other modules.
 * Exporting the concrete AesGcmCryptoService class would let any module
 * @Inject(AesGcmCryptoService) and reach wrap/unwrap/recovery primitives
 * that the port intentionally hides (ADR-0008).
 *
 * If this test fails because someone re-added AesGcmCryptoService to the
 * exports array, DO NOT update the assertion. Remove the export instead.
 */
describe('EncryptionModule public surface (CR-03 guard)', () => {
  const exports = Reflect.getMetadata('exports', EncryptionModule) as unknown[];

  it('exports the ENCRYPTION_PORT token', () => {
    expect(exports).toContain(ENCRYPTION_PORT);
  });

  it('does NOT export the concrete AesGcmCryptoService class', () => {
    expect(exports).not.toContain(AesGcmCryptoService);
  });

  it('exports nothing besides ENCRYPTION_PORT (lock the public surface)', () => {
    expect(exports).toEqual([ENCRYPTION_PORT]);
  });
});
