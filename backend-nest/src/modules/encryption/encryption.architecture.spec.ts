import { afterEach, describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * CR-03 meta-test.
 *
 * The dep-cruiser rule `no-encryption-internal-leak` is the static defense
 * preventing any non-encryption module from importing
 * `encryption/application/*` or `encryption/infrastructure/*`.
 *
 * This test creates a temporary fixture that violates the rule and runs
 * dep-cruiser against it. If the rule has silently regressed (e.g. someone
 * weakens the regex or removes the rule), this test fails before the rule
 * itself is needed in real CI.
 *
 * Why a meta-test: a previous cross-module rule used a `\\1` backreference
 * that compiled but never fired. Lint rules can break silently. This test
 * proves the current rule actually catches violations.
 */
const BACKEND_ROOT = resolve(__dirname, '../../..');
const FIXTURE_PATH = resolve(
  BACKEND_ROOT,
  'src/modules/budget/infrastructure/persistence/_cr03_arch_test_fixture.ts',
);

const FIXTURE_CONTENT = `import { AesGcmCryptoService } from '@modules/encryption/infrastructure/crypto/aes-gcm.crypto-service';
export type CR03Fixture = AesGcmCryptoService;
`;

function cleanup() {
  if (existsSync(FIXTURE_PATH)) {
    rmSync(FIXTURE_PATH, { force: true });
  }
}

describe('dep-cruiser: encryption isolation rule (CR-03 guard)', () => {
  afterEach(cleanup);

  it('blocks direct import of AesGcmCryptoService from a non-encryption module', () => {
    cleanup();
    writeFileSync(FIXTURE_PATH, FIXTURE_CONTENT, 'utf-8');

    const result = spawnSync(
      'bunx',
      ['depcruise', '-c', '.dependency-cruiser.cjs', 'src/'],
      {
        cwd: BACKEND_ROOT,
        encoding: 'utf-8',
      },
    );

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

    expect(output).toContain('no-encryption-internal-leak');
    expect(output).toContain('_cr03_arch_test_fixture.ts');
    expect(result.status).not.toBe(0);
  });
});
