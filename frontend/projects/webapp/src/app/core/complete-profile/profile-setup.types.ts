export interface ProfileData {
  firstName: string;
  monthlyIncome: number;
  housingCosts?: number;
  healthInsurance?: number;
  phonePlan?: number;
  transportCosts?: number;
  leasingCredit?: number;
}

export interface ProfileSetupResult {
  success: boolean;
  error?: string;
}
