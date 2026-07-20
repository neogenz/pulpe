import { describe, expect, it } from 'vitest';

// eslint-disable-next-line boundaries/no-unknown -- package metadata, not an app layer import
import frontendPackage from '../../../../../../package.json';
import { LATEST_RELEASE, SKIPPED_RELEASES } from './whats-new-releases';

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

describe('webapp release data', () => {
  it('announces or explicitly skips the current package version', () => {
    const matchingSkips = SKIPPED_RELEASES.filter(
      ({ version }) => version === frontendPackage.version,
    );
    const states = [
      LATEST_RELEASE.version === frontendPackage.version,
      matchingSkips.length === 1,
    ].filter(Boolean);

    expect(
      states,
      `${frontendPackage.version} must have exactly one toast or silent-release entry`,
    ).toHaveLength(1);

    if (matchingSkips.length === 1) {
      expect(matchingSkips[0].reason.trim()).not.toHaveLength(0);
    }
  });

  it('keeps silent releases unique, valid and motivated', () => {
    const versions = SKIPPED_RELEASES.map(({ version }) => version);

    expect(new Set(versions).size).toBe(versions.length);
    for (const release of SKIPPED_RELEASES) {
      expect(release.version).toMatch(SEMVER_PATTERN);
      expect(release.reason.trim()).not.toHaveLength(0);
    }
  });

  it('never marks the displayed release as silent', () => {
    expect(
      SKIPPED_RELEASES.some(
        ({ version }) => version === LATEST_RELEASE.version,
      ),
    ).toBe(false);
  });
});
