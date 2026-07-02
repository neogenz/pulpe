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

export function isIosUserFacing(entry: WhatsNewReleaseEntry): boolean {
  return (
    entry.platforms.includes('ios') &&
    (entry.changes.features.length > 0 || entry.changes.fixes.length > 0)
  );
}

function toBody(entry: WhatsNewReleaseEntry): string {
  return [...entry.changes.features, ...entry.changes.fixes]
    .map((item) => `- **${item.title}** — ${item.description}`)
    .join('\n');
}

export function buildWhatsNewResponse(query: WhatsNewQuery): WhatsNewResponse {
  const entries = RELEASES.filter(
    (entry) =>
      isIosUserFacing(entry) &&
      compareSemver(entry.version, query.lastSeenVersion) > 0 &&
      compareSemver(entry.version, query.currentVersion) <= 0,
  )
    .sort((a, b) => compareSemver(a.version, b.version))
    .map((entry) => ({
      version: entry.version,
      title: `Nouveautés de la version ${entry.version}`,
      body: toBody(entry),
      publishedAt: entry.date,
    }));

  return whatsNewResponseSchema.parse({ success: true, data: { entries } });
}
