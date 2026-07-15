import { describe, it, expect } from 'vitest';
import {
  tagCreateSchema,
  tagHistoryQuerySchema,
  tagHistoryResponseSchema,
  tagUpdateSchema,
} from '../schemas.js';

describe('tagCreateSchema', () => {
  it('should reject a whitespace-only name (trim before min, else DB CHECK turns it into a 500)', () => {
    const result = tagCreateSchema.safeParse({ name: '   ' });

    expect(result.success).toBe(false);
  });

  it('should trim surrounding whitespace before validating length', () => {
    const paddedThirtyCharName = `  ${'a'.repeat(30)}  `;

    const result = tagCreateSchema.safeParse({ name: paddedThirtyCharName });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('a'.repeat(30));
  });

  it('should reject a name longer than 30 characters after trim', () => {
    const result = tagCreateSchema.safeParse({ name: 'a'.repeat(31) });

    expect(result.success).toBe(false);
  });

  it('should reject unknown keys (strict contract)', () => {
    const result = tagCreateSchema.safeParse({ name: 'Voyage', color: 'red' });

    expect(result.success).toBe(false);
  });
});

describe('tagUpdateSchema', () => {
  it('should inherit the whitespace-only rejection from the create schema', () => {
    const result = tagUpdateSchema.safeParse({ name: ' ' });

    expect(result.success).toBe(false);
  });
});

describe('tagHistoryQuerySchema', () => {
  it.each([3, 6, 12, 24])('accepts the %i-month horizon', (months) => {
    expect(
      tagHistoryQuerySchema.parse({
        months: String(months),
        endMonth: '7',
        endYear: '2026',
      }),
    ).toEqual({ months, endMonth: 7, endYear: 2026 });
  });

  it.each([
    { months: '5', endMonth: '7', endYear: '2026' },
    { months: '3', endMonth: '13', endYear: '2026' },
    { months: '3', endMonth: '7', endYear: '2019' },
    { months: '24', endMonth: '1', endYear: '2020' },
  ])('rejects an invalid history window: %o', (query) => {
    expect(tagHistoryQuerySchema.safeParse(query).success).toBe(false);
  });

  it('accepts the earliest 24-month window contained in the shared year bounds', () => {
    expect(
      tagHistoryQuerySchema.safeParse({
        months: '24',
        endMonth: '12',
        endYear: '2021',
      }).success,
    ).toBe(true);
  });
});

describe('tagHistoryResponseSchema', () => {
  it('accepts an unbounded actual-to-planned ratio and zero periods', () => {
    const result = tagHistoryResponseSchema.safeParse({
      success: true,
      data: {
        tagId: '00000000-0000-4000-8000-000000000001',
        periods: [
          {
            month: 7,
            year: 2026,
            plannedAmount: 0,
            actualAmount: 150,
          },
        ],
        totalPlanned: 100,
        totalActual: 150,
        monthlyAverageActual: 50,
        actualToPlannedPercent: 150,
      },
    });

    expect(result.success).toBe(true);
  });
});
