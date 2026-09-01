import { describe, expect, it } from 'vitest';
import { budgetGenerateSchema } from '../schemas.js';

const templateId = '00000000-0000-4000-8000-000000000001';
const maxYear = new Date().getFullYear() + 10;

describe('budgetGenerateSchema', () => {
  it.each([1, 12, 36])('accepts a valid %i-period request', (count) => {
    expect(
      budgetGenerateSchema.safeParse({
        templateId,
        startMonth: 1,
        startYear: 2025,
        count,
      }).success,
    ).toBe(true);
  });

  it('keeps the existing 12-period default', () => {
    expect(
      budgetGenerateSchema.parse({
        templateId,
        startMonth: 1,
        startYear: 2025,
      }).count,
    ).toBe(12);
  });

  it('accepts 36 periods when the last one stays within the maximum year', () => {
    expect(
      budgetGenerateSchema.safeParse({
        templateId,
        startMonth: 1,
        startYear: maxYear - 2,
        count: 36,
      }).success,
    ).toBe(true);
  });

  it('rejects a request whose last period exceeds the maximum year', () => {
    expect(
      budgetGenerateSchema.safeParse({
        templateId,
        startMonth: 12,
        startYear: maxYear,
        count: 2,
      }).success,
    ).toBe(false);
  });

  it.each([0, 37])('rejects a count of %i', (count) => {
    expect(
      budgetGenerateSchema.safeParse({
        templateId,
        startMonth: 1,
        startYear: 2025,
        count,
      }).success,
    ).toBe(false);
  });
});
