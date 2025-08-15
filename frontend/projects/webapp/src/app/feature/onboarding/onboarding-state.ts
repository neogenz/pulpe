/**
 * Interface describing the state managed by OnboardingStore
 *
 * Represents the complete onboarding process state including:
 * - User form data collection
 * - Progress tracking through steps
 * - Async operations state (submission)
 * - Error handling state
 */
export interface OnboardingState {
  /**
   * Current onboarding data collected from user
   */
  data: OnboardingData;

  /**
   * Current step in the onboarding flow
   */
  currentStepIndex: number;

  /**
   * Whether a submission operation is in progress
   */
  isSubmitting: boolean;

  /**
   * Error message if any operation failed
   */
  error: string;
}

/**
 * User data collected during onboarding process
 */
export interface OnboardingData {
  firstName: string;
  email: string;
  monthlyIncome: number | null;
  housingCosts: number | null;
  healthInsurance: number | null;
  leasingCredit: number | null;
  phonePlan: number | null;
  transportCosts: number | null;
  isUserCreated: boolean;
}

/**
 * Onboarding step identifier type
 */
export type OnboardingStep =
  | 'welcome'
  | 'personal-info'
  | 'income'
  | 'housing'
  | 'health-insurance'
  | 'phone-plan'
  | 'transport'
  | 'leasing-credit'
  | 'registration';

/**
 * Factory function to create initial OnboardingState
 */
export function createInitialOnboardingState(): OnboardingState {
  return {
    data: {
      firstName: '',
      email: '',
      monthlyIncome: null,
      housingCosts: null,
      healthInsurance: null,
      leasingCredit: null,
      phonePlan: null,
      transportCosts: null,
      isUserCreated: false,
    },
    currentStepIndex: 0,
    isSubmitting: false,
    error: '',
  };
}
