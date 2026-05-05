import type { z } from 'zod';
import type { onboardingTransactionSchema } from 'pulpe-shared';

export type OnboardingTransaction = z.infer<typeof onboardingTransactionSchema>;

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
  customTransactions?: OnboardingTransaction[];
}

export interface ProfileSetupResult {
  success: boolean;
  error?: string;
}
