import { describe, it, expect } from 'vitest';
import {
  assetCategoryCreateSchema,
  assetCreateSchema,
  assetSchema,
  assetSnapshotsCreateSchema,
  assetUpdateSchema,
  netWorthResponseSchema,
  budgetLineSchema,
  templateLineSchema,
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

describe('asset link on read schemas', () => {
  const timestamps = {
    createdAt: '2026-11-01T00:00:00+00:00',
    updatedAt: '2026-11-01T00:00:00+00:00',
  };
  const line = {
    id: ASSET_ID,
    name: 'Loyer',
    amount: 800,
    kind: 'expense',
    recurrence: 'fixed',
    savingsGoalId: null,
    ...timestamps,
  };

  it('should read a budget line without assetId as unlinked (older backend)', () => {
    const result = budgetLineSchema.parse({
      ...line,
      budgetId: CATEGORY_ID,
      templateLineId: null,
      isManuallyAdjusted: false,
      checkedAt: null,
    });

    expect(result.assetId).toBeNull();
  });

  it('should read a template line without assetId as unlinked (older backend)', () => {
    const result = templateLineSchema.parse({
      ...line,
      templateId: CATEGORY_ID,
      description: '',
    });

    expect(result.assetId).toBeNull();
  });
});

describe('net worth read contract (PUL-377)', () => {
  // CA1: Livret saisi à 10 000, Épargne mensuelle de 500 pointée depuis.
  const livret = {
    id: '11111111-1111-4111-8111-111111111111',
    categoryId: '22222222-2222-4222-8222-222222222222',
    name: 'Livret',
    currency: 'CHF',
    direction: 'own',
    inPulpe: false,
    archivedAt: null,
    latestValue: 10_500,
    recordedValue: 10_000,
    latestRecordedAt: '2026-11-03T10:00:00.000Z',
    convertedValue: 10_500,
    suggestion: null,
  };
  const payload = {
    success: true,
    data: {
      totals: {
        baseCurrency: 'CHF',
        gross: 10_500,
        debts: 8_000,
        net: 2_500,
        incomplete: false,
      },
      categories: [{ id: livret.categoryId, name: 'Épargne', total: 10_500 }],
      assets: [livret],
    },
  };

  it('should read the up-to-date value and the last entry', () => {
    const [asset] = netWorthResponseSchema.parse(payload).data.assets;

    expect(asset.latestValue).toBe(10_500);
    expect(asset.recordedValue).toBe(10_000);
    expect(asset.suggestion).toBeNull();
  });

  it('should still read for an installed app that knows no recordedValue (CA18)', () => {
    // The shape iOS 1.14.x and Android parse: no `recordedValue`, loose object.
    const installedAssetSchema = assetSchema.omit({ recordedValue: true });
    const asset = installedAssetSchema.parse(livret);

    expect(asset.latestValue).toBe(10_500);
    expect(asset.suggestion).toBeNull();
  });
});
