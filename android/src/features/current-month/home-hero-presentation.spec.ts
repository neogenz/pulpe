import { i18n, translate } from "@/core/i18n/i18n";

import { useAmountVisibility } from "@/core/ui/amount-visibility";

import type { TrendedTrajectory } from "./current-month-view-model";
import {
  chartAccessibilityLabel,
  heroPresentation,
  rhythmSentence,
  verdictSentence,
} from "./home-hero-presentation";

function trajectory(
  overrides: Partial<TrendedTrajectory> = {},
): TrendedTrajectory {
  return {
    landing: [
      { day: 0, balance: 2500 },
      { day: 1, balance: 2200 },
    ],
    plannedAvailable: 5000,
    real: [
      { day: 0, balance: 5000 },
      { day: 1, balance: 5000 },
    ],
    driftDate: new Date(2026, 6, 5),
    plannedOutflows: 2500,
    today: 1,
    totalDays: 31,
    plannedBalance: 2500,
    estimatedBalance: 2200,
    drift: -300,
    trend: 2000,
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
});

describe("verdictSentence", () => {
  it.each([
    ["fr", "Depuis le 5 juillet, il te reste moins que prévu."],
    ["en", "Since July 5, you have less left than planned."],
    ["de", "Seit dem 5. Juli bleibt dir weniger als geplant."],
    ["it", "Dal 5 luglio ti resta meno del previsto."],
  ])("dates the drift in %s", (locale, expected) => {
    i18n.locale = locale;
    const sentence = verdictSentence(
      translate,
      locale,
      heroPresentation({
        estimatedBalance: 2200,
        fallbackPlannedBalance: 2500,
        trajectory: trajectory(),
      }),
    );

    expect(sentence).toBe(expected);
  });

  it("drops the date rather than inventing one", () => {
    i18n.locale = "fr";
    const sentence = verdictSentence(
      translate,
      "fr",
      heroPresentation({
        estimatedBalance: 2900,
        fallbackPlannedBalance: 2500,
        trajectory: null,
      }),
    );

    expect(sentence).toBe("Il te reste plus que prévu.");
  });

  it("says so plainly when nothing moved", () => {
    i18n.locale = "fr";
    const sentence = verdictSentence(
      translate,
      "fr",
      heroPresentation({
        estimatedBalance: 2500,
        fallbackPlannedBalance: 2500,
        trajectory: null,
      }),
    );

    expect(sentence).toBe("Tu es pile sur ton plan.");
  });
});

describe("rhythmSentence", () => {
  // Day 10 of 31, 700 under plan: 1800 − 70 × 10/17 × 21 = 935.29.
  const offPace = trajectory({
    today: 10,
    totalDays: 31,
    estimatedBalance: 1800,
    drift: -700,
    trend: 935.29,
  });
  const sentence = (
    overrides: Partial<TrendedTrajectory> = {},
    amountsHidden = false,
  ) =>
    rhythmSentence(translate, "fr", {
      trajectory: { ...offPace, ...overrides },
      periodEnd: new Date(2026, 7, 24),
      currency: "CHF",
      amountsHidden,
    });

  beforeEach(() => {
    i18n.locale = "fr";
    useAmountVisibility.setState({ areAmountsHidden: false });
  });

  it("sets the landing against what the plan kept", () => {
    expect(sentence()).toMatch(
      /^À ce rythme, il te restera 935 CHF le 24 août au lieu des 2.?500 CHF prévus\.$/,
    );
  });

  it("keeps the direction and drops both figures when amounts are hidden", () => {
    expect(sentence({}, true)).toBe(
      "Le 24 août, il te restera moins que prévu.",
    );
    expect(
      sentence({ estimatedBalance: 3200, drift: 700, trend: 3300 }, true),
    ).toBe("Le 24 août, il te restera plus que prévu.");
  });

  it("says nothing on the last day or when the pace lands on the plan", () => {
    expect(sentence({ today: 31 })).toBeNull();
    expect(
      sentence({ estimatedBalance: 2500, drift: 0, trend: 2500 }),
    ).toBeNull();
  });

  it("rounds a negative half centime away from zero like iOS", () => {
    // iOS reads -1.125 as -1.13: the same landing as the plan, so no sentence.
    expect(
      sentence({ plannedBalance: -1.13, drift: -0.005, trend: -1.125 }),
    ).toBeNull();
  });

  it("quotes the trajectory's own trend, not one it recomputes", () => {
    expect(sentence({ trend: 1500 })).toMatch(/il te restera 1.?500 CHF/);
  });
});

describe("chartAccessibilityLabel", () => {
  const label = (
    overrides: Partial<TrendedTrajectory> = {},
    amountsHidden = false,
  ) =>
    chartAccessibilityLabel(translate, {
      trajectory: trajectory({
        real: [
          { day: 0, balance: 5000 },
          { day: 1, balance: 4700.5 },
        ],
        ...overrides,
      }),
      currency: "CHF",
      amountsHidden,
    });

  beforeEach(() => {
    i18n.locale = "fr";
    useAmountVisibility.setState({ areAmountsHidden: false });
  });

  it("speaks the opening, the plan, today and the trend", () => {
    expect(label()).toMatch(
      /^Disponible prévu 5.?000 CHF\. Prévu fin de période 2.?500 CHF\. Réel aujourd'hui 4.?700\.50 CHF\. Si tu continues, 2.?000 CHF\.$/,
    );
  });

  it("leaves the trend out when it lands beside the plan", () => {
    expect(label({ trend: 2501 })).not.toContain("Si tu continues");
  });

  it("is the masked sentence when amounts are hidden", () => {
    expect(label({}, true)).toBe(
      "Trajectoire d'atterrissage de la période, montants masqués.",
    );
  });
});
