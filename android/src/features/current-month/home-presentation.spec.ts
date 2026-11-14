import type { BudgetLine, Transaction } from "pulpe-shared";

import {
  countMovements,
  driftTitle,
  filterMovements,
  isPointedNow,
  lineFact,
  movementSubtitle,
  periodCaption,
  startSubtitle,
  toPointMovementFact,
} from "./home-presentation";

const t = (key: string, options?: Record<string, unknown>) =>
  options === undefined ? key : `${key}:${JSON.stringify(options)}`;

function movement(id: string, rest: Partial<Transaction> = {}): Transaction {
  return {
    id,
    budgetId: "b",
    budgetLineId: null,
    name: id,
    amount: 10,
    kind: "expense",
    transactionDate: "2026-08-11T09:00:00.000Z",
    createdAt: "2026-08-11T09:00:00.000Z",
    updatedAt: "2026-08-11T09:00:00.000Z",
    checkedAt: null,
    ...rest,
  };
}

describe("driftTitle", () => {
  it("names the worst two and counts the rest", () => {
    expect(driftTitle(t, [])).toBe("");
    expect(driftTitle(t, ["A"])).toContain("driftOne");
    expect(driftTitle(t, ["A", "B"])).toContain("driftTwo");
    expect(driftTitle(t, ["A", "B", "C", "D"])).toContain('"count":3');
  });
});

describe("startSubtitle", () => {
  it("counts what the two names leave out", () => {
    expect(startSubtitle(t, ["Loyer"], 1)).toBe("Loyer");
    expect(startSubtitle(t, ["Loyer", "Salaire"], 13)).toContain('"count":11');
  });
});

describe("lineFact", () => {
  const line = { kind: "saving", recurrence: "fixed" } as BudgetLine;

  it("says the overrun first, then what is left, then the rhythm", () => {
    expect(
      lineFact(t, line, { available: -5, allocated: 20 } as never, "CHF"),
    ).toMatchObject({ isOverrun: true, hasAmount: true });
    expect(
      lineFact(t, line, { available: 15, allocated: 20 } as never, "CHF").text,
    ).toContain("home.toPoint.left");
    expect(
      lineFact(t, line, { available: 20, allocated: 0 } as never, "CHF").text,
    ).toContain("home.toPoint.saving");
  });
});

describe("lineFact rhythm", () => {
  const rest = { available: 20, allocated: 0 } as never;

  it("reads « Lissé » for a spread prévision, its recurrence otherwise", () => {
    const spread = {
      kind: "expense",
      recurrence: "one_off",
      spreadGroupId: "g",
    } as BudgetLine;
    const plain = { ...spread, spreadGroupId: null } as BudgetLine;

    expect(lineFact(t, spread, rest, "CHF").text).toBe("budgets.detail.spread");
    expect(lineFact(t, plain, rest, "CHF").text).toBe(
      "vocabulary.recurrence.one_off",
    );
  });
});

describe("movement wording", () => {
  const now = new Date("2026-08-11T12:00:00.000Z");

  it("names the prévision, else « Hors prévision » even for a saving", () => {
    const saving = movement("s", { kind: "saving" });

    expect(
      toPointMovementFact(t, "fr-CH", saving, undefined, false, now),
    ).toMatch(/^home\.movements\.unplanned · /);
    expect(toPointMovementFact(t, "fr-CH", saving, "Courses", true, now)).toBe(
      "Courses · home.toPoint.pointedNow",
    );
  });

  it("tells a pointed row from an unpointed one", () => {
    expect(movementSubtitle(t, movement("a"), "Courses")).toBe("Courses");
    expect(
      movementSubtitle(
        t,
        movement("a", { checkedAt: "2026-08-11" }),
        "Courses",
      ),
    ).toBe("Courses · home.movements.pointed");
    expect(
      movementSubtitle(t, movement("s", { kind: "saving" }), undefined),
    ).toBe("home.movements.saving");
  });

  it("captions the day of the period", () => {
    expect(
      periodCaption(
        t,
        "fr-CH",
        { day: 10, totalDays: 31 },
        new Date(2026, 10, 24),
      ),
    ).toContain('"day":10,"total":31');
  });
});

describe("movements filter", () => {
  const all = [
    movement("free"),
    movement("planned", { budgetLineId: "l1", checkedAt: "2026-08-11" }),
  ];
  const lines = new Map([["l1", "Café du coin"]]);

  it("counts and keeps per chip", () => {
    expect(countMovements("unpointed", all)).toBe(1);
    expect(countMovements("unplanned", all)).toBe(1);
    expect(filterMovements("unplanned", "", all, lines)).toEqual([all[0]]);
  });

  it("searches names and forecast names, ignoring case and accents", () => {
    expect(filterMovements("all", "CAFE", all, lines)).toEqual([all[1]]);
    expect(filterMovements("all", "free", all, lines)).toEqual([all[0]]);
    expect(filterMovements("all", "zzz", all, lines)).toEqual([]);
  });
});

it("ends the « à l'instant » once the row is no longer pointed", () => {
  expect(isPointedNow(new Set(["a"]), "a", true)).toBe(true);
  expect(isPointedNow(new Set(["a"]), "a", false)).toBe(false);
});
