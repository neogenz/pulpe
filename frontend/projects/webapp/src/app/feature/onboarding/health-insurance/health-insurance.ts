import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import { OnboardingLayout, OnboardingLayoutData } from '../onboarding-layout';
import { OnboardingCurrencyInput } from '../currency-input';

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
  protected readonly onboardingLayoutData: OnboardingLayoutData = {
    title: 'Assurance maladie ?',
    subtitle: "Combien payes-tu d'assurance maladie chaque mois ?",
    currentStep: 4,
    totalSteps: 8,
  };

  protected healthInsuranceValue = signal<number | null>(null);

  constructor(private router: Router) {}

  protected canContinue(): boolean {
    return (
      this.healthInsuranceValue() !== null && this.healthInsuranceValue()! > 0
    );
  }

  protected onHealthInsuranceChange(value: number | null): void {
    this.healthInsuranceValue.set(value);
  }

  protected navigateNext(): void {
    this.router.navigate(['/onboarding/leasing-credit']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/housing']);
  }
}
