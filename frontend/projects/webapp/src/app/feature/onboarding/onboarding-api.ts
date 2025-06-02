import { Injectable, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

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

  submitOnboardingData(): Observable<void> {
    // TODO: Replace with HTTP call to backend
    // return this.http.post<void>('/api/onboarding', this.onboardingData())
    const data = this.onboardingData();
    try {
      localStorage.setItem('onboarding-data', JSON.stringify(data));
      localStorage.setItem('onboarding-completed', 'true');
      return of(undefined);
    } catch (error) {
      console.error('Failed to save onboarding data to localStorage:', error);
      return throwError(() => new Error('Unable to save onboarding data'));
    }
  }

  loadOnboardingData(): Observable<OnboardingData | null> {
    // TODO: Replace with HTTP call to backend
    // return this.http.get<OnboardingData>('/api/onboarding').pipe(
    //   tap(data => this.onboardingDataSignal.set(data)),
    //   catchError(() => of(null))
    // )
    try {
      const savedData = localStorage.getItem('onboarding-data');
      if (savedData) {
        const parsedData = JSON.parse(savedData) as OnboardingData;
        this.onboardingDataSignal.set(parsedData);
        return of(parsedData);
      }
      return of(null);
    } catch (error) {
      console.error('Failed to load onboarding data from localStorage:', error);
      return throwError(() => new Error('Unable to load onboarding data'));
    }
  }

  checkOnboardingStatus(): Observable<boolean> {
    // TODO: Replace with HTTP call to backend
    // return this.http.get<{ completed: boolean }>('/api/onboarding/status').pipe(
    //   map(response => response.completed)
    // )
    try {
      const isCompleted =
        localStorage.getItem('onboarding-completed') === 'true';
      return of(isCompleted);
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
      return throwError(() => new Error('Unable to check onboarding status'));
    }
  }
}
