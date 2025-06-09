import { Injectable, signal } from '@angular/core';

export interface OnboardingStepData {
  monthlyIncome: number | null;
  housingCosts: number | null;
  healthInsurance: number | null;
  leasingCredit: number | null;
  phonePlan: number | null;
  transportCosts: number | null;
  firstName: string;
  email: string;
}

const ONBOARDING_STORAGE_KEY = 'pulpe-onboarding-steps';
const ONBOARDING_STATUS_KEY = 'pulpe-onboarding-completed';

@Injectable({
  providedIn: 'root',
})
export class OnboardingApi {
  private readonly onboardingStepsSignal = signal<OnboardingStepData>({
    monthlyIncome: null,
    housingCosts: null,
    healthInsurance: null,
    leasingCredit: null,
    phonePlan: null,
    transportCosts: null,
    firstName: '',
    email: '',
  });

  readonly onboardingSteps = this.onboardingStepsSignal.asReadonly();

  constructor() {
    this.loadStepsFromLocalStorage();
  }

  updateIncomeStep(amount: number | null): void {
    this.updateStepAndSave('monthlyIncome', amount);
  }

  updateHousingStep(amount: number | null): void {
    this.updateStepAndSave('housingCosts', amount);
  }

  updateHealthInsuranceStep(amount: number | null): void {
    this.updateStepAndSave('healthInsurance', amount);
  }

  updateLeasingCreditStep(amount: number | null): void {
    this.updateStepAndSave('leasingCredit', amount);
  }

  updatePhonePlanStep(amount: number | null): void {
    this.updateStepAndSave('phonePlan', amount);
  }

  updateTransportStep(amount: number | null): void {
    this.updateStepAndSave('transportCosts', amount);
  }

  updatePersonalInfoStep(firstName: string, email: string): void {
    this.onboardingStepsSignal.update((steps) => ({
      ...steps,
      firstName,
      email,
    }));
    this.saveStepsToLocalStorage();
  }

  isOnboardingReadyForSubmission(): boolean {
    const steps = this.onboardingSteps();
    return !!(
      steps.monthlyIncome !== null &&
      steps.firstName.trim() &&
      steps.email.trim()
    );
  }

  submitCompletedOnboarding(): void {
    if (!this.isOnboardingReadyForSubmission()) {
      throw new Error('Onboarding data is incomplete');
    }
    this.#markOnboardingAsCompleted();
  }

  clearOnboardingData(): void {
    this.onboardingStepsSignal.set({
      monthlyIncome: null,
      housingCosts: null,
      healthInsurance: null,
      leasingCredit: null,
      phonePlan: null,
      transportCosts: null,
      firstName: '',
      email: '',
    });

    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      localStorage.removeItem(ONBOARDING_STATUS_KEY);
    } catch (error) {
      console.error(
        'Failed to clear onboarding data from localStorage:',
        error,
      );
    }
  }

  private updateStepAndSave(
    field: keyof Pick<
      OnboardingStepData,
      | 'monthlyIncome'
      | 'housingCosts'
      | 'healthInsurance'
      | 'leasingCredit'
      | 'phonePlan'
      | 'transportCosts'
    >,
    amount: number | null,
  ): void {
    this.onboardingStepsSignal.update((steps) => ({
      ...steps,
      [field]: amount,
    }));
    this.saveStepsToLocalStorage();
  }

  private saveStepsToLocalStorage(): void {
    try {
      const stepsData = this.onboardingSteps();
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(stepsData));
    } catch (error) {
      console.error('Failed to save onboarding steps to localStorage:', error);
    }
  }

  private loadStepsFromLocalStorage(): void {
    try {
      const savedSteps = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (savedSteps) {
        const parsedSteps = JSON.parse(savedSteps) as OnboardingStepData;
        this.onboardingStepsSignal.set(parsedSteps);
      }
    } catch (error) {
      console.error(
        'Failed to load onboarding steps from localStorage:',
        error,
      );
    }
  }

  #markOnboardingAsCompleted(): void {
    try {
      localStorage.setItem(ONBOARDING_STATUS_KEY, 'true');
    } catch {
      throw new Error('Failed to mark onboarding as completed');
    }
  }
}
