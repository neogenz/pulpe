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
  label: id,
  amountText,
});
const other = (
  label: string,
  amountText: string,
  addToNetWorth = false,
): AccountLinkRow => ({
  account: { kind: 'other', addToNetWorth },
  label,
  amountText,
});

describe('planAccountLinks', () => {
  it('should only snapshot a followed account that got a balance', () => {
    expect(planAccountLinks([asset(BCGE, '229016')], [BCGE])).toEqual({
      creates: [],
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
    const plan = planAccountLinks([other('', '50')], [BCGE]);

    expect(plan.unlinks).toEqual([BCGE]);
    expect(plan.snapshots).toEqual([]);
  });

  it('should keep following an account left without a balance', () => {
    expect(isEmptyPlan(planAccountLinks([asset(BCGE)], [BCGE]))).toBe(true);
  });

  it('should create a ticked free row and never snapshot it', () => {
    const plan = planAccountLinks([other(' Neon ', '300', true)], []);

    expect(plan.creates).toEqual([{ name: 'Neon', value: 300 }]);
    expect(plan.snapshots).toEqual([]);
  });

  it('should write nothing for a free row left private', () => {
    expect(isEmptyPlan(planAccountLinks([other('Cash', '50')], []))).toBe(true);
  });

  it('should skip a ticked row with no name or no readable balance', () => {
    const plan = planAccountLinks(
      [other('', '300', true), other('Neon', '', true)],
      [],
    );

    expect(plan.creates).toEqual([]);
  });

  it('should never emit two snapshots for one account', () => {
    const plan = planAccountLinks([asset(BCGE, '10'), asset(BCGE, '20')], []);

    expect(plan.snapshots).toEqual([{ assetId: BCGE, value: 10 }]);
    expect(plan.links).toEqual([BCGE]);
  });
});
