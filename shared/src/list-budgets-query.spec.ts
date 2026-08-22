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

  it('rejects empty fields', () => {
    expect(listBudgetsQuerySchema.safeParse({ fields: '' }).success).toBe(
      false,
    );
  });

  it('keeps existing queries valid without pagination', () => {
    expect(listBudgetsQuerySchema.parse({})).toEqual({});
    expect(
      listBudgetsQuerySchema.parse({ fields: 'month,year', year: '2026' }),
    ).toEqual({ fields: 'month,year', year: 2026 });
  });
});
