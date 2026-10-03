import {
  savingsGoalCreateSchema,
  savingsGoalUpdateSchema,
  type SavingsGoal,
} from "pulpe-shared";

import {
  buildSavingsGoalCreate,
  buildSavingsGoalUpdate,
  canDecompose,
  creationContribution,
  emptySavingsGoalDraft,
  isSavingsGoalDraftSubmittable,
  savingsGoalDraftFrom,
  savingsGoalDraftHint,
  suggestedMonthly,
  targetDateBounds,
  usesManualMonthly,
  type SavingsGoalDraft,
} from "./goal-draft";
import { toIsoDate } from "@/core/ui/date-format";

const NOW = new Date("2026-08-11T10:00:00.000Z");

function draft(overrides: Partial<SavingsGoalDraft> = {}): SavingsGoalDraft {
  return { ...emptySavingsGoalDraft(), name: "Voyage Japon", ...overrides };
}

function goal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: "1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d",
    userId: "9f8e7d6c-5b4a-4392-8172-6d5e4f3a2b1c",
    name: "Voyage Japon",
    startDate: null,
    targetAmount: 6000,
    targetDate: "2027-08-01",
    status: "ACTIVE",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("suggestedMonthly", () => {
  it("divides what is left to save by the months up to the target", () => {
    const monthly = suggestedMonthly(
      draft({ targetAmount: 1200, targetDate: "2026-11-30" }),
      null,
      NOW,
    );

    // August through November, current month included.
    expect(monthly).toBe(300);
  });

  it("subtracts the starting stock before dividing", () => {
    const monthly = suggestedMonthly(
      draft({
        targetAmount: 1200,
        initialAmount: 400,
        targetDate: "2026-11-30",
      }),
      null,
      NOW,
    );

    expect(monthly).toBe(200);
  });

  it("has nothing to suggest without a target date", () => {
    expect(
      suggestedMonthly(draft({ targetAmount: 1200 }), null, NOW),
    ).toBeNull();
  });
});

describe("canDecompose", () => {
  it("is offered when a dated target still asks for money", () => {
    expect(
      canDecompose(draft({ targetAmount: 1200, targetDate: "2026-11-30" })),
    ).toBe(true);
  });

  it("is not offered when the starting stock already covers the target", () => {
    expect(
      canDecompose(
        draft({
          targetAmount: 1200,
          initialAmount: 1200,
          targetDate: "2026-11-30",
        }),
      ),
    ).toBe(false);
  });
});

describe("usesManualMonthly", () => {
  it("takes over for a pot with no deadline", () => {
    expect(usesManualMonthly(draft({ targetAmount: 1200 }))).toBe(true);
  });

  it("steps aside once the goal has both a target and a date", () => {
    expect(
      usesManualMonthly(
        draft({ targetAmount: 1200, targetDate: "2026-11-30" }),
      ),
    ).toBe(false);
  });
});

describe("creationContribution", () => {
  it("follows the suggestion while the user has not overridden it", () => {
    const contribution = creationContribution(
      draft({ targetAmount: 1200, targetDate: "2026-11-30" }),
      null,
      NOW,
    );

    expect(contribution).toBe(300);
  });

  it("keeps what the user typed over the suggestion", () => {
    const contribution = creationContribution(
      draft({
        targetAmount: 1200,
        targetDate: "2026-11-30",
        monthlyOverride: 500,
      }),
      null,
      NOW,
    );

    expect(contribution).toBe(500);
  });

  it("sends nothing when the decomposition is turned off", () => {
    const contribution = creationContribution(
      draft({
        targetAmount: 1200,
        targetDate: "2026-11-30",
        isDecomposed: false,
      }),
      null,
      NOW,
    );

    expect(contribution).toBeNull();
  });

  it("sends the manual amount for a goal with no deadline", () => {
    const contribution = creationContribution(
      draft({ monthlyOverride: 150 }),
      null,
      NOW,
    );

    expect(contribution).toBe(150);
  });
});

describe("buildSavingsGoalCreate", () => {
  it("produces a payload the shared schema accepts", () => {
    const payload = buildSavingsGoalCreate(
      draft({
        name: "  Voyage Japon  ",
        targetAmount: 1200,
        targetDate: "2026-11-30",
        initialAmount: 200,
      }),
      null,
      NOW,
    );

    expect(savingsGoalCreateSchema.parse(payload)).toMatchObject({
      name: "Voyage Japon",
      targetAmount: 1200,
      targetDate: "2026-11-30",
      initialAmount: 200,
      monthlyContribution: 250,
      status: "ACTIVE",
    });
  });

  it("omits every optional field the user left alone", () => {
    const payload = buildSavingsGoalCreate(draft(), null, NOW);

    expect(payload).toEqual({ name: "Voyage Japon", status: "ACTIVE" });
    expect(savingsGoalCreateSchema.safeParse(payload).success).toBe(true);
  });
});

describe("buildSavingsGoalUpdate", () => {
  it("sends only what moved", () => {
    const changes = buildSavingsGoalUpdate(
      { ...savingsGoalDraftFrom(goal()), targetAmount: 8000 },
      goal(),
    );

    expect(changes).toEqual({ targetAmount: 8000 });
    expect(savingsGoalUpdateSchema.safeParse(changes).success).toBe(true);
  });

  it("clears a target date the user removed", () => {
    const changes = buildSavingsGoalUpdate(
      { ...savingsGoalDraftFrom(goal()), targetDate: null },
      goal(),
    );

    expect(changes).toEqual({ targetDate: null });
  });

  it("sends nothing when nothing changed", () => {
    expect(
      buildSavingsGoalUpdate(savingsGoalDraftFrom(goal()), goal()),
    ).toEqual({});
  });
});

describe("isSavingsGoalDraftSubmittable", () => {
  it("refuses a nameless goal", () => {
    expect(isSavingsGoalDraftSubmittable(draft({ name: "   " }))).toBe(false);
  });

  it("refuses a start date after the target date", () => {
    const invalid = draft({
      startDate: "2027-01-01",
      targetDate: "2026-11-30",
    });

    expect(isSavingsGoalDraftSubmittable(invalid)).toBe(false);
    expect(savingsGoalDraftHint(invalid)).toBe("dates");
  });

  it("accepts a goal with a name and nothing else", () => {
    expect(isSavingsGoalDraftSubmittable(draft())).toBe(true);
    expect(savingsGoalDraftHint(draft())).toBeNull();
  });
});

describe("targetDateBounds", () => {
  const OCTOBER_FIRST = new Date(2026, 9, 1, 10);

  it("runs from today to the last day of the 120th month, this one included", () => {
    expect(targetDateBounds(null, OCTOBER_FIRST)).toEqual({
      earliest: "2026-10-01",
      latest: "2036-09-30",
    });
  });

  it("keeps a deadline the goal already has reachable on either side", () => {
    expect(targetDateBounds("2026-03-31", OCTOBER_FIRST).earliest).toBe(
      "2026-03-31",
    );
    expect(targetDateBounds("2037-01-31", OCTOBER_FIRST).latest).toBe(
      "2037-01-31",
    );
  });

  /** The picker's range is only worth anything if it is the schema's. */
  it("matches what the create schema accepts, edge days included", () => {
    const now = new Date();
    const { earliest, latest } = targetDateBounds(null, now);
    const accepts = (targetDate: string) =>
      savingsGoalCreateSchema.safeParse({ name: "Voyage", targetDate }).success;
    const shift = (iso: string, days: number) => {
      const [year, month, day] = iso.split("-").map(Number);
      return toIsoDate(new Date(year, month - 1, day + days));
    };

    expect(accepts(earliest)).toBe(true);
    expect(accepts(latest)).toBe(true);
    expect(accepts(shift(latest, 1))).toBe(false);
    expect(accepts(shift(earliest, -1))).toBe(false);
  });
});

describe("savingsGoalDraftHint", () => {
  const bounds = targetDateBounds(null, new Date(2026, 9, 1, 10));

  it("names a past deadline instead of leaving the save to fail on it", () => {
    const past = draft({ targetDate: "2026-09-30" });

    expect(savingsGoalDraftHint(past, bounds)).toBe("pastDeadline");
    expect(isSavingsGoalDraftSubmittable(past, bounds)).toBe(false);
  });

  it("lets an edit keep the past deadline its goal already had", () => {
    const kept = draft({ targetDate: "2026-03-31" });
    const editBounds = targetDateBounds("2026-03-31", new Date(2026, 9, 1, 10));

    expect(savingsGoalDraftHint(kept, editBounds)).toBeNull();
    expect(isSavingsGoalDraftSubmittable(kept, editBounds)).toBe(true);
  });

  it("explains a monthly amount of zero rather than only greying the button", () => {
    const decomposed = draft({
      targetAmount: 1200,
      targetDate: "2027-06-30",
      monthlyOverride: 0,
    });
    const manual = draft({ monthlyOverride: 0 });

    expect(savingsGoalDraftHint(decomposed, bounds)).toBe("monthly");
    expect(isSavingsGoalDraftSubmittable(decomposed, bounds)).toBe(false);
    expect(savingsGoalDraftHint(manual, bounds)).toBe("monthly");
    expect(isSavingsGoalDraftSubmittable(manual, bounds)).toBe(false);
  });

  it("ignores a monthly amount left in a field that is no longer shown", () => {
    const declined = draft({
      targetAmount: 1200,
      targetDate: "2027-06-30",
      isDecomposed: false,
      monthlyOverride: 0,
    });

    expect(savingsGoalDraftHint(declined, bounds)).toBeNull();
    expect(isSavingsGoalDraftSubmittable(declined, bounds)).toBe(true);
    expect(buildSavingsGoalCreate(declined, null)).not.toHaveProperty(
      "monthlyContribution",
    );
  });
});
