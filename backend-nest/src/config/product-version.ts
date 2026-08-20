import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEMVER_PATTERN } from '@common/utils/semver-compare';

const backendPackage = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf8'),
) as { version: string };
const productVersion = backendPackage.version;

if (!SEMVER_PATTERN.test(productVersion)) {
  throw new Error(`Invalid backend package version: ${productVersion}`);
}

/** Version embedded in and served by this exact backend artifact. */
export const PRODUCT_VERSION = productVersion;
