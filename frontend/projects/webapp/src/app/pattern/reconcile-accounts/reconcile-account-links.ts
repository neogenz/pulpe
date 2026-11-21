import { parseAccountAmount, type AssetSnapshotsCreate } from 'pulpe-shared';

/** One of my items of « Mon patrimoine », or a free line typed for this time. */
export type RowAccount =
  | { readonly kind: 'asset'; readonly id: string }
  | { readonly kind: 'free' };

export interface AccountLinkRow {
  readonly account: RowAccount;
  readonly amountText: string;
  readonly side: 'own' | 'owe';
}

export interface AccountLinkPlan {
  /** Accounts picked here that were not followed yet. */
  readonly links: readonly string[];
  /** Followed accounts that no row holds any more. */
  readonly unlinks: readonly string[];
  readonly snapshots: AssetSnapshotsCreate['items'];
}

export const CENTS_PER_UNIT = 100;

/**
 * What finishing a reconciliation writes to « Mon patrimoine »: the accounts
 * I finish with are the ones followed. A free row never reaches « Mon patrimoine ».
 */
export function planAccountLinks(
  rows: readonly AccountLinkRow[],
  followedIds: readonly string[],
): AccountLinkPlan {
  const picked = new Set<string>();
  const snapshots: AssetSnapshotsCreate['items'] = [];

  for (const { account, amountText, side } of rows) {
    const amount = parseAccountAmount(amountText);
    // A debt is recorded as the magnitude owed, whatever sign was typed.
    const value =
      amount.status !== 'valid'
        ? null
        : (side === 'owe' ? Math.abs(amount.cents) : amount.cents) /
          CENTS_PER_UNIT;
    if (account.kind !== 'asset' || picked.has(account.id)) continue;
    picked.add(account.id);
    if (value !== null) snapshots.push({ assetId: account.id, value });
  }

  return {
    links: [...picked].filter((id) => !followedIds.includes(id)),
    unlinks: followedIds.filter((id) => !picked.has(id)),
    snapshots,
  };
}

export function isEmptyPlan(plan: AccountLinkPlan): boolean {
  return plan.links.length + plan.unlinks.length + plan.snapshots.length === 0;
}
