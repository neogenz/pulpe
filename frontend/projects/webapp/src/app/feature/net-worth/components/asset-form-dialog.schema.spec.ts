import { describe, expect, it } from 'vitest';
import type { Asset, AssetCategory } from 'pulpe-shared';
import {
  buildAssetCreate,
  buildAssetEdit,
  defaultCategoryKey,
  NEW_CATEGORY_PREFIX,
  OTHER_TYPE_KEY,
  typeOptionsFor,
  type AssetFormValue,
} from './asset-form-dialog.schema';

const CHECKING = '11111111-1111-4111-8111-111111111111';
const LOANS = '33333333-3333-4333-8333-333333333333';

const value: AssetFormValue = {
  name: 'UBS',
  direction: 'own',
  categoryKey: CHECKING,
  typeName: '',
  currency: 'CHF',
  value: 1200,
  isOverdraft: false,
};

const asset: Asset = {
  id: '22222222-2222-4222-8222-222222222222',
  categoryId: CHECKING,
  name: 'UBS',
  currency: 'CHF',
  direction: 'own',
  inPulpe: false,
  archivedAt: null,
  latestValue: 1200,
  latestRecordedAt: '2026-11-03T10:00:00.000Z',
  convertedValue: 1200,
  suggestion: null,
};

const categories: AssetCategory[] = [
  { id: CHECKING, name: 'Comptes', total: 1200 },
  { id: LOANS, name: 'Crédit', total: 0 },
];

describe('asset form schema', () => {
  it('builds a create request around an existing Type', () => {
    expect(buildAssetCreate(value)).toEqual({
      asset: {
        name: 'UBS',
        currency: 'CHF',
        direction: 'own',
        inPulpe: false,
        value: 1200,
      },
      category: { id: CHECKING },
    });
  });

  it('turns a suggestion or a typed name into a Type to resolve by name', () => {
    expect(
      buildAssetCreate({
        ...value,
        categoryKey: `${NEW_CATEGORY_PREFIX}Placements`,
      }).category,
    ).toEqual({ name: 'Placements' });
    expect(
      buildAssetCreate({
        ...value,
        categoryKey: OTHER_TYPE_KEY,
        typeName: 'Crypto',
      }).category,
    ).toEqual({ name: 'Crypto' });
  });

  it('signs the first value of an overdrawn account, never the one of a debt', () => {
    expect(buildAssetCreate({ ...value, isOverdraft: true }).asset.value).toBe(
      -1200,
    );
    expect(
      buildAssetCreate({ ...value, direction: 'owe', isOverdraft: true }).asset
        .value,
    ).toBe(1200);
  });

  it('trims the name and refuses a blank one', () => {
    expect(buildAssetCreate({ ...value, name: '  UBS  ' }).asset.name).toBe(
      'UBS',
    );
    expect(() => buildAssetCreate({ ...value, name: '   ' })).toThrow();
  });

  it('keeps only the changed parts of an edit', () => {
    expect(buildAssetEdit(value, asset)).toEqual({});
    expect(buildAssetEdit({ ...value, value: 1500 }, asset)).toEqual({
      value: 1500,
    });
    expect(buildAssetEdit({ ...value, name: 'UBS Pro' }, asset)).toEqual({
      updates: { name: 'UBS Pro' },
    });
    expect(
      buildAssetEdit(
        { ...value, categoryKey: `${NEW_CATEGORY_PREFIX}Cash` },
        asset,
      ),
    ).toEqual({ category: { name: 'Cash' } });
    expect(buildAssetEdit({ ...value, isOverdraft: true }, asset)).toEqual({
      value: -1200,
    });
  });

  describe('Type options', () => {
    const debt: Asset = {
      ...asset,
      id: '44444444-4444-4444-8444-444444444444',
      categoryId: LOANS,
      direction: 'owe',
    };

    it('lists the Types a direction uses, then its unused suggestions', () => {
      const own = typeOptionsFor(
        'own',
        categories,
        [asset, debt],
        ['Comptes', 'Épargne'],
      );

      expect(own.used.map((category) => category.name)).toEqual(['Comptes']);
      expect(own.suggestions).toEqual(['Épargne']);
    });

    it('never offers a debt the Types of what I own', () => {
      const owe = typeOptionsFor(
        'owe',
        categories,
        [asset],
        ['Crédit', 'Hypothèque'],
      );

      expect(owe.used).toEqual([]);
      expect(owe.suggestions).toEqual(['Crédit', 'Hypothèque']);
      expect(defaultCategoryKey(owe)).toBe(`${NEW_CATEGORY_PREFIX}Crédit`);
    });

    it('defaults to the most used Type of the direction', () => {
      const options = typeOptionsFor(
        'own',
        [...categories, { id: 'savings', name: 'Épargne', total: 0 }],
        [
          asset,
          { ...asset, id: 'b', categoryId: 'savings' },
          { ...asset, id: 'c', categoryId: 'savings' },
        ],
        ['Comptes'],
      );

      expect(defaultCategoryKey(options)).toBe('savings');
    });
  });
});
