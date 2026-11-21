import { describe, expect, it } from 'vitest';
import {
  isEmptyPlan,
  planAccountLinks,
  type AccountLinkRow,
} from './reconcile-account-links';

const BCGE = 'bcge';
const REVOLUT = 'revolut';

const asset = (id: string, amountText = ''): AccountLinkRow => ({
  account: { kind: 'asset', id },
  amountText,
  side: 'own',
});
const free = (amountText: string): AccountLinkRow => ({
  account: { kind: 'free' },
  amountText,
  side: 'own',
});

describe('planAccountLinks', () => {
  it('should only snapshot a followed account that got a balance', () => {
    expect(planAccountLinks([asset(BCGE, '229016')], [BCGE])).toEqual({
      links: [],
      unlinks: [],
      snapshots: [{ assetId: BCGE, value: 229016 }],
    });
  });

  it('should link and snapshot an account picked for the first time', () => {
    const plan = planAccountLinks(
      [asset(BCGE, '100'), asset(REVOLUT, '6789.50')],
      [BCGE],
    );

    expect(plan.links).toEqual([REVOLUT]);
    expect(plan.unlinks).toEqual([]);
    expect(plan.snapshots).toEqual([
      { assetId: BCGE, value: 100 },
      { assetId: REVOLUT, value: 6789.5 },
    ]);
  });

  it('should unlink exactly once a followed account whose row is gone', () => {
    const plan = planAccountLinks([free('50')], [BCGE]);

    expect(plan.unlinks).toEqual([BCGE]);
    expect(plan.snapshots).toEqual([]);
  });

  it('should keep following an account left without a balance', () => {
    expect(isEmptyPlan(planAccountLinks([asset(BCGE)], [BCGE]))).toBe(true);
  });

  it('should snapshot a debt as the magnitude owed, whatever sign was typed', () => {
    const debt = (amountText: string): AccountLinkRow => ({
      account: { kind: 'asset', id: BCGE },
      amountText,
      side: 'owe',
    });

    expect(planAccountLinks([debt('-800')], [BCGE]).snapshots).toEqual([
      { assetId: BCGE, value: 800 },
    ]);
    expect(planAccountLinks([debt('800')], [BCGE]).snapshots).toEqual([
      { assetId: BCGE, value: 800 },
    ]);
  });

  it('should write nothing for a free row, whatever it holds', () => {
    expect(isEmptyPlan(planAccountLinks([free('50')], []))).toBe(true);
  });

  it('should never emit two snapshots for one account', () => {
    const plan = planAccountLinks([asset(BCGE, '10'), asset(BCGE, '20')], []);

    expect(plan.snapshots).toEqual([{ assetId: BCGE, value: 10 }]);
    expect(plan.links).toEqual([BCGE]);
  });
});
