import { describe, it, expect } from 'vitest';
import {
  assetCategoryCreateSchema,
  assetCreateSchema,
  assetSnapshotsCreateSchema,
  assetUpdateSchema,
} from '../schemas.js';

const CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440001';
const ASSET_ID = '550e8400-e29b-41d4-a716-446655440002';
const OTHER_ASSET_ID = '550e8400-e29b-41d4-a716-446655440003';

const validCreate = {
  name: 'Compte UBS',
  categoryId: CATEGORY_ID,
  currency: 'CHF',
  direction: 'own',
  value: 1000,
};

describe('assetCreateSchema', () => {
  it('should reject an unknown key (strict contract)', () => {
    const result = assetCreateSchema.safeParse({
      ...validCreate,
      color: 'red',
    });

    expect(result.success).toBe(false);
  });

  it('should default inPulpe to false', () => {
    const result = assetCreateSchema.safeParse(validCreate);

    expect(result.data?.inPulpe).toBe(false);
  });

  it('should accept a negative value (overdraft; the sign rule lives in the backend)', () => {
    const result = assetCreateSchema.safeParse({ ...validCreate, value: -200 });

    expect(result.success).toBe(true);
  });

  it('should reject a currency outside CHF and EUR', () => {
    const result = assetCreateSchema.safeParse({
      ...validCreate,
      currency: 'USD',
    });

    expect(result.success).toBe(false);
  });

  it('should reject a whitespace-only name and one past 100 characters', () => {
    expect(
      assetCreateSchema.safeParse({ ...validCreate, name: '   ' }).success,
    ).toBe(false);
    expect(
      assetCreateSchema.safeParse({ ...validCreate, name: 'a'.repeat(101) })
        .success,
    ).toBe(false);
  });

  it('should require the first value', () => {
    const { value: _value, ...withoutValue } = validCreate;

    expect(assetCreateSchema.safeParse(withoutValue).success).toBe(false);
  });
});

describe('assetUpdateSchema', () => {
  it('should refuse to change the currency or the direction after creation', () => {
    expect(assetUpdateSchema.safeParse({ currency: 'EUR' }).success).toBe(
      false,
    );
    expect(assetUpdateSchema.safeParse({ direction: 'owe' }).success).toBe(
      false,
    );
  });

  it('should accept a partial patch', () => {
    expect(assetUpdateSchema.safeParse({ archived: true }).success).toBe(true);
  });

  it('should reject an empty patch', () => {
    expect(assetUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe('assetSnapshotsCreateSchema', () => {
  it('should reject an empty batch', () => {
    expect(assetSnapshotsCreateSchema.safeParse({ items: [] }).success).toBe(
      false,
    );
  });

  it('should reject the same asset twice in one batch', () => {
    const result = assetSnapshotsCreateSchema.safeParse({
      items: [
        { assetId: ASSET_ID, value: 1 },
        { assetId: ASSET_ID, value: 2 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('should accept two distinct assets', () => {
    const result = assetSnapshotsCreateSchema.safeParse({
      items: [
        { assetId: ASSET_ID, value: 1 },
        { assetId: OTHER_ASSET_ID, value: 2 },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe('assetCategoryCreateSchema', () => {
  it('should reject a name past 30 characters after trim', () => {
    expect(
      assetCategoryCreateSchema.safeParse({ name: 'a'.repeat(31) }).success,
    ).toBe(false);
  });

  it('should trim before validating length', () => {
    const result = assetCategoryCreateSchema.safeParse({
      name: `  ${'a'.repeat(30)}  `,
    });

    expect(result.data?.name).toBe('a'.repeat(30));
  });
});
