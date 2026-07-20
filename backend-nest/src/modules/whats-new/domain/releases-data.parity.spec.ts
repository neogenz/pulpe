import { describe, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  RELEASES,
  SILENT_IOS_RELEASES,
  type WhatsNewReleaseEntry,
} from './releases-data';

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

type IosMarketingRelease = LandingRelease & { iosVersion: string };

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

const landingReleases = JSON.parse(
  readFileSync(
    // @ts-expect-error Bun supports import.meta.dir; production TS targets CommonJS.
    resolve(import.meta.dir, '../../../../../landing/data/releases.json'),
    'utf8',
  ),
) as LandingRelease[];

function hasIosMarketingVersion(
  release: LandingRelease,
): release is IosMarketingRelease {
  return release.iosVersion !== undefined;
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
  landing: IosMarketingRelease,
): void {
  if (projection.iosVersion !== landing.iosVersion) {
    fail(
      landing.version,
      `iosVersion mismatch: projection="${projection.iosVersion}", landing="${landing.iosVersion}"`,
    );
  }

  if (projection.date !== landing.date) {
    fail(
      landing.version,
      `date mismatch: projection="${projection.date}", landing="${landing.date}"`,
    );
  }

  const projectionPlatforms = [...projection.platforms].sort();
  const landingPlatforms = [...landing.platforms].sort();
  if (!isDeepStrictEqual(projectionPlatforms, landingPlatforms)) {
    fail(
      landing.version,
      `platforms mismatch: projection=${JSON.stringify(projectionPlatforms)}, landing=${JSON.stringify(landingPlatforms)}`,
    );
  }

  if (projection.changes.technical.length !== 0) {
    fail(
      landing.version,
      `technical notes mismatch: projection contains ${projection.changes.technical.length}; expected 0`,
    );
  }
}

function assertCuratedSubset(
  projection: WhatsNewReleaseEntry,
  landing: IosMarketingRelease,
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
  const iosMarketingReleases = landingReleases.filter(hasIosMarketingVersion);

  it('records exactly one projection or explicit silence per iOS marketing release', () => {
    for (const landingRelease of iosMarketingReleases) {
      if (!landingRelease.platforms.includes('ios')) {
        fail(landingRelease.version, 'iosVersion requires the ios platform');
      }

      const backendMatches = RELEASES.filter(
        (release) => release.version === landingRelease.version,
      );
      const silentMatches = SILENT_IOS_RELEASES.filter(
        (release) => release.version === landingRelease.version,
      );
      const modeCount = backendMatches.length + silentMatches.length;

      if (modeCount !== 1) {
        fail(
          landingRelease.version,
          `expected exactly one projection or silent entry, found ${backendMatches.length} projection(s) and ${silentMatches.length} silence(s)`,
        );
      }

      const projection = backendMatches[0];
      if (!projection) {
        continue;
      }

      assertMetadataParity(projection, landingRelease);
      assertCuratedSubset(projection, landingRelease);
    }
  });

  it('keeps every explicit silence unique, valid, motivated, and mapped', () => {
    const seenVersions = new Set<string>();

    for (const silentRelease of SILENT_IOS_RELEASES) {
      if (!SEMVER_PATTERN.test(silentRelease.version)) {
        fail(silentRelease.version, 'silent release version is not SemVer');
      }
      if (silentRelease.reason.trim().length === 0) {
        fail(silentRelease.version, 'silent release reason is empty');
      }
      if (seenVersions.has(silentRelease.version)) {
        fail(silentRelease.version, 'duplicate silent release');
      }
      seenVersions.add(silentRelease.version);

      if (
        RELEASES.some((release) => release.version === silentRelease.version)
      ) {
        fail(silentRelease.version, 'release is both projected and silent');
      }

      const landingMatches = iosMarketingReleases.filter(
        (release) => release.version === silentRelease.version,
      );
      if (landingMatches.length !== 1) {
        fail(
          silentRelease.version,
          `expected one iOS marketing landing entry for silence, found ${landingMatches.length}`,
        );
      }
    }
  });

  it('contains no backend entry orphaned from an iOS marketing release', () => {
    for (const backendRelease of RELEASES) {
      const landingMatches = iosMarketingReleases.filter(
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
