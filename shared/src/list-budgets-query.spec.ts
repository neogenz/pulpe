import { describe, expect, it } from 'vitest';

import { listBudgetsQuerySchema } from '../schemas.js';

describe('listBudgetsQuerySchema', () => {
  it('coerces a bounded page', () => {
    expect(listBudgetsQuerySchema.parse({ limit: '36', offset: '72' })).toEqual(
      { limit: 36, offset: 72 },
    );
  });

  it.each([{ offset: '-1', limit: '36' }, { offset: '36' }])(
    'rejects an invalid offset contract: %o',
    (query) => {
      expect(listBudgetsQuerySchema.safeParse(query).success).toBe(false);
    },
  );

  it('keeps existing queries valid without pagination', () => {
    expect(
      listBudgetsQuerySchema.parse({ fields: 'month,year', year: '2026' }),
    ).toEqual({ fields: 'month,year', year: 2026 });
  });
});
