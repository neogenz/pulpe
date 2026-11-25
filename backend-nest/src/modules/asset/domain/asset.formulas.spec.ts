import { describe, expect, it } from 'bun:test';
import { BudgetFormulas, type TransactionKind } from 'pulpe-shared';
import type {
  AssetHistoryEntry,
  AssetMovements,
  AssetSnapshot,
  AssetWithValue,
  FreeMovement,
  MonthLine,
  MonthMovements,
  MovementLine,
} from './asset.entity';
import {
  assetHistory,
  computeNetWorth,
  monthEndValue,
  movementsSince,
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
    movements: { lines: [], freeMovements: [] },
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

/** An instant on day `day` of November 2026; the entries default to the 3rd. */
function on(day: number, hour = 10): string {
  return `2026-11-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;
}

function prevision(
  overrides: Partial<MovementLine> & Pick<MovementLine, 'kind' | 'amount'>,
): MovementLine {
  return {
    id: 'line-1',
    name: 'Prévision',
    checkedAt: on(5),
    accountId: null,
    assetId: null,
    checkedReals: [],
    ...overrides,
  };
}

function free(
  accountId: string,
  kind: TransactionKind,
  amount: number,
  checkedAt = on(5),
): FreeMovement {
  return {
    id: `${accountId}:${amount}:${checkedAt}`,
    name: 'Mouvement',
    accountId,
    kind,
    amount,
    checkedAt,
  };
}

function withMovements(
  lines: MovementLine[],
  freeMovements: FreeMovement[] = [],
): Pick<NetWorthInput, 'movements'> {
  return { movements: { lines, freeMovements } };
}

function valueOf(result: ReturnType<typeof compute>, id: string) {
  return result.assets.find((a) => a.id === id)?.value;
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
const EPARGNE_MENSUELLE = prevision({
  id: 'epargne-mensuelle',
  assetId: 'livret',
  kind: 'saving',
  amount: 500,
});
const MENSUALITE_LEASING = prevision({
  id: 'mensualite-leasing',
  assetId: 'leasing',
  kind: 'expense',
  amount: 300,
});
const RETRAIT = prevision({
  id: 'retrait',
  assetId: 'livret',
  kind: 'income',
  amount: 1000,
});

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
    const result = compute(
      [LIVRET, LEASING],
      withMovements([EPARGNE_MENSUELLE]),
    );

    expect(valueOf(result, 'livret')).toBe(10_500);
    expect(result.assets[0]?.recordedValue).toBe(10_000);
    expect(result.totals).toMatchObject({ gross: 10_500, net: 2_500 });
  });

  it('CA2: a checked Dépense lowers what remains due on the Leasing', () => {
    const result = compute(
      [LIVRET, LEASING],
      withMovements([MENSUALITE_LEASING]),
    );

    expect(valueOf(result, 'leasing')).toBe(7_700);
    expect(result.totals).toMatchObject({ debts: 7_700, net: 2_300 });
  });

  it('CA3: a checked Revenu drawn from the Livret lowers it', () => {
    const result = compute([LIVRET], withMovements([RETRAIT]));

    expect(valueOf(result, 'livret')).toBe(9_000);
  });

  it('CA4: an unchecked prévision without checked movements moves nothing', () => {
    const result = compute(
      [LIVRET, LEASING],
      withMovements([{ ...EPARGNE_MENSUELLE, checkedAt: null }]),
    );

    expect(valueOf(result, 'livret')).toBe(10_000);
    expect(result.totals.net).toBe(2_000);
  });

  it('CA5: a new entry of 12 000 is the value, then a later Épargne of 200 adds to it', () => {
    const livret = {
      ...LIVRET,
      recordedValue: 12_000,
      latestRecordedAt: on(6),
    };

    const result = compute(
      [livret],
      withMovements([
        // Checked before the entry, which already holds it.
        EPARGNE_MENSUELLE,
        prevision({
          id: 'epargne-2',
          assetId: 'livret',
          kind: 'saving',
          amount: 200,
          checkedAt: on(7),
        }),
      ]),
    );

    expect(valueOf(result, 'livret')).toBe(12_200);
  });

  it('CA6: a debt never goes below zero', () => {
    const result = compute(
      [{ ...LEASING, recordedValue: 200 }],
      withMovements([MENSUALITE_LEASING]),
    );

    expect(valueOf(result, 'leasing')).toBe(0);
    expect(result.totals.debts).toBe(0);
  });

  it('lets an own asset go below zero, counted as a debt', () => {
    const result = compute(
      [{ ...LIVRET, recordedValue: 400 }],
      withMovements([RETRAIT]),
    );

    expect(valueOf(result, 'livret')).toBe(-600);
    expect(result.totals).toMatchObject({ gross: 0, debts: 600, net: -600 });
  });

  it('CA7: after CA1 and CA2, every total is the sum of the values shown', () => {
    const result = compute(
      [LIVRET, LEASING],
      withMovements([EPARGNE_MENSUELLE, MENSUALITE_LEASING]),
    );

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
    const result = compute(
      [LIVRET],
      withMovements([
        prevision({ assetId: 'livret', kind: 'expense', amount: 50 }),
      ]),
    );

    expect(valueOf(result, 'livret')).toBe(10_000);
  });

  it("CA14: a EUR asset receives the CHF line converted at today's rate", () => {
    const livretEur = { ...LIVRET, currency: 'EUR' as const };
    const result = compute([livretEur], {
      ...withMovements([EPARGNE_MENSUELLE]),
      rates: { EUR: 0.93 },
    });

    // 500 CHF / 0.93 = 537.63 EUR.
    expect(valueOf(result, 'livret')).toBe(10_537.63);
    expect(result.assets[0]?.convertedValue).toBe(9_800);
  });

  it('CA14: without a rate, a EUR asset keeps its last entry and the page is incomplete', () => {
    const livretEur = { ...LIVRET, currency: 'EUR' as const };
    const result = compute([livretEur], withMovements([EPARGNE_MENSUELLE]));

    expect(valueOf(result, 'livret')).toBe(10_000);
    expect(result.assets[0]?.convertedValue).toBeNull();
    expect(result.totals.incomplete).toBe(true);
  });

  it('CA15: an archived asset keeps its last entry and the totals do not move', () => {
    const archived = { ...LIVRET, archivedAt: '2026-11-01T00:00:00.000Z' };
    const result = compute([archived], withMovements([EPARGNE_MENSUELLE]));

    expect(valueOf(result, 'livret')).toBe(10_000);
    expect(result.totals).toMatchObject({ gross: 0, net: 0 });
  });

  it('converts into a CHF asset when the base currency is EUR', () => {
    const result = compute([LIVRET], {
      baseCurrency: 'EUR',
      ...withMovements([
        prevision({ assetId: 'livret', kind: 'saving', amount: 93 }),
      ]),
      rates: { CHF: 0.93 },
    });

    expect(valueOf(result, 'livret')).toBe(10_100);
  });
});

// PUL-378 jeu d'essai, CHF, nothing checked, entries on 3 November.
const COMPTE_COURANT = asset({
  id: 'compte-courant',
  name: 'Compte courant',
  recordedValue: 5_000,
});
const REVOLUT = asset({ id: 'revolut', name: 'Revolut', recordedValue: 400 });
const CARTE = asset({
  id: 'carte',
  categoryId: BIENS.id,
  name: 'Carte de crédit',
  direction: 'owe',
  recordedValue: 200,
});
const JEU_D_ESSAI = [COMPTE_COURANT, REVOLUT, LIVRET, LEASING];
const AVEC_CARTE = [...JEU_D_ESSAI, CARTE];

function courses(overrides: Partial<MovementLine> = {}): MovementLine {
  return prevision({
    id: 'courses',
    kind: 'expense',
    amount: 400,
    accountId: 'compte-courant',
    ...overrides,
  });
}

describe('computeNetWorth: a movement moves its account (PUL-378)', () => {
  it('starts from the jeu d’essai: gross 15 400, debts 8 000, net 7 400', () => {
    const result = compute(JEU_D_ESSAI);

    expect(result.totals).toMatchObject({
      gross: 15_400,
      debts: 8_000,
      net: 7_400,
    });
  });

  describe('Ce que ça change dans « Mon patrimoine »', () => {
    it('CA5: the imprévu « Restaurant » 80 on the Compte courant, checked: 4 920, net 7 320', () => {
      const result = compute(
        JEU_D_ESSAI,
        withMovements([], [free('compte-courant', 'expense', 80)]),
      );

      expect(valueOf(result, 'compte-courant')).toBe(4_920);
      expect(result.totals.net).toBe(7_320);
    });

    it('CA6: the Revenu « Salaire » 6 000 on the Compte courant, checked: 11 000, net 13 400', () => {
      const result = compute(
        JEU_D_ESSAI,
        withMovements([
          prevision({
            kind: 'income',
            amount: 6_000,
            accountId: 'compte-courant',
          }),
        ]),
      );

      expect(valueOf(result, 'compte-courant')).toBe(11_000);
      expect(result.totals.net).toBe(13_400);
    });

    it('CA7: « Épargne mensuelle » 500 from the Compte courant « Versée sur » Livret: 4 500 and 10 500, net unchanged', () => {
      const result = compute(
        JEU_D_ESSAI,
        withMovements([{ ...EPARGNE_MENSUELLE, accountId: 'compte-courant' }]),
      );

      expect(valueOf(result, 'compte-courant')).toBe(4_500);
      expect(valueOf(result, 'livret')).toBe(10_500);
      expect(result.totals.net).toBe(7_400);
    });

    it('CA8: « Mensualité leasing » 300 from the Compte courant repaying the Leasing: 4 700 and 7 700, net unchanged', () => {
      const result = compute(
        JEU_D_ESSAI,
        withMovements([{ ...MENSUALITE_LEASING, accountId: 'compte-courant' }]),
      );

      expect(valueOf(result, 'compte-courant')).toBe(4_700);
      expect(valueOf(result, 'leasing')).toBe(7_700);
      expect(result.totals.net).toBe(7_400);
    });

    it('CA9: « Retrait » 1 000 « Tiré de » Livret onto the Compte courant: 9 000 and 6 000, net unchanged', () => {
      const result = compute(
        JEU_D_ESSAI,
        withMovements([{ ...RETRAIT, accountId: 'compte-courant' }]),
      );

      expect(valueOf(result, 'livret')).toBe(9_000);
      expect(valueOf(result, 'compte-courant')).toBe(6_000);
      expect(result.totals.net).toBe(7_400);
    });

    it('CA10, CA12: unchecked or deleted, « Restaurant » is no longer read and the Compte courant is back at 5 000', () => {
      // `list_asset_movements` only returns a free movement once checked, and
      // a deleted one is gone (movement_account_link.sql).
      const result = compute(JEU_D_ESSAI, withMovements([], []));

      expect(valueOf(result, 'compte-courant')).toBe(5_000);
      expect(result.totals.net).toBe(7_400);
    });

    it('CA11: « Restaurant » moved to Revolut: the Compte courant is back at 5 000 and Revolut is 320', () => {
      const result = compute(
        JEU_D_ESSAI,
        withMovements([], [free('revolut', 'expense', 80)]),
      );

      expect(valueOf(result, 'compte-courant')).toBe(5_000);
      expect(valueOf(result, 'revolut')).toBe(320);
    });

    it('CA13: an Épargne 500 with « Aucun » as account still feeds the Livret: Compte courant 5 000, Livret 10 500', () => {
      const result = compute(JEU_D_ESSAI, withMovements([EPARGNE_MENSUELLE]));

      expect(valueOf(result, 'compte-courant')).toBe(5_000);
      expect(valueOf(result, 'livret')).toBe(10_500);
    });

    it('CA14: a Dépense of 500 on Revolut overdraws it to −100, counted with the debts', () => {
      const result = compute(
        JEU_D_ESSAI,
        withMovements([], [free('revolut', 'expense', 500)]),
      );

      expect(valueOf(result, 'revolut')).toBe(-100);
      expect(result.totals).toMatchObject({
        gross: 15_000,
        debts: 8_100,
        net: 6_900,
      });
    });

    it('CA15: an entry of 4 880 between the movement of 120 and the check of « Courses » 400: 4 600', () => {
      const compteCourant = {
        ...COMPTE_COURANT,
        recordedValue: 4_880,
        latestRecordedAt: on(5),
      };

      const result = compute(
        [compteCourant],
        withMovements([
          courses({
            checkedAt: on(6),
            checkedReals: [{ amount: 120, checkedAt: on(4) }],
          }),
        ]),
      );

      // 400 counted now, 120 counted at the entry: 280 more, not 400.
      expect(valueOf(result, 'compte-courant')).toBe(4_600);
    });

    it('a movement checked at the very instant of the entry is already in it', () => {
      const result = compute(
        [COMPTE_COURANT],
        withMovements(
          [],
          [
            free(
              'compte-courant',
              'expense',
              80,
              COMPTE_COURANT.latestRecordedAt,
            ),
          ],
        ),
      );

      expect(valueOf(result, 'compte-courant')).toBe(5_000);
    });

    it("CA16: a EUR account receives the amount converted at today's rate", () => {
      const compteEur = { ...COMPTE_COURANT, currency: 'EUR' as const };
      const result = compute([compteEur], {
        ...withMovements([], [free('compte-courant', 'expense', 80)]),
        rates: { EUR: 0.8 },
      });

      // 80 CHF / 0.8 = 100 EUR.
      expect(valueOf(result, 'compte-courant')).toBe(4_900);
      expect(result.assets[0]?.convertedValue).toBe(3_920);
    });

    it('CA16: without a rate, a EUR account keeps its last entry', () => {
      const compteEur = { ...COMPTE_COURANT, currency: 'EUR' as const };
      const result = compute(
        [compteEur],
        withMovements([], [free('compte-courant', 'expense', 80)]),
      );

      expect(valueOf(result, 'compte-courant')).toBe(5_000);
      expect(result.totals.incomplete).toBe(true);
    });
  });

  describe('Prévision et mouvements réels rattachés', () => {
    it('CA17: « Courses » 400 unchecked, with 120 checked: 4 880', () => {
      const result = compute(
        JEU_D_ESSAI,
        withMovements([
          courses({
            checkedAt: null,
            checkedReals: [{ amount: 120, checkedAt: on(4) }],
          }),
        ]),
      );

      expect(valueOf(result, 'compte-courant')).toBe(4_880);
    });

    it('CA18: then « Courses » is checked: 4 600', () => {
      const result = compute(
        JEU_D_ESSAI,
        withMovements([
          courses({
            checkedAt: on(6),
            checkedReals: [{ amount: 120, checkedAt: on(4) }],
          }),
        ]),
      );

      expect(valueOf(result, 'compte-courant')).toBe(4_600);
    });

    it('CA19: « Courses » checked with 450 of checked movements: 4 550', () => {
      const result = compute(
        JEU_D_ESSAI,
        withMovements([
          courses({
            checkedReals: [
              { amount: 300, checkedAt: on(6) },
              { amount: 150, checkedAt: on(7) },
            ],
          }),
        ]),
      );

      expect(valueOf(result, 'compte-courant')).toBe(4_550);
    });

    it('CA20: an Épargne 500 to the Livret, checked with 600 of movements: 4 400 and 10 600, both sides alike', () => {
      const result = compute(
        JEU_D_ESSAI,
        withMovements([
          {
            ...EPARGNE_MENSUELLE,
            accountId: 'compte-courant',
            checkedReals: [{ amount: 600, checkedAt: on(6) }],
          },
        ]),
      );

      expect(valueOf(result, 'compte-courant')).toBe(4_400);
      expect(valueOf(result, 'livret')).toBe(10_600);
      expect(result.totals.net).toBe(7_400);
    });

    it('CA21: one account, a whole month, no entry: the account moves as much as the checked balance', () => {
      type Line = MovementLine & { name: string };
      const line = (
        name: string,
        kind: TransactionKind,
        amount: number,
        checkedAt: string | null,
        reals: number[] = [],
      ): Line => ({
        ...prevision({ kind, amount, accountId: 'compte-courant' }),
        id: name,
        name,
        checkedAt,
        checkedReals: reals.map((real, i) => ({
          amount: real,
          checkedAt: on(10 + i),
        })),
      });
      const lines = [
        line('Salaire', 'income', 6_000, on(5)),
        line('Loyer', 'expense', 1_500, on(5), [1_600]),
        line('Courses', 'expense', 400, null, [120]),
        line('Épargne', 'saving', 500, on(6)),
        line('Vacances', 'expense', 1_000, null),
      ];
      const freeMovements = [
        free('compte-courant', 'expense', 80, on(7)),
        free('compte-courant', 'income', 50, on(8)),
      ];

      const result = compute(
        [COMPTE_COURANT],
        withMovements(lines, freeMovements),
      );

      const checkedBalance = BudgetFormulas.calculateRealizedBalance(lines, [
        ...lines.flatMap((l) =>
          l.checkedReals.map((real) => ({
            kind: l.kind,
            amount: real.amount,
            checkedAt: real.checkedAt,
            budgetLineId: l.id,
          })),
        ),
        ...freeMovements.map((m) => ({ ...m, budgetLineId: null })),
      ]);
      expect(checkedBalance).toBe(3_750);
      expect((valueOf(result, 'compte-courant') ?? 0) - 5_000).toBe(
        checkedBalance,
      );
    });

    it('CA43: « Salaire » 6 000 checked with a movement of 6 000 checked: 11 000, while the budget counts 12 000', () => {
      const salaire = prevision({
        id: 'salaire',
        kind: 'income',
        amount: 6_000,
        accountId: 'compte-courant',
        checkedReals: [{ amount: 6_000, checkedAt: on(6) }],
      });

      const result = compute(JEU_D_ESSAI, withMovements([salaire]));

      expect(valueOf(result, 'compte-courant')).toBe(11_000);
      expect(
        BudgetFormulas.calculateRealizedBalance(
          [salaire],
          [
            {
              kind: 'income',
              amount: 6_000,
              checkedAt: on(6),
              budgetLineId: 'salaire',
            },
          ],
        ),
      ).toBe(12_000);
    });
  });

  describe('Modèle, lissage, suppression', () => {
    it('CA46: « Courses » 400 on Revolut checked with 120: Revolut 0; once deleted, its freed 120 keep Revolut: 280', () => {
      const before = compute(
        JEU_D_ESSAI,
        withMovements([
          courses({
            accountId: 'revolut',
            checkedReals: [{ amount: 120, checkedAt: on(6) }],
          }),
        ]),
      );
      // The delete trigger hands the freed movement the prévision's account.
      const after = compute(
        JEU_D_ESSAI,
        withMovements([], [free('revolut', 'expense', 120, on(6))]),
      );

      expect(valueOf(before, 'revolut')).toBe(0);
      expect(valueOf(after, 'revolut')).toBe(280);
    });

    it('CA24: an archived account keeps the link but checking no longer moves it', () => {
      const archived = { ...REVOLUT, archivedAt: '2026-11-04T00:00:00.000Z' };
      const result = compute(
        [COMPTE_COURANT, archived],
        withMovements([], [free('revolut', 'expense', 80)]),
      );

      expect(valueOf(result, 'revolut')).toBe(400);
      expect(result.totals).toMatchObject({ gross: 5_000, debts: 0 });
    });
  });

  describe('Payer avec une dette', () => {
    it('starts with the Carte de crédit at 200: debts 8 200, net 7 200', () => {
      expect(compute(AVEC_CARTE).totals).toMatchObject({
        debts: 8_200,
        net: 7_200,
      });
    });

    it('CA37: « Restaurant » 80 on the Carte de crédit: 280, debts 8 280, net 7 120, Compte courant 5 000', () => {
      const result = compute(
        AVEC_CARTE,
        withMovements([], [free('carte', 'expense', 80)]),
      );

      expect(valueOf(result, 'carte')).toBe(280);
      expect(valueOf(result, 'compte-courant')).toBe(5_000);
      expect(result.totals).toMatchObject({ debts: 8_280, net: 7_120 });
    });

    it('CA38: « Restaurant » unchecked: the Carte de crédit is back at 200', () => {
      const result = compute(AVEC_CARTE, withMovements([], []));

      expect(valueOf(result, 'carte')).toBe(200);
    });

    it('CA39: a Revenu of 50 on the card brings it to 150; one of 300 to 0, never below', () => {
      const fifty = compute(
        AVEC_CARTE,
        withMovements([], [free('carte', 'income', 50)]),
      );
      const threeHundred = compute(
        AVEC_CARTE,
        withMovements([], [free('carte', 'income', 300)]),
      );

      expect(valueOf(fifty, 'carte')).toBe(150);
      expect(valueOf(threeHundred, 'carte')).toBe(0);
    });

    it('CA40: « Mensualité leasing » 300 paid by card: Carte 500, Leasing 7 700, net still 7 200', () => {
      const result = compute(
        AVEC_CARTE,
        withMovements([{ ...MENSUALITE_LEASING, accountId: 'carte' }]),
      );

      expect(valueOf(result, 'carte')).toBe(500);
      expect(valueOf(result, 'leasing')).toBe(7_700);
      expect(result.totals.net).toBe(7_200);
    });

    it('CA41: after entries of 0 for the card and 4 920 for the Compte courant, the rest starts from them', () => {
      const carte = { ...CARTE, recordedValue: 0, latestRecordedAt: on(6) };
      const compteCourant = {
        ...COMPTE_COURANT,
        recordedValue: 4_920,
        latestRecordedAt: on(6),
      };

      const result = compute(
        [compteCourant, carte],
        withMovements(
          [],
          [
            // « Restaurant » 80, checked before the entries: already in them.
            free('carte', 'expense', 80, on(5)),
            free('carte', 'expense', 30, on(7)),
          ],
        ),
      );

      expect(valueOf(result, 'carte')).toBe(30);
      expect(valueOf(result, 'compte-courant')).toBe(4_920);
    });

    it('takes a debt in check order: Leasing 200, repayment 300 checked → 0, then a purchase of 100 checked afterwards → 100', () => {
      const leasing = { ...LEASING, recordedValue: 200 };
      const repayment = { ...MENSUALITE_LEASING, checkedAt: on(5) };
      const purchase = free('leasing', 'expense', 100, on(6));

      const afterRepayment = compute([leasing], withMovements([repayment]));
      const afterPurchase = compute(
        [leasing],
        withMovements([repayment], [purchase]),
      );

      expect(valueOf(afterRepayment, 'leasing')).toBe(0);
      expect(valueOf(afterPurchase, 'leasing')).toBe(100);
    });

    it('loses the neutrality when a debt touches zero: 300 from the Compte courant on a debt of 200', () => {
      const leasing = { ...LEASING, recordedValue: 200 };
      const result = compute(
        [COMPTE_COURANT, leasing],
        withMovements([{ ...MENSUALITE_LEASING, accountId: 'compte-courant' }]),
      );

      expect(valueOf(result, 'compte-courant')).toBe(4_700);
      expect(valueOf(result, 'leasing')).toBe(0);
      // Net was 4 800, it is now 4 700.
      expect(result.totals.net).toBe(4_700);
    });
  });
});

describe('movementsSince', () => {
  it('is the earliest last entry among the active assets', () => {
    expect(
      movementsSince([
        asset({ id: 'a', latestRecordedAt: on(10) }),
        asset({ id: 'b', latestRecordedAt: on(3) }),
        asset({
          id: 'old',
          latestRecordedAt: on(1),
          archivedAt: '2026-10-01T00:00:00.000Z',
        }),
      ]),
    ).toBe(on(3));
  });

  it('is null without an active asset', () => {
    expect(
      movementsSince([
        asset({ id: 'old', archivedAt: '2026-10-01T00:00:00.000Z' }),
      ]),
    ).toBeNull();
  });
});

// The server writes the default account on create (accountIdForCreate); these
// are the movements it leaves behind, read back by the value.
describe('computeNetWorth: movements created with a default account (PUL-378)', () => {
  it('CA36: Compte courant by default, « Loyer » 1 500, « Restaurant » 80 and « Salaire » 6 000 checked: 9 420', () => {
    const result = compute(
      JEU_D_ESSAI,
      withMovements(
        [
          prevision({
            id: 'loyer',
            kind: 'expense',
            amount: 1_500,
            accountId: 'compte-courant',
          }),
          prevision({
            id: 'salaire',
            kind: 'income',
            amount: 6_000,
            accountId: 'compte-courant',
          }),
        ],
        [free('compte-courant', 'expense', 80)],
      ),
    );

    expect(valueOf(result, 'compte-courant')).toBe(9_420);
  });

  it('CA45: Livret by default, the Épargne 500 « Versée sur » Livret kept without account: Livret 10 500 once checked', () => {
    const result = compute(JEU_D_ESSAI, withMovements([EPARGNE_MENSUELLE]));

    expect(valueOf(result, 'livret')).toBe(10_500);
    expect(valueOf(result, 'compte-courant')).toBe(5_000);
  });
});

// PUL-379 jeu d'essai: the Compte courant, entries of 4 800 on 1 October and
// 5 000 on 1 November; « Assurance » 300 checked between them; « Loyer »
// 1 500, the imprévu « Restaurant » 80 and « Salaire » 6 000 checked since.
const OCT_1 = '2026-10-01T08:00:00.000Z';
const OCT_28 = '2026-10-28T10:00:00.000Z';
const NOV_1 = '2026-11-01T08:00:00.000Z';
const SAISIE_OCT = { id: 'saisie-oct', value: 4_800, recordedAt: OCT_1 };
const SAISIE_NOV = { id: 'saisie-nov', value: 5_000, recordedAt: NOV_1 };
const COURANT = asset({
  id: 'compte-courant',
  name: 'Compte courant',
  recordedValue: 5_000,
  latestRecordedAt: NOV_1,
});

function onCourant(
  name: string,
  kind: TransactionKind,
  amount: number,
  checkedAt: string,
): MovementLine {
  return prevision({
    id: name,
    name,
    kind,
    amount,
    checkedAt,
    accountId: 'compte-courant',
  });
}

function named(
  name: string,
  accountId: string,
  kind: TransactionKind,
  amount: number,
  checkedAt: string,
): FreeMovement {
  return { ...free(accountId, kind, amount, checkedAt), id: name, name };
}

const ASSURANCE = onCourant('Assurance', 'expense', 300, OCT_28);
const LOYER = onCourant('Loyer', 'expense', 1_500, on(3));
const RESTAURANT = named('Restaurant', 'compte-courant', 'expense', 80, on(5));
const SALAIRE = onCourant('Salaire', 'income', 6_000, on(10));
const CONTRACT_MOVEMENTS: AssetMovements = {
  lines: [ASSURANCE, LOYER, SALAIRE],
  freeMovements: [RESTAURANT],
};

function historyOf(
  movements: AssetMovements = CONTRACT_MOVEMENTS,
  snapshots: AssetSnapshot[] = [SAISIE_OCT, SAISIE_NOV],
  account: AssetWithValue = COURANT,
  rate: number | undefined = 1,
) {
  return assetHistory(account, snapshots, movements, rate);
}

function valueNow(account: AssetWithValue, movements: AssetMovements) {
  return valueOf(compute([account], { movements }), account.id);
}

function label(entry: AssetHistoryEntry) {
  return entry.type === 'snapshot' ? `saisie ${entry.value}` : entry.name;
}

function movementsOf(entries: AssetHistoryEntry[]) {
  return entries.filter((entry) => entry.type === 'movement');
}

/** Sum of the effects still counted in the value, in cents (CA5). */
function openSumCents(entries: AssetHistoryEntry[]) {
  return movementsOf(entries)
    .filter((entry) => entry.supersededAt === null)
    .reduce((sum, entry) => sum + Math.round((entry.effect ?? 0) * 100), 0);
}

describe('assetHistory: the history follows the rule of the value (PUL-379)', () => {
  it('values the Compte courant at 9 420', () => {
    expect(valueNow(COURANT, CONTRACT_MOVEMENTS)).toBe(9_420);
  });

  it('CA3: one list, newest first, entries and movements mixed', () => {
    expect(historyOf().map(label)).toEqual([
      'Salaire',
      'Restaurant',
      'Loyer',
      'saisie 5000',
      'Assurance',
      'saisie 4800',
    ]);
  });

  it('CA4: each movement shows its name, check date and signed effect; each entry its value and date', () => {
    expect(historyOf()).toEqual([
      expect.objectContaining({ name: 'Salaire', at: on(10), effect: 6_000 }),
      expect.objectContaining({ name: 'Restaurant', at: on(5), effect: -80 }),
      expect.objectContaining({ name: 'Loyer', at: on(3), effect: -1_500 }),
      { type: 'snapshot', id: 'saisie-nov', at: NOV_1, value: 5_000 },
      expect.objectContaining({ name: 'Assurance', at: OCT_28, effect: -300 }),
      { type: 'snapshot', id: 'saisie-oct', at: OCT_1, value: 4_800 },
    ]);
  });

  it('CA5: the effects above the last entry add up to the value minus that entry (+4 420)', () => {
    expect(openSumCents(historyOf())).toBe(442_000);
    expect(openSumCents(historyOf())).toBe(
      ((valueNow(COURANT, CONTRACT_MOVEMENTS) ?? 0) - 5_000) * 100,
    );
  });

  it('CA5 invariant: rounding, a debt touching zero and a foreign currency keep the sum equal to value minus entry', () => {
    const scenarios: [AssetWithValue, AssetMovements, number][] = [
      [
        { ...COURANT, currency: 'EUR' },
        {
          lines: [
            onCourant('a', 'expense', 33.33, on(3)),
            onCourant('b', 'income', 0.07, on(4)),
          ],
          freeMovements: [
            named('c', 'compte-courant', 'expense', 10.01, on(5)),
          ],
        },
        0.93,
      ],
      [
        { ...COURANT, direction: 'owe', recordedValue: 200 },
        {
          lines: [onCourant('remboursement', 'income', 300, on(3))],
          freeMovements: [
            named('achat', 'compte-courant', 'expense', 100, on(4)),
            named('revenu', 'compte-courant', 'income', 40, on(6)),
          ],
        },
        1,
      ],
    ];

    for (const [account, movements, rate] of scenarios) {
      const value = compute([account], {
        movements,
        rates: { EUR: rate },
      }).assets[0]?.value;
      const entries = assetHistory(
        account,
        [SAISIE_OCT, { ...SAISIE_NOV, value: account.recordedValue }],
        movements,
        rate,
      );

      expect(openSumCents(entries)).toBe(
        Math.round(((value ?? 0) - account.recordedValue) * 100),
      );
    }
  });

  it('CA6: « Assurance », below the 1 November entry, no longer counts: that entry takes over', () => {
    const entries = movementsOf(historyOf());

    expect(
      entries.map((entry) => [
        entry.type === 'movement' && entry.name,
        entry.type === 'movement' && entry.supersededAt,
      ]),
    ).toEqual([
      ['Salaire', null],
      ['Restaurant', null],
      ['Loyer', null],
      ['Assurance', NOV_1],
    ]);
  });

  it('CA7: the history goes back to the first entry, and nothing checked before it shows', () => {
    const before = onCourant(
      'Avant',
      'expense',
      50,
      '2026-09-20T10:00:00.000Z',
    );
    const entries = historyOf({
      ...CONTRACT_MOVEMENTS,
      lines: [...CONTRACT_MOVEMENTS.lines, before],
    });

    expect(entries.at(-1)).toEqual({
      type: 'snapshot',
      id: 'saisie-oct',
      at: OCT_1,
      value: 4_800,
    });
    expect(entries.map(label)).not.toContain('Avant');
  });

  it('CA8: « Restaurant » unchecked leaves the history and the value is 9 500', () => {
    const movements = { ...CONTRACT_MOVEMENTS, freeMovements: [] };

    expect(historyOf(movements).map(label)).not.toContain('Restaurant');
    expect(valueNow(COURANT, movements)).toBe(9_500);
  });

  it('CA9: an entry of 9 000 goes on top, the value is 9 000 and the movements stay under it', () => {
    const NOV_12 = on(12);
    const courant = {
      ...COURANT,
      recordedValue: 9_000,
      latestRecordedAt: NOV_12,
    };
    const entries = historyOf(
      CONTRACT_MOVEMENTS,
      [
        SAISIE_OCT,
        SAISIE_NOV,
        { id: 'saisie-9000', value: 9_000, recordedAt: NOV_12 },
      ],
      courant,
    );

    expect(entries[0]).toEqual({
      type: 'snapshot',
      id: 'saisie-9000',
      at: NOV_12,
      value: 9_000,
    });
    expect(valueNow(courant, CONTRACT_MOVEMENTS)).toBe(9_000);
    expect(
      entries
        .slice(1, 4)
        .map((entry) => [
          label(entry),
          entry.type === 'movement' && entry.supersededAt,
        ]),
    ).toEqual([
      ['Salaire', NOV_12],
      ['Restaurant', NOV_12],
      ['Loyer', NOV_12],
    ]);
    expect(openSumCents(entries)).toBe(0);
  });

  it('CA10: the Livret holds its single entry of 10 000 and nothing else', () => {
    const livret = asset({
      id: 'livret',
      recordedValue: 10_000,
      latestRecordedAt: NOV_1,
    });

    expect(
      historyOf(CONTRACT_MOVEMENTS, [{ ...SAISIE_NOV, value: 10_000 }], livret),
    ).toEqual([
      { type: 'snapshot', id: 'saisie-nov', at: NOV_1, value: 10_000 },
    ]);
  });

  describe('CA13: what moves a debt or an asset, signed', () => {
    const DETTE = asset({
      id: 'dette',
      direction: 'owe',
      recordedValue: 200,
      latestRecordedAt: NOV_1,
    });
    const effects = (account: AssetWithValue, movements: AssetMovements) =>
      historyOf(
        movements,
        [{ ...SAISIE_NOV, value: account.recordedValue }],
        account,
      )
        .filter((entry) => entry.type === 'movement')
        .map((entry) => [entry.name, entry.effect]);

    it('a debt of 200: a repayment of 300 shows −200, a purchase of 100 checked afterwards +100', () => {
      const movements = {
        lines: [
          prevision({
            id: 'remboursement',
            name: 'Remboursement',
            kind: 'expense',
            amount: 300,
            checkedAt: on(3),
            assetId: 'dette',
          }),
        ],
        freeMovements: [named('Achat', 'dette', 'expense', 100, on(4))],
      };

      expect(effects(DETTE, movements)).toEqual([
        ['Achat', 100],
        ['Remboursement', -200],
      ]);
      expect(valueNow(DETTE, movements)).toBe(100);
    });

    it('a debt: a saving paid with it is positive, a Revenu on it negative, a repayment bounded by zero, a purchase after it positive', () => {
      const movements = {
        lines: [
          prevision({
            id: 'epargne',
            name: 'Épargne',
            kind: 'saving',
            amount: 50,
            checkedAt: on(3),
            accountId: 'dette',
          }),
          prevision({
            id: 'remboursement',
            name: 'Remboursement',
            kind: 'expense',
            amount: 500,
            checkedAt: on(5),
            assetId: 'dette',
          }),
        ],
        freeMovements: [
          named('Revenu', 'dette', 'income', 30, on(4)),
          named('Achat', 'dette', 'expense', 10, on(6)),
        ],
      };

      expect(effects(DETTE, movements)).toEqual([
        ['Achat', 10],
        ['Remboursement', -220],
        ['Revenu', -30],
        ['Épargne', 50],
      ]);
    });

    it('a debt at 0: a further repayment is listed with an effect of 0', () => {
      const zero = { ...DETTE, recordedValue: 0 };
      const movements = {
        lines: [],
        freeMovements: [named('Remboursement', 'dette', 'income', 100, on(3))],
      };

      expect(effects(zero, movements)).toEqual([['Remboursement', 0]]);
    });

    it('an asset: a saving that feeds it is positive, a Revenu drawn from it negative', () => {
      const livret = asset({
        id: 'livret',
        recordedValue: 10_000,
        latestRecordedAt: NOV_1,
      });
      const movements = {
        lines: [
          prevision({
            id: 'epargne',
            name: 'Épargne',
            kind: 'saving',
            amount: 500,
            checkedAt: on(3),
            assetId: 'livret',
          }),
          prevision({
            id: 'retrait',
            name: 'Retrait',
            kind: 'income',
            amount: 1_000,
            checkedAt: on(4),
            assetId: 'livret',
          }),
        ],
        freeMovements: [],
      };

      expect(effects(livret, movements)).toEqual([
        ['Retrait', -1_000],
        ['Épargne', 500],
      ]);
    });
  });

  it("CA14: a EUR account shows each effect in euros at today's rate, and none without a rate", () => {
    const courantEur = { ...COURANT, currency: 'EUR' as const };
    const restaurant = { lines: [], freeMovements: [RESTAURANT] };

    // 80 CHF / 0.8 = 100 EUR.
    expect(
      historyOf(restaurant, [SAISIE_OCT, SAISIE_NOV], courantEur, 0.8)[0],
    ).toMatchObject({ name: 'Restaurant', effect: -100 });
    expect(
      assetHistory(
        courantEur,
        [SAISIE_OCT, SAISIE_NOV],
        restaurant,
        undefined,
      )[0],
    ).toMatchObject({ name: 'Restaurant', effect: null });
  });

  it('CA19: a prévision that moved several times in one period shows once, at its last check, with the total', () => {
    const courses = prevision({
      id: 'courses',
      name: 'Courses',
      kind: 'expense',
      amount: 400,
      checkedAt: on(6),
      accountId: 'compte-courant',
      checkedReals: [
        { amount: 120, checkedAt: on(2) },
        { amount: 300, checkedAt: on(4) },
      ],
    });

    expect(historyOf({ lines: [courses], freeMovements: [] })[0]).toEqual({
      type: 'movement',
      id: 'courses',
      at: on(4),
      name: 'Courses',
      effect: -420,
      supersededAt: null,
    });
  });

  it('CA19: « Courses » shows −120 under the 1 November entry and −280 above it, dated 4 November; value 9 140', () => {
    const courses = prevision({
      id: 'courses',
      name: 'Courses',
      kind: 'expense',
      amount: 400,
      checkedAt: on(4),
      accountId: 'compte-courant',
      checkedReals: [{ amount: 120, checkedAt: '2026-10-28T12:00:00.000Z' }],
    });
    const movements = {
      ...CONTRACT_MOVEMENTS,
      lines: [...CONTRACT_MOVEMENTS.lines, courses],
    };
    const entries = historyOf(movements);

    expect(
      movementsOf(entries)
        .filter(
          (entry) => entry.type === 'movement' && entry.name === 'Courses',
        )
        .map(
          (entry) =>
            entry.type === 'movement' && [
              entry.at,
              entry.effect,
              entry.supersededAt,
            ],
        ),
    ).toEqual([
      [on(4), -280, null],
      ['2026-10-28T12:00:00.000Z', -120, NOV_1],
    ]);
    expect(valueNow(COURANT, movements)).toBe(9_140);
    expect(openSumCents(entries)).toBe(414_000);
  });
});

describe('monthEndValue: the value once the month is all checked (PUL-380)', () => {
  const ENTRY = '2026-11-01T08:00:00.000Z';
  const day = (n: number) =>
    `2026-11-${String(n).padStart(2, '0')}T10:00:00.000Z`;
  const CC = asset({ id: 'cc', name: 'Compte courant', recordedValue: 5_000 });

  function prevision(
    name: string,
    kind: TransactionKind,
    amount: number,
    overrides: Partial<MonthLine> = {},
  ): MonthLine & { name: string } {
    return {
      name,
      kind,
      amount,
      checkedAt: null,
      accountId: 'cc',
      assetId: null,
      reals: [],
      ...overrides,
    };
  }

  /** 1 200 of Dépenses checked since the entry of 5 000: the Compte courant is worth 3 800. */
  const DEPENSES = {
    kind: 'expense' as const,
    amount: 1_200,
    accountId: 'cc',
    checkedAt: day(5),
  };
  const loyer = (overrides: Partial<MonthLine> = {}) =>
    prevision('Loyer', 'expense', 1_500, overrides);
  const assurance = (amount = 300) => prevision('Assurance', 'expense', amount);
  const salaire = (overrides: Partial<MonthLine> = {}) =>
    prevision('Salaire', 'income', 6_000, overrides);
  const contract = (lines = [loyer(), assurance(), salaire()]) => ({
    lines,
    freeMovements: [DEPENSES],
  });

  /**
   * The asset valued from the month as `GET /v1/assets` does, and its
   * projection: `{ value, projection }`.
   */
  function project(
    account: AssetWithValue,
    month: MonthMovements,
    /** `null`: no rate could be obtained. */
    rate: number | null = 1,
  ) {
    const movements: AssetMovements = {
      lines: month.lines.map((line, i) => ({
        id: `line-${i}`,
        name: `line-${i}`,
        ...line,
        checkedReals: line.reals.flatMap((real) =>
          real.checkedAt === null
            ? []
            : [{ amount: real.amount, checkedAt: real.checkedAt }],
        ),
      })),
      freeMovements: month.freeMovements.flatMap((movement, i) =>
        movement.checkedAt === null
          ? []
          : [
              {
                id: `free-${i}`,
                name: `free-${i}`,
                ...movement,
                checkedAt: movement.checkedAt,
              },
            ],
      ),
    };
    const [valued] = computeNetWorth({
      baseCurrency: 'CHF',
      categories: [],
      assets: [{ ...account, latestRecordedAt: ENTRY }],
      rates: rate === null ? {} : { [account.currency]: rate },
      movements,
    }).assets;
    return {
      value: valued!.value,
      projection: monthEndValue(
        valued!,
        month,
        account.currency === 'CHF' ? 1 : (rate ?? undefined),
      ),
    };
  }

  it('CA1: the Compte courant at 3 800 ends November at 8 000', () => {
    expect(project(CC, contract())).toEqual({
      value: 3_800,
      projection: 8_000,
    });
  });

  it('CA2: checking Loyer moves the value to 2 300, the projection stays 8 000', () => {
    expect(
      project(
        CC,
        contract([loyer({ checkedAt: day(12) }), assurance(), salaire()]),
      ),
    ).toEqual({ value: 2_300, projection: 8_000 });
  });

  it('CA2 invariant: once everything is checked, the value is the projection of before', () => {
    const all = contract(
      [loyer(), assurance(), salaire()].map((line) => ({
        ...line,
        checkedAt: day(20),
      })),
    );

    expect(project(CC, all)).toEqual({ value: 8_000, projection: null });
  });

  it('CA3: Assurance at 400 moves the projection to 7 900, not the value', () => {
    expect(project(CC, contract([loyer(), assurance(400), salaire()]))).toEqual(
      { value: 3_800, projection: 7_900 },
    );
  });

  it('CA4: only the month it is given counts, Impôts of December goes to December', () => {
    const impots = prevision('Impôts', 'expense', 2_000);

    expect(project(CC, contract()).projection).toBe(8_000);
    expect(project(CC, { lines: [impots], freeMovements: [DEPENSES] })).toEqual(
      {
        value: 3_800,
        projection: 1_800,
      },
    );
  });

  const courses = (overrides: Partial<MonthLine> = {}) =>
    prevision('Courses', 'expense', 400, {
      reals: [
        { amount: 100, checkedAt: day(3) },
        { amount: 350, checkedAt: null },
      ],
      ...overrides,
    });
  const ENTRY_3_800 = asset({ id: 'cc', recordedValue: 3_800 });

  it('CA5: Courses 400 with 450 of movements, 100 checked, counts for 450: 350 still to come', () => {
    expect(
      project(ENTRY_3_800, { lines: [courses()], freeMovements: [] }),
    ).toEqual({ value: 3_700, projection: 3_350 });
  });

  it('CA6: nothing left to come, no projection', () => {
    const checked = courses({
      checkedAt: day(10),
      reals: [{ amount: 450, checkedAt: day(3) }],
    });

    expect(
      project(ENTRY_3_800, { lines: [checked], freeMovements: [] }),
    ).toEqual({ value: 3_350, projection: null });
  });

  it('CA6: a prévision of 400 checked with a movement of 450 not checked leaves 50 to come', () => {
    const checked = courses({
      checkedAt: day(10),
      reals: [{ amount: 450, checkedAt: null }],
    });

    expect(
      project(ENTRY_3_800, { lines: [checked], freeMovements: [] }),
    ).toEqual({ value: 3_400, projection: 3_350 });
  });

  const PHARMACIE = {
    kind: 'expense' as const,
    amount: 40,
    accountId: 'cc',
    checkedAt: null,
  };

  it('CA7: nothing planned nor typed this month, no projection', () => {
    expect(
      project(ENTRY_3_800, { lines: [], freeMovements: [] }).projection,
    ).toBeNull();
  });

  it('CA9, CA7: Pharmacie 40 typed and not checked takes 40 off, and is enough to show it', () => {
    expect(
      project(ENTRY_3_800, { lines: [], freeMovements: [PHARMACIE] }),
    ).toEqual({ value: 3_800, projection: 3_760 });
  });

  it('CA10: an entry of 4 900 after 100 checked on Courses does not count them twice', () => {
    const entry = asset({ id: 'cc', recordedValue: 4_900 });
    const month = {
      lines: [
        courses({
          reals: [
            { amount: 100, checkedAt: '2026-10-31T10:00:00.000Z' },
            { amount: 350, checkedAt: null },
          ],
        }),
      ],
      freeMovements: [],
    };

    expect(project(entry, month)).toEqual({ value: 4_900, projection: 4_550 });
  });

  describe('a debt and the two links', () => {
    const CARTE = asset({ id: 'carte', direction: 'owe', recordedValue: 200 });
    const remboursement = prevision('Remboursement', 'expense', 300, {
      accountId: 'cc',
      assetId: 'carte',
    });
    const RESTAURANT = {
      kind: 'expense' as const,
      amount: 80,
      accountId: 'carte',
      checkedAt: null,
    };

    it('floors the result of a debt at zero: 200 − 300 + 80 = 0', () => {
      expect(
        project(CARTE, { lines: [remboursement], freeMovements: [RESTAURANT] })
          .projection,
      ).toBe(0);
    });

    it('a Restaurant 80 paid with the card raises it to 280', () => {
      expect(
        project(CARTE, { lines: [], freeMovements: [RESTAURANT] }).projection,
      ).toBe(280);
    });

    it('an Épargne 500 from the Compte courant to the Livret moves both', () => {
      const epargne = prevision('Épargne', 'saving', 500, {
        accountId: 'cc',
        assetId: 'livret',
      });
      const month = { lines: [epargne], freeMovements: [] };

      expect(project(ENTRY_3_800, month).projection).toBe(3_300);
      expect(
        project(asset({ id: 'livret', recordedValue: 10_000 }), month)
          .projection,
      ).toBe(10_500);
    });
  });

  it("converts each rest at today's rate: 95 CHF to come on 1 000 EUR at 0.95 gives 900 EUR", () => {
    const eur = asset({ id: 'cc', currency: 'EUR', recordedValue: 1_000 });
    const month = {
      lines: [prevision('Dépense', 'expense', 95)],
      freeMovements: [],
    };

    expect(project(eur, month, 0.95)).toEqual({
      value: 1_000,
      projection: 900,
    });
  });

  it('has no projection without a rate', () => {
    const eur = asset({ id: 'cc', currency: 'EUR', recordedValue: 1_000 });

    expect(
      project(eur, { lines: [], freeMovements: [PHARMACIE] }, null).projection,
    ).toBeNull();
  });

  it('has no projection for an archived asset', () => {
    const archived = asset({
      id: 'cc',
      recordedValue: 3_800,
      archivedAt: '2026-11-10T00:00:00.000Z',
    });

    expect(
      project(archived, { lines: [], freeMovements: [PHARMACIE] }).projection,
    ).toBeNull();
  });
});
