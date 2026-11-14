import {
  type Asset,
  type AssetSnapshotsCreate,
  type NetWorth,
  parseAccountAmount,
  type SupportedCurrency,
} from "pulpe-shared";

/** One of my accounts of « Mon patrimoine », or a line typed for this time. */
export type RowAccount =
  | { kind: "asset"; id: string }
  | { kind: "other"; addToNetWorth: boolean };

export interface AccountRow {
  id: number;
  label: string;
  amountText: string;
  account: RowAccount;
}

/** `ReconcileAccountsFlow.LinkPlan` on iOS, `planAccountLinks` on the web. */
export interface AccountLinkPlan {
  creates: { name: string; value: number }[];
  /** Accounts picked here that were not followed yet. */
  links: string[];
  /** Followed accounts that no row holds any more. */
  unlinks: string[];
  snapshots: AssetSnapshotsCreate["items"];
}

const CENTS_PER_UNIT = 100;
// The API refuses a longer name, and a refused create stops every write after it.
const ASSET_NAME_MAX_LENGTH = 100;
const TYPED_LINE: RowAccount = { kind: "other", addToNetWorth: false };

export function emptyRow(id: number): AccountRow {
  return { id, label: "", amountText: "", account: TYPED_LINE };
}

/** What the reconciliation can finish with: active, owned, in this currency. */
export function ownAccounts(
  netWorth: NetWorth,
  currency: SupportedCurrency,
): Asset[] {
  return netWorth.assets.filter(
    (asset) =>
      asset.archivedAt === null &&
      asset.direction === "own" &&
      asset.currency === currency,
  );
}

/** The accounts followed so far open the sheet, one row each. */
export function seedRows(accounts: Asset[] | null): AccountRow[] {
  const followed = (accounts ?? []).filter((asset) => asset.inPulpe);
  if (followed.length === 0) return [emptyRow(0)];
  return followed.map((asset, id) => ({
    id,
    label: asset.name,
    amountText: "",
    account: { kind: "asset", id: asset.id },
  }));
}

/** My accounts no other row holds: an account is never counted twice. */
export function accountChoices(
  rows: AccountRow[],
  rowId: number,
  accounts: Asset[],
): Asset[] {
  const taken = new Set(
    rows.flatMap((row) =>
      row.id !== rowId && row.account.kind === "asset" ? [row.account.id] : [],
    ),
  );
  return accounts.filter((asset) => !taken.has(asset.id));
}

/** `null` turns the row into a typed line; the amount already typed stays. */
export function selectAccount(
  row: AccountRow,
  asset: Asset | null,
): AccountRow {
  return asset === null
    ? { ...row, label: "", account: TYPED_LINE }
    : { ...row, label: asset.name, account: { kind: "asset", id: asset.id } };
}

/**
 * An account kept in « Mon patrimoine » needs a name to be found again and a
 * balance to start from. Only a blank balance is asked for: an unreadable one
 * already empties the total.
 */
export function missingForNewAccount(
  row: AccountRow,
): "name" | "balance" | null {
  if (row.account.kind !== "other" || !row.account.addToNetWorth) return null;
  if (row.label.trim() === "") return "name";
  return parseAccountAmount(row.amountText).status === "blank"
    ? "balance"
    : null;
}

/**
 * What finishing writes to « Mon patrimoine »: the accounts I finish with are
 * the ones followed. A created account carries its balance as its first
 * value, so it never gets a snapshot on top.
 */
export function planAccountLinks(
  rows: AccountRow[],
  accounts: Asset[],
): AccountLinkPlan {
  const picked: string[] = [];
  const creates: AccountLinkPlan["creates"] = [];
  const snapshots: AccountLinkPlan["snapshots"] = [];

  for (const { account, label, amountText } of rows) {
    const amount = parseAccountAmount(amountText);
    const value =
      amount.status === "valid" ? amount.cents / CENTS_PER_UNIT : null;
    if (account.kind === "asset") {
      if (picked.includes(account.id)) continue;
      picked.push(account.id);
      if (value !== null) snapshots.push({ assetId: account.id, value });
    } else {
      const name = label.trim().slice(0, ASSET_NAME_MAX_LENGTH);
      if (account.addToNetWorth && value !== null && name !== "") {
        creates.push({ name, value });
      }
    }
  }

  const followed = accounts
    .filter((asset) => asset.inPulpe)
    .map((asset) => asset.id);
  return {
    creates,
    links: picked.filter((id) => !followed.includes(id)),
    unlinks: followed.filter((id) => !picked.includes(id)),
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
