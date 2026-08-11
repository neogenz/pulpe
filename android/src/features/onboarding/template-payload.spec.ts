import { budgetTemplateCreateFromOnboardingSchema } from "pulpe-shared";

import type { OnboardingState } from "./onboarding-store";
import type { OnboardingTransaction } from "./onboarding-transaction";
import { toTemplatePayload } from "./template-payload";

/**
 * Reached only through `onboarding-transaction`, which mints ids with it. The
 * mapping under test never generates one, so a stub is enough to keep a native
 * module out of the suite.
 */
jest.mock("react-native-quick-crypto", () => ({
  randomUUID: () => "generated-id",
}));

const ANSWERS: OnboardingState = {
  isFlowActive: true,
  hasCompletedOnboarding: false,
  hasSeenHandoff: false,
  currentStep: "budgetPreview",
  isMovingForward: true,
  editReturnStep: null,
  isAuthenticated: true,
  isSocialAuth: false,
  socialProvidedName: false,
  wasEmailRegistered: true,
  hasCompletedPinSetup: false,
  firstName: "  Maxime  ",
  email: "maxime@example.test",
  currency: "CHF",
  monthlyIncome: 6500,
  housingCosts: 1500,
  healthInsurance: 350,
  phonePlan: null,
  transportCosts: 80,
  leasingCredit: null,
  customTransactions: [],
};

function customTransaction(
  overrides: Partial<OnboardingTransaction> = {},
): OnboardingTransaction {
  return {
    id: "local-id",
    name: "Abonnement",
    amount: 20,
    type: "expense",
    expenseType: "fixed",
    isRecurring: true,
    ...overrides,
  };
}

describe("toTemplatePayload", () => {
  it("sends zero for a charge the user left empty", () => {
    const payload = toTemplatePayload(ANSWERS);

    expect(payload.phonePlan).toBe(0);
    expect(payload.leasingCredit).toBe(0);
  });

  it("names the template after the user", () => {
    expect(toTemplatePayload(ANSWERS).description).toBe(
      "Template personnel de Maxime",
    );
  });

  it("strips the client-side id from every custom line", () => {
    const payload = toTemplatePayload({
      ...ANSWERS,
      customTransactions: [customTransaction()],
    });

    expect(payload.customTransactions).toEqual([
      {
        name: "Abonnement",
        amount: 20,
        type: "expense",
        expenseType: "fixed",
        isRecurring: true,
      },
    ]);
  });

  // The wire schema is strict, so an extra field is a rejected payload after
  // seven steps of work rather than a warning.
  it("produces a payload the wire schema accepts", () => {
    const payload = toTemplatePayload({
      ...ANSWERS,
      customTransactions: [customTransaction()],
    });

    expect(
      budgetTemplateCreateFromOnboardingSchema.safeParse(payload).success,
    ).toBe(true);
  });
});
