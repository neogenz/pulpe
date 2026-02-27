export interface ProfileData {
  firstName: string;
  monthlyIncome: number;
  housingCosts?: number;
  healthInsurance?: number;
  phonePlan?: number;
  internetPlan?: number;
  transportCosts?: number;
  leasingCredit?: number;
  payDayOfMonth?: number;
}

export interface ProfileSetupResult {
  success: boolean;
  error?: string;
}
