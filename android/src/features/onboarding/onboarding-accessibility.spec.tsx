import {
  isHiddenFromAccessibility,
  render,
} from "@testing-library/react-native";

import OnboardingRoute from "@/app/(onboarding)";

const mockOnboardingState = {
  currentStep: "welcome" as const,
  editReturnStep: null,
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock("react-native-paper", () => {
  const Dialog = () => null;
  Dialog.Title = function DialogTitle() {
    return null;
  };
  Dialog.Content = function DialogContent() {
    return null;
  };
  Dialog.Actions = function DialogActions() {
    return null;
  };
  return {
    Button: () => null,
    Dialog,
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Text: () => null,
    useTheme: () => ({ colors: { error: "red" } }),
  };
});
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/features/onboarding/onboarding-analytics", () => ({
  captureOnboardingAbandoned: jest.fn(),
}));
jest.mock("@/features/onboarding/onboarding-selectors", () => ({
  wouldExitOnBack: jest.fn(() => false),
}));
jest.mock("@/features/onboarding/onboarding-store", () => {
  const useOnboardingStore = (
    selector: (state: typeof mockOnboardingState) => unknown,
  ) => selector(mockOnboardingState);
  useOnboardingStore.getState = () => mockOnboardingState;
  return {
    useOnboardingStore,
    goToPreviousStep: jest.fn(),
    resetOnboarding: jest.fn(),
  };
});
jest.mock("@/features/onboarding/onboarding-submission", () => {
  const useSubmissionStore = (
    selector: (state: { status: string }) => unknown,
  ) => selector({ status: "submitting" });
  useSubmissionStore.getState = () => ({ status: "submitting" });
  return { useSubmissionStore };
});
jest.mock("@/features/onboarding/components/submission-overlay", () => {
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { SubmissionOverlay: () => <Text>submission-overlay</Text> };
});
jest.mock("@/features/onboarding/steps/welcome-step", () => {
  const { Text } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { WelcomeStep: () => <Text>welcome-step</Text> };
});
jest.mock("@/features/onboarding/steps/first-name-step", () => ({
  FirstNameStep: () => null,
}));
jest.mock("@/features/onboarding/steps/registration-step", () => ({
  RegistrationStep: () => null,
}));
jest.mock("@/features/onboarding/steps/income-step", () => ({
  IncomeStep: () => null,
}));
jest.mock("@/features/onboarding/steps/charges-step", () => ({
  ChargesStep: () => null,
}));
jest.mock("@/features/onboarding/steps/savings-step", () => ({
  SavingsStep: () => null,
}));
jest.mock("@/features/onboarding/steps/budget-preview-step", () => ({
  BudgetPreviewStep: () => null,
}));
jest.mock("@/features/onboarding/steps/pin-setup-step", () => ({
  PinSetupStep: () => null,
}));

it("makes submission modal for accessibility", async () => {
  const view = await render(<OnboardingRoute />);

  const step = view.getByText("welcome-step", { includeHiddenElements: true });
  const overlay = view.getByText("submission-overlay");

  expect(isHiddenFromAccessibility(step)).toBe(true);
  expect(isHiddenFromAccessibility(overlay)).toBe(false);
});
