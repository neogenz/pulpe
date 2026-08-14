import type { WhatsNewQuery, WhatsNewResponse } from 'pulpe-shared';
import { RELEASES, type WhatsNewReleaseEntry } from './releases-data';

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

export type WhatsNewPlatform = 'android' | 'ios';

/**
 * The version a client of this platform reports. iOS ships under its own App
 * Store marketing version, which drifts from the repo version; Android ships
 * the repo version verbatim (`android/app.json` tracks `package.json`).
 *
 * Undefined for a release that never reached the App Store, which is how an
 * Android-only entry stays invisible to iOS without a second flag saying so.
 */
function clientVersionOf(
  entry: WhatsNewReleaseEntry,
  platform: WhatsNewPlatform,
): string | undefined {
  return platform === 'ios' ? entry.iosVersion : entry.version;
}

export function isUserFacing(
  entry: WhatsNewReleaseEntry,
  platform: WhatsNewPlatform,
): boolean {
  return (
    entry.platforms.includes(platform) &&
    (entry.changes.features.length > 0 || entry.changes.fixes.length > 0)
  );
}

function hasValidReleaseMetadata(clientVersion: string, date: string): boolean {
  if (!semverPattern.test(clientVersion) || !isoDatePattern.test(date)) {
    return false;
  }

  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

function toBody(entries: WhatsNewReleaseEntry[]): string {
  return entries
    .flatMap((entry) => [...entry.changes.features, ...entry.changes.fixes])
    .map((item) => `- **${item.title}** — ${item.description}`)
    .join('\n');
}

export function buildWhatsNewResponse(
  query: WhatsNewQuery,
  platform: WhatsNewPlatform,
  releases: readonly WhatsNewReleaseEntry[] = RELEASES,
): WhatsNewResponse {
  const releasesByVersion = new Map<string, WhatsNewReleaseEntry[]>();
  for (const entry of releases) {
    const clientVersion = clientVersionOf(entry, platform);
    if (
      clientVersion === undefined ||
      !hasValidReleaseMetadata(clientVersion, entry.date) ||
      !isUserFacing(entry, platform) ||
      compareSemver(clientVersion, query.lastSeenVersion) <= 0 ||
      compareSemver(clientVersion, query.currentVersion) > 0
    ) {
      continue;
    }
    const versionReleases = releasesByVersion.get(clientVersion) ?? [];
    versionReleases.push(entry);
    releasesByVersion.set(clientVersion, versionReleases);
  }

  const entries = [...releasesByVersion.entries()]
    .sort(([a], [b]) => compareSemver(a, b))
    .flatMap(([version, releases]) => {
      const publishedAt = releases
        .map((release) => release.date)
        .sort()
        .at(-1);
      if (publishedAt === undefined) {
        return [];
      }
      return [
        {
          version,
          title: `Nouveautés de la version ${version}`,
          body: toBody(releases),
          publishedAt,
        },
      ];
    });

  return { success: true, data: { entries } };
}
