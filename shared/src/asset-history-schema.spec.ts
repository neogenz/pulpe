import { describe, expect, it } from 'vitest';
import {
  assetHistoryEntrySchema,
  assetHistoryQuerySchema,
  assetHistoryResponseSchema,
} from '../schemas.js';

const ID = '550e8400-e29b-41d4-a716-446655440002';
const CURSOR = `1793786400000.1.${ID}`;

describe('assetHistoryQuerySchema', () => {
  it('defaults to a page of 30 without a cursor', () => {
    expect(assetHistoryQuerySchema.parse({})).toEqual({ limit: 30 });
  });

  it('coerces the limit and keeps the cursor of the previous page', () => {
    expect(
      assetHistoryQuerySchema.parse({ limit: '2', cursor: CURSOR }),
    ).toEqual({ limit: 2, cursor: CURSOR });
  });

  it.each(['0', '101', '2.5', 'abc'])('rejects the limit %s', (limit) => {
    expect(assetHistoryQuerySchema.safeParse({ limit }).success).toBe(false);
  });

  it.each([
    'abc',
    `1793786400000.2.${ID}`,
    `-1.0.${ID}`,
    '1793786400000.0.not-a-uuid',
    `${CURSOR}.extra`,
  ])('rejects the cursor %s', (cursor) => {
    expect(assetHistoryQuerySchema.safeParse({ cursor }).success).toBe(false);
  });
});

describe('assetHistoryEntrySchema', () => {
  it('reads an entry and a movement, the movement without a rate or still counted', () => {
    expect(
      assetHistoryEntrySchema.safeParse({
        type: 'snapshot',
        id: ID,
        at: '2026-11-01T08:00:00.000Z',
        value: 5000,
      }).success,
    ).toBe(true);
    expect(
      assetHistoryEntrySchema.safeParse({
        type: 'movement',
        id: ID,
        at: '2026-11-05T10:00:00.000Z',
        name: 'Restaurant',
        effect: null,
        supersededAt: null,
      }).success,
    ).toBe(true);
  });

  it('rejects a movement without its effect', () => {
    expect(
      assetHistoryEntrySchema.safeParse({
        type: 'movement',
        id: ID,
        at: '2026-11-05T10:00:00.000Z',
        name: 'Restaurant',
        supersededAt: null,
      }).success,
    ).toBe(false);
  });
});

const ASSET = {
  id: ID,
  categoryId: ID,
  name: 'Compte courant',
  currency: 'CHF',
  direction: 'own',
  inPulpe: true,
  archivedAt: null,
  latestValue: 3800,
  recordedValue: 5000,
  latestRecordedAt: '2026-11-01T08:00:00.000Z',
  convertedValue: 3800,
  suggestion: null,
};

const page = (extra: Record<string, unknown>) => ({
  success: true,
  data: { asset: ASSET, entries: [], nextCursor: null, ...extra },
});

describe('assetHistoryResponseSchema: monthEndProjection (PUL-380)', () => {
  it('reads « Fin novembre : 8 000 »', () => {
    const result = assetHistoryResponseSchema.parse(
      page({ monthEndProjection: { month: 11, year: 2026, value: 8000 } }),
    );

    expect(result.data.monthEndProjection).toEqual({
      month: 11,
      year: 2026,
      value: 8000,
    });
  });

  it('reads nothing to come as null, and a server without the field as absent', () => {
    expect(
      assetHistoryResponseSchema.safeParse(page({ monthEndProjection: null }))
        .success,
    ).toBe(true);
    expect(assetHistoryResponseSchema.safeParse(page({})).success).toBe(true);
  });

  it.each([
    { month: 0, year: 2026, value: 1 },
    { month: 13, year: 2026, value: 1 },
    { month: 11, year: 2026 },
    { month: 11, year: 2026, value: '8000' },
  ])('rejects the projection %o', (monthEndProjection) => {
    expect(
      assetHistoryResponseSchema.safeParse(page({ monthEndProjection }))
        .success,
    ).toBe(false);
  });
});

describe('assetHistoryResponseSchema', () => {
  it('reads the asset as GET /v1/assets does, a page and the last page marker', () => {
    const result = assetHistoryResponseSchema.safeParse({
      success: true,
      data: {
        asset: {
          id: ID,
          categoryId: ID,
          name: 'Compte courant',
          currency: 'CHF',
          direction: 'own',
          inPulpe: true,
          archivedAt: null,
          latestValue: 9420,
          recordedValue: 5000,
          latestRecordedAt: '2026-11-01T08:00:00.000Z',
          convertedValue: 9420,
          suggestion: null,
        },
        entries: [],
        nextCursor: null,
      },
    });

    expect(result.success).toBe(true);
  });
});
