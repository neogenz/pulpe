import { describe, beforeEach, it, expect, vi } from 'vitest';
import { OnboardingApi } from './onboarding-api';

describe('OnboardingApi', () => {
  let service: OnboardingApi;

  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
      () => undefined,
    );
    service = new OnboardingApi();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with empty onboarding data', () => {
    const data = service.onboardingSteps();
    expect(data.monthlyIncome).toBeNull();
    expect(data.housingCosts).toBeNull();
    expect(data.healthInsurance).toBeNull();
    expect(data.leasingCredit).toBeNull();
    expect(data.phonePlan).toBeNull();
    expect(data.transportCosts).toBeNull();
    expect(data.firstName).toBe('');
    expect(data.email).toBe('');
  });

  it('should update monthly income', () => {
    service.updateIncomeStep(5000);
    expect(service.onboardingSteps().monthlyIncome).toBe(5000);
  });

  it('should update housing costs', () => {
    service.updateHousingStep(1200);
    expect(service.onboardingSteps().housingCosts).toBe(1200);
  });

  it('should update health insurance', () => {
    service.updateHealthInsuranceStep(300);
    expect(service.onboardingSteps().healthInsurance).toBe(300);
  });

  it('should update leasing credit', () => {
    service.updateLeasingCreditStep(400);
    expect(service.onboardingSteps().leasingCredit).toBe(400);
  });

  it('should update phone plan', () => {
    service.updatePhonePlanStep(50);
    expect(service.onboardingSteps().phonePlan).toBe(50);
  });

  it('should update transport costs', () => {
    service.updateTransportStep(100);
    expect(service.onboardingSteps().transportCosts).toBe(100);
  });

  it('should update personal info', () => {
    service.updatePersonalInfoStep('John', 'john@example.com');
    const data = service.onboardingSteps();
    expect(data.firstName).toBe('John');
    expect(data.email).toBe('john@example.com');
  });

  it('should calculate total expenses correctly', () => {
    service.updateIncomeStep(5000);
    service.updateHousingStep(1200);
    service.updateHealthInsuranceStep(300);
    service.updateLeasingCreditStep(400);
    service.updatePhonePlanStep(50);
    service.updateTransportStep(100);
    service.updatePersonalInfoStep('John', 'john@example.com');

    const payload = service.getOnboardingSubmissionPayload();
    const totalExpenses =
      payload.housingCosts +
      payload.healthInsurance +
      payload.leasingCredit +
      payload.phonePlan +
      payload.transportCosts;
    expect(totalExpenses).toBe(2050);
  });

  it('should calculate remaining budget correctly', () => {
    service.updateIncomeStep(5000);
    service.updateHousingStep(1200);
    service.updateHealthInsuranceStep(300);
    service.updateLeasingCreditStep(400);
    service.updatePhonePlanStep(50);
    service.updateTransportStep(100);
    service.updatePersonalInfoStep('John', 'john@example.com');

    const payload = service.getOnboardingSubmissionPayload();
    const totalExpenses =
      payload.housingCosts +
      payload.healthInsurance +
      payload.leasingCredit +
      payload.phonePlan +
      payload.transportCosts;
    const remainingBudget = payload.monthlyIncome - totalExpenses;
    expect(remainingBudget).toBe(2950);
  });

  it('should return false for incomplete onboarding', () => {
    expect(service.isOnboardingReadyForSubmission()).toBe(false);
  });

  it('should return true for complete onboarding', () => {
    service.updateIncomeStep(5000);
    service.updatePersonalInfoStep('John', 'john@example.com');

    expect(service.isOnboardingReadyForSubmission()).toBe(true);
  });

  it('should handle null values in expense calculation', () => {
    service.updateHousingStep(null);
    service.updateHealthInsuranceStep(300);
    service.updatePersonalInfoStep('John', 'john@example.com');
    service.updateIncomeStep(5000);

    const payload = service.getOnboardingSubmissionPayload();
    expect(payload.housingCosts).toBe(0);
    expect(payload.healthInsurance).toBe(300);
  });

  it('should handle localStorage operations for onboarding data submission', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    service.updateIncomeStep(5000);
    service.updatePersonalInfoStep('John', 'john@example.com');

    service.submitCompletedOnboarding();

    expect(setItemSpy).toHaveBeenCalledWith(
      'pulpe-onboarding-completed',
      'true',
    );
  });

  it('should load onboarding data from localStorage', () => {
    const mockData = {
      monthlyIncome: 5000,
      housingCosts: 1200,
      healthInsurance: 300,
      leasingCredit: 400,
      phonePlan: 50,
      transportCosts: 100,
      firstName: 'John',
      email: 'john@example.com',
    };

    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
      JSON.stringify(mockData),
    );
    const testService = new OnboardingApi();

    expect(testService.onboardingSteps()).toEqual(mockData);
  });

  it('should check onboarding status from localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('true');

    service
      .checkOnboardingCompletionStatus()
      .subscribe((isCompleted: boolean) => {
        expect(isCompleted).toBe(true);
      });
  });

  it('should clear onboarding data', () => {
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

    service.updateIncomeStep(5000);
    service.updatePersonalInfoStep('John', 'john@example.com');

    service.clearOnboardingData();

    const data = service.onboardingSteps();
    expect(data.monthlyIncome).toBeNull();
    expect(data.firstName).toBe('');
    expect(data.email).toBe('');
    expect(removeItemSpy).toHaveBeenCalledWith('pulpe-onboarding-steps');
    expect(removeItemSpy).toHaveBeenCalledWith('pulpe-onboarding-completed');
  });

  it('should throw error when trying to get payload for incomplete onboarding', () => {
    expect(() => service.getOnboardingSubmissionPayload()).toThrow(
      'Onboarding data is incomplete',
    );
  });

  it('should throw error when trying to submit incomplete onboarding', () => {
    expect(() => service.submitCompletedOnboarding()).toThrow(
      'Onboarding data is incomplete',
    );
  });

  it('should handle localStorage errors gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage error');
    });

    service.checkOnboardingCompletionStatus().subscribe({
      error: (error: Error) => {
        expect(error.message).toBe('Unable to check onboarding status');
      },
    });
  });
});
