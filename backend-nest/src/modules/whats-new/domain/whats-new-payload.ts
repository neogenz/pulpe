import type {
  SupportedLocale,
  WhatsNewQuery,
  WhatsNewResponse,
} from 'pulpe-shared';
import {
  RELEASES,
  type WhatsNewReleaseEntry,
  type WhatsNewTranslatedLocale,
} from './releases-data';

const semverPattern = /^\d+\.\d+\.\d+$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Compares two 3-part `X.Y.Z` versions numerically, left-to-right.
 * Returns a negative number when `a < b`, zero when equal, positive when
 * `a > b`. Numeric (not lexicographic) so `0.9.0 < 0.10.0` holds.
 */
export function compareSemver(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

export function isIosUserFacing(entry: WhatsNewReleaseEntry): boolean {
  return (
    entry.platforms.includes('ios') &&
    (entry.changes.features.length > 0 || entry.changes.fixes.length > 0)
  );
}

function hasValidReleaseMetadata(entry: WhatsNewReleaseEntry): boolean {
  if (
    !semverPattern.test(entry.iosVersion) ||
    !isoDatePattern.test(entry.date)
  ) {
    return false;
  }

  const year = Number(entry.date.slice(0, 4));
  const month = Number(entry.date.slice(5, 7));
  const day = Number(entry.date.slice(8, 10));
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

function titleForLocale(locale: SupportedLocale, version: string): string {
  switch (locale) {
    case 'fr':
      return `Nouveautés de la version ${version}`;
    case 'en':
      return `What’s new in version ${version}`;
    case 'de':
      return `Neu in Version ${version}`;
    case 'it':
      return `Novità della versione ${version}`;
  }
}

function resolvedLocale(
  entries: readonly WhatsNewReleaseEntry[],
  requested: unknown,
): SupportedLocale {
  switch (requested) {
    case 'en':
    case 'de':
    case 'it':
      return entries.every(
        (entry) => entry.translations?.[requested] !== undefined,
      )
        ? requested
        : 'fr';
    default:
      return 'fr';
  }
}

function toBody(
  entries: WhatsNewReleaseEntry[],
  locale: SupportedLocale,
): string {
  return entries
    .flatMap((entry) => {
      const changes =
        locale === 'fr'
          ? entry.changes
          : entry.translations?.[locale as WhatsNewTranslatedLocale];
      return changes ? [...changes.features, ...changes.fixes] : [];
    })
    .map((item) => `- **${item.title}** — ${item.description}`)
    .join('\n');
}

export function buildWhatsNewResponse(
  query: WhatsNewQuery,
  releases: readonly WhatsNewReleaseEntry[] = RELEASES,
): WhatsNewResponse {
  const releasesByIosVersion = new Map<string, WhatsNewReleaseEntry[]>();
  for (const entry of releases) {
    if (
      !hasValidReleaseMetadata(entry) ||
      !isIosUserFacing(entry) ||
      compareSemver(entry.iosVersion, query.lastSeenVersion) <= 0 ||
      compareSemver(entry.iosVersion, query.currentVersion) > 0
    ) {
      continue;
    }
    const versionReleases = releasesByIosVersion.get(entry.iosVersion) ?? [];
    versionReleases.push(entry);
    releasesByIosVersion.set(entry.iosVersion, versionReleases);
  }

  const entries = [...releasesByIosVersion.entries()]
    .sort(([a], [b]) => compareSemver(a, b))
    .flatMap(([iosVersion, releases]) => {
      const publishedAt = releases
        .map((release) => release.date)
        .sort()
        .at(-1);
      if (publishedAt === undefined) {
        return [];
      }
      const locale = resolvedLocale(releases, query.locale ?? 'fr');
      return [
        {
          version: iosVersion,
          title: titleForLocale(locale, iosVersion),
          body: toBody(releases, locale),
          publishedAt,
        },
      ];
    });

  return { success: true, data: { entries } };
}
