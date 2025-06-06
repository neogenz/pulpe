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
import { OnboardingApi } from '@core/onboarding/onboarding-api';
import { ONBOARDING_TOTAL_STEPS } from '../onboarding-constants';

@Component({
  selector: 'pulpe-leasing-credit',
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
          label="Montant de leasing ou crédits"
          [value]="leasingCreditValue()"
          (valueChange)="onLeasingCreditChange($event)"
        />
      </div>
    </pulpe-onboarding-layout>
  `,
})
export default class LeasingCredit {
  private readonly router = inject(Router);
  private readonly onboardingApi = inject(OnboardingApi);

  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Leasing ou crédit à la consommation ?',
    subtitle:
      'Combien payes-tu de leasing ou crédit à la consommation chaque mois ?',
    currentStep: 5,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  protected leasingCreditValue = signal<number | null>(null);

  constructor() {
    const existingLeasingCredit =
      this.onboardingApi.onboardingSteps().leasingCredit;
    if (existingLeasingCredit !== null) {
      this.leasingCreditValue.set(existingLeasingCredit);
    }
  }

  protected canContinue(): boolean {
    return (
      this.leasingCreditValue() !== null && this.leasingCreditValue()! >= 0
    );
  }

  protected onLeasingCreditChange(value: number | null): void {
    this.leasingCreditValue.set(value);
  }

  protected navigateNext(): void {
    this.onboardingApi.updateLeasingCreditStep(this.leasingCreditValue());
    this.router.navigate(['/onboarding/phone-plan']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/health-insurance']);
  }
}
