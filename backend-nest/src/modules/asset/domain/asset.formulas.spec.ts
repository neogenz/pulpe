import { describe, expect, it } from 'bun:test';
import type { AssetWithValue, CheckedLinkedLine } from './asset.entity';
import {
  checkedLinesCutoffs,
  computeNetWorth,
  type NetWorthInput,
} from './asset.formulas';

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
    suggestionDismissedAt: null,
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
    checkedLines: [],
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

function line(
  overrides: Partial<CheckedLinkedLine> & Pick<CheckedLinkedLine, 'kind'>,
): CheckedLinkedLine {
  return { assetId: 'asset-1', amount: 100, ...overrides };
}

function suggestionOf(
  assets: AssetWithValue[],
  checkedLines: CheckedLinkedLine[],
  overrides: Partial<NetWorthInput> = {},
) {
  return compute(assets, { checkedLines, ...overrides }).assets.map(
    (a) => a.suggestion,
  );
}

describe('computeNetWorth suggestion', () => {
  it('adds a checked Épargne to the value of an own asset', () => {
    const result = suggestionOf(
      [asset({ latestValue: 3000 })],
      [line({ kind: 'saving', amount: 500 })],
    );

    expect(result).toEqual([{ delta: 500, proposedValue: 3500 }]);
  });

  it('subtracts a checked Revenu drawn from an own asset', () => {
    const result = suggestionOf(
      [asset({ latestValue: 3000 })],
      [line({ kind: 'income', amount: 1200.5 })],
    );

    expect(result).toEqual([{ delta: -1200.5, proposedValue: 1799.5 }]);
  });

  it('lowers what remains due on a debt by a checked Dépense', () => {
    const result = suggestionOf(
      [asset({ direction: 'owe', latestValue: 8000 })],
      [line({ kind: 'expense', amount: 400 })],
    );

    expect(result).toEqual([{ delta: -400, proposedValue: 7600 }]);
  });

  it('sums every kind and counts only the lines of the asset', () => {
    const result = suggestionOf(
      [asset({ id: 'a', latestValue: 1000 }), asset({ id: 'b' })],
      [
        line({ assetId: 'a', kind: 'saving', amount: 500 }),
        line({ assetId: 'a', kind: 'saving', amount: 200 }),
        line({ assetId: 'a', kind: 'income', amount: 100 }),
        line({ assetId: 'b', kind: 'saving', amount: 50 }),
      ],
    );

    expect(result).toEqual([
      { delta: 600, proposedValue: 1600 },
      { delta: 50, proposedValue: 50 },
    ]);
  });

  it('moves nothing for a pairing the database refuses to link', () => {
    const result = suggestionOf(
      [
        asset({ id: 'own', latestValue: 100 }),
        asset({ id: 'debt', direction: 'owe', latestValue: 100 }),
      ],
      [
        line({ assetId: 'own', kind: 'expense', amount: 40 }),
        line({ assetId: 'debt', kind: 'saving', amount: 40 }),
        line({ assetId: 'debt', kind: 'income', amount: 40 }),
      ],
    );

    expect(result).toEqual([null, null]);
  });

  it('proposes nothing when no line is counted or the movements cancel out', () => {
    expect(suggestionOf([asset({ latestValue: 100 })], [])).toEqual([null]);
    expect(
      suggestionOf(
        [asset({ latestValue: 100 })],
        [
          line({ kind: 'saving', amount: 300 }),
          line({ kind: 'income', amount: 300 }),
        ],
      ),
    ).toEqual([null]);
  });

  it('converts the base-currency lines into the currency of the asset', () => {
    const result = suggestionOf(
      [asset({ currency: 'EUR', latestValue: 1000 })],
      [line({ kind: 'saving', amount: 93 })],
      { rates: { EUR: 0.93 } },
    );

    expect(result).toEqual([{ delta: 100, proposedValue: 1100 }]);
  });

  it('converts into a CHF asset when the base currency is EUR', () => {
    const result = suggestionOf(
      [asset({ currency: 'CHF', latestValue: 1000 })],
      [line({ kind: 'saving', amount: 107 })],
      { baseCurrency: 'EUR', rates: { CHF: 1.07 } },
    );

    expect(result).toEqual([{ delta: 100, proposedValue: 1100 }]);
  });

  it('rounds the converted delta to the cent', () => {
    const result = suggestionOf(
      [asset({ currency: 'EUR', latestValue: 0 })],
      [line({ kind: 'saving', amount: 100 })],
      { rates: { EUR: 0.93 } },
    );

    expect(result).toEqual([{ delta: 107.53, proposedValue: 107.53 }]);
  });

  it('proposes nothing for a foreign asset without a rate', () => {
    const result = suggestionOf(
      [asset({ currency: 'EUR', latestValue: 1000 })],
      [line({ kind: 'saving', amount: 93 })],
    );

    expect(result).toEqual([null]);
  });

  it('proposes nothing for an archived asset', () => {
    const result = suggestionOf(
      [
        asset({
          latestValue: 1000,
          archivedAt: '2026-10-01T00:00:00.000Z',
        }),
      ],
      [line({ kind: 'saving', amount: 500 })],
    );

    expect(result).toEqual([null]);
  });

  it('lets an own asset go below zero', () => {
    const result = suggestionOf(
      [asset({ latestValue: 100 })],
      [line({ kind: 'income', amount: 250 })],
    );

    expect(result).toEqual([{ delta: -250, proposedValue: -150 }]);
  });

  it('never takes a debt below zero and reports the delta actually applied', () => {
    const result = suggestionOf(
      [asset({ direction: 'owe', latestValue: 300 })],
      [line({ kind: 'expense', amount: 400 })],
    );

    expect(result).toEqual([{ delta: -300, proposedValue: 0 }]);
  });

  it('proposes nothing for a paid-off debt', () => {
    const result = suggestionOf(
      [asset({ direction: 'owe', latestValue: 0 })],
      [line({ kind: 'expense', amount: 400 })],
    );

    expect(result).toEqual([null]);
  });

  it('leaves the totals untouched', () => {
    const without = compute([asset({ latestValue: 3000 })]);
    const withLines = compute([asset({ latestValue: 3000 })], {
      checkedLines: [line({ kind: 'saving', amount: 500 })],
    });

    expect(withLines.totals).toEqual(without.totals);
  });
});

describe('checkedLinesCutoffs', () => {
  const cutoffOf = (overrides: Partial<AssetWithValue>) =>
    checkedLinesCutoffs([asset(overrides)])[0]?.since;

  it('is the latest snapshot without any dismissal', () => {
    expect(cutoffOf({})).toBe('2026-11-03T10:00:00.000Z');
  });

  it('is the dismissal when it is more recent than the latest snapshot', () => {
    expect(
      cutoffOf({ suggestionDismissedAt: '2026-11-03T12:00:00.000Z' }),
    ).toBe('2026-11-03T12:00:00.000Z');
  });

  it('is the latest snapshot when it is more recent than the dismissal, so an apply wins', () => {
    expect(
      cutoffOf({ suggestionDismissedAt: '2026-11-02T12:00:00.000Z' }),
    ).toBe('2026-11-03T10:00:00.000Z');
  });

  it('compares instants, not strings, across the formats PostgREST and JS emit', () => {
    expect(
      cutoffOf({
        latestRecordedAt: '2026-11-03T10:00:00.5+00:00',
        suggestionDismissedAt: '2026-11-03T10:00:00.4Z',
      }),
    ).toBe('2026-11-03T10:00:00.5+00:00');
  });

  it('has one entry per active asset and none for an archived one', () => {
    expect(
      checkedLinesCutoffs([
        asset({ id: 'a' }),
        asset({ id: 'old', archivedAt: '2026-10-01T00:00:00.000Z' }),
      ]),
    ).toEqual([{ assetId: 'a', since: '2026-11-03T10:00:00.000Z' }]);
  });
});
