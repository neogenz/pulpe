// Interface simplifiée pour les données d'onboarding
export interface OnboardingStepData {
  monthlyIncome: number | null;
  housingCosts: number | null;
  healthInsurance: number | null;
  leasingCredit: number | null;
  phonePlan: number | null;
  transportCosts: number | null;
  firstName: string;
  email: string;
}

// Interface pour le résultat de soumission
export interface OnboardingSubmissionResult {
  success: boolean;
  error?: string;
}
