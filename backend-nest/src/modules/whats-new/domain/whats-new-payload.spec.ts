import { describe, it, expect } from 'bun:test';
import { whatsNewResponseSchema } from 'pulpe-shared';
import {
  buildWhatsNewResponse,
  compareSemver,
  isUserFacing,
} from './whats-new-payload';
import type { WhatsNewReleaseEntry } from './releases-data';

const versionsOf = (
  response: ReturnType<typeof buildWhatsNewResponse>,
): string[] => response.data.entries.map((entry) => entry.version);

describe('compareSemver', () => {
  it('compares double-digit segments numerically, not lexicographically', () => {
    expect(compareSemver('0.9.0', '0.10.0')).toBeLessThan(0);
    expect(compareSemver('0.10.0', '0.9.0')).toBeGreaterThan(0);
  });

  it('returns zero for equal versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
  });
});

describe('isUserFacing', () => {
  const iosTechnicalOnly: WhatsNewReleaseEntry = {
    version: '9.9.9',
    iosVersion: '9.9.9',
    date: '2026-01-01',
    platforms: ['ios'],
    changes: {
      features: [],
      fixes: [],
      technical: [{ title: 'Internal', description: 'Refactor' }],
    },
  };

  it('excludes an iOS release that carries only technical changes', () => {
    expect(isUserFacing(iosTechnicalOnly, 'ios')).toBe(false);
  });

  it('includes an iOS release with at least one feature or fix', () => {
    expect(
      isUserFacing(
        {
          ...iosTechnicalOnly,
          changes: {
            features: [{ title: 'Feature', description: 'New' }],
            fixes: [],
            technical: [],
          },
        },
        'ios',
      ),
    ).toBe(true);
  });

  it('excludes a user-facing release that does not target iOS', () => {
    expect(
      isUserFacing(
        {
          ...iosTechnicalOnly,
          platforms: ['web'],
          changes: {
            features: [{ title: 'Feature', description: 'New' }],
            fixes: [],
            technical: [],
          },
        },
        'ios',
      ),
    ).toBe(false);
  });

  it('gates on the requested platform, not on iOS', () => {
    const androidOnly: WhatsNewReleaseEntry = {
      ...iosTechnicalOnly,
      platforms: ['android'],
      changes: {
        features: [{ title: 'Feature', description: 'New' }],
        fixes: [],
        technical: [],
      },
    };

    expect(isUserFacing(androidOnly, 'android')).toBe(true);
    expect(isUserFacing(androidOnly, 'ios')).toBe(false);
  });
});

describe('buildWhatsNewResponse', () => {
  it('ignores malformed release metadata instead of failing the feed', () => {
    const malformedRelease: WhatsNewReleaseEntry = {
      version: '9.9.9',
      iosVersion: '1.1.0',
      date: '15/07/2026',
      platforms: ['ios'],
      changes: {
        features: [{ title: 'Feature', description: 'New' }],
        fixes: [],
        technical: [],
      },
    };

    const response = buildWhatsNewResponse(
      { currentVersion: '1.1.0', lastSeenVersion: '1.0.4' },
      'ios',
      [
        malformedRelease,
        { ...malformedRelease, iosVersion: 'invalid', date: '2026-07-15' },
        { ...malformedRelease, date: '2026-02-30' },
      ],
    );

    expect(response.data.entries).toEqual([]);
  });

  // An Android-only release has no App Store version to borrow, and the two
  // feeds must not leak into each other because of it.
  it('serves a release without an iOS marketing version to Android alone', () => {
    const androidOnly: WhatsNewReleaseEntry = {
      version: '0.44.0',
      date: '2026-09-01',
      platforms: ['android'],
      changes: {
        features: [{ title: 'Le budget dans ta poche', description: 'Pulpe' }],
        fixes: [],
        technical: [],
      },
    };
    const query = { currentVersion: '0.44.0', lastSeenVersion: '0.43.0' };

    expect(
      versionsOf(buildWhatsNewResponse(query, 'android', [androidOnly])),
    ).toEqual(['0.44.0']);
    expect(
      buildWhatsNewResponse(query, 'ios', [androidOnly]).data.entries,
    ).toEqual([]);
  });

  it('returns an empty feed when last-seen equals current version', () => {
    const response = buildWhatsNewResponse(
      { currentVersion: '1.1.0', lastSeenVersion: '1.1.0' },
      'ios',
    );

    expect(response.data.entries).toEqual([]);
  });

  it('returns an empty feed when a newer iOS version has no user-facing release data', () => {
    const response = buildWhatsNewResponse(
      { currentVersion: '1.1.1', lastSeenVersion: '1.1.0' },
      'ios',
    );

    expect(response.data.entries).toEqual([]);
  });

  it('includes releases strictly newer than last-seen, excluding last-seen itself', () => {
    const response = buildWhatsNewResponse(
      { currentVersion: '1.1.0', lastSeenVersion: '1.0.3' },
      'ios',
    );

    expect(versionsOf(response)).toEqual(['1.0.4', '1.1.0']);
  });

  it('includes the current version and excludes anything above it', () => {
    const response = buildWhatsNewResponse(
      { currentVersion: '1.0.4', lastSeenVersion: '1.0.0' },
      'ios',
    );

    expect(versionsOf(response)).toEqual(['1.0.3', '1.0.4']);
  });

  it('aggregates multiple skipped versions ordered ascending', () => {
    const response = buildWhatsNewResponse(
      { currentVersion: '1.1.0', lastSeenVersion: '1.0.0' },
      'ios',
    );

    expect(versionsOf(response)).toEqual(['1.0.3', '1.0.4', '1.1.0']);
  });

  it('groups product releases that shipped in the same iOS binary', () => {
    const response = buildWhatsNewResponse(
      { currentVersion: '1.0.0', lastSeenVersion: '0.9.0' },
      'ios',
    );

    expect(versionsOf(response)).toEqual(['1.0.0']);
    expect(response.data.entries[0]?.body).toContain('Multi-devise EUR/CHF');
    expect(response.data.entries[0]?.body).toContain(
      "Confirmation de sortie de l'onboarding",
    );
  });

  it('renders a markdown feature-then-fix body and a schema-valid payload', () => {
    const response = buildWhatsNewResponse(
      { currentVersion: '1.1.0', lastSeenVersion: '1.0.4' },
      'ios',
    );

    expect(whatsNewResponseSchema.safeParse(response).success).toBe(true);
    expect(response.data.entries).toHaveLength(1);

    const entry = response.data.entries[0];
    expect(entry.version).toBe('1.1.0');
    expect(entry.title).toBe('Nouveautés de la version 1.1.0');
    expect(entry.publishedAt).toBe('2026-07-01');
    expect(entry.body.split('\n')).toHaveLength(4);
    expect(entry.body.startsWith('- **Lisser une dépense** — ')).toBe(true);
    expect(entry.body).not.toContain('Sécurité renforcée');
    expect(entry.body).toContain('\n- **Gérer tes transactions** — ');
    expect(entry.body).toContain('\n- **Plus fluide au quotidien** — ');
    expect(entry.body).not.toContain('(iOS)');
  });

  it('validates the complete mapped release dataset', () => {
    expect(() =>
      buildWhatsNewResponse(
        { currentVersion: '99.99.99', lastSeenVersion: '0.0.0' },
        'ios',
      ),
    ).not.toThrow();
  });
});

describe('buildWhatsNewResponse for android', () => {
  const androidRelease: WhatsNewReleaseEntry = {
    version: '0.43.0',
    iosVersion: '1.4.0',
    date: '2026-08-11',
    platforms: ['android', 'ios'],
    changes: {
      features: [{ title: 'Pulpe sur Android', description: 'Enfin' }],
      fixes: [],
      technical: [],
    },
  };

  it('keys the feed on the repo version, not the App Store one', () => {
    const response = buildWhatsNewResponse(
      { currentVersion: '0.43.0', lastSeenVersion: '0.42.0' },
      'android',
      [androidRelease],
    );

    expect(versionsOf(response)).toEqual(['0.43.0']);
    expect(response.data.entries[0]?.title).toBe(
      'Nouveautés de la version 0.43.0',
    );
  });

  it('excludes a release that does not target android', () => {
    const response = buildWhatsNewResponse(
      { currentVersion: '0.43.0', lastSeenVersion: '0.42.0' },
      'android',
      [{ ...androidRelease, platforms: ['ios', 'web'] }],
    );

    expect(response.data.entries).toEqual([]);
  });

  it('reads the same release out of range under the iOS numbering', () => {
    const response = buildWhatsNewResponse(
      { currentVersion: '0.43.0', lastSeenVersion: '0.42.0' },
      'ios',
      [androidRelease],
    );

    expect(response.data.entries).toEqual([]);
  });
});
