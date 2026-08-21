import { afterEach, describe, expect, it } from 'bun:test';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BACKEND_ROOT = join(__dirname, '../..');
const EXPECTED_VERSION = (
  JSON.parse(readFileSync(join(BACKEND_ROOT, 'package.json'), 'utf8')) as {
    version: string;
  }
).version;
const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('PRODUCT_VERSION Bun artifact', () => {
  it('runs after the bundle is relocated away from its source checkout', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'pulpe-product-version-'));
    tempDirectories.push(workspace);
    const entry = join(workspace, 'entry.ts');
    const bundle = join(workspace, 'build', 'version.js');
    const relocated = join(workspace, 'relocated', 'version.js');

    writeFileSync(
      entry,
      `import { PRODUCT_VERSION } from ${JSON.stringify(join(BACKEND_ROOT, 'src/config/product-version.ts'))};\nconsole.log(PRODUCT_VERSION);\n`,
    );

    const build = Bun.spawnSync([
      process.execPath,
      'build',
      entry,
      '--outfile',
      bundle,
      '--target=node',
    ]);
    expect(build.exitCode).toBe(0);

    mkdirSync(join(workspace, 'relocated'));
    cpSync(bundle, relocated);
    const execution = Bun.spawnSync(['node', relocated]);

    expect(execution.exitCode).toBe(0);
    expect(execution.stdout.toString().trim()).toBe(EXPECTED_VERSION);
    expect(readFileSync(bundle, 'utf8')).not.toContain(BACKEND_ROOT);
  });
});
