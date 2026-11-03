import { describe, expect, it } from 'bun:test';
import type { AssetWithValue } from './asset.entity';
import { computeNetWorth, type NetWorthInput } from './asset.formulas';

const COMPTES = { id: 'cat-comptes', name: 'Comptes' };
const BIENS = { id: 'cat-biens', name: 'Biens' };
const VIDE = { id: 'cat-vide', name: 'Vide' };

function asset(overrides: Partial<AssetWithValue>): AssetWithValue {
  return {
    id: 'asset-1',
    categoryId: COMPTES.id,
    name: 'Compte',
    currency: 'CHF',
    direction: 'own',
    inPulpe: false,
    archivedAt: null,
    latestValue: 0,
    latestRecordedAt: '2026-11-03T10:00:00.000Z',
    ...overrides,
  };
}

function compute(
  assets: AssetWithValue[],
  overrides: Partial<NetWorthInput> = {},
) {
  return computeNetWorth({
    baseCurrency: 'CHF',
    categories: [COMPTES, BIENS, VIDE],
    assets,
    rates: {},
    ...overrides,
  });
}

describe('computeNetWorth', () => {
  it('returns zeros for a user without any asset', () => {
    const result = compute([]);

    expect(result.totals).toEqual({
      baseCurrency: 'CHF',
      gross: 0,
      debts: 0,
      net: 0,
      incomplete: false,
    });
    expect(result.categories.map((c) => c.total)).toEqual([0, 0, 0]);
    expect(result.assets).toEqual([]);
  });

  it('converts a foreign asset at the given rate and adds it to gross and its category', () => {
    const result = compute(
      [
        asset({ id: 'a', latestValue: 12_000 }),
        asset({ id: 'b', currency: 'EUR', latestValue: 1000 }),
      ],
      { rates: { EUR: 0.93 } },
    );

    expect(result.assets.map((a) => a.convertedValue)).toEqual([12_000, 930]);
    expect(result.categories.find((c) => c.id === COMPTES.id)?.total).toBe(
      12_930,
    );
    expect(result.totals.gross).toBe(12_930);
    expect(result.totals.incomplete).toBe(false);
  });

  it('converts into a base currency other than CHF', () => {
    const result = compute(
      [
        asset({ id: 'a', currency: 'CHF', latestValue: 1000 }),
        asset({ id: 'b', currency: 'EUR', latestValue: 500 }),
      ],
      { baseCurrency: 'EUR', rates: { CHF: 1.07 } },
    );

    expect(result.assets.map((a) => a.convertedValue)).toEqual([1070, 500]);
    expect(result.totals).toMatchObject({ baseCurrency: 'EUR', gross: 1570 });
  });

  it('rounds each converted value to the cent and sums without drift', () => {
    const result = compute(
      [
        asset({ id: 'a', currency: 'EUR', latestValue: 0.1 }),
        asset({ id: 'b', currency: 'EUR', latestValue: 0.2 }),
        asset({ id: 'c', currency: 'EUR', latestValue: 33.333 }),
      ],
      { rates: { EUR: 1 } },
    );

    expect(result.assets.map((a) => a.convertedValue)).toEqual([
      0.1, 0.2, 33.33,
    ]);
    expect(result.totals.gross).toBe(33.63);
  });

  it('counts an owe asset in debts and keeps it out of gross and category totals', () => {
    const result = compute([
      asset({ id: 'a', latestValue: 10_000 }),
      asset({ id: 'leasing', direction: 'owe', latestValue: 8000 }),
    ]);

    expect(result.totals).toMatchObject({
      gross: 10_000,
      debts: 8000,
      net: 2000,
    });
    expect(result.categories.find((c) => c.id === COMPTES.id)?.total).toBe(
      10_000,
    );
  });

  it('counts an overdrawn own account in debts, not in gross nor in its category total', () => {
    const result = compute([
      asset({ id: 'a', latestValue: 500 }),
      asset({ id: 'overdraft', latestValue: -200 }),
    ]);

    expect(result.totals).toMatchObject({ gross: 500, debts: 200, net: 300 });
    expect(result.categories.find((c) => c.id === COMPTES.id)?.total).toBe(500);
    expect(result.assets[1]?.convertedValue).toBe(-200);
  });

  it('leaves archived assets out of totals but still converts them', () => {
    const result = compute([
      asset({ id: 'a', latestValue: 100 }),
      asset({
        id: 'old',
        latestValue: 900,
        archivedAt: '2026-10-01T00:00:00.000Z',
      }),
      asset({
        id: 'old-debt',
        direction: 'owe',
        latestValue: 50,
        archivedAt: '2026-10-01T00:00:00.000Z',
      }),
    ]);

    expect(result.totals).toMatchObject({ gross: 100, debts: 0, net: 100 });
    expect(result.categories.find((c) => c.id === COMPTES.id)?.total).toBe(100);
    expect(result.assets.map((a) => a.convertedValue)).toEqual([100, 900, 50]);
  });

  it('flags incomplete and excludes an active asset without a rate', () => {
    const result = compute([
      asset({ id: 'a', latestValue: 100 }),
      asset({ id: 'b', currency: 'EUR', latestValue: 1000 }),
    ]);

    expect(result.assets.map((a) => a.convertedValue)).toEqual([100, null]);
    expect(result.totals).toMatchObject({
      gross: 100,
      debts: 0,
      net: 100,
      incomplete: true,
    });
  });

  it('does not flag incomplete for an archived asset without a rate', () => {
    const result = compute([
      asset({
        id: 'b',
        currency: 'EUR',
        latestValue: 1000,
        archivedAt: '2026-10-01T00:00:00.000Z',
      }),
    ]);

    expect(result.assets[0]?.convertedValue).toBeNull();
    expect(result.totals.incomplete).toBe(false);
  });

  it('lets net go below zero when debts exceed gross', () => {
    const result = compute([
      asset({ id: 'a', latestValue: 1000 }),
      asset({ id: 'mortgage', direction: 'owe', latestValue: 5000 }),
    ]);

    expect(result.totals).toMatchObject({
      gross: 1000,
      debts: 5000,
      net: -4000,
    });
  });

  it('totals each category separately, an empty one at zero', () => {
    const result = compute([
      asset({ id: 'a', latestValue: 100 }),
      asset({ id: 'b', categoryId: BIENS.id, latestValue: 250_000 }),
      asset({ id: 'c', categoryId: BIENS.id, latestValue: 1.5 }),
    ]);

    expect(
      Object.fromEntries(result.categories.map((c) => [c.id, c.total])),
    ).toEqual({
      [COMPTES.id]: 100,
      [BIENS.id]: 250_001.5,
      [VIDE.id]: 0,
    });
  });
});
