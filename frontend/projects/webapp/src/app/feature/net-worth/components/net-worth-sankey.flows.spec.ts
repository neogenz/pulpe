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

describe('buildNetWorthSankey', () => {
  it('flows assets into their category, then gross, then net and debts', () => {
    const { flows, nodes } = buildNetWorthSankey(
      netWorth(
        [
          asset({ id: 'a', name: 'UBS', convertedValue: 900 }),
          asset({ id: 'b', name: 'Cash', convertedValue: 100 }),
          asset({
            id: 'c',
            name: 'Leasing',
            direction: 'owe',
            convertedValue: 300,
          }),
        ],
        { gross: 1000, debts: 300, net: 700 },
      ),
    );

    expect(flows).toEqual([
      { from: 'asset:a', to: `category:${CHECKING}`, flow: 900 },
      { from: 'asset:b', to: `category:${CHECKING}`, flow: 100 },
      { from: 'gross', to: 'debt:c', flow: 300 },
      { from: `category:${CHECKING}`, to: 'gross', flow: 1000 },
      { from: 'gross', to: 'net', flow: 700 },
    ]);
    expect(nodes['debt:c']).toEqual({
      kind: 'debt',
      name: 'Leasing',
      value: 300,
    });
    expect(nodes['net']).toEqual({ kind: 'net', name: null, value: 700 });
  });

  it('drops the net node and scales debts to gross when debts exceed it', () => {
    const { flows, nodes } = buildNetWorthSankey(
      netWorth(
        [
          asset({ id: 'a', name: 'UBS', convertedValue: 1000 }),
          asset({
            id: 'c',
            name: 'Prêt',
            direction: 'owe',
            convertedValue: 3000,
          }),
        ],
        { gross: 1000, debts: 3000, net: -2000 },
      ),
    );

    expect(nodes['net']).toBeUndefined();
    expect(flows).toContainEqual({ from: 'gross', to: 'debt:c', flow: 1000 });
    expect(nodes['debt:c']?.value).toBe(3000);
  });

  it('sends an overdrawn own asset to the debts side, out of its category', () => {
    const { flows, nodes } = buildNetWorthSankey(
      netWorth(
        [
          asset({ id: 'a', name: 'UBS', convertedValue: 1000 }),
          asset({ id: 'o', name: 'Compte courant', convertedValue: -300 }),
        ],
        { gross: 1000, debts: 300, net: 700 },
      ),
    );

    expect(flows).not.toContainEqual(
      expect.objectContaining({ from: 'asset:o' }),
    );
    expect(flows).toContainEqual({ from: 'gross', to: 'debt:o', flow: 300 });
    expect(nodes['debt:o']?.kind).toBe('debt');
  });

  it('skips archived and unconverted assets, and categories left empty', () => {
    const { flows, nodes } = buildNetWorthSankey(
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
            id: 'e',
            name: 'Livret EUR',
            currency: 'EUR',
            convertedValue: null,
          }),
        ],
        { gross: 500, debts: 0, net: 500 },
        [
          { id: CHECKING, name: 'Comptes', total: 500 },
          { id: SAVINGS, name: 'Épargne', total: 0 },
        ],
      ),
    );

    expect(Object.keys(nodes).sort()).toEqual(
      ['asset:a', `category:${CHECKING}`, 'gross', 'net'].sort(),
    );
    expect(flows).toHaveLength(3);
  });

  it('returns an empty diagram when there is no gross', () => {
    const { flows, nodes } = buildNetWorthSankey(
      netWorth([], { gross: 0, debts: 0, net: 0 }, []),
    );

    expect(flows).toEqual([]);
    expect(nodes).toEqual({});
  });
});
