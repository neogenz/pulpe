import { describe, expect, it } from 'vitest';
import type { Asset, AssetCategory } from 'pulpe-shared';
import { debtGroups, ownGroups } from './net-worth-groups';

const categories: AssetCategory[] = [
  { id: 'accounts', name: 'Comptes', total: 1000 },
  { id: 'loans', name: 'Crédit', total: 0 },
  { id: 'unused', name: 'Cash', total: 0 },
];

function asset(overrides: Partial<Asset> & Pick<Asset, 'id'>): Asset {
  return {
    categoryId: 'accounts',
    name: overrides.id,
    currency: 'CHF',
    direction: 'own',
    inPulpe: false,
    archivedAt: null,
    latestValue: 0,
    latestRecordedAt: '2026-11-03T10:00:00.000Z',
    convertedValue: 0,
    suggestion: null,
    ...overrides,
  };
}

const assets = [
  asset({ id: 'ubs', latestValue: 1000, convertedValue: 1000 }),
  asset({ id: 'overdrawn', latestValue: -300, convertedValue: -300 }),
  asset({
    id: 'leasing',
    categoryId: 'loans',
    direction: 'owe',
    latestValue: 100.1,
    convertedValue: 100.1,
  }),
  asset({
    id: 'loan',
    categoryId: 'loans',
    direction: 'owe',
    currency: 'EUR',
    latestValue: 200,
    convertedValue: 200.2,
  }),
];

describe('net worth groups', () => {
  it('groups what I own by Type with the API subtotal, hiding unused Types', () => {
    const groups = ownGroups(categories, assets);

    expect(groups).toHaveLength(1);
    expect(groups[0].category?.name).toBe('Comptes');
    expect(groups[0].total).toBe(1000);
    expect(groups[0].assets.map((a) => a.id)).toEqual(['ubs']);
  });

  it('groups what I owe by Type, then the overdrawn accounts, summed to the cent', () => {
    const groups = debtGroups(categories, assets);

    expect(groups.map((group) => group.category?.name ?? null)).toEqual([
      'Crédit',
      null,
    ]);
    expect(groups[0].total).toBe(300.3);
    expect(groups[1].total).toBe(300);
    expect(groups[1].assets.map((a) => a.id)).toEqual(['overdrawn']);
  });
});
