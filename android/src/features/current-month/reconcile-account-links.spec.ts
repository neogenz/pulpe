import type { Asset, BudgetLine } from "pulpe-shared";

import {
  addableGroups,
  type AccountRow,
  assetRow,
  freeAccountsToRemember,
  freeRow,
  isEmptyPlan,
  nextRowId,
  planAccountLinks,
  restoreRows,
  seedRows,
  summarizeRows,
} from "./reconcile-account-links";
import type { LinkedAccounts } from "./reconcile-linked-accounts";

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

function row(changes: Partial<AccountRow>): AccountRow {
  return { ...freeRow(0, "own"), ...changes };
}

const FOLLOWED = asset("a", { inPulpe: true });
const CARD = asset("card", { direction: "owe", inPulpe: true });
const IDLE = asset("b");

describe("seedRows", () => {
  it("opens on the followed accounts, then the remembered free rows", () => {
    const rows = seedRows(
      [FOLLOWED, IDLE, CARD],
      [{ name: "Revolut", side: "own" }],
    );
    expect(rows.map(({ id, label, side }) => [id, label, side])).toEqual([
      [0, "Compte a", "own"],
      [1, "Compte card", "owe"],
      [2, "Revolut", "own"],
    ]);
    expect(rows.every((r) => r.amountText === "")).toBe(true);
  });

  it("opens on one empty row when nothing is followed or remembered", () => {
    expect(seedRows([IDLE], [])).toEqual([freeRow(0, "own")]);
    expect(seedRows(null, [])).toEqual([freeRow(0, "own")]);
  });

  it("never reuses an id", () => {
    expect(nextRowId(seedRows([FOLLOWED, CARD], []))).toBe(2);
  });
});

describe("summarizeRows", () => {
  it("counts a « Je dois » row against me, whatever sign was typed", () => {
    const summary = summarizeRows([
      row({ amountText: "3000" }),
      row({ id: 1, amountText: "1000" }),
      row({ id: 2, side: "owe", amountText: "800" }),
      row({ id: 3, side: "owe", amountText: "-50" }),
    ]);
    expect(summary).toEqual({
      totalCents: 400_000 - 85_000,
      haveCents: 400_000,
      oweCents: 85_000,
      hasOwe: true,
    });
  });

  it.each(["800", "-800"])(
    "gives 2200 for 3000 « J'ai » and %s « Je dois »",
    (owed) => {
      const summary = summarizeRows([
        row({ amountText: "3000" }),
        row({ id: 1, side: "owe", amountText: owed }),
      ]);
      expect(summary.totalCents).toBe(220_000);
      expect(summary.oweCents).toBe(80_000);
    },
  );

  it("keeps the sign of a « J'ai » row: an overdraft", () => {
    expect(summarizeRows([row({ amountText: "-80" })]).totalCents).toBe(-8000);
  });

  it("withholds the total until something is typed and every amount reads", () => {
    expect(summarizeRows([row({})]).totalCents).toBeNull();
    expect(
      summarizeRows([row({ amountText: "5" }), row({ amountText: "12ab" })])
        .totalCents,
    ).toBeNull();
    expect(summarizeRows([row({})]).hasOwe).toBe(false);
  });
});

describe("planAccountLinks", () => {
  it("writes nothing for free rows", () => {
    expect(
      isEmptyPlan(
        planAccountLinks([row({ label: "Neon", amountText: "10" })], []),
      ),
    ).toBe(true);
  });

  it("snapshots picked items, links new ones, unlinks dropped ones, never creates", () => {
    const plan = planAccountLinks(
      [
        { ...assetRow(0, IDLE), amountText: "-80,5" },
        { ...assetRow(1, IDLE), amountText: "1" },
        { ...assetRow(2, CARD), amountText: "800" },
      ],
      [FOLLOWED, IDLE, CARD],
    );
    expect(plan).toEqual({
      links: ["b"],
      unlinks: ["a"],
      snapshots: [
        { assetId: "b", value: -80.5 },
        { assetId: "card", value: 800 },
      ],
    });
  });

  it("records a debt by its remaining balance, a positive figure", () => {
    const plan = planAccountLinks(
      [{ ...assetRow(0, CARD), amountText: "-800" }],
      [CARD],
    );
    expect(plan.snapshots).toEqual([{ assetId: "card", value: 800 }]);
  });

  it.each(["800", "-800"])(
    "records a debt of %s as 800, never negative",
    (typed) => {
      const plan = planAccountLinks(
        [{ ...assetRow(0, CARD), amountText: typed }],
        [CARD],
      );
      expect(plan.snapshots).toEqual([{ assetId: "card", value: 800 }]);
    },
  );

  it("keeps a followed account with no balance typed, without a snapshot", () => {
    expect(
      isEmptyPlan(planAccountLinks(seedRows([FOLLOWED], []), [FOLLOWED])),
    ).toBe(true);
  });
});

it("remembers named free rows only, names cut to 100 and sides kept", () => {
  expect(
    freeAccountsToRemember([
      row({ label: ` ${"n".repeat(120)} `, amountText: "5", side: "owe" }),
      row({ id: 1, label: "  " }),
      assetRow(2, FOLLOWED),
    ]),
  ).toEqual([{ name: "n".repeat(100), side: "owe" }]);
});

describe("addableGroups", () => {
  const linked: LinkedAccounts = {
    categories: [
      { id: "type", name: "Comptes", total: 0 },
      { id: "empty", name: "Vide", total: 0 },
    ],
    assets: [FOLLOWED, IDLE, CARD, asset("fed")],
  };
  const feeding = {
    kind: "saving",
    assetId: "fed",
  } as BudgetLine;

  it("leaves out items already listed and items a saving line feeds", () => {
    const groups = addableGroups(linked, [assetRow(0, FOLLOWED)], [feeding]);
    expect(groups.map((g) => [g.name, g.assets.map((a) => a.id)])).toEqual([
      ["Comptes", ["b", "card"]],
    ]);
  });

  it("is empty when Mon patrimoine is off", () => {
    expect(addableGroups(null, [], [])).toEqual([]);
  });
});

describe("restoreRows", () => {
  const linked: LinkedAccounts = {
    categories: [],
    assets: [FOLLOWED],
  };
  const drafted = [
    { ...assetRow(0, FOLLOWED), amountText: "1000" },
    { ...assetRow(1, CARD), amountText: "800" },
  ];

  it("turns an item no longer offered into a free row, keeping what was typed", () => {
    const rows = restoreRows(drafted, linked);
    expect(rows[0]).toEqual(drafted[0]);
    expect(rows[1]).toEqual({
      ...drafted[1],
      account: { kind: "free" },
    });
    // Nothing is left to write to the gone item.
    expect(planAccountLinks(rows, linked.assets).snapshots).toEqual([
      { assetId: "a", value: 1000 },
    ]);
  });

  it("keeps every link while Mon patrimoine cannot be read", () => {
    expect(restoreRows(drafted, null)).toEqual(drafted);
  });
});
