import type { SupportedCurrency } from "pulpe-shared";

import type { OnboardingStep } from "./onboarding-step";
import type { OnboardingTransaction } from "./onboarding-transaction";

/** Data owned by the onboarding flow, without a dependency on its store. */
export interface OnboardingState {
  isFlowActive: boolean;
  hasCompletedOnboarding: boolean;
  hasSeenHandoff: boolean;
  currentStep: OnboardingStep;
  editReturnStep: OnboardingStep | null;
  isSocialAuth: boolean;
  socialProvidedName: boolean;
  wasEmailRegistered: boolean;
  hasCompletedPinSetup: boolean;
  firstName: string;
  email: string;
  currency: SupportedCurrency;
  monthlyIncome: number | null;
  housingCosts: number | null;
  healthInsurance: number | null;
  phonePlan: number | null;
  transportCosts: number | null;
  leasingCredit: number | null;
  customTransactions: OnboardingTransaction[];
}

/** The answers, minus everything the flow derives or re-establishes on its own. */
export type OnboardingAnswers = Pick<
  OnboardingState,
  | "firstName"
  | "currency"
  | "monthlyIncome"
  | "housingCosts"
  | "healthInsurance"
  | "phonePlan"
  | "transportCosts"
  | "leasingCredit"
>;
