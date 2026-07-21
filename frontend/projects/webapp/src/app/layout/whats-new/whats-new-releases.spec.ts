import { describe, expect, it } from 'vitest';

// eslint-disable-next-line boundaries/no-unknown -- root product metadata, not an app layer import
import productPackage from '../../../../../../../package.json';
// @ts-expect-error Vitest resolves raw assets; the spec tsconfig has no wildcard declaration
// eslint-disable-next-line boundaries/no-unknown -- private changelog source of truth, test-only import
import frontendChangelog from '../../../../../../CHANGELOG.md?raw';
import { LATEST_RELEASE, SKIPPED_RELEASES } from './whats-new-releases';

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
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
