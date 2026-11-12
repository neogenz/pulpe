import { describe, expect, it } from 'vitest';
import type { Asset, NetWorth } from 'pulpe-shared';
import { buildNetWorthSankey } from './net-worth-sankey.flows';

const CHECKING = '11111111-1111-4111-8111-111111111111';
const SAVINGS = '22222222-2222-4222-8222-222222222222';

function asset(overrides: Partial<Asset> & Pick<Asset, 'id' | 'name'>): Asset {
  return {
    categoryId: CHECKING,
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

function netWorth(
  assets: Asset[],
  totals: Pick<NetWorth['totals'], 'gross' | 'debts' | 'net'>,
  categories: NetWorth['categories'] = [
    { id: CHECKING, name: 'Comptes', total: totals.gross },
  ],
): NetWorth {
  return {
    totals: { baseCurrency: 'CHF', incomplete: false, ...totals },
    categories,
    assets,
  };
}

const LOANS = '33333333-3333-4333-8333-333333333333';

describe('buildNetWorthSankey', () => {
  it('flows each Type into gross, then gross into net and the debt Types', () => {
    const { flows, nodes } = buildNetWorthSankey(
      netWorth(
        [
          asset({ id: 'a', name: 'UBS', convertedValue: 900 }),
          asset({ id: 'b', name: 'Cash', convertedValue: 100 }),
          asset({
            id: 'c',
            name: 'Leasing auto',
            categoryId: LOANS,
            direction: 'owe',
            convertedValue: 200,
          }),
          asset({
            id: 'd',
            name: 'Prêt Paul',
            categoryId: LOANS,
            direction: 'owe',
            convertedValue: 100,
          }),
        ],
        { gross: 1000, debts: 300, net: 700 },
        [
          { id: CHECKING, name: 'Comptes', total: 1000 },
          { id: LOANS, name: 'Crédit', total: 0 },
        ],
      ),
    );

    expect(flows).toEqual([
      { from: `category:${CHECKING}`, to: 'gross', flow: 1000 },
      { from: 'gross', to: `debt:${LOANS}`, flow: 300 },
      { from: 'gross', to: 'net', flow: 700 },
    ]);
    expect(nodes[`debt:${LOANS}`]).toEqual({
      kind: 'debt',
      name: 'Crédit',
      value: 300,
    });
    expect(nodes['net']).toEqual({ kind: 'net', name: null, value: 700 });
  });

  it('keeps one left node per Type however many elements there are', () => {
    const types = [CHECKING, SAVINGS, LOANS];
    const assets = Array.from({ length: 30 }, (_, index) =>
      asset({
        id: `a${index}`,
        name: `Élément ${index}`,
        categoryId: types[index % 3],
        convertedValue: 100,
      }),
    );
    const { nodes } = buildNetWorthSankey(
      netWorth(
        assets,
        { gross: 3000, debts: 0, net: 3000 },
        types.map((id, index) => ({ id, name: `Type ${index}`, total: 1000 })),
      ),
    );

    expect(
      Object.values(nodes).filter((node) => node.kind === 'category'),
    ).toHaveLength(3);
  });

  it('draws nothing when a single Type and no debt leave nothing to split', () => {
    const { flows, nodes } = buildNetWorthSankey(
      netWorth(
        [
          asset({ id: 'a', name: 'UBS', convertedValue: 900 }),
          asset({ id: 'b', name: 'Cash', convertedValue: 100 }),
        ],
        { gross: 1000, debts: 0, net: 1000 },
      ),
    );

    expect(flows).toEqual([]);
    expect(nodes).toEqual({});
  });

  it('covers debts beyond gross with a shortfall node beside gross', () => {
    const { flows, nodes, columns, priorities } = buildNetWorthSankey(
      netWorth(
        [
          asset({ id: 'a', name: 'UBS', convertedValue: 1000 }),
          asset({
            id: 'c',
            name: 'Prêt',
            categoryId: LOANS,
            direction: 'owe',
            convertedValue: 3000,
          }),
          asset({
            id: 'd',
            name: 'Leasing',
            categoryId: SAVINGS,
            direction: 'owe',
            convertedValue: 1000,
          }),
        ],
        { gross: 1000, debts: 4000, net: -3000 },
        [
          { id: CHECKING, name: 'Comptes', total: 1000 },
          { id: LOANS, name: 'Crédit', total: 0 },
          { id: SAVINGS, name: 'Leasing', total: 0 },
        ],
      ),
    );

    // Each debt Type is drawn at its real size: gross covers a quarter of it.
    expect(flows).toContainEqual({
      from: 'gross',
      to: `debt:${LOANS}`,
      flow: 750,
    });
    expect(flows).toContainEqual({
      from: 'net',
      to: `debt:${LOANS}`,
      flow: 2250,
    });
    expect(flows).toContainEqual({
      from: 'gross',
      to: `debt:${SAVINGS}`,
      flow: 250,
    });
    expect(nodes['net']).toEqual({
      kind: 'shortfall',
      name: null,
      value: 3000,
    });
    expect(columns).toEqual({ net: 1 });
    // Under gross, so the main flow stays on top.
    expect(priorities).toEqual({ gross: 0, net: 1 });
  });

  it('gathers the overdrawn accounts in one node on the debts side', () => {
    const { flows, nodes } = buildNetWorthSankey(
      netWorth(
        [
          asset({ id: 'a', name: 'UBS', convertedValue: 1000 }),
          asset({
            id: 'o',
            name: 'Compte courant',
            latestValue: -300,
            convertedValue: -300,
          }),
        ],
        { gross: 1000, debts: 300, net: 700 },
      ),
    );

    expect(flows).toContainEqual({
      from: 'gross',
      to: 'debt:overdrafts',
      flow: 300,
    });
    expect(nodes['debt:overdrafts']).toEqual({
      kind: 'overdrafts',
      name: null,
      value: 300,
    });
  });

  it('skips archived and unconverted assets, and Types left empty', () => {
    const { nodes } = buildNetWorthSankey(
      netWorth(
        [
          asset({ id: 'a', name: 'UBS', convertedValue: 500 }),
          asset({
            id: 'x',
            name: 'Ancien',
            categoryId: SAVINGS,
            convertedValue: 200,
            archivedAt: '2026-10-01T00:00:00.000Z',
          }),
          asset({
            id: 'c',
            name: 'Prêt',
            categoryId: LOANS,
            direction: 'owe',
            convertedValue: 100,
          }),
        ],
        { gross: 500, debts: 100, net: 400 },
        [
          { id: CHECKING, name: 'Comptes', total: 500 },
          { id: SAVINGS, name: 'Épargne', total: 0 },
          { id: LOANS, name: 'Crédit', total: 0 },
        ],
      ),
    );

    expect(Object.keys(nodes).sort()).toEqual([
      `category:${CHECKING}`,
      `debt:${LOANS}`,
      'gross',
      'net',
    ]);
  });

  it('returns an empty diagram when there is no gross', () => {
    const { flows, nodes } = buildNetWorthSankey(
      netWorth([], { gross: 0, debts: 0, net: 0 }, []),
    );

    expect(flows).toEqual([]);
    expect(nodes).toEqual({});
  });
});
