import { describe, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { RELEASES, type WhatsNewReleaseEntry } from './releases-data';

type ChangeItem = { title: string; description: string };
type LandingRelease = {
  version: string;
  iosVersion?: string;
  date: string;
  platforms: ('ios' | 'web')[];
  changes: {
    features: ChangeItem[];
    fixes: ChangeItem[];
    technical: ChangeItem[];
  };
};

const landingReleases = JSON.parse(
  readFileSync(
    // @ts-expect-error Bun supports import.meta.dir; production TS targets CommonJS.
    resolve(import.meta.dir, '../../../../../landing/data/releases.json'),
    'utf8',
  ),
) as LandingRelease[];

function isIosUserFacing(release: LandingRelease): boolean {
  return (
    release.platforms.includes('ios') &&
    (release.changes.features.length > 0 || release.changes.fixes.length > 0)
  );
}

function fail(version: string, detail: string): never {
  throw new Error(
    `Release ${version} is out of sync between landing and the iOS feed: ${detail}. Run /update-changelog Step 5b-bis.`,
  );
}

function toProjection(release: LandingRelease): WhatsNewReleaseEntry {
  if (release.iosVersion === undefined) {
    return fail(release.version, 'missing iosVersion for projected release');
  }

  return {
    version: release.version,
    iosVersion: release.iosVersion,
    date: release.date,
    platforms: release.platforms,
    changes: {
      features: release.changes.features,
      fixes: release.changes.fixes,
      technical: [],
    },
  };
}

describe('embedded iOS release data parity', () => {
  const projectedLandingReleases = landingReleases.filter(
    (release) => isIosUserFacing(release) && release.iosVersion !== undefined,
  );

  it('matches every projected, user-facing iOS landing release', () => {
    for (const landingRelease of projectedLandingReleases) {
      const backendMatches = RELEASES.filter(
        (release) => release.version === landingRelease.version,
      );

      if (backendMatches.length !== 1) {
        fail(
          landingRelease.version,
          `expected one backend entry, found ${backendMatches.length}`,
        );
      }

      if (!isDeepStrictEqual(backendMatches[0], toProjection(landingRelease))) {
        fail(landingRelease.version, 'projected content differs');
      }
    }
  });

  it('contains no backend entry orphaned from the landing projection', () => {
    for (const backendRelease of RELEASES) {
      const landingMatches = projectedLandingReleases.filter(
        (release) => release.version === backendRelease.version,
      );

      if (landingMatches.length !== 1) {
        fail(
          backendRelease.version,
          `expected one projected landing entry, found ${landingMatches.length}`,
        );
      }
    }
  });
});
