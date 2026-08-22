import { describe, expect, it } from 'vitest';

import { listBudgetsQuerySchema } from '../schemas.js';

describe('listBudgetsQuerySchema', () => {
  it('coerces a bounded sparse page', () => {
    expect(
      listBudgetsQuerySchema.parse({
        fields: 'month,year',
        limit: '36',
        offset: '72',
      }),
    ).toEqual({ fields: 'month,year', limit: 36, offset: 72 });
  });

  it.each([
    { fields: 'month,year', offset: '-1', limit: '36' },
    { fields: 'month,year', offset: '36' },
  ])('rejects an invalid offset contract: %o', (query) => {
    expect(listBudgetsQuerySchema.safeParse(query).success).toBe(false);
  });

  it.each([
    { limit: '36' },
    { limit: '36', offset: '72' },
    { year: '2026' },
    { fields: '', limit: '36' },
  ])('rejects sparse-only modifiers without fields: %o', (query) => {
    expect(listBudgetsQuerySchema.safeParse(query).success).toBe(false);
  });

  it('reports only the invalid fields error for empty fields', () => {
    const result = listBudgetsQuerySchema.safeParse({
      fields: '',
      limit: '36',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]?.path).toEqual(['fields']);
  });

  it('reports the first missing prerequisite for an offset', () => {
    const result = listBudgetsQuerySchema.safeParse({ offset: '5' });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toEqual([
      expect.objectContaining({
        message: 'offset requires limit',
        path: ['offset'],
      }),
    ]);
  });

  it('keeps existing queries valid without pagination', () => {
    expect(listBudgetsQuerySchema.parse({})).toEqual({});
    expect(
      listBudgetsQuerySchema.parse({ fields: 'month,year', year: '2026' }),
    ).toEqual({ fields: 'month,year', year: 2026 });
  });
});
