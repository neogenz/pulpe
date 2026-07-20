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

type ProjectedLandingRelease = LandingRelease & { iosVersion: string };

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

function isProjectedIosRelease(
  release: LandingRelease,
): release is ProjectedLandingRelease {
  return release.iosVersion !== undefined && isIosUserFacing(release);
}

function fail(version: string, detail: string): never {
  throw new Error(
    `Release ${version} is out of sync between landing and the iOS feed: ${detail}. Run /release Step 5b-bis.`,
  );
}

const itemKey = (item: ChangeItem): string =>
  `${item.title}\u0000${item.description}`;

function assertMetadataParity(
  projection: WhatsNewReleaseEntry,
  landing: ProjectedLandingRelease,
): void {
  const matches =
    projection.iosVersion === landing.iosVersion &&
    projection.date === landing.date &&
    isDeepStrictEqual(
      [...projection.platforms].sort(),
      [...landing.platforms].sort(),
    ) &&
    projection.changes.technical.length === 0;

  if (!matches) {
    fail(landing.version, 'projection metadata differs');
  }
}

function assertCuratedSubset(
  projection: WhatsNewReleaseEntry,
  landing: ProjectedLandingRelease,
): void {
  const approved = new Set(
    [...landing.changes.features, ...landing.changes.fixes].map(itemKey),
  );
  const items = [...projection.changes.features, ...projection.changes.fixes];

  if (items.length === 0) {
    fail(landing.version, 'empty projection: omit the entry instead');
  }

  const drifted = items.find((item) => !approved.has(itemKey(item)));
  if (drifted) {
    fail(
      landing.version,
      `note "${drifted.title}" is absent from landing copy`,
    );
  }
}

describe('embedded iOS release data parity', () => {
  const projectedLandingReleases = landingReleases.filter(
    isProjectedIosRelease,
  );

  it('projects a curated subset of every user-facing iOS landing release', () => {
    for (const landingRelease of projectedLandingReleases) {
      const backendMatches = RELEASES.filter(
        (release) => release.version === landingRelease.version,
      );

      if (backendMatches.length > 1) {
        fail(
          landingRelease.version,
          `expected at most one backend entry, found ${backendMatches.length}`,
        );
      }

      const projection = backendMatches[0];
      // Silent mode: marketing bump with no iOS-worthy note (references/ios-release.md).
      if (!projection) {
        continue;
      }

      assertMetadataParity(projection, landingRelease);
      assertCuratedSubset(projection, landingRelease);
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
