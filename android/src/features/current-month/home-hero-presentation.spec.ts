import type { BalanceTrajectory } from "pulpe-shared";

import {
  heroPresentation,
  uncheckedSentence,
  varianceLabel,
  verdictSentence,
} from "./home-hero-presentation";

function trajectory(
  overrides: Partial<BalanceTrajectory> = {},
): BalanceTrajectory {
  return {
    landing: [
      { day: 0, balance: 2500 },
      { day: 1, balance: 2200 },
    ],
    driftDate: new Date(2026, 6, 5),
    plannedOutflows: 2500,
    today: 1,
    totalDays: 31,
    plannedBalance: 2500,
    estimatedBalance: 2200,
    drift: -300,
    ...overrides,
  };
}

describe("heroPresentation", () => {
  it("takes the plan from the chart it is drawn beside", () => {
    const presentation = heroPresentation({
      estimatedBalance: 2200,
      fallbackPlannedBalance: 9999,
      trajectory: trajectory(),
    });

    expect(presentation.plannedBalance).toBe(2500);
    expect(presentation.variance).toBe(-300);
    expect(presentation.verdict).toBe("overrun");
  });

  it("falls back on the plan alone when there is no chart to read", () => {
    const presentation = heroPresentation({
      estimatedBalance: 2200,
      fallbackPlannedBalance: 2500,
      trajectory: null,
    });

    expect(presentation.plannedBalance).toBe(2500);
    expect(presentation.driftDate).toBeNull();
  });

  it("calls a month in the red a deficit even when it beat its plan", () => {
    const presentation = heroPresentation({
      estimatedBalance: -120,
      fallbackPlannedBalance: -400,
      trajectory: null,
    });

    expect(presentation.verdict).toBe("gain");
    expect(presentation.tone).toBe("deficit");
  });

  // The hero and the drift card have to agree: a month on plan absorbed the
  // overrun, so the card cannot claim the money went missing.
  it("treats a month exactly on plan as having absorbed its overruns", () => {
    const presentation = heroPresentation({
      estimatedBalance: 2500,
      fallbackPlannedBalance: 2500,
      trajectory: null,
    });

    expect(presentation.verdict).toBe("onPlan");
    expect(presentation.absorbsEnvelopeOverrun).toBe(true);
  });
});

describe("verdictSentence", () => {
  it("dates the day the month left its plan", () => {
    const sentence = verdictSentence(
      heroPresentation({
        estimatedBalance: 2200,
        fallbackPlannedBalance: 2500,
        trajectory: trajectory(),
      }),
    );

    expect(sentence).toBe("Sous ton plan depuis le 5 juillet.");
  });

  it("drops the date rather than inventing one", () => {
    const sentence = verdictSentence(
      heroPresentation({
        estimatedBalance: 2900,
        fallbackPlannedBalance: 2500,
        trajectory: null,
      }),
    );

    expect(sentence).toBe("Il te reste plus que prévu.");
  });

  it("says so plainly when nothing moved", () => {
    const sentence = verdictSentence(
      heroPresentation({
        estimatedBalance: 2500,
        fallbackPlannedBalance: 2500,
        trajectory: null,
      }),
    );

    expect(sentence).toBe("Tu es pile sur ton plan.");
  });
});

describe("varianceLabel", () => {
  it("signs a gain and leaves a loss to its own minus", () => {
    const gain = heroPresentation({
      estimatedBalance: 2900,
      fallbackPlannedBalance: 2500,
      trajectory: null,
    });
    const loss = heroPresentation({
      estimatedBalance: 2200,
      fallbackPlannedBalance: 2500,
      trajectory: null,
    });

    expect(varianceLabel(gain, "CHF")).toBe("+400 CHF");
    expect(varianceLabel(loss, "CHF")).toBe("-300 CHF");
  });
});

describe("uncheckedSentence", () => {
  it("agrees in number", () => {
    expect(uncheckedSentence(0)).toBe("Aucune opération à pointer.");
    expect(uncheckedSentence(1)).toBe("1 opération à pointer.");
    expect(uncheckedSentence(4)).toBe("4 opérations à pointer.");
  });
});
