/**
 * Profile data required to create initial template and budget
 */
export interface ProfileData {
  firstName: string;
  monthlyIncome: number;
  housingCosts?: number;
  healthInsurance?: number;
  phonePlan?: number;
  transportCosts?: number;
  leasingCredit?: number;
}

/**
 * Result of profile setup operation
 */
export interface ProfileSetupResult {
  success: boolean;
  error?: string;
}
