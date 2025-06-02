import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  OnboardingLayout,
  OnboardingLayoutData,
} from '@features/onboarding/onboarding-layout';
import { OnboardingCurrencyInput } from '@features/onboarding/currency-input';

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
  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Quel est le montant de tes revenus mensuels ?',
    subtitle:
      "Tes revenus mensuels correspondent par exemple à ton salaire, tes rentes, etc. Je vais l'utiliser pour calculer ton budget de base. On pourra le modifier par la suite.",
    currentStep: 2,
    totalSteps: 8,
  };

  protected incomeValue = signal<number | null>(null);

  constructor(private router: Router) {}

  protected canContinue(): boolean {
    return this.incomeValue() !== null && this.incomeValue()! > 0;
  }

  protected onIncomeChange(value: number | null): void {
    this.incomeValue.set(value);
  }

  protected navigateNext(): void {
    this.router.navigate(['/onboarding/housing']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/personal-info']);
  }
}
