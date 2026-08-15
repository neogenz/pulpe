import {
  availableToSpend,
  canProceed,
  emotionState,
  fixedChargeLines,
  progressBarSteps,
  totalCharges,
  totalExpenses,
  totalIncome,
  totalSavings,
} from "./onboarding-selectors";
import type { OnboardingState } from "./onboarding-store";
import type { OnboardingTransaction } from "./onboarding-transaction";

const BASE: OnboardingState = {
  isFlowActive: true,
  hasCompletedOnboarding: false,
  hasSeenHandoff: false,
  currentStep: "income",
  editReturnStep: null,
  isAuthenticated: false,
  isSocialAuth: false,
  socialProvidedName: false,
  wasEmailRegistered: false,
  hasCompletedPinSetup: false,
  firstName: "",
  email: "",
  currency: "CHF",
  monthlyIncome: null,
  housingCosts: null,
  healthInsurance: null,
  phonePlan: null,
  transportCosts: null,
  leasingCredit: null,
  customTransactions: [],
};

function stateWith(overrides: Partial<OnboardingState>): OnboardingState {
  return { ...BASE, ...overrides };
}

function line(
  overrides: Partial<OnboardingTransaction>,
): OnboardingTransaction {
  return {
    id: "line",
    amount: 100,
    type: "expense",
    name: "Ligne",
    expenseType: "fixed",
    isRecurring: true,
    ...overrides,
  };
}

describe("progress bar", () => {
  it("counts registration for an email signup and excludes welcome", () => {
    expect(progressBarSteps(BASE)).toEqual([
      "firstName",
      "registration",
      "income",
      "charges",
      "savings",
      "budgetPreview",
    ]);
  });

  it("drops the steps a named Google user never sees", () => {
    const state = stateWith({ isSocialAuth: true, socialProvidedName: true });

    expect(progressBarSteps(state)).toEqual([
      "income",
      "charges",
      "savings",
      "budgetPreview",
    ]);
  });

  it("keeps registration counted after the account is created, so the total holds", () => {
    const before = progressBarSteps(BASE).length;
    const after = progressBarSteps(stateWith({ isAuthenticated: true })).length;

    expect(after).toBe(before);
  });
});

describe("CTA gating", () => {
  it("blocks the first-name step until something is typed", () => {
    expect(canProceed(stateWith({ currentStep: "firstName" }))).toBe(false);
    expect(
      canProceed(stateWith({ currentStep: "firstName", firstName: " " })),
    ).toBe(false);
    expect(
      canProceed(stateWith({ currentStep: "firstName", firstName: "Maxime" })),
    ).toBe(true);
  });

  it("blocks the income step on zero, not only on empty", () => {
    expect(canProceed(stateWith({ currentStep: "income" }))).toBe(false);
    expect(
      canProceed(stateWith({ currentStep: "income", monthlyIncome: 0 })),
    ).toBe(false);
    expect(
      canProceed(stateWith({ currentStep: "income", monthlyIncome: 6500 })),
    ).toBe(true);
  });

  it("lets the optional steps through untouched", () => {
    expect(canProceed(stateWith({ currentStep: "charges" }))).toBe(true);
    expect(canProceed(stateWith({ currentStep: "savings" }))).toBe(true);
  });
});

describe("totals", () => {
  const state = stateWith({
    monthlyIncome: 6500,
    housingCosts: 1800,
    healthInsurance: 350,
    phonePlan: 0,
    leasingCredit: null,
    customTransactions: [
      line({ id: "a", amount: 600, type: "expense" }),
      line({ id: "b", amount: 500, type: "saving" }),
      line({ id: "c", amount: 200, type: "income" }),
    ],
  });

  it("lists only the fixed charges that carry an amount", () => {
    expect(fixedChargeLines(state).map((it) => it.label)).toEqual([
      "Loyer",
      "Assurance maladie",
    ]);
  });

  it("adds custom expenses to the fixed charges", () => {
    expect(totalCharges(state)).toBe(2750);
  });

  it("counts savings apart from charges, and both as expenses", () => {
    expect(totalSavings(state)).toBe(500);
    expect(totalExpenses(state)).toBe(3250);
  });

  it("adds custom income lines to the monthly income", () => {
    expect(totalIncome(state)).toBe(6700);
  });

  it("leaves what is not spent", () => {
    expect(availableToSpend(state)).toBe(3450);
  });
});

describe("emotion state", () => {
  /**
   * Same thresholds as the dashboard hero — the formula itself is tested in
   * `shared/src/calculators/budget-formulas.spec.ts`; what is checked here is
   * that onboarding feeds it the totals it computes, `rollover` included.
   */
  it("is comfortable below 80% of income used", () => {
    const state = stateWith({ monthlyIncome: 1000, housingCosts: 790 });
    expect(emotionState(state)).toBe("comfortable");
  });

  it("is tight from 80% up", () => {
    const state = stateWith({ monthlyIncome: 1000, housingCosts: 800 });
    expect(emotionState(state)).toBe("tight");
  });

  it("is a deficit once the answers spend more than they bring in", () => {
    const state = stateWith({ monthlyIncome: 1000, housingCosts: 1200 });
    expect(emotionState(state)).toBe("deficit");
  });

  it("stays comfortable on an untouched flow rather than reading as a deficit", () => {
    expect(emotionState(BASE)).toBe("comfortable");
  });
});
