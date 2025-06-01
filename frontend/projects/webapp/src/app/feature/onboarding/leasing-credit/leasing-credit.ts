import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  OnboardingCardComponent,
  OnboardingCardData,
} from '../onboarding-card';
import { OnboardingCurrencyInputComponent } from '../currency-input';

@Component({
  selector: 'pulpe-leasing-credit',
  standalone: true,
  imports: [OnboardingCardComponent, OnboardingCurrencyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pulpe-onboarding-card
      [cardData]="cardData"
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
    </pulpe-onboarding-card>
  `,
})
export default class LeasingCreditComponent {
  protected readonly cardData: OnboardingCardData = {
    title: 'Leasing ou crédit à la consommation ?',
    subtitle:
      'Combien payes-tu de leasing ou crédit à la consommation chaque mois ?',
    currentStep: 5,
    totalSteps: 8,
  };

  protected leasingCreditValue = signal<number | null>(null);

  constructor(private router: Router) {}

  protected canContinue(): boolean {
    return (
      this.leasingCreditValue() !== null && this.leasingCreditValue()! >= 0
    );
  }

  protected onLeasingCreditChange(value: number | null): void {
    this.leasingCreditValue.set(value);
  }

  protected navigateNext(): void {
    this.router.navigate(['/onboarding/phone-plan']);
  }

  protected navigatePrevious(): void {
    this.router.navigate(['/onboarding/health-insurance']);
  }
}
