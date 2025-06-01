import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  OnboardingCardComponent,
  OnboardingCardData,
} from '../../../ui/onboarding-card/onboarding-card';
import { CurrencyInputComponent } from '../../../ui/currency-input/currency-input';

@Component({
  selector: 'pulpe-health-insurance',
  standalone: true,
  imports: [OnboardingCardComponent, CurrencyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-onboarding-card
      [cardData]="cardData"
      [canContinue]="canContinue()"
      (next)="navigateNext()"
      (previous)="navigatePrevious()"
    >
      <div class="space-y-6">
        <pulpe-currency-input
          [value]="healthInsuranceValue()"
          placeholder="Frais d'assurances maladie"
          (valueChange)="onHealthInsuranceChange($event)"
        >
        </pulpe-currency-input>
      </div>
    </pulpe-onboarding-card>
  `,
})
export default class HealthInsuranceComponent {
  protected readonly cardData: OnboardingCardData = {
    title: 'Assurance maladie ?',
    subtitle: "Combien payes-tu d'assurance maladie chaque mois ?",
    currentStep: 3,
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
