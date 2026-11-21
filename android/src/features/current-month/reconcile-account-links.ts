import {
  type Asset,
  type AssetSnapshotsCreate,
  type BudgetLine,
  parseAccountAmount,
} from "pulpe-shared";

import type { LinkedAccounts } from "./reconcile-linked-accounts";
import type { FreeAccount } from "./reconcile-free-accounts";

export type RowSide = FreeAccount["side"];

/** One of my items of « Mon patrimoine », or a free line typed for this time. */
export type RowAccount = { kind: "asset"; id: string } | { kind: "free" };

export interface AccountRow {
  id: number;
  label: string;
  amountText: string;
  side: RowSide;
  account: RowAccount;
}

/** `ReconcileAccountsFlow.LinkPlan` on iOS, `planAccountLinks` on the web. */
export interface AccountLinkPlan {
  /** Accounts picked here that were not followed yet. */
  links: string[];
  /** Followed accounts that no row holds any more. */
  unlinks: string[];
  snapshots: AssetSnapshotsCreate["items"];
}

const CENTS_PER_UNIT = 100;
// The API refuses a longer name; a free row is only ever remembered by name.
export const ACCOUNT_NAME_MAX_LENGTH = 100;

export function freeRow(id: number, side: RowSide, label = ""): AccountRow {
  return { id, label, amountText: "", side, account: { kind: "free" } };
}

export function assetRow(id: number, asset: Asset): AccountRow {
  return {
    id,
    label: asset.name,
    amountText: "",
    side: asset.direction,
    account: { kind: "asset", id: asset.id },
  };
}

/**
 * The list opens on the accounts followed in « Mon patrimoine », then the
 * free rows of last time (amounts empty), else on one empty line to type in.
 */
export function seedRows(
  accounts: Asset[] | null,
  remembered: FreeAccount[],
): AccountRow[] {
  const rows = [
    ...(accounts ?? [])
      .filter((asset) => asset.inPulpe)
      .map((asset) => assetRow(0, asset)),
    ...remembered.map(({ name, side }) => freeRow(0, side, name)),
  ].map((row, id) => ({ ...row, id }));
  return rows.length === 0 ? [freeRow(0, "own")] : rows;
}

/** Where the row ids go on from: past every seeded or drafted row's own. */
export function nextRowId(rows: AccountRow[]): number {
  return Math.max(0, ...rows.map((row) => row.id + 1));
}

/**
 * A draft held while the app was locked, against what Mon patrimoine offers
 * now: an item a successful read no longer offers (deleted or archived since)
 * keeps its name, side and amount as a free row, so nothing typed is lost and
 * nothing is written to a gone item. With no answer (flag off, failed read)
 * nothing is known to be gone: the rows keep their link, or they would come
 * back as duplicates of the item once it reads again.
 */
export function restoreRows(
  draft: AccountRow[],
  linked: LinkedAccounts | null,
): AccountRow[] {
  if (!linked) return draft;
  const offered = new Set(linked.assets.map((asset) => asset.id));
  return draft.map((row) =>
    row.account.kind === "asset" && !offered.has(row.account.id)
      ? { ...row, account: { kind: "free" } }
      : row,
  );
}

/** The free rows worth keeping for next time: names and sides, no amount. */
export function freeAccountsToRemember(rows: AccountRow[]): FreeAccount[] {
  return rows.flatMap(({ account, label, side }) => {
    const name = label.trim().slice(0, ACCOUNT_NAME_MAX_LENGTH);
    return account.kind === "free" && name !== "" ? [{ name, side }] : [];
  });
}

export interface RowsSummary {
  /** What I have minus what I owe; `null` until every typed amount reads. */
  totalCents: number | null;
  haveCents: number;
  /** A positive figure: what the « Je dois » rows add up to. */
  oweCents: number;
  hasOwe: boolean;
}

/**
 * Blank rows say nothing, but one unreadable amount withholds the total.
 * The decimal pad has no minus key, so a « Je dois » row counts against me
 * whatever sign was typed; a « J'ai » row keeps its own (an overdraft).
 */
export function summarizeRows(rows: AccountRow[]): RowsSummary {
  let haveCents = 0;
  let oweCents = 0;
  let hasAmount = false;
  let isReadable = true;
  for (const { amountText, side } of rows) {
    const amount = parseAccountAmount(amountText);
    if (amount.status === "invalid") isReadable = false;
    if (amount.status !== "valid") continue;
    hasAmount = true;
    if (side === "owe") oweCents += Math.abs(amount.cents);
    else haveCents += amount.cents;
  }
  return {
    totalCents: hasAmount && isReadable ? haveCents - oweCents : null,
    haveCents,
    oweCents,
    hasOwe: rows.some((row) => row.side === "owe"),
  };
}

/**
 * What finishing writes to « Mon patrimoine »: the accounts I finish with are
 * the ones followed. A free row never reaches it, and Mon patrimoine values a
 * debt by its remaining balance, a positive figure.
 */
export function planAccountLinks(
  rows: AccountRow[],
  accounts: Asset[],
): AccountLinkPlan {
  const picked: string[] = [];
  const snapshots: AccountLinkPlan["snapshots"] = [];

  for (const { account, amountText, side } of rows) {
    if (account.kind !== "asset" || picked.includes(account.id)) continue;
    picked.push(account.id);
    const amount = parseAccountAmount(amountText);
    if (amount.status !== "valid") continue;
    const cents = side === "owe" ? Math.abs(amount.cents) : amount.cents;
    snapshots.push({ assetId: account.id, value: cents / CENTS_PER_UNIT });
  }

  const followed = accounts
    .filter((asset) => asset.inPulpe)
    .map((asset) => asset.id);
  return {
    links: picked.filter((id) => !followed.includes(id)),
    unlinks: followed.filter((id) => !picked.includes(id)),
    snapshots,
  };
}

export function isEmptyPlan(plan: AccountLinkPlan): boolean {
  return plan.links.length + plan.unlinks.length + plan.snapshots.length === 0;
}

export interface AddableGroup {
  id: string;
  name: string;
  assets: Asset[];
}

/**
 * What « Depuis Mon patrimoine » offers, by Type: never one already listed,
 * nor one a saving prévision of the month feeds (its balance follows from the
 * month, not from what I type). Empty when Mon patrimoine is off.
 */
export function addableGroups(
  linked: LinkedAccounts | null | undefined,
  rows: AccountRow[],
  budgetLines: BudgetLine[],
): AddableGroup[] {
  if (!linked) return [];
  const excluded = new Set<string>(
    budgetLines.flatMap((line) =>
      line.kind === "saving" && line.assetId ? [line.assetId] : [],
    ),
  );
  for (const { account } of rows) {
    if (account.kind === "asset") excluded.add(account.id);
  }
  return linked.categories
    .map(({ id, name }) => ({
      id,
      name,
      assets: linked.assets.filter(
        (asset) => asset.categoryId === id && !excluded.has(asset.id),
      ),
    }))
    .filter((group) => group.assets.length > 0);
}
