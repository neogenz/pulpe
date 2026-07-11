import {
  whatsNewResponseSchema,
  type WhatsNewQuery,
  type WhatsNewResponse,
} from 'pulpe-shared';
import { RELEASES, type WhatsNewReleaseEntry } from './releases-data';

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

export function isIosUserFacing(
  entry: WhatsNewReleaseEntry,
): entry is WhatsNewReleaseEntry & { iosVersion: string } {
  return (
    entry.iosVersion !== undefined &&
    entry.platforms.includes('ios') &&
    (entry.changes.features.length > 0 || entry.changes.fixes.length > 0)
  );
}

function toBody(entries: WhatsNewReleaseEntry[]): string {
  return entries
    .flatMap((entry) => [...entry.changes.features, ...entry.changes.fixes])
    .map((item) => `- **${item.title}** — ${item.description}`)
    .join('\n');
}

export function buildWhatsNewResponse(query: WhatsNewQuery): WhatsNewResponse {
  const releasesByIosVersion = new Map<string, WhatsNewReleaseEntry[]>();
  for (const entry of RELEASES) {
    if (
      !isIosUserFacing(entry) ||
      compareSemver(entry.iosVersion, query.lastSeenVersion) <= 0 ||
      compareSemver(entry.iosVersion, query.currentVersion) > 0
    ) {
      continue;
    }
    const releases = releasesByIosVersion.get(entry.iosVersion) ?? [];
    releases.push(entry);
    releasesByIosVersion.set(entry.iosVersion, releases);
  }

  const entries = [...releasesByIosVersion.entries()]
    .sort(([a], [b]) => compareSemver(a, b))
    .map(([iosVersion, releases]) => ({
      version: iosVersion,
      title: `Nouveautés de la version ${iosVersion}`,
      body: toBody(releases),
      publishedAt: releases
        .map((release) => release.date)
        .sort()
        .at(-1)!,
    }));

  return whatsNewResponseSchema.parse({ success: true, data: { entries } });
}
