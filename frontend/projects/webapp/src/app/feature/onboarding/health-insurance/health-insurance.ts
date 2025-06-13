import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  OnboardingLayout,
  OnboardingLayoutData,
} from '@features/onboarding/onboarding-layout';
import { OnboardingCurrencyInput } from '@features/onboarding/currency-input';
import { OnboardingApi } from '@features/onboarding/onboarding-api';
import { ONBOARDING_TOTAL_STEPS } from '../onboarding-constants';

@Component({
  selector: 'pulpe-health-insurance',
  standalone: true,
  imports: [OnboardingLayout, OnboardingCurrencyInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-onboarding-layout
      [onboardingLayoutData]="onboardingLayoutData"
      [canContinue]="canContinue()"
      (next)="navigateNext()"
      (previous)="navigatePrevious()"
    >
      <div class="space-y-6">
        <pulpe-onboarding-currency-input
          label="Frais d'assurances maladie"
          [value]="healthInsuranceValue()"
          (valueChange)="onHealthInsuranceChange($event)"
        />
      </div>
    </pulpe-onboarding-layout>
  `,
})
export default class HealthInsurance {
  private readonly router = inject(Router);
  private readonly onboardingApi = inject(OnboardingApi);

  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Assurance maladie ?',
    subtitle: "Combien payes-tu d'assurance maladie chaque mois ?",
    currentStep: 4,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  protected healthInsuranceValue = signal<number | null>(null);

  constructor() {
    const existingHealthInsurance =
      this.onboardingApi.getStateData().healthInsurance;
    if (existingHealthInsurance !== null) {
      this.healthInsuranceValue.set(existingHealthInsurance);
    }
  }

  protected canContinue(): boolean {
    return (
      this.healthInsuranceValue() !== null && this.healthInsuranceValue()! >= 0
    );
  }

  protected onHealthInsuranceChange(value: number | null): void {
    this.healthInsuranceValue.set(value);
  }

  protected navigateNext(): void {
    this.onboardingApi.updateHealthInsuranceStep(this.healthInsuranceValue());
    this.router.navigate(['/onboarding/leasing-credit']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/housing']);
  }
}
