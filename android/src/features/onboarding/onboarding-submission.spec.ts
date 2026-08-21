import { i18n } from "@/core/i18n/i18n";

import { submitOnboarding, useSubmissionStore } from "./onboarding-submission";

const mockCreateTemplate = jest.fn();
const mockState = {
  firstName: "Max",
  currency: "CHF",
  monthlyIncome: null,
  housingCosts: null,
  healthInsurance: null,
  leasingCredit: null,
  phonePlan: null,
  transportCosts: null,
  customTransactions: [],
};

jest.mock("react-native-quick-crypto", () => ({
  randomUUID: () => "generated-id",
}));
jest.mock("./api", () => ({
  createTemplateFromOnboarding: (...args: unknown[]) =>
    mockCreateTemplate(...args),
  deleteTemplate: jest.fn(),
  generateInitialBudgets: jest.fn(),
}));
jest.mock("./onboarding-analytics", () => ({
  captureFirstBudgetCreated: jest.fn(),
}));
jest.mock("./onboarding-store", () => ({
  completeOnboarding: jest.fn(),
  useOnboardingStore: { getState: () => mockState },
}));
jest.mock("@/core/user-settings/user-settings-api", () => ({
  updateUserSettings: jest.fn(),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useLocaleStore: { getState: () => ({ locale: "de" }) },
}));

it("stores only safe state when localized submission fails", async () => {
  i18n.locale = "de";
  mockCreateTemplate.mockRejectedValueOnce(new Error("provider secret"));

  await submitOnboarding();

  expect(mockCreateTemplate).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Standardmonat",
      description: "Persönliche Vorlage von Max",
      locale: "de",
    }),
  );
  expect(useSubmissionStore.getState()).toEqual({ status: "failed" });
  expect(JSON.stringify(useSubmissionStore.getState())).not.toContain(
    "provider secret",
  );
});
