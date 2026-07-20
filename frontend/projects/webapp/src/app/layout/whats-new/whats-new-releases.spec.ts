import { describe, expect, it } from 'vitest';

// eslint-disable-next-line boundaries/no-unknown -- public changelog source of truth, not an app layer import
import landingReleases from '../../../../../../../landing/data/releases.json';
// eslint-disable-next-line boundaries/no-unknown -- root product metadata, not an app layer import
import productPackage from '../../../../../../../package.json';
import { LATEST_RELEASE, SKIPPED_RELEASES } from './whats-new-releases';

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

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
        landingReleases.filter(
          (landingRelease) => landingRelease.version === release.version,
        ),
        `Silent web release ${release.version} must map to exactly one landing changelog entry`,
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
