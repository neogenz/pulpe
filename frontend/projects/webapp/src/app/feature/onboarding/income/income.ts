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
  selector: 'pulpe-income',
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
          label="Revenus mensuels"
          [value]="incomeValue()"
          (valueChange)="onIncomeChange($event)"
        />
      </div>
    </pulpe-onboarding-layout>
  `,
})
export default class Income {
  private readonly router = inject(Router);
  private readonly onboardingApi = inject(OnboardingApi);

  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Quel est le montant de tes revenus mensuels ?',
    subtitle:
      "Tes revenus mensuels correspondent par exemple à ton salaire, tes rentes, etc. Je vais l'utiliser pour calculer ton budget de base. On pourra le modifier par la suite.",
    currentStep: 2,
    totalSteps: ONBOARDING_TOTAL_STEPS,
  };

  protected incomeValue = signal<number | null>(null);

  constructor() {
    const existingIncome = this.onboardingApi.onboardingSteps().monthlyIncome;
    if (existingIncome !== null) {
      this.incomeValue.set(existingIncome);
    }
  }

  protected canContinue(): boolean {
    return this.incomeValue() !== null && this.incomeValue()! > 0;
  }

  protected onIncomeChange(value: number | null): void {
    this.incomeValue.set(value);
  }

  protected navigateNext(): void {
    this.onboardingApi.updateIncomeStep(this.incomeValue());
    this.router.navigate(['/onboarding/housing']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/personal-info']);
  }
}
