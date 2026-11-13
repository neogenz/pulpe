import type {
  SavingsGoal,
  SavingsGoalPlanMonth,
  SavingsGoalProgress,
  SavingsGoalWithdrawal,
} from "pulpe-shared";

import {
  goalHistory,
  goalRowFact,
  historySummary,
  monthRuns,
  planTitle,
  repairTitle,
  type Words,
} from "./goal-presentation";

const words: Words = {
  locale: "fr",
  currency: "CHF",
  t: (key, options) =>
    options === undefined ? key : `${key}:${Object.values(options).join("|")}`,
};

function month(
  overrides: Partial<SavingsGoalPlanMonth> = {},
): SavingsGoalPlanMonth {
  return {
    month: 3,
    year: 2027,
    state: "future",
    isLocked: false,
    hasBudget: true,
    isProvisionable: true,
    plannedAmount: 0,
    confirmedAmount: 0,
    plannedCumulative: 0,
    confirmedCumulative: 0,
    lines: [],
    ...overrides,
  };
}

describe("repairTitle", () => {
  it("names an unbroken range", () => {
    const months = [
      month({ month: 3 }),
      month({ month: 4 }),
      month({ month: 5 }),
    ];

    expect(repairTitle(months, words)).toBe(
      "goals.detail.plan.plan:goals.detail.range.to:mars|mai",
    );
  });

  it("counts the months when they have a gap", () => {
    const months = [
      month({ month: 3 }),
      month({ month: 5 }),
      month({ month: 6 }),
    ];

    expect(repairTitle(months, words)).toBe("goals.detail.plan.planCount:3");
  });

  it("names both months of a same-year pair, gap or not", () => {
    const months = [month({ month: 3 }), month({ month: 5 })];

    expect(repairTitle(months, words)).toBe(
      "goals.detail.plan.plan:goals.detail.range.and:mars|mai",
    );
  });

  it("counts a pair across two years with a month between", () => {
    const months = [month({ month: 11, year: 2026 }), month({ month: 1 })];

    expect(repairTitle(months, words)).toBe("goals.detail.plan.planCount:2");
  });

  it("has no title when nothing is repairable", () => {
    expect(repairTitle([month({ isProvisionable: false })], words)).toBeNull();
  });
});

describe("monthRuns", () => {
  it("splits the months ahead into funded and empty runs, current month apart", () => {
    const line = {
      budgetLineId: "11111111-1111-4111-8111-111111111111",
      amount: 100,
      checkedAt: null,
      isManuallyAdjusted: false,
    };
    const runs = monthRuns(
      [
        month({ month: 2, state: "current" }),
        month({ month: 3, plannedAmount: 100, lines: [line] }),
        month({ month: 4, plannedAmount: 100, lines: [line] }),
        month({ month: 5, state: "gap" }),
      ],
      words,
    );

    expect(runs.map((run) => run.kind)).toEqual(["planned", "empty"]);
    expect(runs[0].amount).toBe(200);
    expect(planTitle(runs, words)).toBe("goals.detail.plan.plan:mai");
  });
});

describe("goalHistory", () => {
  it("adds up to the saved figure and lists the newest month first", () => {
    const withdrawal: SavingsGoalWithdrawal = {
      transactionId: "33333333-3333-4333-8333-333333333333",
      budgetId: "44444444-4444-4444-8444-444444444444",
      name: "Retrait",
      transactionDate: "2027-02-10T12:00:00.000Z",
      amount: 50,
    };
    const history = goalHistory(
      {
        confirmed: 450,
        initialAmount: 100,
        months: [
          month({
            month: 1,
            state: "past",
            confirmedAmount: 200,
            plannedAmount: 200,
            confirmedCumulative: 300,
          }),
          month({
            month: 2,
            state: "current",
            confirmedAmount: 100,
            plannedAmount: 200,
            confirmedCumulative: 450,
          }),
        ],
      } as SavingsGoalProgress,
      [withdrawal],
      null,
    );

    expect(history.contributed).toBe(400);
    expect(100 + history.contributed - history.withdrawn).toBe(history.saved);
    expect(history.months.map((entry) => entry.month)).toEqual([2, 1]);
    expect(history.months[0].contribution?.percent).toBe(50);
    expect(history.months[1].initialAmount).toBe(100);
    expect(historySummary(history, words)).toBe(
      "goals.history.startAmount:100 CHF, goals.history.pointed:2, goals.history.withdrawalCount:1",
    );
  });
});

describe("goalRowFact", () => {
  const goal = (overrides: Partial<SavingsGoal> = {}) =>
    ({
      status: "ACTIVE",
      targetDate: "2027-11-30",
      ...overrides,
    }) as SavingsGoal;

  it("says a reached target waits for confirmation", () => {
    const fact = goalRowFact(
      goal(),
      { suggestCompletion: true } as SavingsGoalProgress,
      words,
    );

    expect(fact).toEqual({
      chip: "goals.list.fact.reached",
      text: "goals.list.fact.toConfirm",
    });
  });

  it("names the months still to plan next to the deadline", () => {
    const progress = {
      isOverdue: false,
      suggestCompletion: false,
      months: [month({ state: "past" }), month(), month()],
    } as SavingsGoalProgress;

    expect(goalRowFact(goal(), progress, words).text).toBe(
      "Novembre 2027 · goals.list.fact.toPlan:2",
    );
  });

  it("states a paused goal with a chip alone", () => {
    expect(goalRowFact(goal({ status: "PAUSED" }), undefined, words)).toEqual({
      chip: "goals.list.sections.PAUSED",
      text: null,
    });
  });
});
