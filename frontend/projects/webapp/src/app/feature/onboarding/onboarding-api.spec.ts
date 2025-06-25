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
    const data = service.getStateData();
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
    expect(service.getStateData().monthlyIncome).toBe(5000);
  });

  it('should update housing costs', () => {
    service.updateHousingStep(1200);
    expect(service.getStateData().housingCosts).toBe(1200);
  });

  it('should update health insurance', () => {
    service.updateHealthInsuranceStep(300);
    expect(service.getStateData().healthInsurance).toBe(300);
  });

  it('should update leasing credit', () => {
    service.updateLeasingCreditStep(400);
    expect(service.getStateData().leasingCredit).toBe(400);
  });

  it('should update phone plan', () => {
    service.updatePhonePlanStep(50);
    expect(service.getStateData().phonePlan).toBe(50);
  });

  it('should update transport costs', () => {
    service.updateTransportStep(100);
    expect(service.getStateData().transportCosts).toBe(100);
  });

  it('should update personal info', () => {
    service.updatePersonalInfoStep('John', 'john@example.com');
    const data = service.getStateData();
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

    const data = service.getStateData();
    const totalExpenses =
      (data.housingCosts ?? 0) +
      (data.healthInsurance ?? 0) +
      (data.leasingCredit ?? 0) +
      (data.phonePlan ?? 0) +
      (data.transportCosts ?? 0);
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

    const data = service.getStateData();
    const totalExpenses =
      (data.housingCosts ?? 0) +
      (data.healthInsurance ?? 0) +
      (data.leasingCredit ?? 0) +
      (data.phonePlan ?? 0) +
      (data.transportCosts ?? 0);
    const remainingBudget = (data.monthlyIncome ?? 0) - totalExpenses;
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

    const data = service.getStateData();
    expect(data.housingCosts).toBe(null);
    expect(data.healthInsurance).toBe(300);
  });

  it('should save onboarding steps to localStorage when updating data', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    service.updateIncomeStep(5000);
    service.updatePersonalInfoStep('John', 'john@example.com');

    expect(setItemSpy).toHaveBeenCalledWith(
      'pulpe-onboarding-steps',
      expect.stringContaining('"monthlyIncome":5000'),
    );
    expect(setItemSpy).toHaveBeenCalledWith(
      'pulpe-onboarding-steps',
      expect.stringContaining('"firstName":"John"'),
    );
  });

  it('should mark onboarding as completed when submitting', () => {
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

    expect(testService.getStateData()).toEqual(mockData);
  });

  it('should clear onboarding data', () => {
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

    service.updateIncomeStep(5000);
    service.updatePersonalInfoStep('John', 'john@example.com');

    service.clearOnboardingData();

    const data = service.getStateData();
    expect(data.monthlyIncome).toBeNull();
    expect(data.firstName).toBe('');
    expect(data.email).toBe('');
    expect(removeItemSpy).toHaveBeenCalledWith('pulpe-onboarding-steps');
    expect(removeItemSpy).toHaveBeenCalledWith('pulpe-onboarding-completed');
  });

  it('should throw error when trying to submit incomplete onboarding', () => {
    expect(() => service.submitCompletedOnboarding()).toThrow(
      'Onboarding data is incomplete',
    );
  });
});
