import { parseAccountAmount, type AssetSnapshotsCreate } from 'pulpe-shared';

/** One of my accounts of « Mon patrimoine », or a line typed for this time. */
export type RowAccount =
  | { readonly kind: 'asset'; readonly id: string }
  | { readonly kind: 'other'; readonly addToNetWorth: boolean };

export interface AccountLinkRow {
  readonly account: RowAccount;
  readonly label: string;
  readonly amountText: string;
}

export interface AccountLinkPlan {
  readonly creates: readonly { name: string; value: number }[];
  /** Accounts picked here that were not followed yet. */
  readonly links: readonly string[];
  /** Followed accounts that no row holds any more. */
  readonly unlinks: readonly string[];
  readonly snapshots: AssetSnapshotsCreate['items'];
}

export const CENTS_PER_UNIT = 100;

/**
 * What finishing a reconciliation writes to « Mon patrimoine »: the accounts
 * I finish with are the ones followed. A created account carries its balance
 * as its first value, so it never gets a snapshot on top.
 */
export function planAccountLinks(
  rows: readonly AccountLinkRow[],
  followedIds: readonly string[],
): AccountLinkPlan {
  const picked = new Set<string>();
  const creates: { name: string; value: number }[] = [];
  const snapshots: AssetSnapshotsCreate['items'] = [];

  for (const { account, label, amountText } of rows) {
    const amount = parseAccountAmount(amountText);
    const value =
      amount.status === 'valid' ? amount.cents / CENTS_PER_UNIT : null;
    if (account.kind === 'asset') {
      if (picked.has(account.id)) continue;
      picked.add(account.id);
      if (value !== null) snapshots.push({ assetId: account.id, value });
    } else if (account.addToNetWorth && value !== null && label.trim()) {
      creates.push({ name: label.trim(), value });
    }
  }

  return {
    creates,
    links: [...picked].filter((id) => !followedIds.includes(id)),
    unlinks: followedIds.filter((id) => !picked.has(id)),
    snapshots,
  };
}

export function isEmptyPlan(plan: AccountLinkPlan): boolean {
  return (
    plan.creates.length +
      plan.links.length +
      plan.unlinks.length +
      plan.snapshots.length ===
    0
  );
}
