import { describe, it, expect } from 'bun:test';
import { whatsNewResponseSchema } from 'pulpe-shared';
import {
  buildWhatsNewResponse,
  compareSemver,
  isIosUserFacing,
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

describe('isIosUserFacing', () => {
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
    expect(isIosUserFacing(iosTechnicalOnly)).toBe(false);
  });

  it('includes an iOS release with at least one feature or fix', () => {
    expect(
      isIosUserFacing({
        ...iosTechnicalOnly,
        changes: {
          features: [{ title: 'Feature', description: 'New' }],
          fixes: [],
          technical: [],
        },
      }),
    ).toBe(true);
  });

  it('excludes a user-facing release that does not target iOS', () => {
    expect(
      isIosUserFacing({
        ...iosTechnicalOnly,
        platforms: ['web'],
        changes: {
          features: [{ title: 'Feature', description: 'New' }],
          fixes: [],
          technical: [],
        },
      }),
    ).toBe(false);
  });
});

describe('buildWhatsNewResponse', () => {
  it.each([
    ['en', 'What’s new in version 1.3.2', 'Monthly trajectory'],
    ['de', 'Neu in Version 1.3.2', 'Monatsverlauf'],
    ['it', 'Novità della versione 1.3.2', 'Andamento mensile'],
  ] as const)('renders the 1.3.2 feed in %s', (locale, title, marker) => {
    const response = buildWhatsNewResponse({
      currentVersion: '1.3.2',
      lastSeenVersion: '1.3.1',
      locale,
    });

    expect(response.data.entries).toHaveLength(1);
    expect(response.data.entries[0]?.title).toBe(title);
    expect(response.data.entries[0]?.body).toContain(marker);
    expect(response.data.entries[0]?.body).not.toContain(
      'Trajectoire mensuelle',
    );
  });

  it('defaults an omitted locale to the canonical French copy', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '1.3.2',
      lastSeenVersion: '1.3.1',
    });

    expect(response.data.entries[0]?.title).toBe(
      'Nouveautés de la version 1.3.2',
    );
    expect(response.data.entries[0]?.body).toContain('Trajectoire mensuelle');
  });

  it('falls back to French when an unvalidated locale reaches the domain', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '1.3.2',
      lastSeenVersion: '1.3.1',
      locale: '__defineGetter__' as never,
    });

    expect(response.data.entries[0]?.title).toBe(
      'Nouveautés de la version 1.3.2',
    );
    expect(response.data.entries[0]?.body).toContain('Trajectoire mensuelle');
  });

  it('falls back the whole historical entry to French without mixing copies', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '1.3.0',
      lastSeenVersion: '1.2.2',
      locale: 'de',
    });

    expect(response.data.entries[0]?.title).toBe(
      'Nouveautés de la version 1.3.0',
    );
    expect(response.data.entries[0]?.body).toContain(
      'Des objectifs plus flexibles',
    );
    expect(response.data.entries[0]?.body).not.toContain('Neu in Version');
  });

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
      [
        malformedRelease,
        { ...malformedRelease, iosVersion: 'invalid', date: '2026-07-15' },
        { ...malformedRelease, date: '2026-02-30' },
      ],
    );

    expect(response.data.entries).toEqual([]);
  });

  it('returns an empty feed when last-seen equals current version', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '1.1.0',
      lastSeenVersion: '1.1.0',
    });

    expect(response.data.entries).toEqual([]);
  });

  it('returns an empty feed when a newer iOS version has no user-facing release data', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '1.1.1',
      lastSeenVersion: '1.1.0',
    });

    expect(response.data.entries).toEqual([]);
  });

  it('includes releases strictly newer than last-seen, excluding last-seen itself', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '1.1.0',
      lastSeenVersion: '1.0.3',
    });

    expect(versionsOf(response)).toEqual(['1.0.4', '1.1.0']);
  });

  it('includes the current version and excludes anything above it', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '1.0.4',
      lastSeenVersion: '1.0.0',
    });

    expect(versionsOf(response)).toEqual(['1.0.3', '1.0.4']);
  });

  it('aggregates multiple skipped versions ordered ascending', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '1.1.0',
      lastSeenVersion: '1.0.0',
    });

    expect(versionsOf(response)).toEqual(['1.0.3', '1.0.4', '1.1.0']);
  });

  it('groups product releases that shipped in the same iOS binary', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '1.0.0',
      lastSeenVersion: '0.9.0',
    });

    expect(versionsOf(response)).toEqual(['1.0.0']);
    expect(response.data.entries[0]?.body).toContain('Multi-devise EUR/CHF');
    expect(response.data.entries[0]?.body).toContain(
      "Confirmation de sortie de l'onboarding",
    );
  });

  it('renders a markdown feature-then-fix body and a schema-valid payload', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '1.1.0',
      lastSeenVersion: '1.0.4',
    });

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
      buildWhatsNewResponse({
        currentVersion: '99.99.99',
        lastSeenVersion: '0.0.0',
      }),
    ).not.toThrow();
  });
});
