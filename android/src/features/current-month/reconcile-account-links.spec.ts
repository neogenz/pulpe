import type { Asset, NetWorth } from "pulpe-shared";

import {
  accountChoices,
  type AccountRow,
  emptyRow,
  isEmptyPlan,
  missingForNewAccount,
  ownAccounts,
  planAccountLinks,
  seedRows,
  selectAccount,
} from "./reconcile-account-links";

function asset(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    categoryId: "type",
    name: `Compte ${id}`,
    currency: "CHF",
    direction: "own",
    inPulpe: false,
    archivedAt: null,
    latestValue: 100,
    latestRecordedAt: "2026-11-01T10:00:00.000Z",
    convertedValue: 100,
    suggestion: null,
    ...overrides,
  };
}

function row(id: number, changes: Partial<AccountRow>): AccountRow {
  return { ...emptyRow(id), ...changes };
}

const FOLLOWED = asset("a", { inPulpe: true });
const IDLE = asset("b");
const ACCOUNTS = [FOLLOWED, IDLE];

it("keeps active accounts I own in my currency", () => {
  const netWorth = {
    assets: [
      FOLLOWED,
      asset("eur", { currency: "EUR" }),
      asset("debt", { direction: "owe" }),
      asset("old", { archivedAt: "2026-01-01T00:00:00.000Z" }),
    ],
  } as NetWorth;
  expect(ownAccounts(netWorth, "CHF")).toEqual([FOLLOWED]);
});

it("opens on one row per followed account, else on one empty row", () => {
  expect(seedRows(ACCOUNTS)).toEqual([
    {
      id: 0,
      label: "Compte a",
      amountText: "",
      account: { kind: "asset", id: "a" },
    },
  ]);
  expect(seedRows([IDLE])).toEqual([emptyRow(0)]);
  expect(seedRows(null)).toEqual([emptyRow(0)]);
});

it("never offers an account another row holds", () => {
  const rows = seedRows(ACCOUNTS).concat(emptyRow(1));
  expect(accountChoices(rows, 1, ACCOUNTS)).toEqual([IDLE]);
  expect(accountChoices(rows, 0, ACCOUNTS)).toEqual(ACCOUNTS);
});

it("keeps the typed amount when the row changes account", () => {
  const typed = row(1, { label: "Neon", amountText: "12" });
  const picked = selectAccount(typed, IDLE);
  expect(picked).toEqual({
    ...typed,
    label: "Compte b",
    account: { kind: "asset", id: "b" },
  });
  expect(selectAccount(picked, null)).toEqual({ ...typed, label: "" });
});

it("asks a new followed account for a name, then a balance", () => {
  const added = { kind: "other", addToNetWorth: true } as const;
  expect(missingForNewAccount(row(0, { account: added }))).toBe("name");
  expect(missingForNewAccount(row(0, { account: added, label: "Neon" }))).toBe(
    "balance",
  );
  expect(
    missingForNewAccount(
      row(0, { account: added, label: "Neon", amountText: "1" }),
    ),
  ).toBeNull();
  expect(missingForNewAccount(emptyRow(0))).toBeNull();
});

describe("planAccountLinks", () => {
  it("writes nothing for typed lines kept out of Mon patrimoine", () => {
    const plan = planAccountLinks(
      [row(0, { label: "Neon", amountText: "10" })],
      [],
    );
    expect(isEmptyPlan(plan)).toBe(true);
  });

  it("snapshots picked accounts, links the new ones and unlinks the dropped ones", () => {
    const plan = planAccountLinks(
      [
        row(0, { account: { kind: "asset", id: "b" }, amountText: "-80,5" }),
        row(1, { account: { kind: "asset", id: "b" }, amountText: "1" }),
      ],
      ACCOUNTS,
    );
    expect(plan).toEqual({
      creates: [],
      links: ["b"],
      unlinks: ["a"],
      snapshots: [{ assetId: "b", value: -80.5 }],
    });
  });

  it("keeps a followed account with no balance typed, without a snapshot", () => {
    expect(isEmptyPlan(planAccountLinks(seedRows(ACCOUNTS), ACCOUNTS))).toBe(
      true,
    );
  });

  it("creates only named accounts with a readable balance, the name cut to 100", () => {
    const added = { kind: "other", addToNetWorth: true } as const;
    const plan = planAccountLinks(
      [
        row(0, {
          account: added,
          label: ` ${"n".repeat(120)} `,
          amountText: "1250.40",
        }),
        row(1, { account: added, label: "", amountText: "5" }),
        row(2, { account: added, label: "Sans solde", amountText: "12abc" }),
      ],
      [],
    );
    expect(plan.creates).toEqual([{ name: "n".repeat(100), value: 1250.4 }]);
    expect(plan.snapshots).toEqual([]);
  });
});
