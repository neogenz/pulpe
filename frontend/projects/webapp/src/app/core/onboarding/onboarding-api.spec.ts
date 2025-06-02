import { describe, beforeEach, it, expect, vi } from 'vitest';
import { OnboardingApi } from './onboarding-api';

describe('OnboardingApi', () => {
  let service: OnboardingApi;
  let getItemSpy: any;
  let setItemSpy: any;

  beforeEach(() => {
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    getItemSpy.mockReturnValue(null);
    setItemSpy.mockImplementation(() => undefined);
    service = new OnboardingApi();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with empty onboarding data', () => {
    const data = service.onboardingData();
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
    service.updateIncome(5000);
    expect(service.onboardingData().monthlyIncome).toBe(5000);
  });

  it('should update housing costs', () => {
    service.updateHousingCosts(1200);
    expect(service.onboardingData().housingCosts).toBe(1200);
  });

  it('should update health insurance', () => {
    service.updateHealthInsurance(300);
    expect(service.onboardingData().healthInsurance).toBe(300);
  });

  it('should update leasing credit', () => {
    service.updateLeasingCredit(400);
    expect(service.onboardingData().leasingCredit).toBe(400);
  });

  it('should update phone plan', () => {
    service.updatePhonePlan(50);
    expect(service.onboardingData().phonePlan).toBe(50);
  });

  it('should update transport costs', () => {
    service.updateTransportCosts(100);
    expect(service.onboardingData().transportCosts).toBe(100);
  });

  it('should update first name', () => {
    service.updateFirstName('John');
    expect(service.onboardingData().firstName).toBe('John');
  });

  it('should update email', () => {
    service.updateEmail('john@example.com');
    expect(service.onboardingData().email).toBe('john@example.com');
  });

  it('should calculate total expenses correctly', () => {
    service.updateHousingCosts(1200);
    service.updateHealthInsurance(300);
    service.updateLeasingCredit(400);
    service.updatePhonePlan(50);
    service.updateTransportCosts(100);

    expect(service.getTotalExpenses()).toBe(2050);
  });

  it('should calculate remaining budget correctly', () => {
    service.updateIncome(5000);
    service.updateHousingCosts(1200);
    service.updateHealthInsurance(300);
    service.updateLeasingCredit(400);
    service.updatePhonePlan(50);
    service.updateTransportCosts(100);

    expect(service.getRemainingBudget()).toBe(2950);
  });

  it('should return false for incomplete onboarding', () => {
    expect(service.isOnboardingComplete()).toBe(false);
  });

  it('should return true for complete onboarding', () => {
    service.updateIncome(5000);
    service.updateFirstName('John');
    service.updateEmail('john@example.com');

    expect(service.isOnboardingComplete()).toBe(true);
  });

  it('should handle null values in expense calculation', () => {
    service.updateHousingCosts(null);
    service.updateHealthInsurance(300);

    expect(service.getTotalExpenses()).toBe(300);
  });

  it('should handle localStorage operations for onboarding data submission', () => {
    service.updateIncome(5000);
    service.updateFirstName('John');
    service.updateEmail('john@example.com');

    service.submitOnboardingData().subscribe();

    expect(setItemSpy).toHaveBeenCalledWith(
      'onboarding-data',
      JSON.stringify({
        monthlyIncome: 5000,
        housingCosts: null,
        healthInsurance: null,
        leasingCredit: null,
        phonePlan: null,
        transportCosts: null,
        firstName: 'John',
        email: 'john@example.com',
      }),
    );
    expect(setItemSpy).toHaveBeenCalledWith('onboarding-completed', 'true');
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

    getItemSpy.mockReturnValue(JSON.stringify(mockData));
    const testService = new OnboardingApi();

    testService.loadOnboardingData().subscribe();

    expect(testService.onboardingData()).toEqual(mockData);
  });

  it('should check onboarding status from localStorage', () => {
    getItemSpy.mockReturnValue('true');

    service.checkOnboardingStatus().subscribe((isCompleted) => {
      expect(isCompleted).toBe(true);
    });
  });
});
