import backendPackage from '../../package.json';

const PRODUCT_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseProductVersion(version: unknown): string {
  if (typeof version !== 'string' || !PRODUCT_VERSION_PATTERN.test(version)) {
    throw new Error(`Invalid backend package version: ${String(version)}`);
  }

  return version;
}

/** Version embedded in and served by this exact backend artifact. */
export const PRODUCT_VERSION = parseProductVersion(backendPackage.version);
