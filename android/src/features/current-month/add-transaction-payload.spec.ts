import { transactionCreateSchema } from "pulpe-shared";

import {
  buildTransactionPayload,
  draftHint,
  isDraftSubmittable,
  type TransactionDraft,
} from "./add-transaction-payload";

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
