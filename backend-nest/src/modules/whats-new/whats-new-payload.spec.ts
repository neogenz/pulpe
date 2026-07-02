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
  it('excludes web-only releases newer than the last-seen version', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '0.37.1',
      lastSeenVersion: '0.37.0',
    });

    expect(response.data.entries).toEqual([]);
  });

  it('returns an empty feed when last-seen equals current version', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '0.37.0',
      lastSeenVersion: '0.37.0',
    });

    expect(response.data.entries).toEqual([]);
  });

  it('includes releases strictly newer than last-seen, excluding last-seen itself', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '0.32.0',
      lastSeenVersion: '0.31.1',
    });

    expect(versionsOf(response)).toEqual(['0.31.2', '0.32.0']);
  });

  it('includes the current version and excludes anything above it', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '0.33.0',
      lastSeenVersion: '0.31.0',
    });

    expect(versionsOf(response)).toEqual([
      '0.31.1',
      '0.31.2',
      '0.32.0',
      '0.32.1',
      '0.33.0',
    ]);
  });

  it('aggregates multiple skipped versions ordered ascending', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '0.31.0',
      lastSeenVersion: '0.28.0',
    });

    expect(versionsOf(response)).toEqual(['0.29.0', '0.30.0', '0.31.0']);
  });

  it('orders by numeric semver so single-digit minors precede double-digit ones', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '0.36.0',
      lastSeenVersion: '0.9.0',
    });

    expect(versionsOf(response)[0]).toBe('0.18.0');
  });

  it('renders a markdown feature-then-fix body and a schema-valid payload', () => {
    const response = buildWhatsNewResponse({
      currentVersion: '0.37.0',
      lastSeenVersion: '0.36.0',
    });

    expect(whatsNewResponseSchema.safeParse(response).success).toBe(true);
    expect(response.data.entries).toHaveLength(1);

    const entry = response.data.entries[0];
    expect(entry.version).toBe('0.37.0');
    expect(entry.title).toBe('Nouveautés de la version 0.37.0');
    expect(entry.publishedAt).toBe('2026-07-01');
    expect(entry.body.split('\n')).toHaveLength(5);
    expect(entry.body.startsWith('- **Lisser une dépense** — ')).toBe(true);
    expect(entry.body).toContain('\n- **Sécurité renforcée** — ');
  });
});
