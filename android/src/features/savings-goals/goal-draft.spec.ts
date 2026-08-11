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
  usesManualMonthly,
  type SavingsGoalDraft,
} from "./goal-draft";

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
    expect(savingsGoalDraftHint(invalid)).toBe(
      "Le début ne peut pas venir après l'échéance.",
    );
  });

  it("accepts a goal with a name and nothing else", () => {
    expect(isSavingsGoalDraftSubmittable(draft())).toBe(true);
    expect(savingsGoalDraftHint(draft())).toBeNull();
  });
});
