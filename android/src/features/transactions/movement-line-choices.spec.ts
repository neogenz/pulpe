import type { BudgetLine, Transaction } from "pulpe-shared";

import {
  eligibleLines,
  lineSections,
  matchingSections,
  suggestedLine,
} from "./movement-line-choices";

function line(id: string, overrides: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id,
    name: id,
    kind: "expense",
    amount: 100,
    checkedAt: null,
    ...overrides,
  } as BudgetLine;
}

function spend(
  budgetLineId: string | null,
  amount: number,
  name = "x",
): Transaction {
  return {
    id: `${budgetLineId}-${amount}-${name}`,
    kind: "expense",
    name,
    amount,
    budgetLineId,
  } as Transaction;
}

describe("eligibleLines", () => {
  it("keeps the same kind and drops rollover and broken withdrawal lines", () => {
    const lines = [
      line("ok"),
      line("income", { kind: "income" }),
      line("rollover", { isRollover: true }),
      line("broken", { sourceSavingsGoalId: null, sourceSavingsGoalName: "Z" }),
    ];

    expect(eligibleLines(lines, "expense").map((l) => l.id)).toEqual(["ok"]);
  });
});

describe("suggestedLine", () => {
  const lines = [line("small", { amount: 50 }), line("big", { amount: 300 })];

  it("suggests the unpointed line with the most left", () => {
    expect(
      suggestedLine({ lines, transactions: [], kind: "expense", name: "" })?.id,
    ).toBe("big");
  });

  it("prefers the line of a same-name movement", () => {
    const transactions = [spend("small", 10, "Coop")];

    expect(
      suggestedLine({ lines, transactions, kind: "expense", name: " coop " })
        ?.id,
    ).toBe("small");
  });

  it("skips pointed and exhausted lines, and may suggest nothing", () => {
    const only = [
      line("pointed", { checkedAt: "2026-01-01T00:00:00Z" }),
      line("spent", { amount: 20 }),
    ];

    expect(
      suggestedLine({
        lines: only,
        transactions: [spend("spent", 20)],
        kind: "expense",
        name: "",
      }),
    ).toBeNull();
  });
});

describe("lineSections", () => {
  it("sorts lines into margin, over and others", () => {
    const lines = [
      line("margin"),
      line("over", { amount: 10 }),
      line("pointed", { checkedAt: "2026-01-01T00:00:00Z" }),
      line("empty", { amount: 30 }),
    ];
    const transactions = [spend("over", 25), spend("empty", 30)];

    const sections = lineSections(lines, transactions, "expense");

    expect(sections.margin.map((l) => l.id)).toEqual(["margin"]);
    expect(sections.over.map((l) => l.id)).toEqual(["over"]);
    expect(sections.others.map((l) => l.id)).toEqual(["pointed", "empty"]);
    expect(sections.available.get("over")).toBe(-15);
    expect(sections.available.get("margin")).toBe(100);
  });
});

describe("matchingSections", () => {
  const sections = lineSections(
    [
      line("food", { name: "Épicerie" }),
      line("rent", { name: "Loyer", amount: 10 }),
    ],
    [spend("rent", 25)],
    "expense",
  );

  it("keeps every line on an empty or blank query", () => {
    expect(matchingSections(sections, "  ")).toBe(sections);
  });

  it("matches inside names, ignoring case and accents, in every section", () => {
    const shown = matchingSections(sections, " EPIC ");

    expect(shown.margin.map((l) => l.id)).toEqual(["food"]);
    expect(shown.over).toEqual([]);
    expect(matchingSections(sections, "oy").over.map((l) => l.id)).toEqual([
      "rent",
    ]);
  });

  it("folds ß like iOS's search, and never matches everything", () => {
    const folded = lineSections(
      [line("tram", { name: "Straßenbahn" }), line("rent", { name: "Bail ½" })],
      [],
      "expense",
    );
    const ids = (query: string) =>
      matchingSections(folded, query).margin.map((l) => l.id);

    expect(ids("strasse")).toEqual(["tram"]);
    expect(ids("^")).toEqual([]);
    expect(ids("2")).toEqual([]);
    // A vowel sign is part of a Devanagari word, not an accent to drop.
    expect(
      matchingSections(
        lineSections([line("devi", { name: "देवी" })], [], "expense"),
        "दवा",
      ).margin,
    ).toEqual([]);
    // Optional marks over a letter go, as they did in the movements search.
    expect(
      matchingSections(
        lineSections([line("mecca", { name: "مكّة" })], [], "expense"),
        "مكة",
      ).margin.map((l) => l.id),
    ).toEqual(["mecca"]);
  });
});
