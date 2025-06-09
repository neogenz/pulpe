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
  selector: 'pulpe-housing',
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
          label="Montant de ton loyer"
          [value]="housingValue()"
          (valueChange)="onHousingChange($event)"
        />
      </div>
    </pulpe-onboarding-layout>
  `,
})
export default class Housing {
  private readonly router = inject(Router);
  private readonly onboardingApi = inject(OnboardingApi);

  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Logement ?',
    subtitle:
      'Combien payes-tu de loyer ou crédit, pour ton logement chaque mois ?',
    currentStep: 3,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  protected housingValue = signal<number | null>(null);

  constructor() {
    const existingHousing = this.onboardingApi.onboardingSteps().housingCosts;
    if (existingHousing !== null) {
      this.housingValue.set(existingHousing);
    }
  }

  protected canContinue(): boolean {
    return this.housingValue() !== null && this.housingValue()! > 0;
  }

  protected onHousingChange(value: number | null): void {
    this.housingValue.set(value);
  }

  protected navigateNext(): void {
    this.onboardingApi.updateHousingStep(this.housingValue());
    this.router.navigate(['/onboarding/health-insurance']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/income']);
  }
}
