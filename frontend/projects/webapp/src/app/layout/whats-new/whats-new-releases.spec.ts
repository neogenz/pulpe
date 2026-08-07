import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// eslint-disable-next-line boundaries/no-unknown -- root product metadata, not an app layer import
import productPackage from '../../../../../../../package.json';
import { LATEST_RELEASE, SKIPPED_RELEASES } from './whats-new-releases';

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
// Read rather than imported: the spec is bundled by esbuild, which has no
// loader for `.md`. `process.cwd()` is the frontend project root under `ng test`.
const frontendChangelog = readFileSync(
  resolve(process.cwd(), 'CHANGELOG.md'),
  'utf8',
);
const changelogLines: readonly string[] = frontendChangelog.split(/\r?\n/);

describe('webapp release data', () => {
  it('announces or explicitly skips the current product version', () => {
    const matchingSkips = SKIPPED_RELEASES.filter(
      ({ version }) => version === productPackage.version,
    );
    const states = [
      LATEST_RELEASE.version === productPackage.version,
      matchingSkips.length === 1,
    ].filter(Boolean);

    expect(
      states,
      `Product version ${productPackage.version} must have exactly one toast or silent-release entry`,
    ).toHaveLength(1);

    if (matchingSkips.length === 1) {
      expect(matchingSkips[0].reason.trim()).not.toHaveLength(0);
    }
  });

  it('keeps silent releases unique, valid, motivated and mapped', () => {
    const versions = SKIPPED_RELEASES.map(({ version }) => version);

    expect(new Set(versions).size).toBe(versions.length);
    for (const release of SKIPPED_RELEASES) {
      expect(release.version).toMatch(SEMVER_PATTERN);
      expect(release.reason.trim()).not.toHaveLength(0);
      expect(
        changelogLines.filter((line) => line === `## ${release.version}`),
        `Silent web release ${release.version} must map to exactly one frontend changelog heading`,
      ).toHaveLength(1);
    }
  });

  it('keeps the displayed release version valid', () => {
    expect(LATEST_RELEASE.version).toMatch(SEMVER_PATTERN);
  });

  it('never marks the displayed release as silent', () => {
    expect(
      SKIPPED_RELEASES.some(
        ({ version }) => version === LATEST_RELEASE.version,
      ),
    ).toBe(false);
  });
});
