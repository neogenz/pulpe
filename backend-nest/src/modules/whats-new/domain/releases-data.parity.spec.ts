import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  RELEASES,
  SILENT_IOS_RELEASES,
  type WhatsNewReleaseEntry,
  type WhatsNewTranslatedLocale,
} from './releases-data';

type ChangeItem = { title: string; description: string };
type LandingPlatform = 'android' | 'ios' | 'web';
type LocalizedChanges = {
  features: ChangeItem[];
  fixes: ChangeItem[];
};
type LandingRelease = {
  version: string;
  iosVersion?: string;
  date: string;
  platforms: LandingPlatform[];
  changes: {
    features: ChangeItem[];
    fixes: ChangeItem[];
    technical: ChangeItem[];
  };
  translations?: Record<WhatsNewTranslatedLocale, LocalizedChanges>;
};

type IosMarketingRelease = LandingRelease & { iosVersion: string };

const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

function invalidLandingData(path: string, expected: string): never {
  throw new Error(
    `Invalid landing/data/releases.json at ${path}: expected ${expected}`,
  );
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalidLandingData(path, 'an object');
  }
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    invalidLandingData(path, 'an array');
  }
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    invalidLandingData(path, 'a string');
  }
  return value;
}

function parseChangeItems(value: unknown, path: string): ChangeItem[] {
  return expectArray(value, path).map((rawItem, index) => {
    const itemPath = `${path}[${index}]`;
    const item = expectRecord(rawItem, itemPath);
    return {
      title: expectString(item['title'], `${itemPath}.title`),
      description: expectString(item['description'], `${itemPath}.description`),
    };
  });
}

function parseTranslations(
  value: unknown,
  path: string,
): Record<WhatsNewTranslatedLocale, LocalizedChanges> | undefined {
  if (value === undefined) return undefined;

  const translations = expectRecord(value, path);
  const locales: WhatsNewTranslatedLocale[] = ['en', 'de', 'it'];
  const keys = Object.keys(translations).sort();
  if (!isDeepStrictEqual(keys, [...locales].sort())) {
    invalidLandingData(path, 'exactly the en, de, and it translations');
  }

  return Object.fromEntries(
    locales.map((locale) => {
      const translation = expectRecord(
        translations[locale],
        `${path}.${locale}`,
      );
      const changes = expectRecord(
        translation['changes'],
        `${path}.${locale}.changes`,
      );
      return [
        locale,
        {
          features: parseChangeItems(
            changes['features'],
            `${path}.${locale}.changes.features`,
          ),
          fixes: parseChangeItems(
            changes['fixes'],
            `${path}.${locale}.changes.fixes`,
          ),
        },
      ];
    }),
  ) as Record<WhatsNewTranslatedLocale, LocalizedChanges>;
}

function parseLandingRelease(value: unknown, index: number): LandingRelease {
  const path = `$[${index}]`;
  const release = expectRecord(value, path);
  const rawIosVersion = release['iosVersion'];
  const translations = parseTranslations(
    release['translations'],
    `${path}.translations`,
  );
  const rawChanges = expectRecord(release['changes'], `${path}.changes`);
  const platforms = expectArray(release['platforms'], `${path}.platforms`).map(
    (platform, platformIndex) => {
      if (platform !== 'android' && platform !== 'ios' && platform !== 'web') {
        invalidLandingData(
          `${path}.platforms[${platformIndex}]`,
          '"android", "ios", or "web"',
        );
      }
      return platform;
    },
  );

  return {
    version: expectString(release['version'], `${path}.version`),
    ...(rawIosVersion === undefined
      ? {}
      : {
          iosVersion: expectString(rawIosVersion, `${path}.iosVersion`),
        }),
    date: expectString(release['date'], `${path}.date`),
    platforms,
    changes: {
      features: parseChangeItems(
        rawChanges['features'],
        `${path}.changes.features`,
      ),
      fixes: parseChangeItems(rawChanges['fixes'], `${path}.changes.fixes`),
      technical: parseChangeItems(
        rawChanges['technical'],
        `${path}.changes.technical`,
      ),
    },
    ...(translations === undefined ? {} : { translations }),
  };
}

function parseLandingReleases(value: unknown): LandingRelease[] {
  return expectArray(value, '$').map(parseLandingRelease);
}

const rawLandingReleases: unknown = JSON.parse(
  readFileSync(
    // @ts-expect-error Bun supports import.meta.dir; production TS targets CommonJS.
    resolve(import.meta.dir, '../../../../../landing/data/releases.json'),
    'utf8',
  ),
);
const landingReleases = parseLandingReleases(rawLandingReleases);

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
  landing: LandingRelease,
): void {
  if (projection.iosVersion !== landing.iosVersion) {
    fail(
      landing.version,
      `iosVersion mismatch: projection="${projection.iosVersion ?? '(none)'}", landing="${landing.iosVersion ?? '(none)'}"`,
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
  landing: LandingRelease,
): void {
  const items = [...projection.changes.features, ...projection.changes.fixes];

  if (items.length === 0) {
    fail(landing.version, 'empty projection: omit the entry instead');
  }

  const seenItemKeys = new Set<string>();
  const duplicate = items.find((item) => {
    const key = itemKey(item);
    if (seenItemKeys.has(key)) {
      return true;
    }
    seenItemKeys.add(key);
    return false;
  });
  if (duplicate) {
    fail(
      landing.version,
      `duplicate projected note: title="${duplicate.title}", description="${duplicate.description}"`,
    );
  }

  assertCategorySubset(
    landing.version,
    'features',
    projection.changes.features,
    landing.changes.features,
  );
  assertCategorySubset(
    landing.version,
    'fixes',
    projection.changes.fixes,
    landing.changes.fixes,
  );

  assertTranslationSubset(projection, landing);
}

function assertTranslationSubset(
  projection: WhatsNewReleaseEntry,
  landing: LandingRelease,
): void {
  const locales: WhatsNewTranslatedLocale[] = ['en', 'de', 'it'];
  const hasTranslations =
    projection.translations !== undefined || landing.translations !== undefined;
  if (!hasTranslations) return;

  for (const locale of locales) {
    const projected = projection.translations?.[locale];
    const approved = landing.translations?.[locale];
    if (!projected || !approved) {
      fail(
        landing.version,
        `missing ${locale} translation in landing or iOS projection`,
      );
    }
    assertCategorySubset(
      landing.version,
      `${locale}.features`,
      projected.features,
      approved.features,
    );
    assertCategorySubset(
      landing.version,
      `${locale}.fixes`,
      projected.fixes,
      approved.fixes,
    );
  }
}

function assertCategorySubset(
  version: string,
  category: string,
  projectedItems: readonly ChangeItem[],
  landingItems: readonly ChangeItem[],
): void {
  const approved = new Set(landingItems.map(itemKey));
  const drifted = projectedItems.find((item) => !approved.has(itemKey(item)));
  if (!drifted) {
    return;
  }

  fail(
    version,
    `projected ${category} note is absent from landing ${category}: title="${drifted.title}", description="${drifted.description}"`,
  );
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

  // Anchored against every landing release, not only the App Store ones: a
  // release that ships on Android alone has no iOS marketing version and is a
  // complete entry all the same.
  it('keeps every projection anchored to a landing release and in sync with it', () => {
    for (const backendRelease of RELEASES) {
      const landingMatches = landingReleases.filter(
        (release) => release.version === backendRelease.version,
      );

      if (landingMatches.length !== 1) {
        fail(
          backendRelease.version,
          `expected one projected landing entry, found ${landingMatches.length}`,
        );
      }

      const landingRelease = landingMatches[0];
      if (!landingRelease) {
        continue;
      }

      if (
        backendRelease.platforms.includes('ios') &&
        backendRelease.iosVersion === undefined
      ) {
        fail(backendRelease.version, 'the ios platform requires an iosVersion');
      }

      assertMetadataParity(backendRelease, landingRelease);
      assertCuratedSubset(backendRelease, landingRelease);
    }
  });

  // The contract this whole file exists to state: until it held, no release
  // could reach Android without borrowing an App Store version it never had.
  it('accepts a release that ships on Android alone', () => {
    const note = {
      title: 'Pulpe sur Android',
      description: 'Le budget dans ta poche',
    };
    const landing: LandingRelease = {
      version: '9.9.9',
      date: '2026-09-01',
      platforms: ['android'],
      changes: { features: [note], fixes: [], technical: [] },
    };
    const projection: WhatsNewReleaseEntry = {
      version: '9.9.9',
      date: '2026-09-01',
      platforms: ['android'],
      changes: { features: [note], fixes: [], technical: [] },
    };

    expect(() => {
      assertMetadataParity(projection, landing);
      assertCuratedSubset(projection, landing);
    }).not.toThrow();
  });

  it('refuses a projection whose iOS marketing version drifted from landing', () => {
    const note = { title: 'Une correction', description: 'Elle est corrigée' };
    const landing: LandingRelease = {
      version: '9.9.9',
      iosVersion: '2.0.0',
      date: '2026-09-01',
      platforms: ['ios'],
      changes: { features: [], fixes: [note], technical: [] },
    };

    expect(() =>
      assertMetadataParity(
        {
          version: '9.9.9',
          iosVersion: '2.0.1',
          date: '2026-09-01',
          platforms: ['ios'],
          changes: { features: [], fixes: [note], technical: [] },
        },
        landing,
      ),
    ).toThrow(/iosVersion mismatch/);
  });
});
