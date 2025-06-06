import { describe, beforeEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { OnboardingApi } from './onboarding-api';
import { UserApi, OnboardingStatus } from '@core/user';

describe('OnboardingApi', () => {
  let service: OnboardingApi;
  let mockUserApi: Partial<UserApi>;
  let mockOnboardingStatus: Partial<OnboardingStatus>;

  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
      () => undefined,
    );

    mockUserApi = {
      markOnboardingCompleted: vi
        .fn()
        .mockReturnValue(of({ success: true, message: 'OK' })),
      getOnboardingStatus: vi
        .fn()
        .mockReturnValue(of({ success: true, onboardingCompleted: false })),
    };

    mockOnboardingStatus = {
      checkOnboardingCompletionStatus: vi.fn().mockReturnValue(of(false)),
      markOnboardingAsCompletedLocally: vi.fn(),
      clearOnboardingStatus: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        OnboardingApi,
        { provide: UserApi, useValue: mockUserApi },
        { provide: OnboardingStatus, useValue: mockOnboardingStatus },
      ],
    });

    service = TestBed.inject(OnboardingApi);
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

    service.submitCompletedOnboarding().subscribe();

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

    // Créer un nouveau TestBed avec la mock configurée
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        OnboardingApi,
        { provide: UserApi, useValue: mockUserApi },
        { provide: OnboardingStatus, useValue: mockOnboardingStatus },
      ],
    });

    const testService = TestBed.inject(OnboardingApi);

    expect(testService.onboardingSteps()).toEqual(mockData);
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
    service.submitCompletedOnboarding().subscribe({
      error: (error) => {
        expect(error.message).toBe('Onboarding data is incomplete');
      },
    });
  });
});
