import { Injectable, signal } from '@angular/core';

interface OnboardingData {
  monthlyIncome: number | null;
  housingCosts: number | null;
  healthInsurance: number | null;
  leasingCredit: number | null;
  phonePlan: number | null;
  transportCosts: number | null;
  firstName: string;
  email: string;
}

@Injectable({
  providedIn: 'root',
})
export class OnboardingApi {
  private readonly onboardingDataSignal = signal<OnboardingData>({
    monthlyIncome: null,
    housingCosts: null,
    healthInsurance: null,
    leasingCredit: null,
    phonePlan: null,
    transportCosts: null,
    firstName: '',
    email: '',
  });

  readonly onboardingData = this.onboardingDataSignal.asReadonly();

  updateIncome(amount: number | null): void {
    this.onboardingDataSignal.update((data) => ({
      ...data,
      monthlyIncome: amount,
    }));
  }

  updateHousingCosts(amount: number | null): void {
    this.onboardingDataSignal.update((data) => ({
      ...data,
      housingCosts: amount,
    }));
  }

  updateHealthInsurance(amount: number | null): void {
    this.onboardingDataSignal.update((data) => ({
      ...data,
      healthInsurance: amount,
    }));
  }

  updateLeasingCredit(amount: number | null): void {
    this.onboardingDataSignal.update((data) => ({
      ...data,
      leasingCredit: amount,
    }));
  }

  updatePhonePlan(amount: number | null): void {
    this.onboardingDataSignal.update((data) => ({
      ...data,
      phonePlan: amount,
    }));
  }

  updateTransportCosts(amount: number | null): void {
    this.onboardingDataSignal.update((data) => ({
      ...data,
      transportCosts: amount,
    }));
  }

  updateFirstName(firstName: string): void {
    this.onboardingDataSignal.update((data) => ({
      ...data,
      firstName,
    }));
  }

  updateEmail(email: string): void {
    this.onboardingDataSignal.update((data) => ({
      ...data,
      email,
    }));
  }

  getTotalExpenses(): number {
    const data = this.onboardingData();
    return (
      (data.housingCosts || 0) +
      (data.healthInsurance || 0) +
      (data.leasingCredit || 0) +
      (data.phonePlan || 0) +
      (data.transportCosts || 0)
    );
  }

  getRemainingBudget(): number {
    const income = this.onboardingData().monthlyIncome || 0;
    const expenses = this.getTotalExpenses();
    return income - expenses;
  }

  isOnboardingComplete(): boolean {
    const data = this.onboardingData();
    return !!(data.monthlyIncome && data.firstName.trim() && data.email.trim());
  }
}
