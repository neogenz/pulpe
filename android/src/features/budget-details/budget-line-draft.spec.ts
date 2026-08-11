import {
  budgetLineCreateSchema,
  budgetLineUpdateSchema,
  type BudgetLine,
} from "pulpe-shared";

import {
  budgetLineDraftFrom,
  budgetLineDraftHint,
  buildBudgetLineCreate,
  buildBudgetLineUpdate,
  emptyBudgetLineDraft,
  isBudgetLineDraftSubmittable,
} from "./budget-line-draft";

const BUDGET_ID = "3f1a9c2e-5b6d-4f8a-9c1e-2d3b4a5c6d7e";

function line(overrides: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id: "9a8b7c6d-5e4f-4a3b-8c9d-0e1f2a3b4c5d",
    budgetId: BUDGET_ID,
    templateLineId: null,
    savingsGoalId: null,
    name: "Loyer",
    amount: 1650,
    kind: "expense",
    recurrence: "fixed",
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildBudgetLineCreate", () => {
  it("produces a payload the shared schema accepts", () => {
    const payload = buildBudgetLineCreate(
      {
        name: "  Courses  ",
        amount: 600,
        kind: "expense",
        recurrence: "fixed",
      },
      BUDGET_ID,
    );

    expect(payload.name).toBe("Courses");
    expect(budgetLineCreateSchema.safeParse(payload).success).toBe(true);
  });

  it("refuses to build without a positive amount", () => {
    expect(() =>
      buildBudgetLineCreate(emptyBudgetLineDraft(), BUDGET_ID),
    ).toThrow();
  });
});

describe("buildBudgetLineUpdate", () => {
  // Sending untouched fields back would overwrite another device's edit with
  // whatever happened to be on this screen.
  it("carries only what changed", () => {
    const existing = line();
    const payload = buildBudgetLineUpdate(
      { ...budgetLineDraftFrom(existing), amount: 1700 },
      existing,
    );

    expect(payload).toEqual({ id: existing.id, amount: 1700 });
    expect(budgetLineUpdateSchema.safeParse(payload).success).toBe(true);
  });

  it("carries nothing but the id when nothing moved", () => {
    const existing = line();

    expect(
      buildBudgetLineUpdate(budgetLineDraftFrom(existing), existing),
    ).toEqual({ id: existing.id });
  });

  // The flag means "typed over what the template said", so it only applies to
  // a line that came from one.
  it("marks a template line as manually adjusted once its amount changes", () => {
    const existing = line({ templateLineId: BUDGET_ID });
    const payload = buildBudgetLineUpdate(
      { ...budgetLineDraftFrom(existing), amount: 1700 },
      existing,
    );

    expect(payload.isManuallyAdjusted).toBe(true);
  });

  it("leaves a hand-typed line alone", () => {
    const existing = line();
    const payload = buildBudgetLineUpdate(
      { ...budgetLineDraftFrom(existing), amount: 1700 },
      existing,
    );

    expect(payload.isManuallyAdjusted).toBeUndefined();
  });
});

describe("budgetLineDraftHint", () => {
  it("asks for the amount first", () => {
    expect(budgetLineDraftHint(emptyBudgetLineDraft())).toBe(
      "Indique un montant",
    );
  });

  it("then asks for the name", () => {
    expect(budgetLineDraftHint({ ...emptyBudgetLineDraft(), amount: 10 })).toBe(
      "Donne-lui un nom",
    );
  });

  it("says nothing once the draft can be sent", () => {
    const draft = { ...emptyBudgetLineDraft(), amount: 10, name: "Courses" };

    expect(budgetLineDraftHint(draft)).toBeNull();
    expect(isBudgetLineDraftSubmittable(draft)).toBe(true);
  });
});
