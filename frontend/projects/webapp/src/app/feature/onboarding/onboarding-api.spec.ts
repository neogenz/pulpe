import { describe, beforeEach, it, expect } from 'vitest';
import { OnboardingApi } from './onboarding-api';

describe('OnboardingApi', () => {
  let service: OnboardingApi;

  beforeEach(() => {
    service = new OnboardingApi();
  });

  it('should create service', () => {
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
    service.updateHousingCosts(1500);

    expect(service.onboardingData().housingCosts).toBe(1500);
  });

  it('should update health insurance', () => {
    service.updateHealthInsurance(300);

    expect(service.onboardingData().healthInsurance).toBe(300);
  });

  it('should update leasing credit', () => {
    service.updateLeasingCredit(800);

    expect(service.onboardingData().leasingCredit).toBe(800);
  });

  it('should update phone plan', () => {
    service.updatePhonePlan(50);

    expect(service.onboardingData().phonePlan).toBe(50);
  });

  it('should update transport costs', () => {
    service.updateTransportCosts(200);

    expect(service.onboardingData().transportCosts).toBe(200);
  });

  it('should update first name', () => {
    service.updateFirstName('Maxime');

    expect(service.onboardingData().firstName).toBe('Maxime');
  });

  it('should update email', () => {
    service.updateEmail('maxime@example.com');

    expect(service.onboardingData().email).toBe('maxime@example.com');
  });

  it('should calculate total expenses correctly', () => {
    service.updateHousingCosts(1500);
    service.updateHealthInsurance(300);
    service.updateLeasingCredit(800);
    service.updatePhonePlan(50);
    service.updateTransportCosts(200);

    expect(service.getTotalExpenses()).toBe(2850);
  });

  it('should calculate remaining budget correctly', () => {
    service.updateIncome(5000);
    service.updateHousingCosts(1500);
    service.updateHealthInsurance(300);

    expect(service.getRemainingBudget()).toBe(3200);
  });

  it('should return false for incomplete onboarding', () => {
    expect(service.isOnboardingComplete()).toBe(false);
  });

  it('should return true for complete onboarding', () => {
    service.updateIncome(5000);
    service.updateFirstName('Maxime');
    service.updateEmail('maxime@example.com');

    expect(service.isOnboardingComplete()).toBe(true);
  });

  it('should handle null values in expense calculations', () => {
    service.updateIncome(null);
    service.updateHousingCosts(null);

    expect(service.getTotalExpenses()).toBe(0);
    expect(service.getRemainingBudget()).toBe(0);
  });
});
