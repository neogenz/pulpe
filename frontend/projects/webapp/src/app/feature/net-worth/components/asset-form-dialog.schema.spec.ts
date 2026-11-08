import { describe, expect, it } from 'vitest';
import {
  buildAssetCreate,
  buildAssetEdit,
  NEW_CATEGORY_PREFIX,
  type AssetFormValue,
} from './asset-form-dialog.schema';

const CHECKING = '11111111-1111-4111-8111-111111111111';

const value: AssetFormValue = {
  name: 'UBS',
  direction: 'own',
  categoryKey: CHECKING,
  currency: 'CHF',
  value: 1200,
  inPulpe: true,
};

describe('asset form schema', () => {
  it('builds a create request around an existing category', () => {
    expect(buildAssetCreate(value)).toEqual({
      asset: {
        name: 'UBS',
        currency: 'CHF',
        direction: 'own',
        inPulpe: true,
        value: 1200,
      },
      category: { id: CHECKING },
    });
  });

  it('turns a starter suggestion into a category to create', () => {
    const { category } = buildAssetCreate({
      ...value,
      categoryKey: `${NEW_CATEGORY_PREFIX}Placements`,
    });

    expect(category).toEqual({ name: 'Placements' });
  });

  it('trims the name and refuses a blank one', () => {
    expect(buildAssetCreate({ ...value, name: '  UBS  ' }).asset.name).toBe(
      'UBS',
    );
    expect(() => buildAssetCreate({ ...value, name: '   ' })).toThrow();
  });

  it('builds an edit patch without direction or currency', () => {
    expect(
      buildAssetEdit({ ...value, name: 'UBS Pro', inPulpe: false }),
    ).toEqual({
      updates: { name: 'UBS Pro', inPulpe: false },
      category: { id: CHECKING },
    });
  });
});
