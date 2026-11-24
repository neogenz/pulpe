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
    recordedValue: 0,
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
        asset({ id: 'a', recordedValue: 12_000 }),
        asset({ id: 'b', currency: 'EUR', recordedValue: 1000 }),
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
        asset({ id: 'a', currency: 'CHF', recordedValue: 1000 }),
        asset({ id: 'b', currency: 'EUR', recordedValue: 500 }),
      ],
      { baseCurrency: 'EUR', rates: { CHF: 1.07 } },
    );

    expect(result.assets.map((a) => a.convertedValue)).toEqual([1070, 500]);
    expect(result.totals).toMatchObject({ baseCurrency: 'EUR', gross: 1570 });
  });

  it('rounds each converted value to the cent and sums without drift', () => {
    const result = compute(
      [
        asset({ id: 'a', currency: 'EUR', recordedValue: 0.1 }),
        asset({ id: 'b', currency: 'EUR', recordedValue: 0.2 }),
        asset({ id: 'c', currency: 'EUR', recordedValue: 33.333 }),
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
      asset({ id: 'a', recordedValue: 10_000 }),
      asset({ id: 'leasing', direction: 'owe', recordedValue: 8000 }),
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
      asset({ id: 'a', recordedValue: 500 }),
      asset({ id: 'overdraft', recordedValue: -200 }),
    ]);

    expect(result.totals).toMatchObject({ gross: 500, debts: 200, net: 300 });
    expect(result.categories.find((c) => c.id === COMPTES.id)?.total).toBe(500);
    expect(result.assets[1]?.convertedValue).toBe(-200);
  });

  it('leaves archived assets out of totals but still converts them', () => {
    const result = compute([
      asset({ id: 'a', recordedValue: 100 }),
      asset({
        id: 'old',
        recordedValue: 900,
        archivedAt: '2026-10-01T00:00:00.000Z',
      }),
      asset({
        id: 'old-debt',
        direction: 'owe',
        recordedValue: 50,
        archivedAt: '2026-10-01T00:00:00.000Z',
      }),
    ]);

    expect(result.totals).toMatchObject({ gross: 100, debts: 0, net: 100 });
    expect(result.categories.find((c) => c.id === COMPTES.id)?.total).toBe(100);
    expect(result.assets.map((a) => a.convertedValue)).toEqual([100, 900, 50]);
  });

  it('flags incomplete and excludes an active asset without a rate', () => {
    const result = compute([
      asset({ id: 'a', recordedValue: 100 }),
      asset({ id: 'b', currency: 'EUR', recordedValue: 1000 }),
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
        recordedValue: 1000,
        archivedAt: '2026-10-01T00:00:00.000Z',
      }),
    ]);

    expect(result.assets[0]?.convertedValue).toBeNull();
    expect(result.totals.incomplete).toBe(false);
  });

  it('lets net go below zero when debts exceed gross', () => {
    const result = compute([
      asset({ id: 'a', recordedValue: 1000 }),
      asset({ id: 'mortgage', direction: 'owe', recordedValue: 5000 }),
    ]);

    expect(result.totals).toMatchObject({
      gross: 1000,
      debts: 5000,
      net: -4000,
    });
  });

  it('totals each category separately, an empty one at zero', () => {
    const result = compute([
      asset({ id: 'a', recordedValue: 100 }),
      asset({ id: 'b', categoryId: BIENS.id, recordedValue: 250_000 }),
      asset({ id: 'c', categoryId: BIENS.id, recordedValue: 1.5 }),
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
  return {
    assetId: 'asset-1',
    amount: 100,
    checkedAt: '2026-11-05T10:00:00.000Z',
    ...overrides,
  };
}

// PUL-377 jeu d'essai: Livret 10 000 (own), Leasing 8 000 (owe), CHF.
const LIVRET = asset({ id: 'livret', name: 'Livret', recordedValue: 10_000 });
const LEASING = asset({
  id: 'leasing',
  categoryId: BIENS.id,
  name: 'Leasing',
  direction: 'owe',
  recordedValue: 8_000,
});
const EPARGNE_MENSUELLE = line({
  assetId: 'livret',
  kind: 'saving',
  amount: 500,
});
const MENSUALITE_LEASING = line({
  assetId: 'leasing',
  kind: 'expense',
  amount: 300,
});
const RETRAIT = line({ assetId: 'livret', kind: 'income', amount: 1000 });

function valueOf(result: ReturnType<typeof compute>, id: string) {
  return result.assets.find((a) => a.id === id)?.value;
}

describe('computeNetWorth: the value follows what is checked (PUL-377)', () => {
  it('starts from the last entry when nothing is checked', () => {
    const result = compute([LIVRET, LEASING]);

    expect(valueOf(result, 'livret')).toBe(10_000);
    expect(result.totals).toMatchObject({
      gross: 10_000,
      debts: 8_000,
      net: 2_000,
    });
  });

  it('CA1: a checked Épargne raises the Livret, gross and net', () => {
    const result = compute([LIVRET, LEASING], {
      checkedLines: [EPARGNE_MENSUELLE],
    });

    expect(valueOf(result, 'livret')).toBe(10_500);
    expect(result.assets[0]?.recordedValue).toBe(10_000);
    expect(result.totals).toMatchObject({ gross: 10_500, net: 2_500 });
  });

  it('CA2: a checked Dépense lowers what remains due on the Leasing', () => {
    const result = compute([LIVRET, LEASING], {
      checkedLines: [MENSUALITE_LEASING],
    });

    expect(valueOf(result, 'leasing')).toBe(7_700);
    expect(result.totals).toMatchObject({ debts: 7_700, net: 2_300 });
  });

  it('CA3: a checked Revenu drawn from the Livret lowers it', () => {
    const result = compute([LIVRET], { checkedLines: [RETRAIT] });

    expect(valueOf(result, 'livret')).toBe(9_000);
  });

  it('CA4: unchecking takes the line out, so the Livret is back at 10 000', () => {
    const result = compute([LIVRET, LEASING], { checkedLines: [] });

    expect(valueOf(result, 'livret')).toBe(10_000);
    expect(result.totals.net).toBe(2_000);
  });

  it('CA5: a new entry of 12 000 is the value, then a later Épargne of 200 adds to it', () => {
    const livret = { ...LIVRET, recordedValue: 12_000 };

    // The cutoff drops the Épargne checked before the entry; the repository
    // hands over only the 200 checked after it.
    const result = compute([livret], {
      checkedLines: [line({ assetId: 'livret', kind: 'saving', amount: 200 })],
    });

    expect(valueOf(result, 'livret')).toBe(12_200);
  });

  it('CA6: a debt never goes below zero', () => {
    const result = compute([{ ...LEASING, recordedValue: 200 }], {
      checkedLines: [MENSUALITE_LEASING],
    });

    expect(valueOf(result, 'leasing')).toBe(0);
    expect(result.totals.debts).toBe(0);
  });

  it('lets an own asset go below zero, counted as a debt', () => {
    const result = compute([{ ...LIVRET, recordedValue: 400 }], {
      checkedLines: [RETRAIT],
    });

    expect(valueOf(result, 'livret')).toBe(-600);
    expect(result.totals).toMatchObject({ gross: 0, debts: 600, net: -600 });
  });

  it('CA7: after CA1 and CA2, every total is the sum of the values shown', () => {
    const result = compute([LIVRET, LEASING], {
      checkedLines: [EPARGNE_MENSUELLE, MENSUALITE_LEASING],
    });

    const own = result.assets
      .filter((a) => a.direction === 'own')
      .reduce((sum, a) => sum + (a.convertedValue ?? 0), 0);
    const owe = result.assets
      .filter((a) => a.direction === 'owe')
      .reduce((sum, a) => sum + (a.convertedValue ?? 0), 0);
    expect(result.totals).toMatchObject({
      gross: own,
      debts: owe,
      net: own - owe,
    });
    expect(result.totals).toMatchObject({
      gross: 10_500,
      debts: 7_700,
      net: 2_800,
    });
    expect(result.categories.find((c) => c.id === COMPTES.id)?.total).toBe(
      10_500,
    );
  });

  it('moves nothing for a pairing the database refuses to link', () => {
    const result = compute([LIVRET], {
      checkedLines: [line({ assetId: 'livret', kind: 'expense', amount: 50 })],
    });

    expect(valueOf(result, 'livret')).toBe(10_000);
  });

  it("CA14: a EUR asset receives the CHF line converted at today's rate", () => {
    const livretEur = { ...LIVRET, currency: 'EUR' as const };
    const result = compute([livretEur], {
      checkedLines: [EPARGNE_MENSUELLE],
      rates: { EUR: 0.93 },
    });

    // 500 CHF / 0.93 = 537.63 EUR.
    expect(valueOf(result, 'livret')).toBe(10_537.63);
    expect(result.assets[0]?.convertedValue).toBe(9_800);
  });

  it('CA14: without a rate, a EUR asset keeps its last entry and the page is incomplete', () => {
    const livretEur = { ...LIVRET, currency: 'EUR' as const };
    const result = compute([livretEur], { checkedLines: [EPARGNE_MENSUELLE] });

    expect(valueOf(result, 'livret')).toBe(10_000);
    expect(result.assets[0]?.convertedValue).toBeNull();
    expect(result.totals.incomplete).toBe(true);
  });

  it('CA15: an archived asset keeps its last entry and the totals do not move', () => {
    const archived = { ...LIVRET, archivedAt: '2026-11-01T00:00:00.000Z' };
    const result = compute([archived], { checkedLines: [EPARGNE_MENSUELLE] });

    expect(valueOf(result, 'livret')).toBe(10_000);
    expect(result.totals).toMatchObject({ gross: 0, net: 0 });
  });

  it('converts into a CHF asset when the base currency is EUR', () => {
    const result = compute([LIVRET], {
      baseCurrency: 'EUR',
      checkedLines: [line({ assetId: 'livret', kind: 'saving', amount: 93 })],
      rates: { CHF: 0.93 },
    });

    expect(valueOf(result, 'livret')).toBe(10_100);
  });
});

describe('checkedLinesCutoffs', () => {
  it('is the last entry of each active asset, none for an archived one', () => {
    expect(
      checkedLinesCutoffs([
        asset({ id: 'a' }),
        asset({ id: 'old', archivedAt: '2026-10-01T00:00:00.000Z' }),
      ]),
    ).toEqual([{ assetId: 'a', since: '2026-11-03T10:00:00.000Z' }]);
  });
});
