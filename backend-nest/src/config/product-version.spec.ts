import { describe, expect, it } from 'bun:test';
import { parseProductVersion } from './product-version';

describe('parseProductVersion', () => {
  it.each([
    undefined,
    42,
    'latest',
    '1.2',
    '01.2.3',
    '1.2.3-.',
    '1.2.3-alpha..1',
  ])('rejects invalid version %p', (version) => {
    expect(() => parseProductVersion(version)).toThrow(
      `Invalid backend package version: ${String(version)}`,
    );
  });
});
