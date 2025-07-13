import { describe, it, expect } from 'vitest';
import type {
  OnboardingStepData,
  OnboardingSubmissionResult,
} from './onboarding.types';

describe('Onboarding Types', () => {
  describe('OnboardingStepData', () => {
    it('should have correct structure', () => {
      const data: OnboardingStepData = {
        monthlyIncome: 5000,
        housingCosts: 1200,
        healthInsurance: 200,
        leasingCredit: 0,
        phonePlan: 50,
        transportCosts: 100,
        firstName: 'John',
        email: 'john@example.com',
      };

      expect(data.monthlyIncome).toBe(5000);
      expect(data.housingCosts).toBe(1200);
      expect(data.healthInsurance).toBe(200);
      expect(data.leasingCredit).toBe(0);
      expect(data.phonePlan).toBe(50);
      expect(data.transportCosts).toBe(100);
      expect(data.firstName).toBe('John');
      expect(data.email).toBe('john@example.com');
    });

    it('should accept null values for numeric fields', () => {
      const data: OnboardingStepData = {
        monthlyIncome: null,
        housingCosts: null,
        healthInsurance: null,
        leasingCredit: null,
        phonePlan: null,
        transportCosts: null,
        firstName: '',
        email: '',
      };

      expect(data.monthlyIncome).toBeNull();
      expect(data.housingCosts).toBeNull();
      expect(data.healthInsurance).toBeNull();
      expect(data.leasingCredit).toBeNull();
      expect(data.phonePlan).toBeNull();
      expect(data.transportCosts).toBeNull();
    });
  });

  describe('OnboardingSubmissionResult', () => {
    it('should handle success case', () => {
      const result: OnboardingSubmissionResult = {
        success: true,
      };

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle error case', () => {
      const result: OnboardingSubmissionResult = {
        success: false,
        error: 'Something went wrong',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });
  });
});
