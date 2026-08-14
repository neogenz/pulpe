import {
  transactionCreateSchema,
  transactionUpdateSchema,
  type Transaction,
} from "pulpe-shared";

import {
  buildTransactionPayload,
  buildTransactionRestore,
  buildTransactionUpdate,
  draftHint,
  isDraftSubmittable,
  transactionDraftFrom,
  type TransactionDraft,
} from "./transaction-draft";

const NOW = new Date(2026, 7, 11, 14, 30, 5, 250);

function draft(overrides: Partial<TransactionDraft> = {}): TransactionDraft {
  return {
    budgetId: "3f1c1c6e-1f4e-4c0a-9f2e-2b7c8d9e0a11",
    name: "  Courses  ",
    amount: 42.5,
    kind: "expense",
    day: new Date(2026, 7, 9),
    isChecked: true,
    tagIds: [],
    sourceSavingsGoalId: null,
    ...overrides,
  };
}

describe("buildTransactionPayload", () => {
  it("produces a payload the shared create schema accepts", () => {
    const payload = buildTransactionPayload(draft(), NOW);

    expect(transactionCreateSchema.safeParse(payload).success).toBe(true);
  });

  it("trims the description", () => {
    expect(buildTransactionPayload(draft(), NOW).name).toBe("Courses");
  });

  it("keeps the chosen day and takes the current clock", () => {
    const payload = buildTransactionPayload(draft(), NOW);
    const date = new Date(payload.transactionDate as string);

    expect(date.getDate()).toBe(9);
    expect(date.getHours()).toBe(14);
    expect(date.getMinutes()).toBe(30);
  });

  it("stamps the pointing at entry time, not at the chosen day", () => {
    const payload = buildTransactionPayload(draft(), NOW);

    expect(payload.checkedAt).toBe(NOW.toISOString());
  });

  it("leaves the transaction unpointed when the toggle is off", () => {
    const payload = buildTransactionPayload(draft({ isChecked: false }), NOW);

    expect(payload.checkedAt).toBeNull();
  });

  // An empty array would state "no tags" where the user simply never chose any.
  it("omits the tag list rather than sending an empty one", () => {
    const payload = buildTransactionPayload(draft(), NOW);

    expect("tagIds" in payload).toBe(false);
  });

  it("sends the tags that were chosen", () => {
    const tagIds = ["7b6b1a3e-0f4d-4c11-9a2b-3c4d5e6f7a80"];
    const payload = buildTransactionPayload(draft({ tagIds }), NOW);

    expect(payload.tagIds).toEqual(tagIds);
    expect(transactionCreateSchema.safeParse(payload).success).toBe(true);
  });

  it("declares the goal an income was taken out of", () => {
    const goalId = "9d8e7f6a-5b4c-4d3e-8f9a-0b1c2d3e4f5a";
    const payload = buildTransactionPayload(
      draft({ kind: "income", sourceSavingsGoalId: goalId }),
      NOW,
    );

    expect(payload.sourceSavingsGoalId).toBe(goalId);
    expect(transactionCreateSchema.safeParse(payload).success).toBe(true);
  });

  // The schema takes an origin on an income and nothing else, so a stale
  // choice left behind by a change of type must not travel with it.
  it("drops an origin a spend could not carry", () => {
    const payload = buildTransactionPayload(
      draft({
        kind: "expense",
        sourceSavingsGoalId: "9d8e7f6a-5b4c-4d3e-8f9a-0b1c2d3e4f5a",
      }),
      NOW,
    );

    expect("sourceSavingsGoalId" in payload).toBe(false);
    expect(transactionCreateSchema.safeParse(payload).success).toBe(true);
  });

  it("refuses an amount the form should never have submitted", () => {
    expect(() => buildTransactionPayload(draft({ amount: 0 }), NOW)).toThrow();
  });
});

describe("isDraftSubmittable", () => {
  it("accepts a filled draft", () => {
    expect(isDraftSubmittable(draft())).toBe(true);
  });

  it("refuses a blank description", () => {
    expect(isDraftSubmittable(draft({ name: "   " }))).toBe(false);
  });

  it("refuses a missing amount", () => {
    expect(isDraftSubmittable(draft({ amount: null }))).toBe(false);
  });
});

describe("draftHint", () => {
  it("asks for the amount first", () => {
    expect(draftHint(draft({ amount: null, name: "" }))).toBe(
      "Ajoute un montant",
    );
  });

  it("asks for the description once the amount is there", () => {
    expect(draftHint(draft({ name: "" }))).toBe("Ajoute une description");
  });

  it("says nothing about a complete draft", () => {
    expect(draftHint(draft())).toBeNull();
  });
});

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "5c2d3e4f-6a7b-4c8d-9e0f-1a2b3c4d5e6f",
    budgetId: "3f1c1c6e-1f4e-4c0a-9f2e-2b7c8d9e0a11",
    budgetLineId: null,
    name: "Courses",
    amount: 42.5,
    kind: "expense",
    transactionDate: "2026-08-09T14:30:05.250Z",
    tagIds: [],
    createdAt: "2026-08-09T14:30:05.250Z",
    updatedAt: "2026-08-09T14:30:05.250Z",
    checkedAt: "2026-08-09T14:30:05.250Z",
    ...overrides,
  };
}

describe("buildTransactionUpdate", () => {
  it("carries only what changed", () => {
    const existing = transaction();
    const payload = buildTransactionUpdate(
      { ...transactionDraftFrom(existing), amount: 51 },
      existing,
    );

    expect(payload).toEqual({ amount: 51 });
    expect(transactionUpdateSchema.safeParse(payload).success).toBe(true);
  });

  // Rebuilding the day from the stored instant must land back on that instant,
  // or every save would silently move the operation's time.
  it("carries nothing when the form was only opened", () => {
    const existing = transaction();

    expect(
      buildTransactionUpdate(transactionDraftFrom(existing), existing),
    ).toEqual({});
  });

  it("keeps the original clock when only the day moved", () => {
    const existing = transaction();
    const stored = new Date(existing.transactionDate);
    const payload = buildTransactionUpdate(
      { ...transactionDraftFrom(existing), day: new Date(2026, 7, 12) },
      existing,
    );
    const moved = new Date(payload.transactionDate as string);

    expect(moved.getDate()).toBe(12);
    expect(moved.getHours()).toBe(stored.getHours());
    expect(moved.getMinutes()).toBe(stored.getMinutes());
  });

  it("ignores the order tags were picked in", () => {
    const tagIds = [
      "7b6b1a3e-0f4d-4c11-9a2b-3c4d5e6f7a80",
      "8c7c2b4f-1e5d-4d22-8b3c-4d5e6f7a8b91",
    ];
    const existing = transaction({ tagIds });
    const payload = buildTransactionUpdate(
      { ...transactionDraftFrom(existing), tagIds: [...tagIds].reverse() },
      existing,
    );

    expect("tagIds" in payload).toBe(false);
  });

  it("sends the whole list when a tag was removed", () => {
    const existing = transaction({
      tagIds: [
        "7b6b1a3e-0f4d-4c11-9a2b-3c4d5e6f7a80",
        "8c7c2b4f-1e5d-4d22-8b3c-4d5e6f7a8b91",
      ],
    });
    const payload = buildTransactionUpdate(
      { ...transactionDraftFrom(existing), tagIds: [] },
      existing,
    );

    expect(payload.tagIds).toEqual([]);
  });
});

describe("buildTransactionRestore", () => {
  it("puts back the same row, id included", () => {
    const deleted = transaction({
      budgetLineId: "2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d",
      tagIds: ["7b6b1a3e-0f4d-4c11-9a2b-3c4d5e6f7a80"],
    });
    const payload = buildTransactionRestore(deleted);

    expect(payload.id).toBe(deleted.id);
    expect(payload.budgetLineId).toBe(deleted.budgetLineId);
    expect(payload.checkedAt).toBe(deleted.checkedAt);
    expect(payload.tagIds).toEqual(deleted.tagIds);
    expect(transactionCreateSchema.safeParse(payload).success).toBe(true);
  });

  // The create schema takes a source only on a free income — which is the only
  // shape that can carry one in the first place.
  it("keeps the savings origin of a withdrawal", () => {
    const deleted = transaction({
      kind: "income",
      sourceSavingsGoalId: "9d8e7f6a-5b4c-4d3e-8f9a-0b1c2d3e4f5a",
      sourceSavingsGoalName: "Vacances",
    });
    const payload = buildTransactionRestore(deleted);

    expect(payload.sourceSavingsGoalId).toBe(deleted.sourceSavingsGoalId);
    expect(transactionCreateSchema.safeParse(payload).success).toBe(true);
  });

  // A realised planned withdrawal carries both ids. Sending them together is a
  // second declaration of origin, and the schema rejects the whole payload —
  // the undo used to be lost right here.
  it("leaves the origin to the server on an allocated withdrawal", () => {
    const deleted = transaction({
      kind: "income",
      budgetLineId: "2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d",
      sourceSavingsGoalId: "9d8e7f6a-5b4c-4d3e-8f9a-0b1c2d3e4f5a",
      sourceSavingsGoalName: "Vacances",
    });

    const payload = buildTransactionRestore(deleted);

    expect(payload.budgetLineId).toBe(deleted.budgetLineId);
    expect("sourceSavingsGoalId" in payload).toBe(false);
    expect(transactionCreateSchema.safeParse(payload).success).toBe(true);
  });

  it("omits what the create schema will not take as null", () => {
    const payload = buildTransactionRestore(transaction());

    expect("budgetLineId" in payload).toBe(false);
    expect("sourceSavingsGoalId" in payload).toBe(false);
    expect("originalAmount" in payload).toBe(false);
  });
});
